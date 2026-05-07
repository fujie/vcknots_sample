import { useState } from 'react';

interface VerificationFormProps {
  onSubmit: (credentialType: string) => void;
  disabled?: boolean;
}

export function VerificationForm({ onSubmit, disabled }: VerificationFormProps) {
  const [credentialType, setCredentialType] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!credentialType.trim()) return;
    onSubmit(credentialType.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Verification request form">
      <div>
        <label htmlFor="credential-type" className="block text-sm font-medium text-gray-700 mb-1">Credential Type</label>
        <input
          id="credential-type"
          type="text"
          value={credentialType}
          onChange={(e) => setCredentialType(e.target.value)}
          disabled={disabled}
          required
          placeholder="e.g., UniversityDegree"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !credentialType.trim()}
        className="w-full py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
      >
        Create Verification Request
      </button>
    </form>
  );
}
