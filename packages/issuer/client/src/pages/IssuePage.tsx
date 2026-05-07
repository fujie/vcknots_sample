import { useState, useRef } from 'react';
import { CredentialForm, type CredentialFormData } from '../components/CredentialForm';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { IssueStatusTracker, type IssueStatus } from '../components/IssueStatusTracker';

const API_BASE = 'http://localhost:4001';

export function IssuePage() {
  const [status, setStatus] = useState<IssueStatus>('idle');
  const [offerUri, setOfferUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  async function handleSubmit(data: CredentialFormData) {
    try {
      setError(null);
      setStatus('idle');
      setOfferUri(null);

      const res = await fetch(`${API_BASE}/api/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error_description ?? 'Failed to create offer');
      }

      const { id, offer } = await res.json();
      const uri = `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(offer))}`;
      setOfferUri(uri);
      setStatus('offer_created');

      // SSE で発行状態をリアルタイム追跡
      subscribeToEvents(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  function subscribeToEvents(offerId: string) {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/api/offers/${offerId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'token_issued') {
          setStatus('token_issued');
        } else if (data.status === 'credential_issued') {
          setStatus('credential_issued');
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE 接続エラー時は自動再接続される
    };

    // 5分後に接続を閉じる
    setTimeout(() => es.close(), 300000);
  }

  function handleReset() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
    setOfferUri(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Issue Credential</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">{error}</p>}
        <CredentialForm onSubmit={handleSubmit} disabled={status !== 'idle'} />
      </div>

      {status !== 'idle' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <IssueStatusTracker status={status} />
          {offerUri && status !== 'credential_issued' && (
            <div className="mt-6">
              <QRCodeDisplay uri={offerUri} />
            </div>
          )}
          {status === 'credential_issued' && (
            <p className="mt-4 text-sm text-emerald-600 font-medium">✓ Credential successfully issued to wallet!</p>
          )}
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
          >
            Issue Another
          </button>
        </div>
      )}
    </div>
  );
}
