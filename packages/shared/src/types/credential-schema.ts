/**
 * 属性の型定義
 */
export type AttributeType = 'string' | 'number' | 'date' | 'boolean';

/**
 * スキーマ属性の定義
 */
export interface SchemaAttribute {
  /** 属性名（例: "degree", "gpa"） */
  name: string;
  /** 属性の型 */
  type: AttributeType;
  /** 必須フラグ */
  required: boolean;
  /** 属性の説明 */
  description?: string;
}

/**
 * 資格情報スキーマの定義
 */
export interface CredentialSchema {
  /** UUID */
  id: string;
  /** スキーマ名（例: "UniversityDegree"） */
  name: string;
  /** バージョン（例: "1.0"） */
  version: string;
  /** 属性定義の配列 */
  attributes: SchemaAttribute[];
  /** ISO 8601 タイムスタンプ */
  createdAt: string;
  /** ISO 8601 タイムスタンプ */
  updatedAt: string;
}

/**
 * バリデーションエラー
 */
export interface ValidationError {
  /** エラーが発生したフィールド名 */
  field: string;
  /** エラーメッセージ */
  message: string;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
