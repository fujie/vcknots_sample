import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { VerifyPage } from './pages/VerifyPage';
import { ResultPage } from './pages/ResultPage';
import { ActivityLogPage } from './pages/ActivityLogPage';

export function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-amber-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">🔍 VCknots Verifier</h1>
          <nav className="flex gap-1">
            <NavLink to="/verify" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-amber-500 text-white' : 'text-amber-100 hover:bg-amber-500/50'}`}>Verify</NavLink>
            <NavLink to="/activity-logs" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-amber-500 text-white' : 'text-amber-100 hover:bg-amber-500/50'}`}>Logs</NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/verify" replace />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/activity-logs" element={<ActivityLogPage />} />
        </Routes>
      </main>
    </div>
  );
}
