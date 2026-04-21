import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Privileges } from './pages/Privileges';
import { MonthlyRun } from './pages/MonthlyRun';
import { Locations } from './pages/Locations';
import { Schedules } from './pages/Schedules';
import { Groups } from './pages/Groups';

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/monthly" replace />} />
          <Route path="/monthly" element={<MonthlyRun />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/privileges" element={<Privileges />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/monthly" replace />} />
        </Routes>
      </main>
    </div>
  );
}
