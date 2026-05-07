/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { CredentialSchema } from '@vcknots-sample/shared';
import { SchemaStorage } from '../services/schema-storage.js';

const STORAGE_KEY = 'vcknots-schemas';

function createTestSchema(overrides: Partial<CredentialSchema> = {}): CredentialSchema {
  return {
    id: 'test-id-1',
    name: 'TestSchema',
    version: '1.0',
    attributes: [
      { name: 'field1', type: 'string', required: true, description: 'A test field' },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SchemaStorage', () => {
  let storage: SchemaStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new SchemaStorage();
  });

  describe('getAll', () => {
    it('should return empty array when no schemas exist', async () => {
      const result = await storage.getAll();
      expect(result).toEqual([]);
    });

    it('should return empty array when localStorage contains invalid JSON', async () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');
      const result = await storage.getAll();
      expect(result).toEqual([]);
    });

    it('should return stored schemas', async () => {
      const schema = createTestSchema();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([schema]));
      const result = await storage.getAll();
      expect(result).toEqual([schema]);
    });
  });

  describe('save', () => {
    it('should save a schema to localStorage', async () => {
      const schema = createTestSchema();
      await storage.save(schema);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toEqual([schema]);
    });

    it('should append to existing schemas', async () => {
      const schema1 = createTestSchema({ id: 'id-1', name: 'Schema1' });
      const schema2 = createTestSchema({ id: 'id-2', name: 'Schema2' });

      await storage.save(schema1);
      await storage.save(schema2);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toHaveLength(2);
      expect(stored[0]).toEqual(schema1);
      expect(stored[1]).toEqual(schema2);
    });
  });

  describe('getById', () => {
    it('should return null when schema does not exist', async () => {
      const result = await storage.getById('nonexistent');
      expect(result).toBeNull();
    });

    it('should return the schema with matching id', async () => {
      const schema = createTestSchema({ id: 'target-id' });
      await storage.save(schema);

      const result = await storage.getById('target-id');
      expect(result).toEqual(schema);
    });
  });

  describe('update', () => {
    it('should update an existing schema', async () => {
      const schema = createTestSchema({ id: 'update-id' });
      await storage.save(schema);

      const updated = { ...schema, name: 'UpdatedName', updatedAt: '2024-06-01T00:00:00.000Z' };
      await storage.update('update-id', updated);

      const result = await storage.getById('update-id');
      expect(result).toEqual(updated);
    });

    it('should throw error when schema does not exist', async () => {
      const schema = createTestSchema({ id: 'nonexistent' });
      await expect(storage.update('nonexistent', schema)).rejects.toThrow(
        'Schema with id "nonexistent" not found'
      );
    });
  });

  describe('delete', () => {
    it('should remove a schema by id', async () => {
      const schema1 = createTestSchema({ id: 'keep-id' });
      const schema2 = createTestSchema({ id: 'delete-id' });
      await storage.save(schema1);
      await storage.save(schema2);

      await storage.delete('delete-id');

      const all = await storage.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('keep-id');
    });

    it('should handle deleting non-existent id gracefully', async () => {
      const schema = createTestSchema({ id: 'existing' });
      await storage.save(schema);

      await storage.delete('nonexistent');

      const all = await storage.getAll();
      expect(all).toHaveLength(1);
    });
  });
});
