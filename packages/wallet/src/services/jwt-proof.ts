/**
 * OID4VCI proof JWT の生成。
 * ECDSA P-256 (ES256) で署名された JWT proof を生成する。
 *
 * vcknots の CredentialProofProvider が要求する形式:
 * - Header: { alg: "ES256", typ: "openid4vci-proof+jwt", kid: <DID#DID> }
 * - Payload: { aud: <issuer URL>, iat: <現在時刻>, nonce?: <c_nonce> }
 * - Pre-Authorized Code Flow では iss を省略する
 * - kid は DID 形式で、vcknots の did:key プロバイダーが解決して公開鍵を取得する
 */

function base64urlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToBase64url(str: string): string {
  const encoder = new TextEncoder();
  return base64urlEncode(encoder.encode(str));
}

/**
 * ES256 署名付き proof JWT を生成する。
 * vcknots の credential-proof-jwt provider が検証可能な形式。
 */
export async function createProofJwt(params: {
  issuerUrl: string;
  holderDid: string;
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  nonce?: string;
}): Promise<string> {
  const { issuerUrl, holderDid, privateKeyJwk, nonce } = params;

    // Header - kid は "DID#fragment" 形式 (verification method ID)
    // did:key の場合、フラグメントは did:key: プレフィックスを除いた部分
    const fragment = holderDid.replace(/^did:key:/, '');
    const header = {
      alg: 'ES256',
      typ: 'openid4vci-proof+jwt',
      kid: `${holderDid}#${fragment}`,
    };

  // Payload - Pre-Authorized Code Flow では iss を省略
  const payload: Record<string, unknown> = {
    aud: issuerUrl,
    iat: Math.floor(Date.now() / 1000),
  };
  if (nonce) {
    payload.nonce = nonce;
  }

  const headerB64 = strToBase64url(JSON.stringify(header));
  const payloadB64 = strToBase64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // 秘密鍵をインポート
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  // ES256 署名 (ECDSA with SHA-256)
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signatureBuffer));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}
