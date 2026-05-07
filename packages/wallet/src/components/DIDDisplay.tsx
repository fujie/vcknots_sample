import { useState } from 'react';

interface DIDDisplayProps {
  did: string;
}

export function DIDDisplay({ did }: DIDDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <code className="text-sm bg-gray-100 px-3 py-1.5 rounded-md text-gray-700 font-mono truncate max-w-md">
        {did}
      </code>
      <button
        onClick={handleCopy}
        className="text-sm px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition font-medium"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
