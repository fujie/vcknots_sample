/**
 * Feature: vcknots-verifiable-credentials, Property 9: 資格情報ストレージのラウンドトリップ
 *
 * *任意の* 有効な StoredCredential に対して、localStorage に保存した後に読み込むと、
 * 元の資格情報と等価なオブジェクトが得られる。
 *
 * **Validates: Requirements 8.3**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { CredentialStorage } from '../services/credential-storage.js';
import type { StoredCredential, PresentationDefinition } from '../types/wallet.js';

// @vitest-environment jsdom

/**
 * 有効な StoredCredential を生成する arbitrary
 */
/**
 * ISO 8601 日付文字列を生成する arbitrary
 */
function arbitraryIsoDate(): fc.Arbitrary<string> {
  return fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
    .map((ts) => new Date(ts).toISOString());
}

function arbitraryStoredCredential(): fc.Arbitrary<StoredCredential> {
  return fc.record({
    id: fc.uuid(),
    rawJwt: fc.stringMatching(/^[A-Za-z0-9]{10,50}$/).map((s) => `eyJ${s}`),
    decoded: fc.record({
      issuer: fc.stringMatching(/^[A-Za-z0-9]{5,20}$/).map((s) => `did:key:z6Mk${s}`),
      type: fc.array(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,15}$/),
        { minLength: 1, maxLength: 3 },
      ).map((types) => ['VerifiableCredential', ...types]),
      credentialSubject: fc.dictionary(
        fc.stringMatching(/^[a-z][a-zA-Z0-9]{1,10}$/),
        fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.boolean()),
        { minKeys: 1, maxKeys: 5 },
      ),
      issuanceDate: arbitraryIsoDate(),
      expirationDate: fc.option(arbitraryIsoDate(), { nil: undefined }),
    }),
    issuerUrl: fc.constant('https://issuer.example.com'),
    receivedAt: arbitraryIsoDate(),
  });
}

describe('CredentialStorage - Property 9: 資格情報ストレージのラウンドトリップ', () => {
  let storage: CredentialStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new CredentialStorage();
  });

  it('保存した資格情報を読み込むと元の資格情報と等価なオブジェクトが得られる', () => {
    fc.assert(
      fc.property(
        arbitraryStoredCredential(),
        (credential) => {
          localStorage.clear();
          storage.save(credential);
          const loaded = storage.getById(credential.id);
          expect(loaded).toEqual(credential);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('複数の資格情報を保存して全件取得できる', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryStoredCredential(), { minLength: 1, maxLength: 10 })
          .map((creds) => {
            // ID の重複を排除
            const seen = new Set<string>();
            return creds.filter((c) => {
              if (seen.has(c.id)) return false;
              seen.add(c.id);
              return true;
            });
          }),
        (credentials) => {
          localStorage.clear();
          for (const cred of credentials) {
            storage.save(cred);
          }
          const all = storage.getAll();
          expect(all.length).toBe(credentials.length);
          for (const cred of credentials) {
            expect(all.find((c) => c.id === cred.id)).toEqual(cred);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('削除した資格情報は取得できない', () => {
    fc.assert(
      fc.property(
        arbitraryStoredCredential(),
        (credential) => {
          localStorage.clear();
          storage.save(credential);
          storage.delete(credential.id);
          const loaded = storage.getById(credential.id);
          expect(loaded).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: vcknots-verifiable-credentials, Property 11: Presentation Exchange 条件に基づく資格情報マッチング
 *
 * *任意の* 保存済み資格情報のセットと *任意の* PresentationDefinition に対して、
 * `findMatching` が返すすべての資格情報は、PresentationDefinition の input_descriptors の
 * 制約条件を満たす。また、返されなかった資格情報は制約条件を満たさない。
 *
 * **Validates: Requirements 9.2**
 */
describe('CredentialStorage - Property 11: Presentation Exchange 条件に基づく資格情報マッチング', () => {
  let storage: CredentialStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new CredentialStorage();
  });

  it('findMatching が返す資格情報はすべて制約条件を満たす', () => {
    // 特定のタイプを持つ資格情報と、そのタイプを要求する PresentationDefinition を生成
    const credentialTypes = ['UniversityDegree', 'DriverLicense', 'EmployeeID', 'Passport'];

    fc.assert(
      fc.property(
        // 資格情報のタイプをランダムに選択
        fc.array(
          fc.record({
            id: fc.uuid(),
            rawJwt: fc.constant('eyJhbGciOiJFUzI1NiJ9.test'),
            decoded: fc.record({
              issuer: fc.constant('did:key:z6MkTest'),
              type: fc.subarray(credentialTypes, { minLength: 1 }).map(
                (types) => ['VerifiableCredential', ...types],
              ),
              credentialSubject: fc.constant({ name: 'Test' }),
              issuanceDate: fc.constant('2024-01-01T00:00:00.000Z'),
              expirationDate: fc.constant(undefined),
            }),
            issuerUrl: fc.constant('https://issuer.example.com'),
            receivedAt: fc.constant('2024-01-01T00:00:00.000Z'),
          }),
          { minLength: 1, maxLength: 5 },
        ).map((creds) => {
          const seen = new Set<string>();
          return creds.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
        }),
        // 要求するタイプをランダムに選択
        fc.subarray(credentialTypes, { minLength: 1, maxLength: 2 }),
        (credentials, requiredTypes) => {
          localStorage.clear();

          for (const cred of credentials) {
            storage.save(cred as StoredCredential);
          }

          const presentationDefinition: PresentationDefinition = {
            id: 'test-pd',
            input_descriptors: requiredTypes.map((type) => ({
              id: `desc-${type}`,
              constraints: {
                fields: [
                  {
                    path: ['$.type'],
                    filter: {
                      type: 'array',
                      contains: { const: type },
                    },
                  },
                ],
              },
            })),
          };

          const matching = storage.findMatching(presentationDefinition);

          // 返された資格情報はすべて少なくとも1つの input_descriptor を満たす
          for (const matched of matching) {
            const satisfiesAtLeastOne = presentationDefinition.input_descriptors.some(
              (descriptor) => {
                const typeField = descriptor.constraints.fields[0];
                const requiredType = typeField.filter!.contains!.const;
                return matched.decoded.type.includes(requiredType);
              },
            );
            expect(satisfiesAtLeastOne).toBe(true);
          }

          // 返されなかった資格情報はどの input_descriptor も満たさない
          const nonMatching = credentials.filter(
            (c) => !matching.find((m) => m.id === c.id),
          );
          for (const nonMatched of nonMatching) {
            const satisfiesAny = presentationDefinition.input_descriptors.some(
              (descriptor) => {
                const typeField = descriptor.constraints.fields[0];
                const requiredType = typeField.filter!.contains!.const;
                return nonMatched.decoded.type.includes(requiredType);
              },
            );
            expect(satisfiesAny).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
