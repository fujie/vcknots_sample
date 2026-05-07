import { useState, useEffect, useCallback } from 'react';
import type { StoredCredential } from '../types/wallet.js';
import { CredentialStorage } from '../services/credential-storage.js';

const credentialStorage = new CredentialStorage();

/**
 * 資格情報の取得・削除を管理するフック。
 */
export function useCredentials() {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setCredentials(credentialStorage.getAll());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteCredential = useCallback((id: string) => {
    credentialStorage.delete(id);
    refresh();
  }, [refresh]);

  const getById = useCallback((id: string): StoredCredential | null => {
    return credentialStorage.getById(id);
  }, []);

  return { credentials, loading, deleteCredential, getById, refresh };
}
