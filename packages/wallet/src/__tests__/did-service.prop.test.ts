/**
 * Feature: vcknots-verifiable-credentials, Property 12: DID のストレージと再利用の冪等性
 *
 * *任意の* DID と鍵ペアに対して、localStorage に保存した後に `getOrCreateDID()` を
 * 複数回呼び出しても、常に同一の DID が返される。新しい DID は生成されない。
 *
 * **Validates: Requirements 11.2, 11.4**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { DIDService } from '../services/did-service.js';

// @vitest-environment jsdom

describe('DIDService - Property 12: DID のストレージと再利用の冪等性', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getOrCreateDID() を複数回呼び出しても常に同一の DID が返される', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (callCount) => {
          localStorage.clear();
          const service = new DIDService();

          // 最初の呼び出しで DID を生成
          const firstResult = await service.getOrCreateDID();

          // 複数回呼び出して同一の DID が返されることを検証
          for (let i = 1; i < callCount; i++) {
            const result = await service.getOrCreateDID();
            expect(result.did).toBe(firstResult.did);
            expect(result.publicKeyJwk).toEqual(firstResult.publicKeyJwk);
            expect(result.privateKeyJwk).toEqual(firstResult.privateKeyJwk);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('hasDID() は DID 生成後に true を返す', async () => {
    const service = new DIDService();
    expect(service.hasDID()).toBe(false);
    await service.getOrCreateDID();
    expect(service.hasDID()).toBe(true);
  });

  it('generateDID() は毎回異なる DID を生成する', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const service = new DIDService();
          const did1 = await service.generateDID();
          const did2 = await service.generateDID();
          expect(did1.did).not.toBe(did2.did);
        },
      ),
      { numRuns: 20 },
    );
  });
});
