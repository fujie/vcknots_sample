import type { ActivityLogEntry } from '@vcknots-sample/shared';
import { ActivityLogger } from '@vcknots-sample/shared';
import type {
  ParsedCredentialOffer,
  ParsedAuthzRequest,
  StoredCredential,
  DecodedCredential,
} from '../types/wallet.js';
import { OID4Client } from './oid4-client.js';
import { CredentialStorage } from './credential-storage.js';
import { DIDService } from './did-service.js';
import { createProofJwt } from './jwt-proof.js';

/**
 * ウォレット操作の統合サービス。
 * OID4Client、CredentialStorage、DIDService を使用して
 * 資格情報の受信・保存・提示のフローを管理する。
 */
export class WalletService {
  private oid4Client: OID4Client;
  private credentialStorage: CredentialStorage;
  private didService: DIDService;
  private activityLogger: ActivityLogger;

  constructor(
    oid4Client?: OID4Client,
    credentialStorage?: CredentialStorage,
    didService?: DIDService,
    activityLogger?: ActivityLogger,
  ) {
    this.credentialStorage = credentialStorage ?? new CredentialStorage();
    this.oid4Client = oid4Client ?? new OID4Client(this.credentialStorage);
    this.didService = didService ?? new DIDService();
    this.activityLogger = activityLogger ?? new ActivityLogger();
  }

