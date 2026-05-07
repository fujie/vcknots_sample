import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CredentialSchema } from '@vcknots-sample/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * スキーマサービス — data/schemas.json からスキーマを参照する
 */
export class SchemaService {
  private readonly schemasPath: string;

  constructor(schemasPath?: string) {
    // デフォルトはモノレポルートの data/schemas.json を参照
    this.schemasPath = schemasPath ?? resolve(__dirname, '../../../../data/schemas.json');
  }

  /**
   * 資格情報タイプ名でスキーマを取得する
   */
  async getSchema(credentialType: string): Promise<CredentialSchema | null> {
    const schemas = await this.listSchemas();
    return schemas.find((s) => s.name === credentialType) ?? null;
  }

  /**
   * 利用可能なスキーマ一覧を取得する
   */
  async listSchemas(): Promise<CredentialSchema[]> {
    try {
      const content = await readFile(this.schemasPath, 'utf-8');
      return JSON.parse(content) as CredentialSchema[];
    } catch {
      return [];
    }
  }
}
