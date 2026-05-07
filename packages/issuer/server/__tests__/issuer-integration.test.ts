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

/**
 * Task 13.4: 発行者サーバーのインテグレーションテスト（追加シナリオ）
 *
 * メタデータエンドポイント、トークンエンドポイント、資格情報エンドポイントの
 * 連携テストを追加する。
 *
 * 要件: 1.1-1.4, 3.1-3.5
 */

function createTestApp(issuerService: IssuerService, activityLogger: ActivityLogger) {
  const app = express();
  app.use(express.json());
  app.use(createWellKnownRouter(issuerService));
  app.use(createTokenRouter(issuerService));
  app.use(createCredentialRouter(issuerService));
  app.use(createOffersRouter(issuerService, activityLogger));

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

describe('Issuer Server - Integration Tests (Full Flow)', () => {
  let app: express.Express;
  let issuerService: IssuerService;
  let activityLogger: ActivityLogger;

  beforeEach(async () => {
    const tempDir = join(tmpdir(), `vcknots-issuer-int-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });
    const schemasPath = join(tempDir, 'schemas.json');

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
      {
        id: randomUUID(),
        name: 'EmploymentCertificate',
        version: '1.0',
        attributes: [
          { name: 'company', type: 'string', required: true },
          { name: 'position', type: 'string', required: true },
          { name: 'startDate', type: 'date', required: true },
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

  describe('Metadata endpoint (Requirements 1.1-1.4)', () => {
    it('should return credential_configurations_supported matching defined schemas', async () => {
      const res = await request(app)
        .get('/.well-known/openid-credential-issuer')
        .expect(200);

      const configs = res.body.credential_configurations_supported;
      expect(configs).toBeDefined();
      expect(configs['UniversityDegree']).toBeDefined();
      expect(configs['UniversityDegree'].format).toBe('jwt_vc_json');
    });

    it('should include credential_endpoint in metadata', async () => {
      const res = await request(app)
        .get('/.well-known/openid-credential-issuer')
        .expect(200);

      expect(res.body.credential_endpoint).toBeDefined();
      expect(res.body.credential_endpoint).toContain('/credential');
    });

    it('should include proof_types_supported with ES256', async () => {
      const res = await request(app)
        .get('/.well-known/openid-credential-issuer')
        .expect(200);

      const configs = res.body.credential_configurations_supported;
      const degreeConfig = configs['UniversityDegree'];
      expect(degreeConfig.proof_types_supported).toBeDefined();
      expect(degreeConfig.proof_types_supported.jwt.proof_signing_alg_values_supported).toContain('ES256');
    });
  });

  describe('Token endpoint (Requirements 3.1-3.5)', () => {
    it('should return token with correct structure for valid code', async () => {
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

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('token_type', 'Bearer');
      expect(res.body).toHaveProperty('expires_in');
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.access_token.length).toBeGreaterThan(0);
    });

    it('should reject reused pre-authorized code with invalid_grant', async () => {
      const offer = await issuerService.createOffer('UniversityDegree', { degree: 'CS' });
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      // First use succeeds
      await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': preAuthCode,
        })
        .expect(200);

      // Second use fails
      const res = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': preAuthCode,
        })
        .expect(400);

      expect(res.body.error).toBe('invalid_grant');
    });
  });

  describe('Credential endpoint (Requirements 3.2, 3.3, 3.5)', () => {
    it('should verify claims are preserved in token store after offer and token exchange', async () => {
      const claims = { degree: 'Mathematics', gpa: 3.7 };

      // Create offer
      const offer = await issuerService.createOffer('UniversityDegree', claims);
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      // Exchange token
      const tokenRes = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': preAuthCode,
        })
        .expect(200);

      // Verify claims are stored correctly for credential issuance
      const tokenStore = issuerService.getTokenStore();
      const tokenData = tokenStore.get(tokenRes.body.access_token);
      expect(tokenData).toBeDefined();
      expect(tokenData!.claims.degree).toBe('Mathematics');
      expect(tokenData!.claims.gpa).toBe(3.7);
      expect(tokenData!.credentialType).toBe('UniversityDegree');
    });

    it('should accept valid access token (not return 401) when issuing credential', async () => {
      const claims = { degree: 'CS', gpa: 3.5 };

      const offer = await issuerService.createOffer('UniversityDegree', claims);
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      const tokenRes = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': preAuthCode,
        })
        .expect(200);

      // With a valid token, the endpoint should NOT return 401
      // (it may return 500 due to vcknots proof validation, but not 401)
      const credRes = await request(app)
        .post('/credential')
        .set('Authorization', `Bearer ${tokenRes.body.access_token}`)
        .send({ proof: { proof_type: 'jwt', jwt: 'eyJ.test.sig' } });

      expect(credRes.status).not.toBe(401);
    });

    it('should reject credential request without Authorization header', async () => {
      const res = await request(app)
        .post('/credential')
        .send({ proof: { proof_type: 'jwt', jwt: 'test' } })
        .expect(401);

      expect(res.body.error).toBe('invalid_token');
    });

    it('should reject credential request with malformed Bearer token', async () => {
      const res = await request(app)
        .post('/credential')
        .set('Authorization', 'Bearer invalid-random-token')
        .send({ proof: { proof_type: 'jwt', jwt: 'test' } })
        .expect(401);

      expect(res.body.error).toBe('invalid_token');
    });

    it('should reject credential request without proof', async () => {
      const offer = await issuerService.createOffer('UniversityDegree', { degree: 'CS' });
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      const tokenRes = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': preAuthCode,
        })
        .expect(200);

      const res = await request(app)
        .post('/credential')
        .set('Authorization', `Bearer ${tokenRes.body.access_token}`)
        .send({})
        .expect(400);

      expect(res.body.error).toBe('invalid_request');
    });
  });

  describe('Multiple offers and concurrent flows', () => {
    it('should handle multiple concurrent issuance flows independently', async () => {
      // Create two offers
      const offer1 = await issuerService.createOffer('UniversityDegree', { degree: 'CS', gpa: 3.9 });
      const offer2 = await issuerService.createOffer('EmploymentCertificate', {
        company: 'TechCorp',
        position: 'Engineer',
        startDate: '2024-01-01',
      });

      const code1 = offer1.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']!['pre-authorized_code'];
      const code2 = offer2.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']!['pre-authorized_code'];

      // Exchange tokens for both
      const token1Res = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': code1,
        })
        .expect(200);

      const token2Res = await request(app)
        .post('/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          'pre-authorized_code': code2,
        })
        .expect(200);

      // Verify each token has correct claims stored
      const tokenStore = issuerService.getTokenStore();

      const tokenData1 = tokenStore.get(token1Res.body.access_token);
      expect(tokenData1).toBeDefined();
      expect(tokenData1!.claims.degree).toBe('CS');
      expect(tokenData1!.claims.gpa).toBe(3.9);
      expect(tokenData1!.credentialType).toBe('UniversityDegree');

      const tokenData2 = tokenStore.get(token2Res.body.access_token);
      expect(tokenData2).toBeDefined();
      expect(tokenData2!.claims.company).toBe('TechCorp');
      expect(tokenData2!.claims.position).toBe('Engineer');
      expect(tokenData2!.credentialType).toBe('EmploymentCertificate');
    });
  });
});
