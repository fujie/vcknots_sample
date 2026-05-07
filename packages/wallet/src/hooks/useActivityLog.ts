import { useState, useEffect, useCallback } from 'react';
import type { ActivityLogEntry } from '@vcknots-sample/shared';
import { WalletService } from '../services/wallet-service.js';

const walletService = new WalletService();

/**
 * アクティビティログの取得を管理するフック。
 */
export function useActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLogs(walletService.getActivityLogs());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, refresh };
}
