import { Gift, Calendar, MapPin, Users, Bolt, FileSpreadsheet, LayoutTemplate } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const NAV = [
  { path: '/reports', label: 'Report Generation', icon: FileSpreadsheet, end: false },
  { path: '/monthly', label: 'Fetch Raw Data', icon: Calendar, end: false },
  { path: '/locations', label: 'Locations', icon: MapPin, end: false },
  { path: '/groups', label: 'Groups', icon: Users, end: false },
  { path: '/electricity', label: 'Electricity', icon: Bolt, end: false },
  { path: '/privileges', label: 'Privileges', icon: Gift, end: false },
  { path: '/templates', label: 'Report Templates', icon: LayoutTemplate, end: false },
];

export function Sidebar() {
  return (
    <aside className="w-60 bg-[#1a1a2e] text-white flex flex-col">
      <div className="p-5 flex items-center gap-3 border-b border-white/10">
        <img src="/sharge-icon.png" alt="Sharge" className="w-8 h-8" />
        <div>
          <span className="font-semibold text-base">Auto Report</span>
          <span className="block text-[10px] text-white/40 -mt-0.5">by Sharge Thailand</span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <img src="/logo.png" alt="Sharge" className="h-5 opacity-40" />
      </div>
    </aside>
  );
}
