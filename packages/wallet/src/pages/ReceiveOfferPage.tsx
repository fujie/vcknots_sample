import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ParsedCredentialOffer } from '../types/wallet.js';
import { OfferConfirmDialog } from '../components/OfferConfirmDialog.js';
import { WalletService } from '../services/wallet-service.js';

const walletService = new WalletService();

export function ReceiveOfferPage() {
  const navigate = useNavigate();
  const [uri, setUri] = useState('');
  const [offer, setOffer] = useState<ParsedCredentialOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');

  async function handleParse() {
    try {
      setError(null);
      setLoading(true);
      const parsed = await walletService.receiveOffer(uri.trim());
      setOffer(parsed);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse offer');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!offer) return;
    try {
      setError(null);
      setLoading(true);
      await walletService.acceptOffer(offer);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept offer');
    } finally {
      setLoading(false);
    }
  }

  function handleReject() {
    setOffer(null);
    setStep('input');
  }

  if (step === 'success') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Credential Received!</h2>
        <p className="text-gray-600 mb-6">The credential has been saved to your wallet.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
            View Dashboard
          </button>
          <button onClick={() => { setStep('input'); setUri(''); setOffer(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
            Receive Another
          </button>
        </div>
      </div>
    );
  }

  if (step === 'confirm' && offer) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <OfferConfirmDialog offer={offer} onAccept={handleAccept} onReject={handleReject} loading={loading} />
        {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Receive Credential</h2>
      <p className="text-sm text-gray-600 mb-4">Paste the Credential Offer URI from the issuer to receive a credential.</p>
      <div className="space-y-4">
        <textarea
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="openid-credential-offer://..."
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono resize-none"
          disabled={loading}
        />
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <button
          onClick={handleParse}
          disabled={!uri.trim() || loading}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
        >
          {loading ? 'Processing...' : 'Parse Offer'}
        </button>
      </div>
    </div>
  );
}
