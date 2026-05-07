import type {
  CredentialSchema,
  ValidationResult,
  ValidationError,
} from '../types/index.js';

/**
 * ISO 8601 日付文字列かどうかを簡易チェックする。
 * Date.parse が有効な値を返し、かつ文字列が空でないことを確認する。
 */
function isISODateString(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }
  const timestamp = Date.parse(value);
  return !isNaN(timestamp);
}

/**
 * スキーマおよびクレーム値のバリデーションを行うクラス。
 */
export class SchemaValidator {
  /**
   * スキーマの妥当性を検証する。
   *
   * バリデーションルール:
   * - スキーマ名が空でないこと
   * - スキーマバージョンが空でないこと
   * - 属性が1つ以上定義されていること
   * - 属性名が空文字列でないこと
   * - 属性名が重複していないこと（大文字小文字区別）
   * - 属性の型が 'string' | 'number' | 'date' | 'boolean' のいずれかであること
   */
  validate(schema: CredentialSchema): ValidationResult {
    const errors: ValidationError[] = [];

    if (!schema.name || schema.name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Schema name must not be empty',
      });
    }

    if (!schema.version || schema.version.trim() === '') {
      errors.push({
        field: 'version',
        message: 'Schema version must not be empty',
      });
    }

    if (!schema.attributes || schema.attributes.length === 0) {
      errors.push({
        field: 'attributes',
        message: 'Schema must have at least one attribute',
      });
    } else {
      const validTypes = new Set(['string', 'number', 'date', 'boolean']);
      const seenNames = new Set<string>();

      for (let i = 0; i < schema.attributes.length; i++) {
        const attr = schema.attributes[i];

        if (!attr.name || attr.name.trim() === '') {
          errors.push({
            field: `attributes[${i}].name`,
            message: 'Attribute name must not be empty',
          });
        } else if (seenNames.has(attr.name)) {
          errors.push({
            field: `attributes[${i}].name`,
            message: `Duplicate attribute name: "${attr.name}"`,
          });
        } else {
          seenNames.add(attr.name);
        }

        if (!validTypes.has(attr.type)) {
          errors.push({
            field: `attributes[${i}].type`,
            message: `Invalid attribute type: "${attr.type}". Must be one of: string, number, date, boolean`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 資格情報の属性値がスキーマに適合するか検証する。
   *
   * バリデーションルール:
   * - 必須属性がクレームに存在すること
   * - 属性値がスキーマで定義された型と一致すること
   *   - string → typeof === 'string'
   *   - number → typeof === 'number'
   *   - boolean → typeof === 'boolean'
   *   - date → typeof === 'string' かつ ISO 8601 形式
   */
  validateClaims(
    claims: Record<string, unknown>,
    schema: CredentialSchema,
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const attr of schema.attributes) {
      const value = claims[attr.name];

      // 必須属性の存在チェック
      if (attr.required && (value === undefined || value === null)) {
        errors.push({
          field: attr.name,
          message: `Required attribute "${attr.name}" is missing`,
        });
        continue;
      }

      // 値が存在する場合のみ型チェック
      if (value !== undefined && value !== null) {
        switch (attr.type) {
          case 'string':
            if (typeof value !== 'string') {
              errors.push({
                field: attr.name,
                message: `Attribute "${attr.name}" must be a string`,
              });
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              errors.push({
                field: attr.name,
                message: `Attribute "${attr.name}" must be a number`,
              });
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors.push({
                field: attr.name,
                message: `Attribute "${attr.name}" must be a boolean`,
              });
            }
            break;
          case 'date':
            if (!isISODateString(value)) {
              errors.push({
                field: attr.name,
                message: `Attribute "${attr.name}" must be a valid ISO 8601 date string`,
              });
            }
            break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
