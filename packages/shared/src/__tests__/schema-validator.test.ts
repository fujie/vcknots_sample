import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../utils/schema-validator.js';
import type { CredentialSchema } from '../types/index.js';

function createValidSchema(overrides: Partial<CredentialSchema> = {}): CredentialSchema {
  return {
    id: 'schema-1',
    name: 'UniversityDegree',
    version: '1.0',
    attributes: [
      { name: 'degree', type: 'string', required: true },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe('validate()', () => {
    it('should pass for a valid schema', () => {
      const result = validator.validate(createValidSchema());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail when schema name is empty', () => {
      const result = validator.validate(createValidSchema({ name: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'name' }),
      );
    });

    it('should fail when schema name is whitespace only', () => {
      const result = validator.validate(createValidSchema({ name: '   ' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'name' }),
      );
    });

    it('should fail when schema version is empty', () => {
      const result = validator.validate(createValidSchema({ version: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'version' }),
      );
    });

    it('should fail when schema has no attributes', () => {
      const result = validator.validate(createValidSchema({ attributes: [] }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'attributes' }),
      );
    });

    it('should fail when an attribute name is empty', () => {
      const result = validator.validate(
        createValidSchema({
          attributes: [{ name: '', type: 'string', required: true }],
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'attributes[0].name' }),
      );
    });

    it('should fail when attribute names are duplicated', () => {
      const result = validator.validate(
        createValidSchema({
          attributes: [
            { name: 'degree', type: 'string', required: true },
            { name: 'degree', type: 'number', required: false },
          ],
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'attributes[1].name',
          message: expect.stringContaining('Duplicate'),
        }),
      );
    });

    it('should treat attribute name duplication as case-sensitive', () => {
      const result = validator.validate(
        createValidSchema({
          attributes: [
            { name: 'Degree', type: 'string', required: true },
            { name: 'degree', type: 'string', required: false },
          ],
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('should fail when attribute type is invalid', () => {
      const result = validator.validate(
        createValidSchema({
          attributes: [
            { name: 'field', type: 'invalid' as any, required: true },
          ],
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'attributes[0].type' }),
      );
    });

    it('should accept all valid attribute types', () => {
      const result = validator.validate(
        createValidSchema({
          attributes: [
            { name: 'a', type: 'string', required: true },
            { name: 'b', type: 'number', required: true },
            { name: 'c', type: 'date', required: true },
            { name: 'd', type: 'boolean', required: true },
          ],
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('should collect multiple errors at once', () => {
      const result = validator.validate(
        createValidSchema({
          name: '',
          version: '',
          attributes: [],
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('validateClaims()', () => {
    const schema = createValidSchema({
      attributes: [
        { name: 'degree', type: 'string', required: true },
        { name: 'gpa', type: 'number', required: true },
        { name: 'graduated', type: 'boolean', required: false },
        { name: 'graduationDate', type: 'date', required: false },
      ],
    });

    it('should pass for valid claims', () => {
      const result = validator.validateClaims(
        {
          degree: 'Computer Science',
          gpa: 3.8,
          graduated: true,
          graduationDate: '2024-06-15T00:00:00.000Z',
        },
        schema,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail when a required attribute is missing', () => {
      const result = validator.validateClaims({ gpa: 3.8 }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'degree',
          message: expect.stringContaining('missing'),
        }),
      );
    });

    it('should pass when an optional attribute is missing', () => {
      const result = validator.validateClaims(
        { degree: 'CS', gpa: 3.5 },
        schema,
      );
      expect(result.valid).toBe(true);
    });

    it('should fail when string attribute has wrong type', () => {
      const result = validator.validateClaims(
        { degree: 123, gpa: 3.8 },
        schema,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'degree' }),
      );
    });

    it('should fail when number attribute has wrong type', () => {
      const result = validator.validateClaims(
        { degree: 'CS', gpa: 'high' },
        schema,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'gpa' }),
      );
    });

    it('should fail when boolean attribute has wrong type', () => {
      const result = validator.validateClaims(
        { degree: 'CS', gpa: 3.8, graduated: 'yes' },
        schema,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'graduated' }),
      );
    });

    it('should fail when date attribute is not a valid ISO string', () => {
      const result = validator.validateClaims(
        { degree: 'CS', gpa: 3.8, graduationDate: 'not-a-date' },
        schema,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'graduationDate' }),
      );
    });

    it('should fail when date attribute is a number', () => {
      const result = validator.validateClaims(
        { degree: 'CS', gpa: 3.8, graduationDate: 1234567890 },
        schema,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'graduationDate' }),
      );
    });

    it('should pass when date attribute is a valid ISO string', () => {
      const result = validator.validateClaims(
        { degree: 'CS', gpa: 3.8, graduationDate: '2024-06-15' },
        schema,
      );
      expect(result.valid).toBe(true);
    });
  });
});
