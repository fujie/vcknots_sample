import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { IssuePage } from './pages/IssuePage';
import { HistoryPage } from './pages/HistoryPage';
import { ActivityLogPage } from './pages/ActivityLogPage';

export function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-emerald-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">📜 VCknots Issuer</h1>
          <nav className="flex gap-1">
            <NavLink to="/issue" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-emerald-500 text-white' : 'text-emerald-100 hover:bg-emerald-500/50'}`}>Issue</NavLink>
            <NavLink to="/history" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-emerald-500 text-white' : 'text-emerald-100 hover:bg-emerald-500/50'}`}>History</NavLink>
            <NavLink to="/activity-logs" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-emerald-500 text-white' : 'text-emerald-100 hover:bg-emerald-500/50'}`}>Logs</NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/issue" replace />} />
          <Route path="/issue" element={<IssuePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/activity-logs" element={<ActivityLogPage />} />
        </Routes>
      </main>
    </div>
  );
}
