import { describe, it, expect, beforeEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { vcknots } from '@trustknots/vcknots';
import { ActivityLogger } from '@vcknots-sample/shared';
import type { CredentialSchema } from '@vcknots-sample/shared';
import { SchemaService } from '../services/schema-service.js';
import { IssuerService } from '../services/issuer-service.js';
import { createWellKnownRouter } from '../routes/well-known.js';
import { createTokenRouter } from '../routes/token.js';
import { createCredentialRouter } from '../routes/credential.js';
import { createOffersRouter } from '../routes/offers.js';

function createTestApp(issuerService: IssuerService, activityLogger: ActivityLogger) {
  const app = express();
  app.use(express.json());
  app.use(createWellKnownRouter(issuerService));
  app.use(createTokenRouter(issuerService));
  app.use(createCredentialRouter(issuerService));
  app.use(createOffersRouter(issuerService, activityLogger));

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

describe('Issuer REST API Routes', () => {
  let app: express.Express;
  let issuerService: IssuerService;
  let activityLogger: ActivityLogger;
  let schemasPath: string;

  beforeEach(async () => {
    const tempDir = join(tmpdir(), `vcknots-routes-test-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });
    schemasPath = join(tempDir, 'schemas.json');

    const testSchemas: CredentialSchema[] = [
      {
        id: randomUUID(),
        name: 'UniversityDegree',
        version: '1.0',
        attributes: [
          { name: 'degree', type: 'string', required: true },
          { name: 'gpa', type: 'number', required: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await writeFile(schemasPath, JSON.stringify(testSchemas));

    const schemaService = new SchemaService(schemasPath);
    activityLogger = new ActivityLogger();
    const { issuer: freshIssuer } = vcknots();
    issuerService = new IssuerService(schemaService, activityLogger, freshIssuer);
    await issuerService.initialize();

    app = createTestApp(issuerService, activityLogger);
  });

  describe('GET /.well-known/openid-credential-issuer', () => {
    it('should return issuer metadata as JSON', async () => {
      const res = await request(app)
        .get('/.well-known/openid-credential-issuer')
        .expect(200);

      expect(res.body.credential_issuer).toBeDefined();
      expect(res.body.credential_endpoint).toBeDefined();
    });
  });

  describe('POST /token', () => {
    it('should return HTTP 400 with invalid_grant for invalid pre-authorized code', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': 'invalid-code',
        })
        .expect(400);

      expect(res.body.error).toBe('invalid_grant');
      expect(res.body.error_description).toBeDefined();
    });

    it('should return HTTP 400 with unsupported_grant_type for wrong grant type', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'authorization_code',
          'pre-authorized_code': 'some-code',
        })
        .expect(400);

      expect(res.body.error).toBe('unsupported_grant_type');
    });

    it('should return HTTP 400 with invalid_request when pre-authorized_code is missing', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        })
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
    });

    it('should return valid token response for valid pre-authorized code', async () => {
      // First create an offer to get a valid pre-authorized code
      const offer = await issuerService.createOffer('UniversityDegree', { degree: 'CS' });
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': preAuthCode,
        })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.token_type).toBe('Bearer');
      expect(res.body.expires_in).toBeGreaterThan(0);
    });
  });

  describe('POST /credential', () => {
    it('should return HTTP 401 with invalid_token for invalid access token', async () => {
      const res = await request(app)
        .post('/credential')
        .set('Authorization', 'Bearer invalid-token')
        .send({ proof: { proof_type: 'jwt', jwt: 'test' } })
        .expect(401);

      expect(res.body.error).toBe('invalid_token');
      expect(res.body.error_description).toBeDefined();
    });

    it('should return HTTP 401 when no Authorization header is provided', async () => {
      const res = await request(app)
        .post('/credential')
        .send({ proof: { proof_type: 'jwt', jwt: 'test' } })
        .expect(401);

      expect(res.body.error).toBe('invalid_token');
    });

    it('should return HTTP 400 when proof is missing', async () => {
      const res = await request(app)
        .post('/credential')
        .set('Authorization', 'Bearer some-token')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
    });
  });

  describe('POST /api/offers', () => {
    it('should create an offer and return 201', async () => {
      const res = await request(app)
        .post('/api/offers')
        .send({ credentialType: 'UniversityDegree', claims: { degree: 'CS' } })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.offer).toBeDefined();
      expect(res.body.offer.credential_issuer).toBeDefined();
    });

    it('should return HTTP 400 when credentialType is missing', async () => {
      const res = await request(app)
        .post('/api/offers')
        .send({ claims: { degree: 'CS' } })
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
    });

    it('should return error for undefined credential type', async () => {
      const res = await request(app)
        .post('/api/offers')
        .send({ credentialType: 'NonExistent', claims: {} })
        .expect(500);

      expect(res.body.error).toBe('server_error');
      expect(res.body.error_description).toContain('Schema not found');
    });
  });

  describe('GET /api/history', () => {
    it('should return empty array when no credentials have been issued', async () => {
      const res = await request(app)
        .get('/api/history')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return only credential_issued logs', async () => {
      // Manually add some logs to test filtering
      activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'offer_created',
        status: 'success',
        details: {},
      });
      activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'credential_issued',
        status: 'success',
        details: { credentialType: 'UniversityDegree' },
      });

      const res = await request(app)
        .get('/api/history')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].action).toBe('credential_issued');
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
      activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'offer_created',
        status: 'success',
        details: {},
      });
      activityLogger.log({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        component: 'issuer',
        action: 'issuance_failed',
        status: 'failure',
        details: {},
        errorReason: 'test error',
      });

      const res = await request(app)
        .get('/api/activity-logs')
        .expect(200);

      expect(res.body).toHaveLength(2);
    });
  });

  describe('Error handling middleware', () => {
    it('should format OID4VCI errors with error and error_description fields', async () => {
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': 'invalid',
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('error_description');
      expect(typeof res.body.error).toBe('string');
      expect(typeof res.body.error_description).toBe('string');
    });
  });
});
