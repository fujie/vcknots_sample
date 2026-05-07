/**
 * アクティビティの操作種別
 */
export type ActivityAction =
  | 'offer_created'           // 資格情報オファー作成（発行者）
  | 'credential_issued'       // 資格情報発行完了（発行者）
  | 'issuance_failed'         // 発行処理失敗（発行者）
  | 'offer_received'          // オファー受信（ウォレット）
  | 'credential_acquired'     // 資格情報取得完了（ウォレット）
  | 'presentation_submitted'  // プレゼンテーション提出（ウォレット）
  | 'authz_request_created'   // 認可リクエスト作成（検証者）
  | 'presentation_received'   // プレゼンテーション受信（検証者）
  | 'verification_completed'; // 検証完了（検証者）

/**
 * アクティビティログエントリ
 */
export interface ActivityLogEntry {
  /** UUID */
  id: string;
  /** ISO 8601 タイムスタンプ */
  timestamp: string;
  /** コンポーネント種別 */
  component: 'issuer' | 'verifier' | 'wallet';
  /** 操作種別 */
  action: ActivityAction;
  /** 操作結果 */
  status: 'success' | 'failure';
  /** 操作の詳細情報 */
  details: Record<string, unknown>;
  /** エラー理由（失敗時のみ） */
  errorReason?: string;
}
