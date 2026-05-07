import { useState } from 'react';
import type { ParsedAuthzRequest, StoredCredential } from '../types/wallet.js';

interface PresentConfirmDialogProps {
  request: ParsedAuthzRequest;
  onApprove: (selected: StoredCredential[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function PresentConfirmDialog({ request, onApprove, onCancel, loading }: PresentConfirmDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(request.matchingCredentials.map((c) => c.id))
  );

  function toggleCredential(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleApprove() {
    const selectedCreds = request.matchingCredentials.filter((c) => selected.has(c.id));
    onApprove(selectedCreds);
  }

  if (request.matchingCredentials.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Present Credentials</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-amber-800">No matching credentials found for this request.</p>
        </div>
        <button onClick={onCancel} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirm Presentation</h2>
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Verifier</span>
        <p className="text-sm text-gray-900 font-mono mt-0.5">{request.verifierUrl}</p>
      </div>
      <p className="text-sm text-gray-600 mb-3">Select credentials to present:</p>
      <div className="space-y-2 mb-6">
        {request.matchingCredentials.map((cred) => {
          const mainType = cred.decoded.type.find((t) => t !== 'VerifiableCredential') ?? 'Credential';
          return (
            <label key={cred.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer transition">
              <input
                type="checkbox"
                checked={selected.has(cred.id)}
                onChange={() => toggleCredential(cred.id)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{mainType}</p>
                <p className="text-xs text-gray-500">Issuer: {cred.decoded.issuer.slice(0, 30)}...</p>
              </div>
            </label>
          );
        })}
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={selected.size === 0 || loading}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
        >
          {loading ? 'Submitting...' : 'Approve'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
