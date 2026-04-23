import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Privileges } from './pages/Privileges';
import { MonthlyRun } from './pages/MonthlyRun';
import { Locations } from './pages/Locations';
import { Schedules } from './pages/Schedules';
import { Groups } from './pages/Groups';
import { Electricity } from './pages/Electricity';
import { ReportGen } from './pages/ReportGen';
import { Templates } from './pages/Templates';

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/reports" replace />} />
          <Route path="/reports" element={<ReportGen />} />
          <Route path="/monthly" element={<MonthlyRun />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/electricity" element={<Electricity />} />
          <Route path="/privileges" element={<Privileges />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/reports" replace />} />
        </Routes>
      </main>
    </div>
  );
}
