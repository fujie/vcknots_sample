import type {
  ParsedCredentialOffer,
  ParsedAuthzRequest,
  TokenResponse,
  StoredCredential,
  PresentationDefinition,
} from '../types/wallet.js';
import { CredentialStorage } from './credential-storage.js';

/**
 * OID4VCI/OID4VP クライアントロジック。
 * Credential Offer URI の解析、発行者メタデータの取得、
 * トークン交換、資格情報取得、認可リクエスト解析、プレゼンテーション送信を行う。
 */
export class OID4Client {
  private credentialStorage: CredentialStorage;

  constructor(credentialStorage?: CredentialStorage) {
    this.credentialStorage = credentialStorage ?? new CredentialStorage();
  }

  /**
   * Credential Offer URI を解析し、発行者 URL・資格情報タイプ・Pre-Authorized Code を抽出する。
   * URI 形式: openid-credential-offer://?credential_offer=<JSON-encoded-offer>
   */
  parseCredentialOffer(uri: string): ParsedCredentialOffer {
    if (!uri || typeof uri !== 'string') {
      throw new Error('Invalid Credential Offer URI: URI is empty or not a string');
    }

    // URI スキームのチェック
    if (!uri.startsWith('openid-credential-offer://')) {
      throw new Error('Invalid Credential Offer URI: must start with openid-credential-offer://');
    }

    const queryStart = uri.indexOf('?');
    if (queryStart === -1) {
      throw new Error('Invalid Credential Offer URI: missing query parameters');
    }

    const queryString = uri.slice(queryStart + 1);
    const params = new URLSearchParams(queryString);
    const credentialOfferParam = params.get('credential_offer');

    if (!credentialOfferParam) {
      throw new Error('Invalid Credential Offer URI: missing credential_offer parameter');
    }

    let offer: {
      credential_issuer?: string;
      credential_configuration_ids?: string[];
      grants?: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code'?: {
          'pre-authorized_code'?: string;
        };
      };
    };

    try {
      offer = JSON.parse(credentialOfferParam);
    } catch {
      throw new Error('Invalid Credential Offer URI: credential_offer is not valid JSON');
    }

    if (!offer.credential_issuer) {
      throw new Error('Invalid Credential Offer: missing credential_issuer');
    }

    if (!offer.credential_configuration_ids || offer.credential_configuration_ids.length === 0) {
      throw new Error('Invalid Credential Offer: missing credential_configuration_ids');
    }

    const preAuthGrant = offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code'];
    if (!preAuthGrant?.['pre-authorized_code']) {
      throw new Error('Invalid Credential Offer: missing pre-authorized_code');
    }

    return {
      issuerUrl: offer.credential_issuer,
      credentialType: offer.credential_configuration_ids[0],
      preAuthorizedCode: preAuthGrant['pre-authorized_code'],
      issuerMetadata: {},
    };
  }

  /**
   * 発行者の /.well-known/openid-credential-issuer からメタデータを取得する。
   */
  async fetchIssuerMetadata(issuerUrl: string): Promise<object> {
    const metadataUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-credential-issuer`;
    const response = await fetch(metadataUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch issuer metadata: HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * トークンエンドポイントに Pre-Authorized Code を送信しアクセストークンを取得する。
   */
  async exchangePreAuthorizedCode(
    tokenEndpoint: string,
    code: string,
  ): Promise<TokenResponse> {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        'pre-authorized_code': code,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        `Token exchange failed: ${(errorBody as { error?: string }).error || `HTTP ${response.status}`}`,
      );
    }

    return await response.json() as TokenResponse;
  }

  /**
   * 資格情報エンドポイントにアクセストークンと proof を送信し JWT-VC を取得する。
   */
  async fetchCredential(
    credentialEndpoint: string,
    accessToken: string,
    proof: object,
    credentialType?: string,
  ): Promise<string> {
    // OID4VCI CredentialRequest 形式でリクエストを構築
    const body: Record<string, unknown> = {
      format: 'jwt_vc_json',
      proof,
    };
    if (credentialType) {
      body.credential_definition = {
        type: ['VerifiableCredential', credentialType],
      };
    }

    const response = await fetch(credentialEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        `Credential fetch failed: ${(errorBody as { error?: string }).error || `HTTP ${response.status}`}`,
      );
    }

    const result = await response.json() as { credential: string };
    return result.credential;
  }

  /**
   * 認可リクエスト URI を解析し、検証者 URL・レスポンス URI・ノンス・PresentationDefinition を抽出する。
   * URI 形式: openid4vp://?client_id=<id>&response_uri=<uri>&nonce=<nonce>&presentation_definition=<JSON>
   * または: openid4vp://?request_uri=<encoded-uri>
   */
  parseAuthorizationRequest(uri: string): ParsedAuthzRequest {
    if (!uri || typeof uri !== 'string') {
      throw new Error('Invalid Authorization Request URI: URI is empty or not a string');
    }

    if (!uri.startsWith('openid4vp://')) {
      throw new Error('Invalid Authorization Request URI: must start with openid4vp://');
    }

    const queryStart = uri.indexOf('?');
    if (queryStart === -1) {
      throw new Error('Invalid Authorization Request URI: missing query parameters');
    }

    const queryString = uri.slice(queryStart + 1);
    const params = new URLSearchParams(queryString);

    // request_uri 形式の場合
    const requestUri = params.get('request_uri');
    if (requestUri) {
      // request_uri の場合は後で解決する必要があるが、
      // ここでは基本的なパース結果を返す
      return {
        verifierUrl: requestUri,
        responseUri: requestUri,
        nonce: '',
        presentationDefinition: { id: '', input_descriptors: [] },
        matchingCredentials: [],
      };
    }

    // インライン形式の場合
    const clientId = params.get('client_id');
    const responseUri = params.get('response_uri');
    const nonce = params.get('nonce');
    const presentationDefinitionParam = params.get('presentation_definition');

    if (!clientId) {
      throw new Error('Invalid Authorization Request: missing client_id');
    }

    if (!responseUri) {
      throw new Error('Invalid Authorization Request: missing response_uri');
    }

    if (!nonce) {
      throw new Error('Invalid Authorization Request: missing nonce');
    }

    if (!presentationDefinitionParam) {
      throw new Error('Invalid Authorization Request: missing presentation_definition');
    }

    let presentationDefinition: PresentationDefinition;
    try {
      presentationDefinition = JSON.parse(presentationDefinitionParam);
    } catch {
      throw new Error('Invalid Authorization Request: presentation_definition is not valid JSON');
    }

    // 一致する資格情報を検索
    const matchingCredentials = this.credentialStorage.findMatching(presentationDefinition);

    // state パラメータを取得
    const state = params.get('state') ?? undefined;

    return {
      verifierUrl: clientId,
      responseUri,
      nonce,
      state,
      presentationDefinition,
      matchingCredentials,
    };
  }

  /**
   * VP を生成して検証者に送信する。
   */
  async submitPresentation(
    responseUri: string,
    credentials: StoredCredential[],
    did: string,
    _keyPair: { privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey },
    nonce: string,
    state?: string,
  ): Promise<void> {
    // 簡易的な VP Token の生成（プロトタイプ）
    const vpToken = JSON.stringify({
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: did,
      verifiableCredential: credentials.map((c) => c.rawJwt),
      nonce,
    });

    const presentationSubmission = {
      id: crypto.randomUUID(),
      definition_id: 'presentation-request',
      descriptor_map: credentials.map((c, index) => ({
        id: `descriptor-${index}`,
        format: 'jwt_vp',
        path: `$.verifiableCredential[${index}]`,
      })),
    };

    const params: Record<string, string> = {
      vp_token: vpToken,
      presentation_submission: JSON.stringify(presentationSubmission),
    };
    if (state) {
      params.state = state;
    }

    const response = await fetch(responseUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        `Presentation submission failed: ${(errorBody as { error?: string }).error || `HTTP ${response.status}`}`,
      );
    }
  }
}
