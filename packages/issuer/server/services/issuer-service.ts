import { randomUUID } from 'node:crypto';
import {
  CredentialIssuer,
  CredentialConfigurationId,
  CredentialIssuerMetadata,
  type CredentialOffer,
  type CredentialRequest,
  type TokenResponse,
  type IssuerFlow,
} from '@trustknots/vcknots';
import { ActivityLogger } from '@vcknots-sample/shared';
import { issuer as defaultIssuer } from '../vcknots-setup.js';
import { SchemaService } from './schema-service.js';

const ISSUER_URL = 'http://localhost:4001';

/** オファーに紐づくデータ */
interface OfferData {
  credentialType: string;
  claims: Record<string, unknown>;
  createdAt: string;
}

/** アクセストークンに紐づくデータ */
interface TokenData {
  credentialType: string;
  claims: Record<string, unknown>;
  preAuthorizedCode: string;
  createdAt: string;
}

/**
 * 発行者サービス — 発行ロジックのオーケストレーション
 */
export class IssuerService {
  private readonly schemaService: SchemaService;
  private readonly activityLogger: ActivityLogger;
  private readonly issuer: IssuerFlow;

  /** Pre-Authorized Code → オファーデータのマッピング */
  private readonly offerStore = new Map<string, OfferData>();

  /** アクセストークン → トークンデータのマッピング */
  private readonly tokenStore = new Map<string, TokenData>();

  /** 発行者 ID (branded type) */
  private readonly issuerId: ReturnType<typeof CredentialIssuer>;

  private initialized = false;

  constructor(schemaService: SchemaService, activityLogger: ActivityLogger, issuerFlow?: IssuerFlow) {
    this.schemaService = schemaService;
    this.activityLogger = activityLogger;
    this.issuer = issuerFlow ?? defaultIssuer;
    this.issuerId = CredentialIssuer(ISSUER_URL);
  }

  /**
   * 初期化 — 発行者メタデータを登録する（スキーマに基づく）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // スキーマからクレデンシャル設定を構築
      const schemas = await this.schemaService.listSchemas();
      const configurations: Record<string, any> = {};

      for (const schema of schemas) {
        configurations[schema.name] = {
          format: 'jwt_vc_json',
          credential_signing_alg_values_supported: ['ES256'],
          credential_definition: {
            type: ['VerifiableCredential', schema.name],
            credentialSubject: Object.fromEntries(
              schema.attributes.map((attr) => [
                attr.name,
                { mandatory: attr.required, value_type: attr.type },
              ]),
            ),
          },
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ['ES256'],
            },
          },
        };
      }

      // スキーマがない場合でもデフォルト設定を含める
      if (Object.keys(configurations).length === 0) {
        configurations['VerifiableCredential'] = {
          format: 'jwt_vc_json',
          credential_signing_alg_values_supported: ['ES256'],
          credential_definition: {
            type: ['VerifiableCredential'],
          },
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ['ES256'],
            },
          },
        };
      }

      const metadata = CredentialIssuerMetadata({
        credential_issuer: ISSUER_URL,
        credential_endpoint: `${ISSUER_URL}/credential`,
        credential_configurations_supported: configurations,
      });

      await this.issuer.createIssuerMetadata(metadata);
    } catch (err) {
      // メタデータが既に登録されている場合は無視する
      if (!(err as Error).message?.includes('already registered')) {
        throw err;
      }
    }

    this.initialized = true;
  }

  /**
   * メタデータ取得 — issuer.findIssuerMetadata() をラップ
   */
  async getMetadata(): Promise<CredentialIssuerMetadata> {
    const metadata = await this.issuer.findIssuerMetadata(this.issuerId);
    if (!metadata) {
      // メタデータが未登録の場合、動的に構築して返す
      const schemas = await this.schemaService.listSchemas();
      const configurations: Record<string, unknown> = {};

      for (const schema of schemas) {
        configurations[schema.name] = {
          format: 'jwt_vc_json',
          credential_signing_alg_values_supported: ['ES256'],
          credential_definition: {
            type: ['VerifiableCredential', schema.name],
            credentialSubject: Object.fromEntries(
              schema.attributes.map((attr) => [
                attr.name,
                { mandatory: attr.required, value_type: attr.type },
              ]),
            ),
          },
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ['ES256'],
            },
          },
        };
      }

