/**
 * Feature: vcknots-verifiable-credentials, Property 7: Credential Offer URI の解析正当性
 * Feature: vcknots-verifiable-credentials, Property 8: 不正な Credential Offer URI のエラー処理
 * Feature: vcknots-verifiable-credentials, Property 10: 認可リクエスト URI の解析正当性
 *
 * **Validates: Requirements 7.1, 7.4, 9.1**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { OID4Client } from '../services/oid4-client.js';

// @vitest-environment jsdom

describe('OID4Client - Property 7: Credential Offer URI の解析正当性', () => {
  let client: OID4Client;

  beforeEach(() => {
    localStorage.clear();
    client = new OID4Client();
  });

  it('有効な Credential Offer URI を正しく解析する', () => {
    fc.assert(
      fc.property(
        fc.record({
          issuerUrl: fc.stringMatching(/^https:\/\/[a-z]{3,10}\.[a-z]{2,5}$/),
          credentialType: fc.stringMatching(/^[A-Z][a-zA-Z]{3,20}$/),
          preAuthorizedCode: fc.stringMatching(/^[a-zA-Z0-9]{10,40}$/),
        }),
        ({ issuerUrl, credentialType, preAuthorizedCode }) => {
          const offer = {
            credential_issuer: issuerUrl,
            credential_configuration_ids: [credentialType],
            grants: {
              'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
                'pre-authorized_code': preAuthorizedCode,
              },
            },
          };

          const uri = `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(offer))}`;

          const result = client.parseCredentialOffer(uri);

          expect(result.issuerUrl).toBe(issuerUrl);
          expect(result.credentialType).toBe(credentialType);
          expect(result.preAuthorizedCode).toBe(preAuthorizedCode);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: vcknots-verifiable-credentials, Property 8: 不正な Credential Offer URI のエラー処理
 *
 * *任意の* 有効な Credential Offer URI の形式に適合しない文字列に対して、
 * 解析処理はエラーを返し、正常な ParsedCredentialOffer を生成しない。
 *
 * **Validates: Requirements 7.4**
 */
describe('OID4Client - Property 8: 不正な Credential Offer URI のエラー処理', () => {
  let client: OID4Client;

  beforeEach(() => {
    localStorage.clear();
    client = new OID4Client();
  });

  it('不正なスキームの URI はエラーを返す', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,10}:\/\/[a-z]{3,10}$/).filter(
          (s) => !s.startsWith('openid-credential-offer://'),
        ),
        (invalidUri) => {
          expect(() => client.parseCredentialOffer(invalidUri)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('credential_offer パラメータが欠落した URI はエラーを返す', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,20}$/),
        (randomParam) => {
          const uri = `openid-credential-offer://?other_param=${randomParam}`;
          expect(() => client.parseCredentialOffer(uri)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('不正な JSON の credential_offer はエラーを返す', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9]{5,30}$/),
        (invalidJson) => {
          const uri = `openid-credential-offer://?credential_offer=${encodeURIComponent(invalidJson)}`;
          expect(() => client.parseCredentialOffer(uri)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('必須フィールドが欠落した offer はエラーを返す', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // credential_issuer が欠落
          { credential_configuration_ids: ['Test'], grants: { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': { 'pre-authorized_code': 'abc' } } },
          // credential_configuration_ids が欠落
          { credential_issuer: 'https://example.com', grants: { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': { 'pre-authorized_code': 'abc' } } },
          // pre-authorized_code が欠落
          { credential_issuer: 'https://example.com', credential_configuration_ids: ['Test'], grants: {} },
          // grants が欠落
          { credential_issuer: 'https://example.com', credential_configuration_ids: ['Test'] },
          // credential_configuration_ids が空配列
          { credential_issuer: 'https://example.com', credential_configuration_ids: [], grants: { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': { 'pre-authorized_code': 'abc' } } },
        ),
        (invalidOffer) => {
          const uri = `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(invalidOffer))}`;
          expect(() => client.parseCredentialOffer(uri)).toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('空文字列はエラーを返す', () => {
    expect(() => client.parseCredentialOffer('')).toThrow();
  });
});

/**
 * Feature: vcknots-verifiable-credentials, Property 10: 認可リクエスト URI の解析正当性
 *
 * *任意の* 有効な認可リクエスト URI に対して、解析処理は検証者 URL、レスポンス URI、
 * ノンス、および Presentation Definition を正しく抽出する。
 *
 * **Validates: Requirements 9.1**
 */
describe('OID4Client - Property 10: 認可リクエスト URI の解析正当性', () => {
  let client: OID4Client;

  beforeEach(() => {
    localStorage.clear();
    client = new OID4Client();
  });

  it('有効な認可リクエスト URI を正しく解析する', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.stringMatching(/^https:\/\/[a-z]{3,10}\.[a-z]{2,5}$/),
          responseUri: fc.stringMatching(/^https:\/\/[a-z]{3,10}\.[a-z]{2,5}\/response$/),
          nonce: fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/),
          descriptorId: fc.stringMatching(/^[a-z]{3,10}$/),
        }),
        async ({ clientId, responseUri, nonce, descriptorId }) => {
          const presentationDefinition = {
            id: 'test-pd',
            input_descriptors: [
              {
                id: descriptorId,
                constraints: {
                  fields: [
                    {
                      path: ['$.type'],
                      filter: {
                        type: 'array',
                        contains: { const: 'VerifiableCredential' },
                      },
                    },
                  ],
                },
              },
            ],
          };

          const uri = `openid4vp://?client_id=${encodeURIComponent(clientId)}&response_uri=${encodeURIComponent(responseUri)}&nonce=${encodeURIComponent(nonce)}&presentation_definition=${encodeURIComponent(JSON.stringify(presentationDefinition))}`;

          const result = await client.parseAuthorizationRequest(uri);

          expect(result.verifierUrl).toBe(clientId);
          expect(result.responseUri).toBe(responseUri);
          expect(result.nonce).toBe(nonce);
          expect(result.presentationDefinition).toEqual(presentationDefinition);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('不正なスキームの URI はエラーを返す', () => {
    fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{3,10}:\/\/[a-z]{3,10}$/).filter(
          (s) => !s.startsWith('openid4vp://'),
        ),
        async (invalidUri) => {
          await expect(client.parseAuthorizationRequest(invalidUri)).rejects.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('必須パラメータが欠落した URI はエラーを返す', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          // client_id が欠落
          'openid4vp://?response_uri=https://v.com/r&nonce=abc&presentation_definition={}',
          // response_uri が欠落
          'openid4vp://?client_id=https://v.com&nonce=abc&presentation_definition={}',
          // nonce が欠落
          'openid4vp://?client_id=https://v.com&response_uri=https://v.com/r&presentation_definition={}',
          // presentation_definition が欠落
          'openid4vp://?client_id=https://v.com&response_uri=https://v.com/r&nonce=abc',
        ),
        async (invalidUri) => {
          await expect(client.parseAuthorizationRequest(invalidUri)).rejects.toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });
});
