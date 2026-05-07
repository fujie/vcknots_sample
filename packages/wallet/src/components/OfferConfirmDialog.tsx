import type { ParsedCredentialOffer } from '../types/wallet.js';

interface OfferConfirmDialogProps {
  offer: ParsedCredentialOffer;
  onAccept: () => void;
  onReject: () => void;
  loading?: boolean;
}

export function OfferConfirmDialog({ offer, onAccept, onReject, loading }: OfferConfirmDialogProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirm Credential Offer</h2>
      <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issuer</span>
          <p className="text-sm text-gray-900 font-mono mt-0.5">{offer.issuerUrl}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Credential Type</span>
          <p className="text-sm text-gray-900 font-semibold mt-0.5">{offer.credentialType}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4">Do you want to accept this credential offer?</p>
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          disabled={loading}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition font-medium"
        >
          {loading ? 'Accepting...' : 'Accept'}
        </button>
        <button
          onClick={onReject}
          disabled={loading}
          className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-100 transition font-medium"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
