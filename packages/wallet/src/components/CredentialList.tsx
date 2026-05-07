import type { StoredCredential } from '../types/wallet.js';
import { CredentialCard } from './CredentialCard.js';

interface CredentialListProps {
  credentials: StoredCredential[];
  onSelect?: (credential: StoredCredential) => void;
}

export function CredentialList({ credentials, onSelect }: CredentialListProps) {
  if (credentials.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-3">📭</div>
        <p className="font-medium">No credentials stored yet.</p>
        <p className="text-sm mt-1">Go to the <span className="text-indigo-600 font-medium">Receive</span> tab to get your first credential.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {credentials.map((cred) => (
        <CredentialCard key={cred.id} credential={cred} onClick={() => onSelect?.(cred)} />
      ))}
    </div>
  );
}
