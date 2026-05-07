import { useState, useEffect } from 'react';
import { DIDService } from '../services/did-service.js';

const didService = new DIDService();

/**
 * DID の取得・表示を管理するフック。
 */
export function useDID() {
  const [did, setDid] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDID() {
      try {
        const didInfo = await didService.getOrCreateDID();
        if (!cancelled) {
          setDid(didInfo.did);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load DID');
          setLoading(false);
        }
      }
    }

    loadDID();
    return () => { cancelled = true; };
  }, []);

  return { did, loading, error };
}
