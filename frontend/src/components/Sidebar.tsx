import {
  Calendar, Gift, LayoutTemplate, MapPin, Settings,
  Users, Bolt, FileSpreadsheet,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

type NavItem = {
  path: string;
  label: string;
  icon: typeof Calendar;
  end?: boolean;
};

const NAV: NavItem[] = [
  { path: '/reports', label: 'Monthly Run', icon: FileSpreadsheet },
  { path: '/monthly', label: 'Fetch Raw Data', icon: Calendar },
  { path: '/locations', label: 'Locations', icon: MapPin },
  { path: '/groups', label: 'Groups', icon: Users },
  { path: '/electricity', label: 'Electricity', icon: Bolt },
  { path: '/privileges', label: 'Privileges', icon: Gift },
  { path: '/templates', label: 'Report Templates', icon: LayoutTemplate },
];

export function Sidebar() {
  return (
    <aside
      className="w-56 shrink-0 flex flex-col text-white"
      style={{ background: 'var(--sharge-navy)', borderRight: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 py-[18px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="w-7 h-7 rounded-[7px] grid place-items-center text-white font-bold text-[15px]"
          style={{
            background: 'var(--sharge-gradient)',
            letterSpacing: '-0.04em',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 2px 8px rgba(237,27,52,0.25)',
          }}
        >
          +
        </div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold" style={{ letterSpacing: '-0.01em' }}>
            Auto Report
          </div>
          <div className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}>
            Sharge · Ops
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-px px-2.5 pt-3.5 pb-3">
        <div
          className="text-[10px] font-semibold uppercase px-2 pt-2 pb-1.5"
          style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em' }}
        >
          Workspace
        </div>
        {NAV.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-[7px] px-[9px] py-[7px] text-[13px] transition-colors ${
                isActive
                  ? 'font-medium text-white'
                  : 'text-white/55 hover:text-white hover:bg-white/5'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }
                : { border: '1px solid transparent' }
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={15} strokeWidth={1.75} />
                <span className="flex-1 truncate">{label}</span>
                {isActive && (
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ background: 'var(--sharge-red)' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user */}
      <div
        className="flex items-center gap-2.5 p-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="w-[26px] h-[26px] rounded-full grid place-items-center text-[11px] font-semibold shrink-0"
          style={{
            background: 'linear-gradient(135deg, #FDE68A, #F472B6)',
            color: '#7C2D12',
          }}
        >
          NS
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[12px] font-medium truncate">Nattapong S.</div>
          <div className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.55)' }}>Finance Ops</div>
        </div>
        <button
          className="w-7 h-7 grid place-items-center rounded-md hover:bg-white/5 transition-colors"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          <Settings size={14} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
