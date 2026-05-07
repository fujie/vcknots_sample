import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { SchemaAttribute } from '@vcknots-sample/shared';
import { SchemaValidator } from '@vcknots-sample/shared';
import { SchemaStorage } from '../services/schema-storage';
import { SchemaForm } from '../components/SchemaForm';
import { AttributeEditor } from '../components/AttributeEditor';
import { SchemaPreview } from '../components/SchemaPreview';

const storage = new SchemaStorage();
const validator = new SchemaValidator();

export function SchemaEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [attributes, setAttributes] = useState<SchemaAttribute[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      storage.getById(id).then((schema) => {
        if (schema) {
          setName(schema.name);
          setVersion(schema.version);
          setAttributes(schema.attributes);
        }
        setLoading(false);
      });
    }
  }, [id]);

  const handleSave = async () => {
    const now = new Date().toISOString();
    const schema = {
      id: id ?? crypto.randomUUID(),
      name,
      version,
      attributes,
      createdAt: now,
      updatedAt: now,
    };

    const result = validator.validate(schema);
    if (!result.valid) {
      const errorMap: Record<string, string> = {};
      for (const err of result.errors) {
        errorMap[err.field] = err.message;
      }
      setErrors(errorMap);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (isEditing && id) {
        const existing = await storage.getById(id);
        if (existing) {
          schema.createdAt = existing.createdAt;
        }
        await storage.update(id, schema);
      } else {
        await storage.save(schema);
      }
      navigate('/schemas');
    } catch (err) {
      console.error('Failed to save schema:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>{isEditing ? 'スキーマ編集' : '新規スキーマ作成'}</h1>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '400px' }}>
          <SchemaForm
            name={name}
            version={version}
            onNameChange={setName}
            onVersionChange={setVersion}
            errors={errors}
          />

          <div style={{ marginTop: '16px' }}>
            <AttributeEditor
              attributes={attributes}
              onChange={setAttributes}
              errors={errors}
            />
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button type="button" onClick={() => navigate('/schemas')}>
              キャンセル
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          <SchemaPreview name={name} version={version} attributes={attributes} />
        </div>
      </div>
    </div>
  );
}