  /**
   * 資格情報オファーの受信と処理。
   * OID4Client を使用してオファーを解析し、発行者メタデータを取得する。
   */
  async receiveOffer(offerUri: string): Promise<ParsedCredentialOffer> {
    try {
      const parsedOffer = this.oid4Client.parseCredentialOffer(offerUri);

      // 発行者メタデータを取得
      const metadata = await this.oid4Client.fetchIssuerMetadata(parsedOffer.issuerUrl);

      const result: ParsedCredentialOffer = {
        ...parsedOffer,
        issuerMetadata: metadata,
      };

      // アクティビティログ記録
      this.logActivity('offer_received', 'success', {
        issuerUrl: parsedOffer.issuerUrl,
        credentialType: parsedOffer.credentialType,
      });

      return result;
    } catch (error) {
      this.logActivity('offer_received', 'failure', {
        offerUri,
      }, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * オファーの受け入れと資格情報取得。
   * Pre-Authorized Code Flow に従ってトークン取得→資格情報取得→保存を実行する。
   */
  async acceptOffer(offer: ParsedCredentialOffer): Promise<StoredCredential> {
    try {
      // DID を取得または生成
      const didInfo = await this.didService.getOrCreateDID();

      // トークンエンドポイントの URL を構築
      const tokenEndpoint = `${offer.issuerUrl.replace(/\/$/, '')}/token`;

      // Pre-Authorized Code でトークンを取得
      const tokenResponse = await this.oid4Client.exchangePreAuthorizedCode(
        tokenEndpoint,
        offer.preAuthorizedCode,
      );

      // 資格情報エンドポイントの URL を構築
      const credentialEndpoint = `${offer.issuerUrl.replace(/\/$/, '')}/credential`;

      // ES256 署名付き proof JWT を生成
      const proofJwt = await createProofJwt({
        issuerUrl: offer.issuerUrl,
        holderDid: didInfo.did,
        publicKeyJwk: didInfo.publicKeyJwk,
        privateKeyJwk: didInfo.privateKeyJwk,
        nonce: tokenResponse.access_token,
      });

      const proof = {
        proof_type: 'jwt',
        jwt: proofJwt,
      };

      // 資格情報を取得
      const jwtVc = await this.oid4Client.fetchCredential(
        credentialEndpoint,
        tokenResponse.access_token,
        proof,
        offer.credentialType,
      );

      // JWT-VC をデコード
      const decoded = this.decodeJwtVc(jwtVc);

      // StoredCredential を作成して保存
      const storedCredential: StoredCredential = {
        id: crypto.randomUUID(),
        rawJwt: jwtVc,
        decoded,
        issuerUrl: offer.issuerUrl,
        receivedAt: new Date().toISOString(),
      };

      this.credentialStorage.save(storedCredential);

      // アクティビティログ記録
      this.logActivity('credential_acquired', 'success', {
        issuerUrl: offer.issuerUrl,
        credentialType: offer.credentialType,
        credentialId: storedCredential.id,
      });

      return storedCredential;
    } catch (error) {
      this.logActivity('credential_acquired', 'failure', {
        issuerUrl: offer.issuerUrl,
        credentialType: offer.credentialType,
      }, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 認可リクエストの受信と処理。
   * 認可リクエストを解析し、一致する資格情報を検索する。
   */
  receiveAuthzRequest(requestUri: string): ParsedAuthzRequest {
    try {
      const parsedRequest = this.oid4Client.parseAuthorizationRequest(requestUri);

      // アクティビティログ記録
      this.logActivity('presentation_submitted', 'success', {
        verifierUrl: parsedRequest.verifierUrl,
        matchingCount: parsedRequest.matchingCredentials.length,
        action: 'authz_request_received',
      });

      return parsedRequest;
    } catch (error) {
      this.logActivity('presentation_submitted', 'failure', {
        requestUri,
        action: 'authz_request_received',
      }, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * 資格情報の提示。
   * VP を生成して検証者に送信する。
   */
  async presentCredentials(
    request: ParsedAuthzRequest,
    selectedCredentials: StoredCredential[],
  ): Promise<void> {
    try {
      const didInfo = await this.didService.getOrCreateDID();

      await this.oid4Client.submitPresentation(
        request.responseUri,
        selectedCredentials,
        didInfo.did,
        { privateKeyJwk: didInfo.privateKeyJwk, publicKeyJwk: didInfo.publicKeyJwk },
        request.nonce,
        request.state,
      );

      // アクティビティログ記録
      this.logActivity('presentation_submitted', 'success', {
        verifierUrl: request.verifierUrl,
        credentialCount: selectedCredentials.length,
        credentialTypes: selectedCredentials.map((c) => c.decoded.type),
      });
    } catch (error) {
      this.logActivity('presentation_submitted', 'failure', {
        verifierUrl: request.verifierUrl,
        credentialCount: selectedCredentials.length,
      }, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * アクティビティログを取得する。
   */
  getActivityLogs(): ActivityLogEntry[] {
    return this.activityLogger.getLogs();
  }

  /**
   * JWT-VC をデコードする。
   * base64url → UTF-8 バイト列 → TextDecoder で正しくマルチバイト文字を処理する。
   */
  private decodeJwtVc(jwtVc: string): DecodedCredential {
    try {
      const parts = jwtVc.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // base64url → UTF-8 文字列にデコード
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const jsonStr = new TextDecoder().decode(bytes);
      const payload = JSON.parse(jsonStr);

      return {
        issuer: payload.iss || payload.vc?.issuer || '',
        type: payload.vc?.type || payload.type || ['VerifiableCredential'],
        credentialSubject: payload.vc?.credentialSubject || payload.credentialSubject || {},
        issuanceDate: payload.vc?.issuanceDate || payload.issuanceDate || (payload.iat
          ? new Date(payload.iat * 1000).toISOString()
          : new Date().toISOString()),
        expirationDate: payload.vc?.expirationDate || payload.expirationDate || (payload.exp
          ? new Date(payload.exp * 1000).toISOString()
          : undefined),
      };
    } catch {
      // デコードに失敗した場合はデフォルト値を返す
      return {
        issuer: '',
        type: ['VerifiableCredential'],
        credentialSubject: {},
        issuanceDate: new Date().toISOString(),
      };
    }
  }

  /**
   * アクティビティログを記録するヘルパー。
   */
  private logActivity(
    action: ActivityLogEntry['action'],
    status: ActivityLogEntry['status'],
    details: Record<string, unknown>,
    errorReason?: string,
  ): void {
    const entry: ActivityLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      component: 'wallet',
      action,
      status,
      details,
      ...(errorReason ? { errorReason } : {}),
    };
    this.activityLogger.log(entry);
  }
}
