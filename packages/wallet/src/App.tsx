import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage.js';
import { ReceiveOfferPage } from './pages/ReceiveOfferPage.js';
import { PresentPage } from './pages/PresentPage.js';
import { CredentialDetailPage } from './pages/CredentialDetailPage.js';
import { ActivityLogPage } from './pages/ActivityLogPage.js';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-indigo-600 text-white shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">🔐 VCknots Wallet</h1>
            <nav className="flex gap-1">
              <NavLink to="/" end className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-indigo-500 text-white' : 'text-indigo-100 hover:bg-indigo-500/50'}`}>Dashboard</NavLink>
              <NavLink to="/receive" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-indigo-500 text-white' : 'text-indigo-100 hover:bg-indigo-500/50'}`}>Receive</NavLink>
              <NavLink to="/present" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-indigo-500 text-white' : 'text-indigo-100 hover:bg-indigo-500/50'}`}>Present</NavLink>
              <NavLink to="/activity-logs" className={({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-indigo-500 text-white' : 'text-indigo-100 hover:bg-indigo-500/50'}`}>Logs</NavLink>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/receive" element={<ReceiveOfferPage />} />
            <Route path="/present" element={<PresentPage />} />
            <Route path="/credentials/:id" element={<CredentialDetailPage />} />
            <Route path="/activity-logs" element={<ActivityLogPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
