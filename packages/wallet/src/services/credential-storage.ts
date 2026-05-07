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
   * JSONPath 解決。
   * JWT-VC ペイロード全体をルートとするパス（$.vc.type 等）と
   * デコード済み credential をルートとするパス（$.type 等）の両方に対応する。
   * SD-JWT-VC の $.vct にも対応する。
   */
  private resolveJsonPath(credential: StoredCredential, path: string): unknown {
    if (!path.startsWith('$.')) {
      return undefined;
    }

    const parts = path.slice(2).split('.');

    // $.vc.* パス — JWT-VC ペイロードの vc オブジェクトを参照
    // credential.decoded は vc の中身を展開した構造なので、vc. プレフィックスをスキップ
    if (parts[0] === 'vc') {
      const vcParts = parts.slice(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = credential.decoded;
      for (const part of vcParts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
      }
      if (current !== undefined) return current;
    }

    // $.vct — SD-JWT-VC 形式: credential type の最後の要素を返す
    if (parts.length === 1 && parts[0] === 'vct') {
      const types = credential.decoded.type;
      return types[types.length - 1];
    }

    // $.type, $.credentialSubject.* 等 — decoded をルートとして解決
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = credential.decoded;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    if (current !== undefined) return current;

    // フォールバック: rawJwt のペイロード全体から解決を試みる
    try {
      const payloadB64 = credential.rawJwt.split('.')[1];
      const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const fullPayload = JSON.parse(new TextDecoder().decode(bytes));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let raw: any = fullPayload;
      for (const part of parts) {
        if (raw === null || raw === undefined) return undefined;
        raw = raw[part];
      }
      return raw;
    } catch {
      return undefined;
    }
  }
}
