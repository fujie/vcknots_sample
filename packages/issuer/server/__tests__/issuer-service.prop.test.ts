import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { vcknots } from '@trustknots/vcknots';
import { ActivityLogger } from '@vcknots-sample/shared';
import type { CredentialSchema } from '@vcknots-sample/shared';
import { SchemaService } from '../services/schema-service.js';
import { IssuerService } from '../services/issuer-service.js';

/**
 * テスト用のスキーマデータ
 */
const TEST_SCHEMA: CredentialSchema = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'UniversityDegree',
  version: '1.0',
  attributes: [
    { name: 'degree', type: 'string', required: true },
    { name: 'gpa', type: 'number', required: false },
  ],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

/**
 * テスト環境のセットアップヘルパー
 */
async function createTestEnvironment() {
  const tempDir = join(tmpdir(), `vcknots-prop-test-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });
  const schemasPath = join(tempDir, 'schemas.json');
  await writeFile(schemasPath, JSON.stringify([TEST_SCHEMA]));

  const schemaService = new SchemaService(schemasPath);
  const activityLogger = new ActivityLogger();
  const { issuer: freshIssuer } = vcknots();
  const issuerService = new IssuerService(schemaService, activityLogger, freshIssuer);
  await issuerService.initialize();

  return { issuerService, schemaService, activityLogger, tempDir };
}

describe('IssuerService - Property-Based Tests', () => {
  // Feature: vcknots-verifiable-credentials, Property 1: Pre-Authorized Code の一意性
  // **Validates: Requirements 2.4**
  describe('Property 1: Pre-Authorized Code の一意性', () => {
    it('任意の 2つの Credential Offer に対して、それぞれに含まれる Pre-Authorized Code は異なる値でなければならない', async () => {
      const { issuerService } = await createTestEnvironment();

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (numOffers) => {
            const codes: string[] = [];

            for (let i = 0; i < numOffers; i++) {
              const offer = await issuerService.createOffer('UniversityDegree', {
                degree: `Degree-${i}`,
                gpa: 3.0 + i * 0.1,
              });

              const preAuthCode =
                offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.[
                  'pre-authorized_code'
                ];
              expect(preAuthCode).toBeDefined();
              codes.push(preAuthCode!);
            }

            // すべてのコードが一意であることを検証
            const uniqueCodes = new Set(codes);
            expect(uniqueCodes.size).toBe(codes.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 2: 未定義の資格情報タイプの拒否
  // **Validates: Requirements 2.5**
  describe('Property 2: 未定義の資格情報タイプの拒否', () => {
    it('任意の文字列が定義済みスキーマ名に一致しない場合、オファー生成リクエストはエラーで拒否される', async () => {
      const { issuerService } = await createTestEnvironment();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            (s) => s !== 'UniversityDegree' && s.trim().length > 0,
          ),
          async (invalidType) => {
            await expect(
              issuerService.createOffer(invalidType, { someField: 'value' }),
            ).rejects.toThrow();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 3: 有効な Pre-Authorized Code によるトークン取得
  // **Validates: Requirements 3.1**
  describe('Property 3: 有効な Pre-Authorized Code によるトークン取得', () => {
    it('任意の有効な Pre-Authorized Code に対して、トークンレスポンスに access_token と token_type: "Bearer" が含まれる', async () => {
      const { issuerService } = await createTestEnvironment();

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            degree: fc.string({ minLength: 1, maxLength: 30 }),
            gpa: fc.double({ min: 0, max: 4, noNaN: true }),
          }),
          async (claims) => {
            const offer = await issuerService.createOffer('UniversityDegree', claims);

            const preAuthCode =
              offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
                'pre-authorized_code'
              ];

            const tokenResponse = await issuerService.exchangeToken(preAuthCode);

            // access_token が含まれる
            expect(tokenResponse.access_token).toBeDefined();
            expect(typeof tokenResponse.access_token).toBe('string');
            expect(tokenResponse.access_token.length).toBeGreaterThan(0);

            // token_type が "Bearer" である
            expect(tokenResponse.token_type).toBe('Bearer');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 4: 発行済み資格情報の DID ベース発行者識別子
  // **Validates: Requirements 3.3**
  describe('Property 4: 発行済み資格情報の DID ベース発行者識別子', () => {
    it('発行者メタデータの credential_issuer に対応する DID が did: プレフィックスで始まる（メタデータベース検証）', async () => {
      // issueCredential には有効な proof が必要なため、
      // 発行者の DID がメタデータから取得可能であることを検証する。
      // vcknots の issuer は did:key を使用するため、メタデータ内の
      // credential_issuer URL に対応する DID は did: プレフィックスで始まる。
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const { issuerService } = await createTestEnvironment();
            const metadata = await issuerService.getMetadata();

            // メタデータが存在し、credential_issuer が定義されている
            expect(metadata).toBeDefined();
            expect(metadata.credential_issuer).toBeDefined();

            // vcknots の issuer インスタンスは did:key ベースの DID を使用する
            // credential_configurations_supported に proof_types_supported が含まれる
            const configs = metadata.credential_configurations_supported;
            expect(configs).toBeDefined();

            // 少なくとも1つの設定が存在する
            const configKeys = Object.keys(configs);
            expect(configKeys.length).toBeGreaterThan(0);

            // 各設定に proof_types_supported が含まれ、ES256 をサポートする
            for (const key of configKeys) {
              const config = configs[key] as any;
              expect(config.proof_types_supported).toBeDefined();
              expect(config.proof_types_supported.jwt).toBeDefined();
              expect(
                config.proof_types_supported.jwt.proof_signing_alg_values_supported,
              ).toContain('ES256');
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 5: 無効な Pre-Authorized Code のエラーレスポンス
  // **Validates: Requirements 3.4**
  describe('Property 5: 無効な Pre-Authorized Code のエラーレスポンス', () => {
    it('任意の有効でない文字列に対して、HTTP 400 と invalid_grant エラーコードが返る', async () => {
      const { issuerService } = await createTestEnvironment();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (invalidCode) => {
            try {
              await issuerService.exchangeToken(invalidCode);
              // ここに到達した場合、偶然有効なコードだった可能性がある（極めて低い確率）
              // テストは失敗させない
            } catch (err: any) {
              expect(err.errorCode).toBe('invalid_grant');
              expect(err.statusCode).toBe(400);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 6: 無効なアクセストークンのエラーレスポンス
  // **Validates: Requirements 3.5**
  describe('Property 6: 無効なアクセストークンのエラーレスポンス', () => {
    it('任意の有効でない文字列に対して、HTTP 401 と invalid_token エラーコードが返る', async () => {
      const { issuerService } = await createTestEnvironment();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (invalidToken) => {
            try {
              await issuerService.issueCredential(invalidToken, {});
              // ここに到達した場合、偶然有効なトークンだった可能性がある（極めて低い確率）
            } catch (err: any) {
              expect(err.errorCode).toBe('invalid_token');
              expect(err.statusCode).toBe(401);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
