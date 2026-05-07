import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4001';

interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  status: string;
  details: Record<string, unknown>;
}

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/history`)
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Issuance History</h2>
      {loading ? (
        <div className="animate-pulse space-y-3"><div className="h-12 bg-gray-200 rounded" /><div className="h-12 bg-gray-200 rounded" /></div>
      ) : history.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No credentials have been issued yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">{String(entry.details.credentialType ?? 'Credential')}</p>
                <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{entry.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
