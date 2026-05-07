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
 * Task 13.4: 検証者サーバーのインテグレーションテスト（追加シナリオ）
 *
 * メタデータエンドポイント、認可リクエストエンドポイント、認可レスポンスエンドポイントの
 * 連携テストを追加する。
 *
 * 要件: 4.1-4.3, 5.1-5.5, 6.1-6.6
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

describe('Verifier Server - Integration Tests (Full Flow)', () => {
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

  describe('Metadata endpoint (Requirements 4.1-4.3)', () => {
    it('should return metadata with vp_formats supporting jwt_vp_json and jwt_vc_json', async () => {
      const res = await request(app)
        .get('/.well-known/openid-verifier')
        .expect(200);

      expect(res.body.vp_formats).toBeDefined();
      expect(res.body.vp_formats.jwt_vp_json).toBeDefined();
      expect(res.body.vp_formats.jwt_vp_json.alg).toContain('ES256');
      expect(res.body.vp_formats.jwt_vc_json).toBeDefined();
      expect(res.body.vp_formats.jwt_vc_json.alg).toContain('ES256');
    });

    it('should include client_id and response_uri in metadata', async () => {
      const res = await request(app)
        .get('/.well-known/openid-verifier')
        .expect(200);

      expect(res.body.client_id).toBeDefined();
      expect(typeof res.body.client_id).toBe('string');
      expect(res.body.response_uri).toBeDefined();
      expect(res.body.response_uri).toContain('/authz-response');
    });
  });

  describe('Authorization request endpoint (Requirements 5.1-5.5)', () => {
    it('should create authorization request with Presentation Exchange format', async () => {
      const res = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      // Verify Presentation Definition structure
      const pd = res.body.presentationDefinition;
      expect(pd).toBeDefined();
      expect(pd.id).toBeDefined();
      expect(pd.input_descriptors).toBeDefined();
      expect(pd.input_descriptors).toHaveLength(1);

      // Verify input descriptor
      const descriptor = pd.input_descriptors[0];
      expect(descriptor.id).toBeDefined();
      expect(descriptor.name).toBe('UniversityDegree');
      expect(descriptor.purpose).toContain('UniversityDegree');
      expect(descriptor.constraints).toBeDefined();
      expect(descriptor.constraints.fields).toBeDefined();
      expect(descriptor.constraints.fields.length).toBeGreaterThan(0);

      // Verify field constraint targets $.type
      const typeField = descriptor.constraints.fields.find(
        (f: any) => f.path.includes('$.type'),
      );
      expect(typeField).toBeDefined();
      expect(typeField.filter.contains.const).toBe('UniversityDegree');
    });

    it('should generate unique nonce and state for each request', async () => {
      const res1 = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      const res2 = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      expect(res1.body.nonce).not.toBe(res2.body.nonce);
      expect(res1.body.state).not.toBe(res2.body.state);
      expect(res1.body.id).not.toBe(res2.body.id);
    });

    it('should include responseUri pointing to authz-response endpoint', async () => {
      const res = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'DriverLicense' })
        .expect(201);

      expect(res.body.responseUri).toContain('/authz-response');
    });

    it('should reject request without credentialType', async () => {
      const res = await request(app)
        .post('/api/authz-requests')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
    });
  });

  describe('Authorization response endpoint (Requirements 6.1-6.6)', () => {
    it('should accept and process VP submission with presentation_submission', async () => {
      const authzRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      const vpToken = JSON.stringify({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: 'did:key:z6MkTestHolder',
        verifiableCredential: ['eyJ.payload.sig'],
      });

      const res = await request(app)
        .post('/authz-response')
        .send({
          vp_token: vpToken,
          presentation_submission: {
            id: randomUUID(),
            definition_id: authzRes.body.id,
            descriptor_map: [{
              id: 'UniversityDegree_descriptor',
              format: 'jwt_vp',
              path: '$.verifiableCredential[0]',
            }],
          },
          state: authzRes.body.state,
        })
        .expect(200);

      // Should return a verification result (may fail due to invalid signature)
      expect(res.body).toHaveProperty('verified');
      expect(res.body).toHaveProperty('credentials');
      expect(Array.isArray(res.body.credentials)).toBe(true);
    });

    it('should return verification result with errors array when VP is invalid', async () => {
      const res = await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'invalid-vp-token',
          presentation_submission: {
            id: randomUUID(),
            definition_id: 'test-def',
            descriptor_map: [],
          },
        })
        .expect(200);

      expect(res.body.verified).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should reject submission without vp_token', async () => {
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
    });

    it('should log all verification activities', async () => {
      // Submit a presentation
      await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'test-token',
          presentation_submission: {
            id: randomUUID(),
            definition_id: 'test',
            descriptor_map: [],
          },
          state: 'test-state',
        })
        .expect(200);

      // Check activity logs
      const logsRes = await request(app)
        .get('/api/activity-logs')
        .expect(200);

      const logs = logsRes.body;
      const receivedLog = logs.find((l: any) => l.action === 'presentation_received');
      const completedLog = logs.find((l: any) => l.action === 'verification_completed');

      expect(receivedLog).toBeDefined();
      expect(receivedLog.component).toBe('verifier');
      expect(receivedLog.status).toBe('success');

      expect(completedLog).toBeDefined();
      expect(completedLog.component).toBe('verifier');
    });
  });

  describe('Full verification flow chaining', () => {
    it('should support creating request, retrieving it, and submitting response', async () => {
      // Step 1: Create authorization request
      const createRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'EmploymentCertificate' })
        .expect(201);

      const requestId = createRes.body.id;

      // Step 2: Retrieve the request details
      const getRes = await request(app)
        .get(`/api/authz-requests/${requestId}`)
        .expect(200);

      expect(getRes.body.credentialType).toBe('EmploymentCertificate');
      expect(getRes.body.presentationDefinition.input_descriptors[0].name).toBe('EmploymentCertificate');

      // Step 3: Submit presentation response
      const verifyRes = await request(app)
        .post('/authz-response')
        .send({
          vp_token: JSON.stringify({
            type: ['VerifiablePresentation'],
            holder: 'did:key:z6MkHolder',
            verifiableCredential: [],
          }),
          presentation_submission: {
            id: randomUUID(),
            definition_id: requestId,
            descriptor_map: [],
          },
          state: createRes.body.state,
        })
        .expect(200);

      expect(verifyRes.body).toHaveProperty('verified');

      // Step 4: Verify all activities are logged
      const logsRes = await request(app)
        .get('/api/activity-logs')
        .expect(200);

      expect(logsRes.body.length).toBeGreaterThanOrEqual(3);
    });
  });
});
