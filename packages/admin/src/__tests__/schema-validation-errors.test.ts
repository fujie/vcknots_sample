/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import type { CredentialSchema, ValidationResult } from '@vcknots-sample/shared';
import { SchemaValidator } from '@vcknots-sample/shared';

const validator = new SchemaValidator();

/**
 * SchemaEditorPage で使用されるエラーマッピングロジックを再現する。
 * validator.validate() の結果を UI コンポーネントが受け取る Record<string, string> に変換する。
 */
function mapValidationErrors(result: ValidationResult): Record<string, string> {
  const errorMap: Record<string, string> = {};
  for (const err of result.errors) {
    errorMap[err.field] = err.message;
  }
  return errorMap;
}

function createSchema(overrides: Partial<CredentialSchema> = {}): CredentialSchema {
  return {
    id: 'test-id',
    name: 'TestSchema',
    version: '1.0',
    attributes: [
      { name: 'field1', type: 'string', required: true, description: '' },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Schema validation error display', () => {
  describe('error field keys match UI component expectations', () => {
    it('should produce "name" key for empty schema name', () => {
      const result = validator.validate(createSchema({ name: '' }));
      const errors = mapValidationErrors(result);

      expect(errors['name']).toBeDefined();
      expect(errors['name']).toContain('name');
    });

    it('should produce "version" key for empty schema version', () => {
      const result = validator.validate(createSchema({ version: '' }));
      const errors = mapValidationErrors(result);

      expect(errors['version']).toBeDefined();
      expect(errors['version']).toContain('version');
    });

    it('should produce "attributes" key when no attributes defined', () => {
      const result = validator.validate(createSchema({ attributes: [] }));
      const errors = mapValidationErrors(result);

      expect(errors['attributes']).toBeDefined();
      expect(errors['attributes']).toContain('at least one');
    });

    it('should produce "attributes[N].name" key for empty attribute name', () => {
      const result = validator.validate(
        createSchema({
          attributes: [
            { name: 'valid', type: 'string', required: true },
            { name: '', type: 'string', required: false },
          ],
        }),
      );
      const errors = mapValidationErrors(result);

      expect(errors['attributes[1].name']).toBeDefined();
      expect(errors['attributes[1].name']).toContain('Attribute name');
    });

    it('should produce "attributes[N].name" key for duplicate attribute names', () => {
      const result = validator.validate(
        createSchema({
          attributes: [
            { name: 'degree', type: 'string', required: true },
            { name: 'degree', type: 'number', required: false },
          ],
        }),
      );
      const errors = mapValidationErrors(result);

      expect(errors['attributes[1].name']).toBeDefined();
      expect(errors['attributes[1].name']).toContain('Duplicate');
    });

    it('should produce "attributes[N].type" key for invalid attribute type', () => {
      const result = validator.validate(
        createSchema({
          attributes: [
            { name: 'field', type: 'invalid' as any, required: true },
          ],
        }),
      );
      const errors = mapValidationErrors(result);

      expect(errors['attributes[0].type']).toBeDefined();
      expect(errors['attributes[0].type']).toContain('Invalid attribute type');
    });
  });

  describe('multiple validation errors are collected', () => {
    it('should map all errors when schema has multiple issues', () => {
      const result = validator.validate(
        createSchema({
          name: '',
          version: '',
          attributes: [
            { name: '', type: 'string', required: true },
            { name: 'dup', type: 'string', required: true },
            { name: 'dup', type: 'number', required: false },
          ],
        }),
      );
      const errors = mapValidationErrors(result);

      expect(errors['name']).toBeDefined();
      expect(errors['version']).toBeDefined();
      expect(errors['attributes[0].name']).toBeDefined();
      expect(errors['attributes[2].name']).toBeDefined();
    });

    it('should return empty error map for valid schema', () => {
      const result = validator.validate(createSchema());
      const errors = mapValidationErrors(result);

      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
