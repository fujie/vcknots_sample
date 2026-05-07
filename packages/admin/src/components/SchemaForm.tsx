interface SchemaFormProps {
  name: string;
  version: string;
  onNameChange: (name: string) => void;
  onVersionChange: (version: string) => void;
  errors?: Record<string, string>;
}

export function SchemaForm({ name, version, onNameChange, onVersionChange, errors }: SchemaFormProps) {
  return (
    <div>
      <div style={{ marginBottom: '12px' }}>
        <label htmlFor="schema-name">スキーマ名</label>
        <br />
        <input
          id="schema-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="例: UniversityDegree"
          style={{ borderColor: errors?.['name'] ? 'red' : undefined, width: '300px' }}
        />
        {errors?.['name'] && (
          <div style={{ color: 'red', fontSize: '12px' }}>{errors['name']}</div>
        )}
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label htmlFor="schema-version">バージョン</label>
        <br />
        <input
          id="schema-version"
          type="text"
          value={version}
          onChange={(e) => onVersionChange(e.target.value)}
          placeholder="例: 1.0"
          style={{ borderColor: errors?.['version'] ? 'red' : undefined, width: '300px' }}
        />
        {errors?.['version'] && (
          <div style={{ color: 'red', fontSize: '12px' }}>{errors['version']}</div>
        )}
      </div>
    </div>
  );
}
