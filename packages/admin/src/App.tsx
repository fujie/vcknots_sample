import { Routes, Route, Navigate } from 'react-router-dom';
import { SchemaListPage } from './pages/SchemaListPage';
import { SchemaEditorPage } from './pages/SchemaEditorPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/schemas" replace />} />
      <Route path="/schemas" element={<SchemaListPage />} />
      <Route path="/schemas/new" element={<SchemaEditorPage />} />
      <Route path="/schemas/:id/edit" element={<SchemaEditorPage />} />
    </Routes>
  );
}
