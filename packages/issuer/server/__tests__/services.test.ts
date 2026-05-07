import { describe, it, expect, beforeEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { vcknots } from '@trustknots/vcknots';
import { ActivityLogger } from '@vcknots-sample/shared';
import type { CredentialSchema } from '@vcknots-sample/shared';
import { SchemaService } from '../services/schema-service.js';
import { IssuerService } from '../services/issuer-service.js';

describe('SchemaService', () => {
  let schemaService: SchemaService;
  let tempDir: string;
  let schemasPath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `vcknots-test-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });
    schemasPath = join(tempDir, 'schemas.json');
  });

  it('should return empty array when schemas file does not exist', async () => {
    schemaService = new SchemaService(join(tempDir, 'nonexistent.json'));
    const schemas = await schemaService.listSchemas();
    expect(schemas).toEqual([]);
  });

  it('should return empty array when schemas file is empty array', async () => {
    await writeFile(schemasPath, '[]');
    schemaService = new SchemaService(schemasPath);
    const schemas = await schemaService.listSchemas();
    expect(schemas).toEqual([]);
  });

  it('should list all schemas from file', async () => {
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
    schemaService = new SchemaService(schemasPath);

    const schemas = await schemaService.listSchemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0].name).toBe('UniversityDegree');
  });

  it('should get schema by credential type name', async () => {
    const testSchemas: CredentialSchema[] = [
      {
        id: randomUUID(),
        name: 'UniversityDegree',
        version: '1.0',
        attributes: [{ name: 'degree', type: 'string', required: true }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        name: 'DriverLicense',
        version: '1.0',
        attributes: [{ name: 'licenseNumber', type: 'string', required: true }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await writeFile(schemasPath, JSON.stringify(testSchemas));
    schemaService = new SchemaService(schemasPath);

    const schema = await schemaService.getSchema('DriverLicense');
    expect(schema).not.toBeNull();
    expect(schema!.name).toBe('DriverLicense');
  });

  it('should return null for non-existent schema', async () => {
    await writeFile(schemasPath, '[]');
    schemaService = new SchemaService(schemasPath);

    const schema = await schemaService.getSchema('NonExistent');
    expect(schema).toBeNull();
  });
});

describe('IssuerService', () => {
  let issuerService: IssuerService;
  let schemaService: SchemaService;
  let activityLogger: ActivityLogger;
  let tempDir: string;
  let schemasPath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `vcknots-test-${randomUUID()}`);
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

    schemaService = new SchemaService(schemasPath);
    activityLogger = new ActivityLogger();
    // Create a fresh vcknots instance per test to avoid shared state
    const { issuer: freshIssuer } = vcknots();
    issuerService = new IssuerService(schemaService, activityLogger, freshIssuer);
    await issuerService.initialize();
  });

  describe('createOffer', () => {
    it('should throw error for undefined credential type (requirement 2.5)', async () => {
      await expect(
        issuerService.createOffer('NonExistentType', { name: 'test' }),
      ).rejects.toThrow('Schema not found for credential type: NonExistentType');
    });

    it('should log failure when schema not found', async () => {
      try {
        await issuerService.createOffer('NonExistentType', { name: 'test' });
      } catch {
        // expected
      }
      const logs = activityLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('issuance_failed');
      expect(logs[0].status).toBe('failure');
      expect(logs[0].errorReason).toContain('NonExistentType');
    });

    it('should create offer for valid credential type', async () => {
      const offer = await issuerService.createOffer('UniversityDegree', {
        degree: 'Computer Science',
        gpa: 3.8,
      });

      expect(offer).toBeDefined();
      expect(offer.credential_issuer).toBeDefined();
      expect(
        offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.[
          'pre-authorized_code'
        ],
      ).toBeDefined();
    });

    it('should store offer data in offer store', async () => {
      const offer = await issuerService.createOffer('UniversityDegree', {
        degree: 'Computer Science',
      });

      const preAuthCode =
        offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.[
          'pre-authorized_code'
        ];
      expect(preAuthCode).toBeDefined();
      expect(issuerService.getOfferStore().has(preAuthCode!)).toBe(true);
    });

    it('should log offer_created activity on success', async () => {
      await issuerService.createOffer('UniversityDegree', {
        degree: 'Computer Science',
      });

      const logs = activityLogger.getLogs();
      expect(logs.some((l) => l.action === 'offer_created' && l.status === 'success')).toBe(true);
    });
  });

  describe('exchangeToken', () => {
    it('should throw error with invalid_grant for invalid pre-authorized code', async () => {
      try {
        await issuerService.exchangeToken('invalid-code');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('pre-authorized code is invalid');
        expect(err.errorCode).toBe('invalid_grant');
        expect(err.statusCode).toBe(400);
      }
    });

    it('should return valid token response for valid pre-authorized code', async () => {
      const offer = await issuerService.createOffer('UniversityDegree', {
        degree: 'CS',
      });
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      const tokenResponse = await issuerService.exchangeToken(preAuthCode);
      expect(tokenResponse.access_token).toBeDefined();
      expect(tokenResponse.token_type).toBe('Bearer');
      expect(tokenResponse.expires_in).toBeGreaterThan(0);
    });

    it('should invalidate pre-authorized code after use (one-time use)', async () => {
      const offer = await issuerService.createOffer('UniversityDegree', {
        degree: 'CS',
      });
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      await issuerService.exchangeToken(preAuthCode);

      // Second use should fail
      try {
        await issuerService.exchangeToken(preAuthCode);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.errorCode).toBe('invalid_grant');
      }
    });

    it('should store token data in token store', async () => {
      const offer = await issuerService.createOffer('UniversityDegree', {
        degree: 'CS',
      });
      const preAuthCode =
        offer.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']![
          'pre-authorized_code'
        ];

      const tokenResponse = await issuerService.exchangeToken(preAuthCode);
      expect(issuerService.getTokenStore().has(tokenResponse.access_token)).toBe(true);
    });
  });

  describe('issueCredential', () => {
    it('should throw error with invalid_token for invalid access token', async () => {
      try {
        await issuerService.issueCredential('invalid-token', {});
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('access token is invalid');
        expect(err.errorCode).toBe('invalid_token');
        expect(err.statusCode).toBe(401);
      }
    });

    it('should log failure for invalid access token', async () => {
      try {
        await issuerService.issueCredential('invalid-token', {});
      } catch {
        // expected
      }
      const logs = activityLogger.getLogs();
      expect(logs.some((l) => l.action === 'issuance_failed' && l.errorReason?.includes('access token'))).toBe(true);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata with credential_issuer and credential_endpoint', async () => {
      await issuerService.initialize();
      const metadata = await issuerService.getMetadata();
      expect(metadata.credential_issuer).toBeDefined();
      expect(metadata.credential_endpoint).toBeDefined();
    });
  });
});
