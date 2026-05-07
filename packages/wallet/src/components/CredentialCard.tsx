import type { StoredCredential } from '../types/wallet.js';

interface CredentialCardProps {
  credential: StoredCredential;
  onClick?: () => void;
}

export function CredentialCard({ credential, onClick }: CredentialCardProps) {
  const mainType = credential.decoded.type.find((t) => t !== 'VerifiableCredential') ?? 'Credential';
  const issuerShort = credential.decoded.issuer.length > 30
    ? `${credential.decoded.issuer.slice(0, 30)}...`
    : credential.decoded.issuer;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition bg-gradient-to-r from-white to-indigo-50/30 group"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition">{mainType}</h3>
          <p className="text-sm text-gray-500 mt-0.5">Issuer: {issuerShort}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{new Date(credential.decoded.issuanceDate).toLocaleDateString()}</p>
          <span className="text-xs text-indigo-500 group-hover:text-indigo-600">View →</span>
        </div>
      </div>
    </button>
  );
}
