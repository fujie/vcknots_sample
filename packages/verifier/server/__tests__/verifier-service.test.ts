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

function createTestApp(verifierService: VerifierService, activityLogger: ActivityLogger) {
  const app = express();
  app.use(express.json());
  app.use(createWellKnownRouter(verifierService));
  app.use(createAuthzRequestRouter(verifierService));
  app.use(createAuthzResponseRouter(verifierService, activityLogger));

  // Error handling middleware
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

describe('Verifier REST API Routes', () => {
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

  describe('GET /.well-known/openid-verifier', () => {
    it('should return verifier metadata as JSON', async () => {
      const res = await request(app)
        .get('/.well-known/openid-verifier')
        .expect(200);

      expect(res.body).toBeDefined();
      expect(res.body.vp_formats).toBeDefined();
      expect(res.body.client_id).toBeDefined();
    });

    it('should include vp_formats with supported algorithms', async () => {
      const res = await request(app)
        .get('/.well-known/openid-verifier')
        .expect(200);

      expect(res.body.vp_formats).toHaveProperty('jwt_vp_json');
      expect(res.body.vp_formats).toHaveProperty('jwt_vc_json');
    });

    it('should include response_uri', async () => {
      const res = await request(app)
        .get('/.well-known/openid-verifier')
        .expect(200);

      expect(res.body.response_uri).toContain('/authz-response');
    });
  });

  describe('POST /api/authz-requests', () => {
    it('should create an authorization request and return 201', async () => {
      const res = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.credentialType).toBe('UniversityDegree');
      expect(res.body.nonce).toBeDefined();
      expect(res.body.responseUri).toBeDefined();
      expect(res.body.presentationDefinition).toBeDefined();
      expect(res.body.state).toBeDefined();
    });

    it('should return HTTP 400 when credentialType is missing', async () => {
      const res = await request(app)
        .post('/api/authz-requests')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
      expect(res.body.error_description).toBeDefined();
    });

    it('should include presentation_definition with input_descriptors', async () => {
      const res = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'DriverLicense' })
        .expect(201);

      const pd = res.body.presentationDefinition;
      expect(pd.input_descriptors).toBeDefined();
      expect(pd.input_descriptors).toHaveLength(1);
      expect(pd.input_descriptors[0].name).toBe('DriverLicense');
      expect(pd.input_descriptors[0].constraints.fields).toBeDefined();
    });

    it('should log authz_request_created activity', async () => {
      await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      const logs = activityLogger.getLogs();
      const authzLog = logs.find((l) => l.action === 'authz_request_created');
      expect(authzLog).toBeDefined();
      expect(authzLog!.status).toBe('success');
      expect(authzLog!.component).toBe('verifier');
    });
  });

  describe('GET /api/authz-requests/:id', () => {
    it('should return authorization request details for valid id', async () => {
      const createRes = await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' })
        .expect(201);

      const requestId = createRes.body.id;

      const res = await request(app)
        .get(`/api/authz-requests/${requestId}`)
        .expect(200);

      expect(res.body.credentialType).toBe('UniversityDegree');
      expect(res.body.nonce).toBeDefined();
      expect(res.body.presentationDefinition).toBeDefined();
    });

    it('should return 404 for non-existent authorization request', async () => {
      const res = await request(app)
        .get('/api/authz-requests/non-existent-id')
        .expect(404);

      expect(res.body.error).toBe('not_found');
    });
  });

  describe('POST /authz-response', () => {
    it('should return HTTP 400 when vp_token is missing', async () => {
      const res = await request(app)
        .post('/authz-response')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
      expect(res.body.error_description).toContain('vp_token');
    });

    it('should return verification failure for invalid vp_token', async () => {
      const res = await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'invalid-token',
          presentation_submission: {
            id: randomUUID(),
            definition_id: randomUUID(),
            descriptor_map: [],
          },
        })
        .expect(200);

      expect(res.body.verified).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should log presentation_received and verification_completed activities', async () => {
      await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'some-token',
          presentation_submission: {
            id: randomUUID(),
            definition_id: randomUUID(),
            descriptor_map: [],
          },
        })
        .expect(200);

      const logs = activityLogger.getLogs();
      const receivedLog = logs.find((l) => l.action === 'presentation_received');
      const completedLog = logs.find((l) => l.action === 'verification_completed');

      expect(receivedLog).toBeDefined();
      expect(receivedLog!.component).toBe('verifier');
      expect(completedLog).toBeDefined();
      expect(completedLog!.component).toBe('verifier');
    });

    it('should return verification result with errors array on failure', async () => {
      const res = await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'malformed.jwt.token',
          presentation_submission: {
            id: 'sub-1',
            definition_id: 'def-1',
            descriptor_map: [],
          },
          state: 'test-state',
        })
        .expect(200);

      expect(res.body.verified).toBe(false);
      expect(res.body.credentials).toEqual([]);
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it('should log failure reason when verification fails', async () => {
      await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'invalid',
          presentation_submission: {
            id: 'sub-1',
            definition_id: 'def-1',
            descriptor_map: [],
          },
        })
        .expect(200);

      const logs = activityLogger.getLogs();
      const failureLog = logs.find(
        (l) => l.action === 'verification_completed' && l.status === 'failure',
      );
      expect(failureLog).toBeDefined();
      expect(failureLog!.errorReason).toBeDefined();
    });
  });

  describe('GET /api/activity-logs', () => {
    it('should return empty array when no activity has occurred', async () => {
      const res = await request(app)
        .get('/api/activity-logs')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return all activity logs', async () => {
      // Trigger some activities
      await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'UniversityDegree' });

      await request(app)
        .post('/authz-response')
        .send({
          vp_token: 'test-token',
          presentation_submission: {
            id: 'sub-1',
            definition_id: 'def-1',
            descriptor_map: [],
          },
        });

      const res = await request(app)
        .get('/api/activity-logs')
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(3); // authz_request_created + presentation_received + verification_completed
    });

    it('should include timestamp and component in each log entry', async () => {
      await request(app)
        .post('/api/authz-requests')
        .send({ credentialType: 'TestCredential' });

      const res = await request(app)
        .get('/api/activity-logs')
        .expect(200);

      for (const log of res.body) {
        expect(log.timestamp).toBeDefined();
        expect(log.component).toBe('verifier');
        expect(log.action).toBeDefined();
        expect(log.status).toBeDefined();
      }
    });
  });

  describe('Error handling middleware', () => {
    it('should format errors with error and error_description fields', async () => {
      const res = await request(app)
        .post('/api/authz-requests')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('error_description');
      expect(typeof res.body.error).toBe('string');
      expect(typeof res.body.error_description).toBe('string');
    });
  });
});
