import type { CredentialSchema } from '@vcknots-sample/shared';

const STORAGE_KEY = 'vcknots-schemas';

/**
 * スキーマストレージサービス
 *
 * ブラウザの localStorage を使用してスキーマの CRUD 操作を提供する。
 * Admin Panel はクライアントサイド SPA のため、localStorage をストレージとして使用する。
 * Issuer Server は data/schemas.json を参照する（別途同期メカニズムで対応）。
 */
export class SchemaStorage {
  /**
   * スキーマを保存する
   */
  async save(schema: CredentialSchema): Promise<void> {
    const schemas = await this.getAll();
    schemas.push(schema);
    this.persist(schemas);
  }

  /**
   * 全スキーマを取得する
   */
  async getAll(): Promise<CredentialSchema[]> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw) as CredentialSchema[];
    } catch {
      return [];
    }
  }

  /**
   * ID でスキーマを取得する
   */
  async getById(id: string): Promise<CredentialSchema | null> {
    const schemas = await this.getAll();
    return schemas.find((s) => s.id === id) ?? null;
  }

  /**
   * スキーマを更新する
   */
  async update(id: string, schema: CredentialSchema): Promise<void> {
    const schemas = await this.getAll();
    const index = schemas.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Schema with id "${id}" not found`);
    }
    schemas[index] = schema;
    this.persist(schemas);
  }

  /**
   * スキーマを削除する
   */
  async delete(id: string): Promise<void> {
    const schemas = await this.getAll();
    const filtered = schemas.filter((s) => s.id !== id);
    this.persist(filtered);
  }

  /**
   * localStorage にスキーマ配列を永続化する
   */
  private persist(schemas: CredentialSchema[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas));
  }
}
