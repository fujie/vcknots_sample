import { useCredentials } from '../hooks/useCredentials.js';
import { useDID } from '../hooks/useDID.js';
import { DIDDisplay } from '../components/DIDDisplay.js';
import { CredentialList } from '../components/CredentialList.js';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const { credentials, loading } = useCredentials();
  const { did, loading: didLoading } = useDID();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Your Identity</h2>
        {didLoading ? (
          <div className="animate-pulse h-5 bg-gray-200 rounded w-96" />
        ) : (
          <DIDDisplay did={did} />
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Credentials</h2>
          <span className="text-sm text-gray-500">{credentials.length} stored</span>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-gray-200 rounded-lg" />
            <div className="h-20 bg-gray-200 rounded-lg" />
          </div>
        ) : (
          <CredentialList
            credentials={credentials}
            onSelect={(cred) => navigate(`/credentials/${cred.id}`)}
          />
        )}
      </div>
    </div>
  );
}
