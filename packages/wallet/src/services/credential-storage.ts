import type {
  StoredCredential,
  PresentationDefinition,
  FieldConstraint,
} from '../types/wallet.js';

const CREDENTIALS_STORAGE_KEY = 'vcknots-credentials';

/**
 * 資格情報の永続化を行うサービス。
 * localStorage を使用して資格情報を保存・取得・削除する。
 */
export class CredentialStorage {
  /**
   * 資格情報を localStorage に保存する。
   */
  save(credential: StoredCredential): void {
    const credentials = this.getAll();
    // 同じ ID が既に存在する場合は上書き
    const index = credentials.findIndex((c) => c.id === credential.id);
    if (index >= 0) {
      credentials[index] = credential;
    } else {
      credentials.push(credential);
    }
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
  }

  /**
   * 全資格情報を取得する。
   */
  getAll(): StoredCredential[] {
    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as StoredCredential[];
  }

  /**
   * ID で資格情報を取得する。
   */
  getById(id: string): StoredCredential | null {
    const credentials = this.getAll();
    return credentials.find((c) => c.id === id) ?? null;
  }

  /**
   * 資格情報を削除する。
   */
  delete(id: string): void {
    const credentials = this.getAll();
    const filtered = credentials.filter((c) => c.id !== id);
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * Presentation Exchange の input_descriptors の制約条件に基づいて
   * 一致する資格情報を検索する。
   */
  findMatching(presentationDefinition: PresentationDefinition): StoredCredential[] {
    const credentials = this.getAll();

    return credentials.filter((credential) => {
      // すべての input_descriptors のうち少なくとも1つを満たす
      return presentationDefinition.input_descriptors.some((descriptor) => {
        return this.matchesDescriptor(credential, descriptor.constraints.fields);
      });
    });
  }

  /**
   * 資格情報が指定されたフィールド制約をすべて満たすかチェックする。
   */
  private matchesDescriptor(
    credential: StoredCredential,
    fields: FieldConstraint[],
  ): boolean {
    return fields.every((field) => {
      return this.matchesFieldConstraint(credential, field);
    });
  }

  /**
   * 資格情報が単一のフィールド制約を満たすかチェックする。
   */
  private matchesFieldConstraint(
    credential: StoredCredential,
    field: FieldConstraint,
  ): boolean {
    // path 配列のいずれかのパスで値が取得できればOK
    for (const path of field.path) {
      const value = this.resolveJsonPath(credential, path);
      if (value === undefined) {
        continue;
      }

      // フィルターが指定されていない場合は値が存在すればマッチ
      if (!field.filter) {
        return true;
      }

      // フィルター条件のチェック
      if (field.filter.pattern) {
        const regex = new RegExp(field.filter.pattern);
        if (typeof value === 'string' && regex.test(value)) {
          return true;
        }
      }

      if (field.filter.contains) {
        if (Array.isArray(value) && value.includes(field.filter.contains.const)) {
          return true;
        }
      }

      // type が "string" でパターンなしの場合、値が存在すればマッチ
      if (field.filter.type === 'string' && typeof value === 'string' && !field.filter.pattern) {
        return true;
      }

      // type が "array" で contains がある場合は上で処理済み
      // それ以外の type チェック
      if (field.filter.type === 'array' && Array.isArray(value) && !field.filter.contains) {
        return true;
      }
    }

    return false;
  }

  /**
   * 簡易的な JSONPath 解決。
   * サポートするパス形式: $.type, $.credentialSubject.name など
   */
  private resolveJsonPath(credential: StoredCredential, path: string): unknown {
    if (!path.startsWith('$.')) {
      return undefined;
    }

    const parts = path.slice(2).split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = credential.decoded;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}
