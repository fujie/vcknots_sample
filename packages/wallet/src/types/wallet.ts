/**
 * ウォレット固有の型定義
 */

/**
 * デコード済みの資格情報内容
 */
export interface DecodedCredential {
  /** 発行者 DID */
  issuer: string;
  /** 資格情報タイプ（例: ["VerifiableCredential", "UniversityDegree"]） */
  type: string[];
  /** 資格情報の属性値 */
  credentialSubject: Record<string, unknown>;
  /** 発行日（ISO 8601） */
  issuanceDate: string;
  /** 有効期限（ISO 8601、オプション） */
  expirationDate?: string;
}

/**
 * 保存済み資格情報
 */
export interface StoredCredential {
  /** UUID（ウォレット内部 ID） */
  id: string;
  /** JWT-VC の生データ */
  rawJwt: string;
  /** デコード済みの資格情報内容 */
  decoded: DecodedCredential;
  /** 発行者の URL */
  issuerUrl: string;
  /** 受信日時（ISO 8601） */
  receivedAt: string;
}

/**
 * 解析済み Credential Offer
 */
export interface ParsedCredentialOffer {
  /** 発行者 URL */
  issuerUrl: string;
  /** 資格情報タイプ */
  credentialType: string;
  /** Pre-Authorized Code */
  preAuthorizedCode: string;
  /** 発行者メタデータ */
  issuerMetadata: object;
}

/**
 * トークンレスポンス
 */
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in?: number;
  c_nonce?: string;
  c_nonce_expires_in?: number;
}

/**
 * フィールド制約
 */
export interface FieldConstraint {
  /** JSONPath（例: ["$.type"]） */
  path: string[];
  /** フィルター条件 */
  filter?: {
    type: string;
    pattern?: string;
    contains?: { const: string };
  };
}

/**
 * Input Descriptor
 */
export interface InputDescriptor {
  id: string;
  name?: string;
  purpose?: string;
  constraints: {
    fields: FieldConstraint[];
  };
}

/**
 * Presentation Definition
 */
export interface PresentationDefinition {
  id: string;
  input_descriptors: InputDescriptor[];
}

/**
 * 解析済み認可リクエスト
 */
export interface ParsedAuthzRequest {
  /** 検証者 URL */
  verifierUrl: string;
  /** レスポンス送信先 URI */
  responseUri: string;
  /** ノンス */
  nonce: string;
  /** state パラメータ */
  state?: string;
  /** 要求条件 */
  presentationDefinition: PresentationDefinition;
  /** 一致する保存済み資格情報 */
  matchingCredentials: StoredCredential[];
}

/**
 * DID 情報
 */
export interface DIDInfo {
  /** DID 文字列 */
  did: string;
  /** 鍵ペア（JWK 形式で保存） */
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
}
