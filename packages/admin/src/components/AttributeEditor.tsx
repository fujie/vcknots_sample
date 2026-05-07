import type { SchemaAttribute, AttributeType } from '@vcknots-sample/shared';

const ATTRIBUTE_TYPES: AttributeType[] = ['string', 'number', 'date', 'boolean'];

interface AttributeEditorProps {
  attributes: SchemaAttribute[];
  onChange: (attributes: SchemaAttribute[]) => void;
  errors?: Record<string, string>;
}

export function AttributeEditor({ attributes, onChange, errors }: AttributeEditorProps) {
  const handleAdd = () => {
    onChange([
      ...attributes,
      { name: '', type: 'string', required: false, description: '' },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(attributes.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof SchemaAttribute, value: unknown) => {
    const updated = attributes.map((attr, i) => {
      if (i !== index) return attr;
      return { ...attr, [field]: value };
    });
    onChange(updated);
  };

  return (
    <div>
      <h3>属性 (Attributes)</h3>
      {attributes.length === 0 && (
        <p style={{ color: '#666' }}>属性がありません。「属性を追加」ボタンで追加してください。</p>
      )}
      {attributes.map((attr, index) => {
        const nameError = errors?.[`attributes[${index}].name`];
        const typeError = errors?.[`attributes[${index}].type`];
        return (
          <div
            key={index}
            style={{
              border: '1px solid #ccc',
              padding: '12px',
              marginBottom: '8px',
              borderRadius: '4px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <label htmlFor={`attr-name-${index}`}>名前</label>
                <br />
                <input
                  id={`attr-name-${index}`}
                  type="text"
                  value={attr.name}
                  onChange={(e) => handleChange(index, 'name', e.target.value)}
                  placeholder="属性名"
                  style={{ borderColor: nameError ? 'red' : undefined }}
                />
                {nameError && <div style={{ color: 'red', fontSize: '12px' }}>{nameError}</div>}
              </div>
              <div>
                <label htmlFor={`attr-type-${index}`}>型</label>
                <br />
                <select
                  id={`attr-type-${index}`}
                  value={attr.type}
                  onChange={(e) => handleChange(index, 'type', e.target.value as AttributeType)}
                  style={{ borderColor: typeError ? 'red' : undefined }}
                >
                  {ATTRIBUTE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {typeError && <div style={{ color: 'red', fontSize: '12px' }}>{typeError}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '20px' }}>
                <input
                  id={`attr-required-${index}`}
                  type="checkbox"
                  checked={attr.required}
                  onChange={(e) => handleChange(index, 'required', e.target.checked)}
                />
                <label htmlFor={`attr-required-${index}`}>必須</label>
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor={`attr-desc-${index}`}>説明</label>
                <br />
                <input
                  id={`attr-desc-${index}`}
                  type="text"
                  value={attr.description ?? ''}
                  onChange={(e) => handleChange(index, 'description', e.target.value)}
                  placeholder="説明（任意）"
                  style={{ width: '100%' }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                style={{ marginTop: '20px', color: 'red' }}
                aria-label={`属性 ${attr.name || index + 1} を削除`}
              >
                削除
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={handleAdd}>
        + 属性を追加
      </button>
      {errors?.['attributes'] && (
        <div style={{ color: 'red', marginTop: '4px' }}>{errors['attributes']}</div>
      )}
    </div>
  );
}
