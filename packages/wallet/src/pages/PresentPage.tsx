import { useState } from 'react';
import type { ParsedAuthzRequest, StoredCredential } from '../types/wallet.js';
import { PresentConfirmDialog } from '../components/PresentConfirmDialog.js';
import { WalletService } from '../services/wallet-service.js';

const walletService = new WalletService();

export function PresentPage() {
  const [uri, setUri] = useState('');
  const [request, setRequest] = useState<ParsedAuthzRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');

  async function handleParse() {
    try {
      setError(null);
      setLoading(true);
      const parsed = await walletService.receiveAuthzRequest(uri.trim());
      setRequest(parsed);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse request');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(selected: StoredCredential[]) {
    if (!request) return;
    try {
      setError(null);
      setLoading(true);
      await walletService.presentCredentials(request, selected);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit presentation');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setRequest(null);
    setStep('input');
  }

  if (step === 'success') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Presentation Submitted!</h2>
        <p className="text-gray-600 mb-6">Your credentials have been presented to the verifier.</p>
        <button onClick={() => { setStep('input'); setUri(''); setRequest(null); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
          Present Another
        </button>
      </div>
    );
  }

  if (step === 'confirm' && request) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <PresentConfirmDialog request={request} onApprove={handleApprove} onCancel={handleCancel} loading={loading} />
        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Present Credentials</h2>
      <p className="text-sm text-gray-600 mb-4">Paste the Authorization Request URI from the verifier.</p>
      <div className="space-y-4">
        <textarea
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="openid4vp://..."
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono resize-none"
        />
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <button
          onClick={handleParse}
          disabled={!uri.trim()}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
        >
          Parse Request
        </button>
      </div>
    </div>
  );
}
