import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Users, X, Check, Loader2 } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  station_code: string | null;
  group_name: string | null;
  is_report_enabled: boolean;
}

export function Groups() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/v1/locations')
      .then(r => r.json())
      .then(d => setLocations(d.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const groups = useMemo(() => {
    const agg: Record<string, number> = {};
    for (const l of locations) {
      if (l.group_name) agg[l.group_name] = (agg[l.group_name] || 0) + 1;
    }
    return Object.entries(agg).sort().map(([name, count]) => ({ name, count }));
  }, [locations]);

  const selectedMembers = useMemo(
    () => locations.filter(l => l.group_name === selectedGroup),
    [locations, selectedGroup]
  );

  const handleDeleteGroup = async (name: string) => {
    const members = locations.filter(l => l.group_name === name);
    if (!confirm(`Remove group "${name}"? This will un-tag ${members.length} location(s).`)) return;
    await Promise.all(members.map(l =>
      fetch(`/api/v1/locations/${l.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: null }),
      })
    ));
    if (selectedGroup === name) setSelectedGroup(null);
    load();
  };

  return (
    <div className="p-8 max-w-[1600px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
          <p className="text-sm text-[#636E72] mt-1">Organize locations into groups for consolidated reports.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B1927] text-white rounded-lg text-sm hover:bg-[#701421]"
        >
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-5">
        {/* Groups list */}
        <div className="luxury-card overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <p className="text-xs font-semibold text-[#636E72] uppercase tracking-wider">Groups ({groups.length})</p>
          </div>
          {loading ? (
            <p className="p-8 text-center text-gray-400">Loading...</p>
          ) : groups.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-3">No groups yet.</p>
              <button onClick={() => setCreating(true)} className="text-sm text-[#8B1927] hover:underline">
                Create your first group
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {groups.map(g => (
                <div
                  key={g.name}
                  onClick={() => setSelectedGroup(g.name)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between ${
                    selectedGroup === g.name ? 'bg-red-50/50 border-l-4 border-[#8B1927]' : 'hover:bg-gray-50/50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm">{g.name}</p>
                    <p className="text-xs text-[#636E72]">{g.count} locations</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.name); }}
                    className="p-1 text-red-500 hover:bg-red-50 rounded opacity-50 hover:opacity-100"
                    title="Delete group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Group detail */}
        <div className="luxury-card">
          {selectedGroup ? (
            <GroupEditor
              groupName={selectedGroup}
              members={selectedMembers}
              allLocations={locations}
              onChanged={load}
            />
          ) : (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Select a group on the left, or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {creating && (
        <CreateGroupDialog
          allLocations={locations}
          existingGroups={groups.map(g => g.name)}
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false);
            load();
            setSelectedGroup(name);
          }}
        />
      )}
    </div>
  );
}

function GroupEditor({ groupName, members, allLocations, onChanged }: {
  groupName: string;
  members: Location[];
  allLocations: Location[];
  onChanged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());

  const nonMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLocations
      .filter(l => l.group_name !== groupName)
      .filter(l => !q || l.name.toLowerCase().includes(q) || (l.station_code || '').toLowerCase().includes(q));
  }, [allLocations, groupName, search]);

  const toggle = async (loc: Location, add: boolean) => {
    setPending(prev => new Set([...prev, loc.id]));
    try {
      await fetch(`/api/v1/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: add ? groupName : null }),
      });
      onChanged();
    } finally {
      setPending(prev => {
        const next = new Set(prev);
        next.delete(loc.id);
        return next;
      });
    }
  };

  return (
    <>
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{groupName}</h2>
            <p className="text-xs text-[#636E72] mt-0.5">{members.length} members</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x">
        {/* Members */}
        <div>
          <div className="px-4 py-2 bg-emerald-50/50 border-b text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Members ({members.length})
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {members.length === 0 ? (
              <p className="p-6 text-center text-xs text-gray-400">No members yet. Add from right →</p>
            ) : members.map(l => (
              <div key={l.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 border-b border-gray-50 text-sm">
                <div>
                  <p className="font-medium text-[13px]">{l.name}</p>
                  {l.station_code && <p className="text-[11px] text-gray-400 font-mono">{l.station_code}</p>}
                </div>
                <button
                  onClick={() => toggle(l, false)}
                  disabled={pending.has(l.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Remove from group"
                >
                  {pending.has(l.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add locations */}
        <div>
          <div className="px-4 py-2 bg-blue-50/50 border-b text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Location ({nonMembers.length} available)
          </div>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search to add..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded"
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {nonMembers.slice(0, 100).map(l => (
              <div key={l.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 border-b border-gray-50 text-sm">
                <div>
                  <p className="font-medium text-[13px]">{l.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {l.station_code || ''} {l.group_name && <span className="text-amber-600">· already in "{l.group_name}"</span>}
                  </p>
                </div>
                <button
                  onClick={() => toggle(l, true)}
                  disabled={pending.has(l.id)}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                  title="Add to group"
                >
                  {pending.has(l.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
            {nonMembers.length > 100 && (
              <p className="px-3 py-2 text-xs text-gray-400 text-center">... showing 100 — refine search to see more</p>
            )}
            {nonMembers.length === 0 && <p className="p-6 text-center text-xs text-gray-400">All locations assigned</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function CreateGroupDialog({ allLocations, existingGroups, onClose, onCreated }: {
  allLocations: Location[];
  existingGroups: string[];
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allLocations;
    return allLocations.filter(l =>
      l.name.toLowerCase().includes(q) || (l.station_code || '').toLowerCase().includes(q)
    );
  }, [allLocations, search]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filtered.forEach(l => next.add(l.id));
      return next;
    });
  };

  const save = async () => {
    const n = name.trim();
    if (!n) { alert('Group name is required'); return; }
    if (existingGroups.includes(n)) {
      if (!confirm(`Group "${n}" already exists. Add these locations to it?`)) return;
    }
    if (selectedIds.size === 0) { alert('Select at least one location'); return; }

    setSaving(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id =>
        fetch(`/api/v1/locations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_name: n }),
        })
      ));
      onCreated(n);
    } catch (e) {
      alert(`Failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">New Group</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          <div>
            <label className="block text-xs text-[#636E72] mb-1">Group Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. BYD, Shell, Bangchak"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-[#636E72]">Locations ({selectedIds.size} selected)</label>
              <button onClick={selectAllVisible} className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">+ all visible</button>
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
            <div className="border border-gray-100 rounded-lg max-h-[45vh] overflow-auto">
              {filtered.slice(0, 500).map(l => (
                <label key={l.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{l.name}</p>
                    {l.station_code && <p className="text-[11px] text-gray-400 font-mono">{l.station_code}</p>}
                  </div>
                  {l.group_name && l.group_name !== name && (
                    <span className="text-[10px] text-amber-600">(in "{l.group_name}")</span>
                  )}
                </label>
              ))}
              {filtered.length > 500 && <p className="text-center text-xs text-gray-400 py-2">... {filtered.length - 500} more — refine search</p>}
              {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-4">No match</p>}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-[#8B1927] text-white text-sm rounded-lg hover:bg-[#701421] disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}
