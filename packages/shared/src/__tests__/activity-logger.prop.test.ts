import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ActivityLogger } from '../utils/activity-logger.js';
import type { ActivityAction, ActivityLogEntry } from '../types/index.js';

// --- Issuer actions ---
const ISSUER_ACTIONS: ActivityAction[] = [
  'offer_created',
  'credential_issued',
  'issuance_failed',
];

// --- Wallet actions ---
const WALLET_ACTIONS: ActivityAction[] = [
  'offer_received',
  'credential_acquired',
  'presentation_submitted',
];

// --- Verifier actions ---
const VERIFIER_ACTIONS: ActivityAction[] = [
  'authz_request_created',
  'presentation_received',
  'verification_completed',
];

/**
 * 有効な ISO 8601 タイムスタンプを生成する arbitrary
 */
const arbISOTimestamp: fc.Arbitrary<string> = fc
  .integer({ min: 946684800000, max: 4102444799999 })
  .map((ms) => new Date(ms).toISOString());

/**
 * 任意の details オブジェクトを生成する arbitrary
 */
const arbDetails: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { minKeys: 0, maxKeys: 5 },
);

/**
 * 発行者アクティビティログエントリを生成する arbitrary
 */
const arbIssuerEntry: fc.Arbitrary<ActivityLogEntry> = fc
  .record({
    id: fc.uuid(),
    timestamp: arbISOTimestamp,
    action: fc.constantFrom(...ISSUER_ACTIONS),
    status: fc.constantFrom('success' as const, 'failure' as const),
    details: arbDetails,
    errorReason: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  })
  .map((entry) => ({
    ...entry,
    component: 'issuer' as const,
    // 失敗時にはエラー理由を必ず含める
    errorReason: entry.status === 'failure'
      ? (entry.errorReason ?? 'Unknown error')
      : undefined,
  }));

/**
 * ウォレットアクティビティログエントリを生成する arbitrary
 * 関連情報（発行者情報または検証者情報）を details に含める
 */
const arbWalletEntry: fc.Arbitrary<ActivityLogEntry> = fc
  .record({
    id: fc.uuid(),
    timestamp: arbISOTimestamp,
    action: fc.constantFrom(...WALLET_ACTIONS),
    status: fc.constantFrom('success' as const, 'failure' as const),
    relatedInfo: fc.string({ minLength: 1 }),
  })
  .map((entry) => {
    const details: Record<string, unknown> =
      entry.action === 'presentation_submitted'
        ? { verifierInfo: entry.relatedInfo }
        : { issuerInfo: entry.relatedInfo };
    return {
      id: entry.id,
      timestamp: entry.timestamp,
      component: 'wallet' as const,
      action: entry.action,
      status: entry.status,
      details,
    };
  });

/**
 * 検証者アクティビティログエントリを生成する arbitrary
 */
const arbVerifierEntry: fc.Arbitrary<ActivityLogEntry> = fc
  .record({
    id: fc.uuid(),
    timestamp: arbISOTimestamp,
    action: fc.constantFrom(...VERIFIER_ACTIONS),
    status: fc.constantFrom('success' as const, 'failure' as const),
    details: arbDetails,
    errorReason: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  })
  .map((entry) => ({
    ...entry,
    component: 'verifier' as const,
    // 検証失敗時には失敗理由を必ず含める
    errorReason: entry.status === 'failure'
      ? (entry.errorReason ?? 'Verification failed')
      : undefined,
  }));