      return CredentialIssuerMetadata({
        credential_issuer: ISSUER_URL,
        credential_endpoint: `${ISSUER_URL}/credential`,
        credential_configurations_supported: configurations as any,
      });
    }
    return metadata;
  }

  /**
   * オファー生成 — スキーマ存在チェック後に issuer.offerCredential() を呼び出す
   */
  async createOffer(
    credentialType: string,
    claims: Record<string, unknown>,
  ): Promise<CredentialOffer> {
    // スキーマ存在チェック (要件 2.5)
    const schema = await this.schemaService.getSchema(credentialType);
    if (!schema) {
      this.activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'issuance_failed',
        status: 'failure',
        details: { credentialType },
        errorReason: `Schema not found for credential type: ${credentialType}`,
      });
      throw new Error(`Schema not found for credential type: ${credentialType}`);
    }

    // vcknots issuer を使用してオファーを生成
    const configurationId = CredentialConfigurationId(credentialType);
    const offer = await this.issuer.offerCredential(
      this.issuerId,
      [configurationId],
      { usePreAuth: true },
    );

    // Pre-Authorized Code を取得してストアに保存
    const preAuthCode =
      offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.[
        'pre-authorized_code'
      ];

    if (preAuthCode) {
      this.offerStore.set(preAuthCode, {
        credentialType,
        claims,
        createdAt: new Date().toISOString(),
      });
    }

    // アクティビティログ記録 (要件 19.1)
    this.activityLogger.log({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      component: 'issuer',
      action: 'offer_created',
      status: 'success',
      details: {
        credentialType,
        preAuthorizedCode: preAuthCode,
      },
    });

    return offer;
  }

  /**
   * トークン交換 — Pre-Authorized Code を検証しアクセストークンを返す
   */
  async exchangeToken(preAuthorizedCode: string): Promise<TokenResponse> {
    // Pre-Authorized Code の検証
    const offerData = this.offerStore.get(preAuthorizedCode);
    if (!offerData) {
      this.activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'issuance_failed',
        status: 'failure',
        details: { preAuthorizedCode },
        errorReason: 'Invalid pre-authorized code',
      });
      const error = new Error('The pre-authorized code is invalid or has expired.');
      (error as any).errorCode = 'invalid_grant';
      (error as any).statusCode = 400;
      throw error;
    }

    // コードを使用済みにする（一度だけ使用可能）
    this.offerStore.delete(preAuthorizedCode);

    // アクセストークンを生成
    const accessToken = randomUUID();
    this.tokenStore.set(accessToken, {
      credentialType: offerData.credentialType,
      claims: offerData.claims,
      preAuthorizedCode: preAuthorizedCode,
      createdAt: new Date().toISOString(),
    });

    // c_nonce を生成（OID4VCI 仕様準拠）
    const cNonce = randomUUID();

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 86400,
      c_nonce: cNonce,
      c_nonce_expires_in: 86400,
    };
  }

  /**
   * 資格情報発行 — issuer.issueCredential() をラップ
   */
  async issueCredential(
    accessToken: string,
    proof: object,
    requestOptions?: { format?: string; credential_definition?: { type: string[] } },
  ): Promise<string> {
    // アクセストークンの検証
    const tokenData = this.tokenStore.get(accessToken);
    if (!tokenData) {
      this.activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'issuance_failed',
        status: 'failure',
        details: {},
        errorReason: 'Invalid or expired access token',
      });
      const error = new Error('The access token is invalid or has expired.');
      (error as any).errorCode = 'invalid_token';
      (error as any).statusCode = 401;
      throw error;
    }

    // トークンを使用済みにする
    this.tokenStore.delete(accessToken);

    try {
      // vcknots issuer を使用して JWT-VC を発行
      const credentialRequest: CredentialRequest = {
        format: 'jwt_vc_json' as any,
        credential_definition: {
          type: ['VerifiableCredential', tokenData.credentialType],
        },
        proof: proof as any,
      };

      const response = await this.issuer.issueCredential(
        this.issuerId,
        credentialRequest,
        {
          alg: 'ES256',
          claims: tokenData.claims,
        },
      );

      const credential = Array.isArray(response.credential)
        ? response.credential[0]
        : response.credential;

      if (!credential) {
        throw new Error('No credential returned from issuer');
      }

      // アクティビティログ記録 (要件 19.2)
      this.activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'credential_issued',
        status: 'success',
        details: {
          credentialType: tokenData.credentialType,
          claims: tokenData.claims,
          preAuthorizedCode: tokenData.preAuthorizedCode,
        },
      });

      return credential;
    } catch (err) {
      // 既にカスタムエラーの場合はそのまま再スロー
      if ((err as any).errorCode) {
        throw err;
      }

      // アクティビティログ記録 (要件 19.3)
      this.activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'issuance_failed',
        status: 'failure',
        details: { credentialType: tokenData.credentialType },
        errorReason: (err as Error).message,
      });

      throw err;
    }
  }

  /**
   * オファーストアの内容を取得（テスト・デバッグ用）
   */
  getOfferStore(): Map<string, OfferData> {
    return this.offerStore;
  }

  /**
   * トークンストアの内容を取得（テスト・デバッグ用）
   */
  getTokenStore(): Map<string, TokenData> {
    return this.tokenStore;
  }

  /**
   * アクセストークンに紐づく Pre-Authorized Code を取得する
   */
  getPreAuthCodeForToken(accessToken: string): string | undefined {
    return this.tokenStore.get(accessToken)?.preAuthorizedCode;
  }
}
