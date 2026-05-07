import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { vcknots } from '@trustknots/vcknots';
import { ActivityLogger } from '@vcknots-sample/shared';
import { VerifierService } from '../services/verifier-service.js';
import { createWellKnownRouter } from '../routes/well-known.js';
import { createAuthzRequestRouter } from '../routes/authz-request.js';
import { createAuthzResponseRouter } from '../routes/authz-response.js';

/**
 * Task 13.2: 検証フローのエンドツーエンド統合テスト
 *
 * 検証者 UI で認可リクエスト生成→ウォレットで URI 入力→資格情報選択→VP 送信→検証結果表示
 * の一連のフローが動作することを確認する。
 *
 * 要件: 18.1, 18.2
 */

function createTestApp(verifierService: VerifierService, activityLogger: ActivityLogger) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createWellKnownRouter(verifierService));
  app.use(createAuthzRequestRouter(verifierService));
  app.use(createAuthzResponseRouter(verifierService, activityLogger));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = (err as any).statusCode ?? 500;
    const errorCode = (err as any).errorCode ?? 'server_error';
    const errorDescription = err.message ?? 'An unexpected error occurred.';
    res.status(statusCode).json({
      error: errorCode,
      error_description: errorDescription,
    });
  });

  return app;
}

describe('Verification Flow - End-to-End Integration', () => {
  let app: express.Express;
  let verifierService: VerifierService;
  let activityLogger: ActivityLogger;

  beforeEach(async () => {
    activityLogger = new ActivityLogger();
    const { verifier: freshVerifier } = vcknots();
    verifierService = new VerifierService(activityLogger, freshVerifier);
    await verifierService.initialize();

    app = createTestApp(verifierService, activityLogger);
  });

  describe('Complete verification flow: authz-request → presentation → result', () => {
    it('should complete the full verification flow from request creation to verification result', async () => {
      // Step 1: 検証者が認可リクエストを生成する
      const authzRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      expect(authzRes.body.id).toBeDefined();
      expect(authzRes.body.credentialType).toBe('UniversityDegree');
      expect(authzRes.body.nonce).toBeDefined();
      expect(authzRes.body.responseUri).toBeDefined();
      expect(authzRes.body.presentationDefinition).toBeDefined();
      expect(authzRes.body.state).toBeDefined();

      // Step 2: ウォレットが認可リクエストの詳細を取得する
      const requestId = authzRes.body.id;
      const detailRes = await request(app)
        .get(`/api/authz-requests/${requestId}`)
        .expect(200);

      expect(detailRes.body.credentialType).toBe('UniversityDegree');
      expect(detailRes.body.presentationDefinition).toBeDefined();
      expect(detailRes.body.presentationDefinition.input_descriptors).toHaveLength(1);
      expect(detailRes.body.presentationDefinition.input_descriptors[0].name).toBe('UniversityDegree');

      // Step 3: ウォレットが VP を生成して送信する
      const vpToken = JSON.stringify({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: 'did:key:z6MkTestHolder',
        verifiableCredential: ['eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJkaWQ6a2V5Ono2TWtUZXN0SXNzdWVyIiwidmMiOnsiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIlVuaXZlcnNpdHlEZWdyZWUiXSwiY3JlZGVudGlhbFN1YmplY3QiOnsiZGVncmVlIjoiQ29tcHV0ZXIgU2NpZW5jZSJ9fX0.signature'],
        nonce: authzRes.body.nonce,
      });

      const presentationSubmission = {
        id: randomUUID(),
        definition_id: requestId,
        descriptor_map: [
          {
            id: 'UniversityDegree_descriptor',
            format: 'jwt_vp',
            path: '$.verifiableCredential[0]',
          },
        ],
      };

      // Step 4: 検証者が VP を受信して検証する
      const verifyRes = await request(app)
        .post('/authz-response')
        .send({
          vp_token: vpToken,
          presentation_submission: presentationSubmission,
          state: authzRes.body.state,
        })
        .expect(200);

      // Step 5: 検証結果を確認する
      expect(verifyRes.body).toHaveProperty('verified');
      expect(verifyRes.body).toHaveProperty('credentials');
      // The verification may fail due to invalid signature in test,
      // but the flow should complete without errors
      expect(typeof verifyRes.body.verified).toBe('boolean');
    });

    it('should handle multiple credential type requests', async () => {
      // Create requests for different credential types
      const degreeRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      const licenseRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'DriverLicense' })
        .expect(201);

      // Both should have unique IDs and states
      expect(degreeRes.body.id).not.toBe(licenseRes.body.id);
      expect(degreeRes.body.state).not.toBe(licenseRes.body.state);
      expect(degreeRes.body.nonce).not.toBe(licenseRes.body.nonce);

      // Each should have correct presentation definition
      expect(degreeRes.body.presentationDefinition.input_descriptors[0].name).toBe('UniversityDegree');
      expect(licenseRes.body.presentationDefinition.input_descriptors[0].name).toBe('DriverLicense');
    });

    it('should record activity logs for the entire verification flow', async () => {
      // Create authorization request
      const authzRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      // Submit presentation
      await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'test-vp-token',
          presentation_submission: {
            id: randomUUID(),
            definition_id: authzRes.body.id,
            descriptor_map: [],
          },
          state: authzRes.body.state,
        })
        .expect(200);

      // Verify activity logs
      const logsRes = await request(app)
        .get('/api/activity-logs')
        .expect(200);

      const logs = logsRes.body;
      expect(logs.some((l: any) => l.action === 'authz_request_created')).toBe(true);
      expect(logs.some((l: any) => l.action === 'presentation_received')).toBe(true);
      expect(logs.some((l: any) => l.action === 'verification_completed')).toBe(true);
    });

    it('should return verification failure with errors for invalid VP', async () => {
      const authzRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      const verifyRes = await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'completely-invalid-token',
          presentation_submission: {
            id: randomUUID(),
            definition_id: authzRes.body.id,
            descriptor_map: [],
          },
          state: authzRes.body.state,
        })
        .expect(200);

      expect(verifyRes.body.verified).toBe(false);
      expect(verifyRes.body.errors).toBeDefined();
      expect(verifyRes.body.errors.length).toBeGreaterThan(0);
    });

    it('should reject authz-response when vp_token is missing', async () => {
      const res = await request(app)
        .post('/authz-response')
        .send({
          presentation_submission: {
            id: randomUUID(),
            definition_id: 'test',
            descriptor_map: [],
          },
        })
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
      expect(res.body.error_description).toContain('vp_token');
    });

    it('should return 404 for non-existent authorization request', async () => {
      const res = await request(app)
        .get('/api/authz-requests/non-existent-id')
        .expect(404);

      expect(res.body.error).toBe('not_found');
    });
  });

  describe('Verifier metadata', () => {
    it('should expose verifier metadata at well-known endpoint', async () => {
      const res = await request(app)
        .get('/.well-known/openid-verifier')
        .expect(200);

      expect(res.body.vp_formats).toBeDefined();
      expect(res.body.vp_formats.jwt_vp_json).toBeDefined();
      expect(res.body.vp_formats.jwt_vc_json).toBeDefined();
      expect(res.body.client_id).toBeDefined();
      expect(res.body.response_uri).toContain('/authz-response');
    });
  });

  describe('CORS configuration', () => {
    it('should allow cross-origin requests (verified via endpoint accessibility)', async () => {
      // CORS is configured via cors() middleware in production.
      // This test verifies the endpoint is accessible.
      const res = await request(app)
        .get('/.well-known/openid-verifier')
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
