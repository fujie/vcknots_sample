import { useParams, useNavigate } from 'react-router-dom';
import { useCredentials } from '../hooks/useCredentials.js';

export function CredentialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getById, deleteCredential } = useCredentials();
  const navigate = useNavigate();
  const credential = id ? getById(id) : null;

  if (!credential) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Credential not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const mainType = credential.decoded.type.find((t) => t !== 'VerifiableCredential') ?? 'Credential';

  function handleDelete() {
    if (confirm(`Delete "${mainType}" credential?`)) {
      deleteCredential(credential!.id);
      navigate('/');
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{mainType}</h2>
        <button onClick={handleDelete} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium">
          Delete
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issuer</span>
          <p className="text-sm text-gray-900 font-mono mt-0.5 break-all">{credential.decoded.issuer}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</span>
          <p className="text-sm text-gray-900 mt-0.5">{credential.decoded.type.join(', ')}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issued</span>
          <p className="text-sm text-gray-900 mt-0.5">{new Date(credential.decoded.issuanceDate).toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Credential Subject</span>
          <pre className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{JSON.stringify(credential.decoded.credentialSubject, null, 2)}</pre>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Received At</span>
          <p className="text-sm text-gray-900 mt-0.5">{new Date(credential.receivedAt).toLocaleString()}</p>
        </div>
      </div>

      <button onClick={() => navigate('/')} className="mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
        ← Back
      </button>
    </div>
  );
}
