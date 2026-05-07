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
   * 認可リクエスト URI を解析する。
   * インライン形式と request_uri 形式（JAR）の両方をサポートする。
   */
  async parseAuthorizationRequest(uri: string): Promise<ParsedAuthzRequest> {
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
    const clientId = params.get('client_id') ?? '';

    // request_uri 形式の場合 — JAR を fetch してデコードする
    const requestUri = params.get('request_uri');
    if (requestUri) {
      return await this.resolveRequestUri(requestUri, clientId);
    }

    // インライン形式の場合
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

    const matchingCredentials = this.credentialStorage.findMatching(presentationDefinition);
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
   * request_uri を fetch して JAR (JWT-Secured Authorization Request) をデコードする。
   */
  private async resolveRequestUri(requestUri: string, clientId: string): Promise<ParsedAuthzRequest> {
    const response = await fetch(requestUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch request object: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    let requestObject: Record<string, unknown>;

    if (contentType.includes('application/json')) {
      // JSON 形式のリクエストオブジェクト
      requestObject = await response.json();
    } else {
      // JWT 形式のリクエストオブジェクト — ペイロードをデコード
      const jwt = await response.text();
      const parts = jwt.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid request object JWT format');
      }
      const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      requestObject = JSON.parse(new TextDecoder().decode(bytes));
    }

    // リクエストオブジェクトからパラメータを抽出
    const responseUri = (requestObject.response_uri as string)
      ?? (requestObject.redirect_uri as string)
      ?? '';
    const nonce = (requestObject.nonce as string) ?? '';
    const state = (requestObject.state as string) ?? undefined;

    // presentation_definition を取得
    let presentationDefinition: PresentationDefinition;
    if (requestObject.presentation_definition) {
      presentationDefinition = requestObject.presentation_definition as PresentationDefinition;
    } else if (requestObject.claims && (requestObject.claims as any).vp_token?.presentation_definition) {
      presentationDefinition = (requestObject.claims as any).vp_token.presentation_definition;
    } else {
      presentationDefinition = { id: '', input_descriptors: [] };
    }

    const matchingCredentials = this.credentialStorage.findMatching(presentationDefinition);

    return {
      verifierUrl: clientId || (requestObject.client_id as string) || '',
      responseUri,
      nonce,
      state,
      presentationDefinition,
      matchingCredentials,
    };
  }

  /**
   * VP を JWT-VP 形式で生成して検証者に送信する。
   * OID4VP 仕様に準拠した jwt_vp_json フォーマット。
   */
  async submitPresentation(
    responseUri: string,
    credentials: StoredCredential[],
    did: string,
    keyPair: { privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey },
    nonce: string,
    state?: string,
    presentationDefinition?: PresentationDefinition,
    clientId?: string,
  ): Promise<void> {
    // JWT-VP ペイロードを構築
    // OID4VP 仕様: aud には client_id を設定する
    const vpPayload = {
      iss: did,
      aud: clientId || responseUri,
      nonce,
      iat: Math.floor(Date.now() / 1000),
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: credentials.map((c) => c.rawJwt),
      },
    };

    // JWT-VP ヘッダー
    // did:key の場合、フラグメントは did:key: プレフィックスを除いた部分
    const fragment = did.replace(/^did:key:/, '');
    const vpHeader = {
      alg: 'ES256',
      typ: 'JWT',
      kid: `${did}#${fragment}`,
    };

    // ES256 署名
    const headerB64 = this.strToBase64url(JSON.stringify(vpHeader));
    const payloadB64 = this.strToBase64url(JSON.stringify(vpPayload));
    const signingInput = `${headerB64}.${payloadB64}`;

    const privateKey = await crypto.subtle.importKey(
      'jwk',
      keyPair.privateKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );

    const signatureBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(signingInput),
    );

    const signatureB64 = this.base64urlEncode(new Uint8Array(signatureBuffer));
    const vpToken = `${signingInput}.${signatureB64}`;

    // Presentation Submission（OID4VP 仕様準拠）
    const definitionId = presentationDefinition?.id ?? 'presentation-request';
    const inputDescriptors = presentationDefinition?.input_descriptors ?? [];

    const presentationSubmission = {
      id: crypto.randomUUID(),
      definition_id: definitionId,
      descriptor_map: credentials.map((_c, index) => {
        const descriptorId = inputDescriptors[index]?.id ?? `descriptor-${index}`;
        return {
          id: descriptorId,
          format: 'jwt_vp_json',
          path: '$',
          path_nested: {
            id: descriptorId,
            format: 'jwt_vc_json',
            path: `$.vp.verifiableCredential[${index}]`,
          },
        };
      }),
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

  private base64urlEncode(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private strToBase64url(str: string): string {
    return this.base64urlEncode(new TextEncoder().encode(str));
  }
}
