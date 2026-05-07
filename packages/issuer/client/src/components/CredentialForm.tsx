import { useState, useEffect } from 'react';
import type { CredentialSchema, SchemaAttribute } from '@vcknots-sample/shared';

const API_BASE = 'http://localhost:4001';

export interface CredentialFormData {
  credentialType: string;
  claims: Record<string, unknown>;
}

interface CredentialFormProps {
  onSubmit: (data: CredentialFormData) => void;
  disabled?: boolean;
}

export function CredentialForm({ onSubmit, disabled }: CredentialFormProps) {
  const [schemas, setSchemas] = useState<CredentialSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<CredentialSchema | null>(null);
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchSchemas(); }, []);

  async function fetchSchemas() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/schemas`);
      if (!res.ok) throw new Error('Failed to fetch schemas');
      setSchemas(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schemas');
    } finally {
      setLoading(false);
    }
  }

  function handleSchemaChange(name: string) {
    setSelectedSchema(schemas.find((s) => s.name === name) ?? null);
    setClaims({});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchema) return;
    const parsed: Record<string, unknown> = {};
    for (const attr of selectedSchema.attributes) {
      const raw = claims[attr.name] ?? '';
      if (attr.required && !raw.trim()) return;
      parsed[attr.name] = parseValue(raw, attr.type);
    }
    onSubmit({ credentialType: selectedSchema.name, claims: parsed });
  }

  function parseValue(value: string, type: SchemaAttribute['type']): unknown {
    if (type === 'number') return Number(value);
    if (type === 'boolean') return value === 'true';
    return value;
  }

  if (loading) return <div className="animate-pulse h-10 bg-gray-200 rounded" />;
  if (error) return <p role="alert" className="text-red-600 text-sm">{error}</p>;
  if (schemas.length === 0) return <p className="text-gray-500">No schemas defined. Create schemas in the Admin Panel.</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Credential issuance form">
      <div>
        <label htmlFor="credential-type" className="block text-sm font-medium text-gray-700 mb-1">Credential Type</label>
        <select
          id="credential-type"
          value={selectedSchema?.name ?? ''}
          onChange={(e) => handleSchemaChange(e.target.value)}
          disabled={disabled}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        >
          <option value="">Select a credential type</option>
          {schemas.map((s) => <option key={s.id} value={s.name}>{s.name} (v{s.version})</option>)}
        </select>
      </div>

      {selectedSchema && (
        <fieldset className="space-y-3 border border-gray-200 rounded-lg p-4">
          <legend className="text-sm font-medium text-gray-700 px-2">Attributes</legend>
          {selectedSchema.attributes.map((attr) => (
            <div key={attr.name}>
              <label htmlFor={`attr-${attr.name}`} className="block text-sm text-gray-600 mb-1">
                {attr.name}{attr.required && <span className="text-red-500 ml-0.5">*</span>}
                {attr.description && <span className="text-gray-400 ml-1">— {attr.description}</span>}
              </label>
              {attr.type === 'boolean' ? (
                <select
                  id={`attr-${attr.name}`}
                  value={claims[attr.name] ?? ''}
                  onChange={(e) => setClaims((p) => ({ ...p, [attr.name]: e.target.value }))}
                  disabled={disabled}
                  required={attr.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  id={`attr-${attr.name}`}
                  type={attr.type === 'number' ? 'number' : attr.type === 'date' ? 'date' : 'text'}
                  value={claims[attr.name] ?? ''}
                  onChange={(e) => setClaims((p) => ({ ...p, [attr.name]: e.target.value }))}
                  disabled={disabled}
                  required={attr.required}
                  placeholder={attr.description ?? `Enter ${attr.name}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
          ))}
        </fieldset>
      )}

      <button
        type="submit"
        disabled={disabled || !selectedSchema}
        className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
      >
        Generate Offer
      </button>
    </form>
  );
}
