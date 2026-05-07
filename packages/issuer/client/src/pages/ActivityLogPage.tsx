import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4001';

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  status: string;
  details: Record<string, unknown>;
  errorReason?: string;
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/activity-logs`)
      .then((r) => r.json())
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Logs</h2>
      {loading ? (
        <div className="animate-pulse space-y-3"><div className="h-12 bg-gray-200 rounded" /></div>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{entry.action.replace(/_/g, ' ')}</p>
                {entry.errorReason && <p className="text-xs text-red-600">{entry.errorReason}</p>}
              </div>
              <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
