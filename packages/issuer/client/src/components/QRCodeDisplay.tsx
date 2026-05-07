import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  uri: string;
  size?: number;
}

export function QRCodeDisplay({ uri, size = 200 }: QRCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="p-4 bg-white border-2 border-gray-200 rounded-xl shadow-sm">
        <QRCodeSVG value={uri} size={size} />
      </div>
      <details className="mt-3 w-full max-w-md">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Show URI</summary>
        <p className="mt-1 text-xs font-mono text-gray-600 break-all bg-gray-50 p-2 rounded">{uri}</p>
      </details>
    </div>
  );
}
