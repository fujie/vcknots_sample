import type { DIDInfo } from '../types/wallet.js';

const DID_STORAGE_KEY = 'vcknots-did';

// Base58btc alphabet
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58btcEncode(bytes: Uint8Array): string {
  // Count leading zeros
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeros++;
  }

  // Convert to base58
  const size = Math.ceil(bytes.length * 138 / 100) + 1;
  const b58 = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = 0;
    for (let k = size - 1; k >= 0 && (carry !== 0 || j < length); k--, j++) {
      carry += 256 * b58[k];
      b58[k] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    length = j;
  }

  let result = '1'.repeat(zeros);
  let started = false;
  for (let i = size - length; i < size; i++) {
    if (!started && b58[i] === 0) continue;
    started = true;
    result += BASE58_ALPHABET[b58[i]];
  }

  return result || '1';
}

/**
 * P-256 公開鍵を compressed 形式に変換する。
 * compressed key = prefix (02 or 03) + x coordinate
 * prefix は y 座標の最下位ビットに基づく。
 */
function compressP256PublicKey(x: Uint8Array, y: Uint8Array): Uint8Array {
  const prefix = (y[y.length - 1] & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

/**
 * Base64url 文字列を Uint8Array にデコードする。
 */
function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * DID の生成と管理を行うサービス。
 * did:key メソッドで DID と鍵ペアを生成し、localStorage に保存する。
 * P-256 (secp256r1) 曲線を使用し、multicodec 0x1200 + compressed public key で did:key を構成する。
 */
export class DIDService {
  /**
   * did:key メソッドで DID と鍵ペアを生成する。
   */
  async generateDID(): Promise<DIDInfo> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );

    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    // did:key を生成
    const did = this.jwkToDidKey(publicKeyJwk);

    return { did, publicKeyJwk, privateKeyJwk };
  }

  /**
   * JWK 公開鍵から did:key を生成する。
   * P-256 multicodec: 0x1200 (varint: 0x80 0x24)
   */
  private jwkToDidKey(publicKeyJwk: JsonWebKey): string {
    const x = base64urlToBytes(publicKeyJwk.x!);
    const y = base64urlToBytes(publicKeyJwk.y!);

    // Compressed public key (33 bytes)
    const compressed = compressP256PublicKey(x, y);

    // Multicodec prefix for P-256: 0x1200 encoded as varint = [0x80, 0x24]
    const multicodecPrefix = new Uint8Array([0x80, 0x24]);

    // Combine: multicodec prefix + compressed public key
    const multicodecKey = new Uint8Array(multicodecPrefix.length + compressed.length);
    multicodecKey.set(multicodecPrefix, 0);
    multicodecKey.set(compressed, multicodecPrefix.length);

    // Base58btc encode with 'z' prefix
    const encoded = base58btcEncode(multicodecKey);
    return `did:key:z${encoded}`;
  }

  /**
   * localStorage に DID が存在すれば再利用、なければ新規生成する。
   * 保存済み DID が正しい did:key:zDnae 形式でない場合は再生成する。
   */
  async getOrCreateDID(): Promise<DIDInfo> {
    const stored = localStorage.getItem(DID_STORAGE_KEY);
    if (stored) {
      try {
        const didInfo = JSON.parse(stored) as DIDInfo;
        // 正しい P-256 did:key 形式 (zDnae...) かチェック
        if (didInfo.did && didInfo.did.startsWith('did:key:zDnae') && didInfo.privateKeyJwk && didInfo.publicKeyJwk) {
          return didInfo;
        }
      } catch {
        // パースエラーの場合は再生成
      }
      // 不正な形式の場合はクリアして再生成
      localStorage.removeItem(DID_STORAGE_KEY);
    }

    const didInfo = await this.generateDID();
    localStorage.setItem(DID_STORAGE_KEY, JSON.stringify(didInfo));
    return didInfo;
  }

  /**
   * DID の存在確認を行う。
   */
  hasDID(): boolean {
    return localStorage.getItem(DID_STORAGE_KEY) !== null;
  }
}
