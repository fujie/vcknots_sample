import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CredentialSchema } from '@vcknots-sample/shared';
import { SchemaStorage } from '../services/schema-storage';

const storage = new SchemaStorage();

export function SchemaListPage() {
  const [schemas, setSchemas] = useState<CredentialSchema[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchemas = async () => {
    setLoading(true);
    const all = await storage.getAll();
    setSchemas(all);
    setLoading(false);
  };

  useEffect(() => {
    loadSchemas();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`スキーマ「${name}」を削除しますか？`)) {
      return;
    }
    await storage.delete(id);
    await loadSchemas();
  };

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1>スキーマ一覧</h1>
        <Link to="/schemas/new">
          <button type="button">+ 新規スキーマ作成</button>
        </Link>
      </div>

      {schemas.length === 0 ? (
        <p>定義済みのスキーマはありません。「新規スキーマ作成」ボタンから作成してください。</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>スキーマ名</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>バージョン</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>属性数</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {schemas.map((schema) => (
              <tr key={schema.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{schema.name}</td>
                <td style={{ padding: '8px' }}>{schema.version}</td>
                <td style={{ padding: '8px' }}>{schema.attributes.length}</td>
                <td style={{ padding: '8px' }}>
                  <Link to={`/schemas/${schema.id}/edit`}>
                    <button type="button" style={{ marginRight: '8px' }}>編集</button>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(schema.id, schema.name)}
                    style={{ color: 'red' }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
