import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { VerificationForm } from '../components/VerificationForm';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { VerifyStatusTracker, type VerifyStatus } from '../components/VerifyStatusTracker';

const API_BASE = 'http://localhost:4002';

export function VerifyPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [requestUri, setRequestUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  async function handleSubmit(credentialType: string) {
    try {
      setError(null);
      setStatus('idle');
      setRequestUri(null);

      const res = await fetch(`${API_BASE}/api/authz-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialType }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error_description ?? 'Failed to create request');
      }

      const data = await res.json();
      const pd = encodeURIComponent(JSON.stringify(data.presentationDefinition));
      const uri = `openid4vp://?client_id=${encodeURIComponent(data.responseUri)}&response_uri=${encodeURIComponent(data.responseUri)}&nonce=${encodeURIComponent(data.nonce)}&presentation_definition=${pd}&state=${encodeURIComponent(data.state)}`;
      setRequestUri(uri);
      setStatus('request_created');

      // SSE で検証結果をリアルタイム追跡
      subscribeToEvents(data.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  function subscribeToEvents(state: string) {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/api/authz-requests/${state}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'verification_completed') {
          setStatus('verification_completed');
          es.close();
          navigate('/result', { state: { result: data.result } });
        }
      } catch {
        // ignore
      }
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
    setRequestUri(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Verify Credential</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">{error}</p>}
        <VerificationForm onSubmit={handleSubmit} disabled={status !== 'idle'} />
      </div>

      {status !== 'idle' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <VerifyStatusTracker status={status} />
          {requestUri && status !== 'verification_completed' && (
            <div className="mt-6">
              <QRCodeDisplay uri={requestUri} />
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
          >
            New Verification
          </button>
        </div>
      )}
    </div>
  );
}
