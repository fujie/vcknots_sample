import type { SchemaAttribute } from '@vcknots-sample/shared';

interface SchemaPreviewProps {
  name: string;
  version: string;
  attributes: SchemaAttribute[];
}

export function SchemaPreview({ name, version, attributes }: SchemaPreviewProps) {
  if (!name && !version && attributes.length === 0) {
    return (
      <div style={{ border: '1px solid #ddd', padding: '16px', borderRadius: '4px' }}>
        <h3>プレビュー</h3>
        <p style={{ color: '#666' }}>スキーマ情報を入力するとプレビューが表示されます。</p>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: '16px', borderRadius: '4px' }}>
      <h3>プレビュー</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>スキーマ名:</td>
            <td style={{ padding: '4px 8px' }}>{name || '(未入力)'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>バージョン:</td>
            <td style={{ padding: '4px 8px' }}>{version || '(未入力)'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '4px 8px' }}>属性数:</td>
            <td style={{ padding: '4px 8px' }}>{attributes.length}</td>
          </tr>
        </tbody>
      </table>

      {attributes.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <h4>属性一覧</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>名前</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>型</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>必須</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>説明</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((attr, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 8px' }}>{attr.name || '(未入力)'}</td>
                  <td style={{ padding: '4px 8px' }}>{attr.type}</td>
                  <td style={{ padding: '4px 8px' }}>{attr.required ? '✓' : ''}</td>
                  <td style={{ padding: '4px 8px' }}>{attr.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