describe('ActivityLogger - Property-Based Tests', () => {
  let logger: ActivityLogger;

  beforeEach(() => {
    logger = new ActivityLogger();
  });

  // Feature: vcknots-verifiable-credentials, Property 16: 発行者アクティビティログの完全性
  // **Validates: Requirements 19.1, 19.2, 19.3**
  describe('Property 16: 発行者アクティビティログの完全性', () => {
    it('任意の発行者操作に対して、記録後のログにタイムスタンプ・操作種別・操作結果が含まれる', () => {
      fc.assert(
        fc.property(arbIssuerEntry, (entry) => {
          logger.clear();
          logger.log(entry);

          const logs = logger.getLogs();
          expect(logs.length).toBeGreaterThanOrEqual(1);

          const recorded = logs.find((l) => l.id === entry.id);
          expect(recorded).toBeDefined();

          // タイムスタンプが含まれる
          expect(recorded!.timestamp).toBe(entry.timestamp);
          // 操作種別が含まれる
          expect(recorded!.action).toBe(entry.action);
          expect(ISSUER_ACTIONS).toContain(recorded!.action);
          // 操作結果が含まれる
          expect(recorded!.status).toBe(entry.status);
          // コンポーネントが issuer である
          expect(recorded!.component).toBe('issuer');

          // 失敗の場合はエラー理由も含まれる
          if (entry.status === 'failure') {
            expect(recorded!.errorReason).toBeDefined();
            expect(typeof recorded!.errorReason).toBe('string');
            expect(recorded!.errorReason!.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 17: ウォレットアクティビティログの完全性
  // **Validates: Requirements 19.4, 19.5, 19.6**
  describe('Property 17: ウォレットアクティビティログの完全性', () => {
    it('任意のウォレット操作に対して、記録後のログにタイムスタンプ・操作種別・関連情報が含まれる', () => {
      fc.assert(
        fc.property(arbWalletEntry, (entry) => {
          logger.clear();
          logger.log(entry);

          const logs = logger.getLogs();
          expect(logs.length).toBeGreaterThanOrEqual(1);

          const recorded = logs.find((l) => l.id === entry.id);
          expect(recorded).toBeDefined();

          // タイムスタンプが含まれる
          expect(recorded!.timestamp).toBe(entry.timestamp);
          // 操作種別が含まれる
          expect(recorded!.action).toBe(entry.action);
          expect(WALLET_ACTIONS).toContain(recorded!.action);
          // コンポーネントが wallet である
          expect(recorded!.component).toBe('wallet');

          // 関連情報（発行者情報または検証者情報）が details に含まれる
          if (entry.action === 'presentation_submitted') {
            expect(recorded!.details).toHaveProperty('verifierInfo');
            expect(typeof recorded!.details.verifierInfo).toBe('string');
          } else {
            // offer_received, credential_acquired は発行者情報を含む
            expect(recorded!.details).toHaveProperty('issuerInfo');
            expect(typeof recorded!.details.issuerInfo).toBe('string');
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // Feature: vcknots-verifiable-credentials, Property 18: 検証者アクティビティログの完全性
  // **Validates: Requirements 19.7, 19.8, 19.9**
  describe('Property 18: 検証者アクティビティログの完全性', () => {
    it('任意の検証者操作に対して、記録後のログにタイムスタンプ・操作種別・操作結果が含まれる', () => {
      fc.assert(
        fc.property(arbVerifierEntry, (entry) => {
          logger.clear();
          logger.log(entry);

          const logs = logger.getLogs();
          expect(logs.length).toBeGreaterThanOrEqual(1);

          const recorded = logs.find((l) => l.id === entry.id);
          expect(recorded).toBeDefined();

          // タイムスタンプが含まれる
          expect(recorded!.timestamp).toBe(entry.timestamp);
          // 操作種別が含まれる
          expect(recorded!.action).toBe(entry.action);
          expect(VERIFIER_ACTIONS).toContain(recorded!.action);
          // 操作結果が含まれる
          expect(recorded!.status).toBe(entry.status);
          // コンポーネントが verifier である
          expect(recorded!.component).toBe('verifier');

          // 検証失敗の場合は失敗理由も含まれる
          if (entry.status === 'failure') {
            expect(recorded!.errorReason).toBeDefined();
            expect(typeof recorded!.errorReason).toBe('string');
            expect(recorded!.errorReason!.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
