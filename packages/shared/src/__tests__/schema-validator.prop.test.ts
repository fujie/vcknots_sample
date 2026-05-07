import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SchemaValidator } from '../utils/schema-validator.js';
import type { CredentialSchema, SchemaAttribute, AttributeType } from '../types/index.js';

const VALID_ATTRIBUTE_TYPES: AttributeType[] = ['string', 'number', 'date', 'boolean'];

/**
 * 有効な属性型を生成する arbitrary
 */
const arbAttributeType: fc.Arbitrary<AttributeType> =
  fc.constantFrom(...VALID_ATTRIBUTE_TYPES);

/**
 * 空でない属性名を生成する arbitrary
 */
const arbNonEmptyAttrName: fc.Arbitrary<string> =
  fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

/**
 * 有効な SchemaAttribute を生成する arbitrary
 */
const arbValidAttribute: fc.Arbitrary<SchemaAttribute> = fc.record({
  name: arbNonEmptyAttrName,
  type: arbAttributeType,
  required: fc.boolean(),
  description: fc.option(fc.string(), { nil: undefined }),
});

/**
 * 有効なベーススキーマ（属性以外）を生成するヘルパー
 */
function buildSchema(attributes: SchemaAttribute[]): CredentialSchema {
  return {
    id: 'test-id',
    name: 'TestSchema',
    version: '1.0',
    attributes,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

/**
 * 有効な CredentialSchema を生成する arbitrary
 */
/**
 * 有効な ISO 8601 タイムスタンプを生成する arbitrary
 */
const arbISOTimestamp: fc.Arbitrary<string> = fc
  .integer({ min: 946684800000, max: 4102444799999 }) // 2000-01-01 to 2099-12-31 in ms
  .map((ms) => new Date(ms).toISOString());

const arbValidCredentialSchema: fc.Arbitrary<CredentialSchema> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  version: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  attributes: fc.array(arbValidAttribute, { minLength: 1, maxLength: 10 }),
  createdAt: arbISOTimestamp,
  updatedAt: arbISOTimestamp,
});

describe('SchemaValidator - Property-Based Tests', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  // Feature: vcknots-verifiable-credentials, Property 13: スキーマストレージのラウンドトリップ
  // **Validates: Requirements 12.3**
  describe('Property 13: スキーマストレージのラウンドトリップ', () => {
    it('should preserve CredentialSchema data through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(arbValidCredentialSchema, (schema) => {
          // Simulate file-based storage round-trip: serialize to JSON and deserialize back
          const roundTripped = JSON.parse(JSON.stringify(schema)) as CredentialSchema;

          // The round-tripped schema must be deeply equal to the original
          expect(roundTripped).toEqual(schema);

          // Verify structural integrity: all fields are preserved
          expect(roundTripped.id).toBe(schema.id);
          expect(roundTripped.name).toBe(schema.name);
          expect(roundTripped.version).toBe(schema.version);
          expect(roundTripped.createdAt).toBe(schema.createdAt);
          expect(roundTripped.updatedAt).toBe(schema.updatedAt);
          expect(roundTripped.attributes).toHaveLength(schema.attributes.length);

          // Verify each attribute is preserved
          for (let i = 0; i < schema.attributes.length; i++) {
            expect(roundTripped.attributes[i].name).toBe(schema.attributes[i].name);
            expect(roundTripped.attributes[i].type).toBe(schema.attributes[i].type);
            expect(roundTripped.attributes[i].required).toBe(schema.attributes[i].required);
            expect(roundTripped.attributes[i].description).toBe(schema.attributes[i].description);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 14: スキーマバリデーションによる不正属性の拒否
  // **Validates: Requirements 12.6**
  describe('Property 14: スキーマバリデーションによる不正属性の拒否', () => {
    it('should reject schemas with at least one empty attribute name', () => {
      fc.assert(
        fc.property(
          // Generate a non-empty array of valid attributes, then inject at least one empty-name attribute
          fc.record({
            validAttrs: fc.array(arbValidAttribute, { minLength: 0, maxLength: 5 }),
            emptyNameAttr: fc.record({
              name: fc.constantFrom('', '  ', '\t', '\n'),
              type: arbAttributeType,
              required: fc.boolean(),
              description: fc.option(fc.string(), { nil: undefined }),
            }),
            insertIndex: fc.nat(),
          }),
          ({ validAttrs, emptyNameAttr, insertIndex }) => {
            // Insert the empty-name attribute at a random position
            const attributes = [...validAttrs];
            const idx = attributes.length === 0 ? 0 : insertIndex % (attributes.length + 1);
            attributes.splice(idx, 0, emptyNameAttr);

            const schema = buildSchema(attributes);
            const result = validator.validate(schema);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            // At least one error should reference an attribute name issue
            const hasEmptyNameError = result.errors.some(
              (e) => e.field.includes('.name') && e.message.toLowerCase().includes('empty'),
            );
            expect(hasEmptyNameError).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject schemas with duplicate attribute names', () => {
      fc.assert(
        fc.property(
          fc.record({
            // Generate a non-empty name that will be duplicated
            duplicateName: arbNonEmptyAttrName,
            // Generate additional unique attributes (may be empty)
            otherAttrs: fc.array(arbValidAttribute, { minLength: 0, maxLength: 4 }),
            type1: arbAttributeType,
            type2: arbAttributeType,
            required1: fc.boolean(),
            required2: fc.boolean(),
          }),
          ({ duplicateName, otherAttrs, type1, type2, required1, required2 }) => {
            // Filter out any other attributes that happen to share the duplicate name
            const filteredOthers = otherAttrs.filter((a) => a.name !== duplicateName);

            // Create two attributes with the same name
            const dup1: SchemaAttribute = { name: duplicateName, type: type1, required: required1 };
            const dup2: SchemaAttribute = { name: duplicateName, type: type2, required: required2 };

            const attributes = [dup1, ...filteredOthers, dup2];
            const schema = buildSchema(attributes);
            const result = validator.validate(schema);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            // At least one error should reference a duplicate attribute name
            const hasDuplicateError = result.errors.some(
              (e) => e.field.includes('.name') && e.message.toLowerCase().includes('duplicate'),
            );
            expect(hasDuplicateError).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
