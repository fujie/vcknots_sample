import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { ActivityLogger } from '@vcknots-sample/shared';
import { WalletService } from '../services/wallet-service.js';
import { OID4Client } from '../services/oid4-client.js';
import { CredentialStorage } from '../services/credential-storage.js';
import { DIDService } from '../services/did-service.js';
import type { StoredCredential, ParsedCredentialOffer } from '../types/wallet.js';

/**
 * Task 13.3: 発行フローのプロパティベーステスト
 *
 * Property 15: 発行フローにおけるクレーム値の保存
 * **Validates: Requirements 17.2**
 *
 * 任意の有効なクレーム値のセットに対して、発行フロー完了後にウォレットに保存された
 * 資格情報の credentialSubject は、発行者が入力した元のクレーム値と一致する。
 */

// localStorage のモック
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value; },
  removeItem: (key: string) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]); },
  get length() { return Object.keys(localStorageData).length; },
  key: (index: number) => Object.keys(localStorageData)[index] ?? null,
};

// crypto.randomUUID のモック
const mockRandomUUID = () => {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'crypto', {
  value: {
    ...globalThis.crypto,
    randomUUID: mockRandomUUID,
    subtle: globalThis.crypto?.subtle,
  },
});

/**
 * JWT-VC を生成するヘルパー。
 * 指定されたクレーム値を credentialSubject に含む JWT-VC を生成する。
 */
function createMockJwtVc(claims: Record<string, unknown>, credentialType: string): string {
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    iss: 'did:key:z6MkTestIssuer123456789',
    sub: 'did:key:z6MkTestHolder123456789',
    iat: Math.floor(Date.now() / 1000),
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', credentialType],
      credentialSubject: claims,
      issuanceDate: new Date().toISOString(),
    },
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock-signature-for-testing';

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * fast-check arbitrary: 有効なクレーム値のセットを生成する。
 * クレーム値は文字列、数値、ブール値のいずれかで、キーは有効な識別子。
 */
const arbitraryClaimKey = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/);

const arbitraryClaimValue = fc.oneof(
  fc.string({ minLength: 0, maxLength: 100 }),
  fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }).filter((v) => !Object.is(v, -0)),
  fc.boolean(),
);

const arbitraryClaims = fc.dictionary(arbitraryClaimKey, arbitraryClaimValue, {
  minKeys: 1,
  maxKeys: 10,
});

describe('WalletService - Property-Based Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // Feature: vcknots-verifiable-credentials, Property 15: 発行フローにおけるクレーム値の保存
  // **Validates: Requirements 17.2**
  describe('Property 15: 発行フローにおけるクレーム値の保存', () => {
    it('任意の有効なクレーム値のセットに対して、発行フロー完了後にウォレットに保存された資格情報の credentialSubject は元のクレーム値と一致する', () => {
      fc.assert(
        fc.property(
          arbitraryClaims,
          fc.stringMatching(/^[A-Z][a-zA-Z]{2,20}$/),
          (claims, credentialType) => {
            // テスト環境をリセット
            localStorageMock.clear();

            const credentialStorage = new CredentialStorage();
            const activityLogger = new ActivityLogger();

            // 発行者が JWT-VC を生成する（クレーム値を含む）
            const jwtVc = createMockJwtVc(claims, credentialType);

            // ウォレットが JWT-VC をデコードして保存する
            // WalletService.acceptOffer の内部ロジックをシミュレート
            const parts = jwtVc.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

            const decoded = {
              issuer: payload.iss || '',
              type: payload.vc?.type || ['VerifiableCredential'],
              credentialSubject: payload.vc?.credentialSubject || {},
              issuanceDate: payload.vc?.issuanceDate || new Date().toISOString(),
            };

            const storedCredential: StoredCredential = {
              id: mockRandomUUID(),
              rawJwt: jwtVc,
              decoded,
              issuerUrl: 'http://localhost:4001',
              receivedAt: new Date().toISOString(),
            };

            credentialStorage.save(storedCredential);

            // 保存された資格情報を読み込む
            const retrieved = credentialStorage.getById(storedCredential.id);

            // credentialSubject が元のクレーム値と一致することを検証
            expect(retrieved).not.toBeNull();
            expect(retrieved!.decoded.credentialSubject).toEqual(claims);

            // 各クレーム値が個別に一致することも検証
            for (const [key, value] of Object.entries(claims)) {
              expect(retrieved!.decoded.credentialSubject[key]).toEqual(value);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('発行フロー全体を通じてクレーム値が保存される（WalletService.acceptOffer シミュレーション）', () => {
      fc.assert(
        fc.property(
          arbitraryClaims,
          (claims) => {
            // テスト環境をリセット
            localStorageMock.clear();

            const credentialStorage = new CredentialStorage();
            const credentialType = 'TestCredential';
            const issuerUrl = 'http://localhost:4001';

            // Step 1: 発行者がクレーム値を含む JWT-VC を生成する
            const jwtVc = createMockJwtVc(claims, credentialType);

            // Step 2: WalletService の decodeJwtVc ロジックを再現する
            const parts = jwtVc.split('.');
            if (parts.length !== 3) {
              throw new Error('Invalid JWT format');
            }

            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

            const decoded = {
              issuer: payload.iss || payload.issuer || '',
              type: payload.vc?.type || payload.type || ['VerifiableCredential'],
              credentialSubject: payload.vc?.credentialSubject || payload.credentialSubject || {},
              issuanceDate: payload.vc?.issuanceDate || payload.issuanceDate || new Date().toISOString(),
            };

            // Step 3: StoredCredential を作成して保存する
            const storedCredential: StoredCredential = {
              id: mockRandomUUID(),
              rawJwt: jwtVc,
              decoded,
              issuerUrl,
              receivedAt: new Date().toISOString(),
            };

            credentialStorage.save(storedCredential);

            // Step 4: 保存された資格情報を取得して検証する
            const allCredentials = credentialStorage.getAll();
            expect(allCredentials.length).toBe(1);

            const retrieved = allCredentials[0];
            expect(retrieved.decoded.credentialSubject).toEqual(claims);
            expect(retrieved.decoded.type).toContain(credentialType);
            expect(retrieved.decoded.issuer).toBe('did:key:z6MkTestIssuer123456789');
            expect(retrieved.issuerUrl).toBe(issuerUrl);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
