import { useLocation, useNavigate } from 'react-router-dom';

interface VerifiedCredential {
  type: string[];
  issuer: string;
  credentialSubject: Record<string, unknown>;
  issuanceDate: string;
}

interface VerificationResult {
  verified: boolean;
  credentials: VerifiedCredential[];
  errors?: string[];
}

export function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = (location.state as { result?: VerificationResult } | null)?.result;

  if (!result) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No verification result available.</p>
        <button onClick={() => navigate('/verify')} className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium">
          Start New Verification
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div role="status" aria-label="Verification result" className={`p-4 rounded-lg border-2 mb-6 ${result.verified ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
        <h2 className={`text-lg font-semibold ${result.verified ? 'text-green-700' : 'text-red-700'}`}>
          {result.verified ? '✓ Verification Successful' : '✗ Verification Failed'}
        </h2>
        {result.errors && result.errors.length > 0 && (
          <div role="alert" className="mt-2">
            <ul className="list-disc list-inside text-sm text-red-600">
              {result.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}
      </div>

      {result.credentials.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Verified Credentials</h3>
          {result.credentials.map((cred, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm"><span className="font-medium text-gray-700">Type:</span> {cred.type.join(', ')}</p>
              <p className="text-sm"><span className="font-medium text-gray-700">Issuer:</span> <code className="text-xs">{cred.issuer}</code></p>
              <p className="text-sm"><span className="font-medium text-gray-700">Issued:</span> {new Date(cred.issuanceDate).toLocaleString()}</p>
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer">Credential Subject</summary>
                <pre className="text-xs mt-1 bg-white p-2 rounded border">{JSON.stringify(cred.credentialSubject, null, 2)}</pre>
              </details>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => navigate('/verify')} className="mt-6 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium">
        Start New Verification
      </button>
    </div>
  );
}
