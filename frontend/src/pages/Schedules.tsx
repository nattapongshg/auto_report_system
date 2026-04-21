import { useEffect, useMemo, useState } from 'react';
import { Calendar, Play, Plus, Trash2, Pencil, Loader2, Search, X } from 'lucide-react';

interface Location { id: string; name: string; station_code: string | null; }

interface Schedule {
  id: string;
  name: string;
  location_ids: string[];
  trigger_day: number;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_detail: Record<string, unknown> | null;
  created_at: string;
}

export function Schedules() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/schedules').then(r => r.json()),
      fetch('/api/v1/locations').then(r => r.json()),
    ])
      .then(([s, l]) => {
        setItems(s.items || []);
        setLocations(l.items || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const locByName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of locations) m[l.id] = l.name;
    return m;
  }, [locations]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    await fetch(`/api/v1/schedules/${id}`, { method: 'DELETE' });
    load();
  };

  const handleToggle = async (s: Schedule) => {
    await fetch(`/api/v1/schedules/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    load();
  };

  const handleRunNow = async (id: string) => {
    if (!confirm('Run this schedule now against the latest snapshot?')) return;
    setRunningId(id);
    try {
      const res = await fetch(`/api/v1/schedules/${id}/run`, { method: 'POST' });
      if (!res.ok) {
        alert(`Run failed: ${await res.text()}`);
        return;
      }
      alert('Triggered. Check last_run_status in ~30s.');
      setTimeout(load, 15000);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
          <p className="text-sm text-[#636E72] mt-1">Auto generate & send reports on a day of each month.</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B1927] text-white rounded-lg text-sm hover:bg-[#701421]"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      <div className="luxury-card overflow-hidden">
        {loading ? (
          <p className="text-gray-400 p-8 text-center">Loading...</p>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-3">No schedules yet.</p>
            <button
              onClick={() => setEditing('new')}
              className="text-sm text-[#8B1927] hover:underline"
            >
              Create your first schedule
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-[#636E72]">Name</th>
                <th className="text-center px-4 py-3 font-medium text-[#636E72] w-20">Day</th>
                <th className="text-left px-4 py-3 font-medium text-[#636E72]">Locations</th>
                <th className="text-center px-4 py-3 font-medium text-[#636E72] w-24">Active</th>
                <th className="text-left px-4 py-3 font-medium text-[#636E72] w-44">Last Run</th>
                <th className="text-right px-4 py-3 font-medium text-[#636E72] w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#8B1927]/10 text-[#8B1927] text-xs font-bold">
                      {s.trigger_day}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className="font-mono">{s.location_ids.length}</span> locations
                    {s.location_ids.length > 0 && (
                      <span className="text-gray-400 ml-2">
                        ({s.location_ids.slice(0, 2).map(id => locByName[id]).filter(Boolean).join(', ')}
                        {s.location_ids.length > 2 ? ` +${s.location_ids.length - 2}` : ''})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(s)}
                      className={`text-xs px-2 py-1 rounded-full ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {s.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.last_run_at ? (
                      <div>
                        <div className="text-gray-600">{new Date(s.last_run_at).toLocaleString()}</div>
                        {s.last_run_status && (
                          <span className={`text-[10px] font-medium ${
                            s.last_run_status === 'success' ? 'text-emerald-600'
                              : s.last_run_status === 'partial' ? 'text-amber-600'
                                : 'text-red-600'
                          }`}>
                            {s.last_run_status}
                            {s.last_run_detail?.sent != null && ` · ${s.last_run_detail.sent} sent`}
                            {Number(s.last_run_detail?.failed) > 0 && `, ${s.last_run_detail?.failed} failed`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleRunNow(s.id)}
                        disabled={runningId === s.id}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40"
                        title="Run now"
                      >
                        {runningId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditing(s)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ScheduleDialog
          schedule={editing === 'new' ? null : editing}
          locations={locations}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ScheduleDialog({ schedule, locations, onClose, onSaved }: {
  schedule: Schedule | null;
  locations: Location[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(schedule?.name ?? '');
  const [day, setDay] = useState(schedule?.trigger_day ?? 5);
  const [active, setActive] = useState(schedule?.is_active ?? true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(schedule?.location_ids ?? []));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(l =>
      l.name.toLowerCase().includes(q) || (l.station_code ?? '').toLowerCase().includes(q)
    );
  }, [locations, search]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = (on: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const l of filtered) {
        if (on) next.add(l.id); else next.delete(l.id);
      }
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) { alert('Name is required'); return; }
    if (selectedIds.size === 0) { alert('Pick at least one location'); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        trigger_day: day,
        is_active: active,
        location_ids: Array.from(selectedIds),
      };
      const url = schedule ? `/api/v1/schedules/${schedule.id}` : '/api/v1/schedules';
      const method = schedule ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">{schedule ? 'Edit Schedule' : 'New Schedule'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-[#636E72] mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. BYD Monthly Reports"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-[#636E72] mb-1">Run on day of month</label>
              <input
                type="number"
                min={1}
                max={28}
                value={day}
                onChange={e => setDay(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            Active
          </label>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-[#636E72]">Locations ({selectedIds.size} selected)</label>
              <button onClick={() => toggleAllVisible(true)} className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">+visible</button>
              <button onClick={() => toggleAllVisible(false)} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">−visible</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-[10px] px-2 py-0.5 text-gray-500 hover:underline">clear</button>
            </div>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search location..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div className="border border-gray-100 rounded-lg max-h-[40vh] overflow-auto">
              {filtered.map(l => (
                <label key={l.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                  <span className="text-sm">{l.name}</span>
                  {l.station_code && <span className="text-xs text-gray-400 font-mono ml-auto">{l.station_code}</span>}
                </label>
              ))}
              {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-4">No match</p>}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-[#8B1927] text-white text-sm rounded-lg hover:bg-[#701421] disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
