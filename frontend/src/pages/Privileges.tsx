import { useEffect, useState } from 'react';
import { RefreshCw, Save, Search, Plus, Trash2, X, Loader2, Layers } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Btn, PageTitle } from '../components/ui/primitives';
import type { PrivilegeConfig } from '../lib/queries';
import {
  qk,
  useAllGroupRates, useDeletePrivilege, usePrivileges, useSavePrivilege,
} from '../lib/queries';

const TYPE_OPTIONS = ['credit', 'percent'];
const TYPE_COLORS: Record<string, string> = {
  credit: 'bg-blue-50 text-blue-700 border-blue-200',
  percent: 'bg-green-50 text-green-700 border-green-200',
};

export function Privileges() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const { data: items = [], isLoading } = usePrivileges(typeFilter || undefined);
  const { data: groupRatesByPriv = {} } = useAllGroupRates();
  const save = useSavePrivilege();
  const del = useDeletePrivilege();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<PrivilegeConfig>>({});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [groupsFor, setGroupsFor] = useState<PrivilegeConfig | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.privileges() });

  const startEdit = (item: PrivilegeConfig) => {
    setEditingId(item.id);
    setEditData({
      privilege_program_name: item.privilege_program_name,
      discount_label: item.discount_label,
      privilege_type: item.privilege_type,
      share_rate: item.share_rate,
      notes: item.notes,
    });
  };

  const handleSave = async (id: string) => {
    const patch: Record<string, unknown> = { ...editData };
    if (patch.share_rate === '' || patch.share_rate === undefined) patch.share_rate = null;
    else if (typeof patch.share_rate === 'string') patch.share_rate = parseFloat(patch.share_rate) || null;
    try {
      await save.mutateAsync({ id, patch });
      setEditingId(null);
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this privilege config? This cannot be undone.')) return;
    await del.mutateAsync(id);
  };

  const filtered = items.filter((i) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (i.privilege_program_name || '').toLowerCase().includes(s) ||
      (i.discount_label || '').toLowerCase().includes(s) ||
      (i.notes || '').toLowerCase().includes(s)
    );
  });

  const stats = {
    total: items.length,
    credit: items.filter((i) => i.privilege_type === 'credit').length,
    percent: items.filter((i) => i.privilege_type === 'percent').length,
    withRate: items.filter((i) => i.share_rate != null).length,
    withProgName: items.filter((i) => i.privilege_program_name).length,
  };

  return (
    <div className="px-10 py-8 max-w-[1500px] mx-auto">
      <PageTitle
        title="Privilege Configs"
        subtitle={`${stats.total} privileges · ${stats.credit} credit, ${stats.percent} percent · ${stats.withProgName} with program_name · ${stats.withRate} with share_rate`}
        right={
          <>
            <Btn kind="ghost" onClick={refresh} title="Refresh">
              <RefreshCw size={13} />
              Refresh
            </Btn>
            <Btn kind="primaryG" onClick={() => setCreating(true)}>
              <Plus size={13} /> New
            </Btn>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search program name, label, notes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">All types</option>
          <option value="credit">Credit</option>
          <option value="percent">Percent</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Privilege Program Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Discount Label (fallback)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-32">Share Rate</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Notes</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className={isEditing ? 'bg-yellow-50/50' : 'hover:bg-gray-50/50'}>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          value={editData.privilege_program_name ?? ''}
                          onChange={(e) => setEditData({ ...editData, privilege_program_name: e.target.value })}
                          placeholder="(empty — use discount_label lookup)"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      ) : (
                        <span className="text-sm font-medium">
                          {item.privilege_program_name || <span className="text-gray-300 italic">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          value={editData.discount_label ?? ''}
                          onChange={(e) => setEditData({ ...editData, discount_label: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                        />
                      ) : (
                        <span className="font-mono text-xs text-gray-500">
                          {item.discount_label || <span className="text-gray-300 italic">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <select
                          value={editData.privilege_type ?? 'credit'}
                          onChange={(e) => setEditData({ ...editData, privilege_type: e.target.value })}
                          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                        >
                          {TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[item.privilege_type] ?? 'bg-gray-50'}`}>
                          {item.privilege_type}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editData.share_rate ?? ''}
                          onChange={(e) => setEditData({ ...editData, share_rate: e.target.value === '' ? null : parseFloat(e.target.value) })}
                          placeholder="NULL (use discount)"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                        />
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span
                            className={`font-mono text-xs cursor-pointer ${item.share_rate != null ? 'text-blue-600 font-medium' : 'text-gray-300'}`}
                            onClick={() => startEdit(item)}
                          >
                            {item.share_rate != null ? `${item.share_rate} /kWh` : 'NULL'}
                          </span>
                          {(groupRatesByPriv[item.id] || []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {groupRatesByPriv[item.id].map(o => (
                                <button
                                  key={o.id}
                                  onClick={() => setGroupsFor(item)}
                                  title="Click to edit overrides"
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100"
                                >
                                  {o.group_name}: <b>{o.share_rate}</b>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <input
                          value={editData.notes ?? ''}
                          onChange={(e) => setEditData({ ...editData, notes: e.target.value || null })}
                          placeholder="Notes..."
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">{item.notes || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSave(item.id)}
                            disabled={save.isPending}
                            className="p-1.5 bg-green-50 hover:bg-green-100 rounded text-green-600"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 text-xs">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setGroupsFor(item)}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                            title="Per-group rate overrides"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs text-blue-500 hover:underline px-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8">No privileges found</p>
          )}
        </div>
      )}

      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold mb-3">Lookup & Revenue Logic</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>Configs are keyed by <b>privilege_program_name</b> (from Q1144). Fallback to <b>discount_label</b> for legacy rows.</p>
          <div className="flex items-start gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 mt-0.5 ${TYPE_COLORS.percent}`}>percent</span>
            <span>Revenue = <code className="bg-gray-100 px-1 rounded text-xs">payment_amount</code></span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 mt-0.5 ${TYPE_COLORS.credit}`}>credit</span>
            <span>Revenue = <code className="bg-gray-100 px-1 rounded text-xs">net_payment + (share_rate ? kwh * share_rate : total_discount)</code></span>
          </div>
          <div className="flex items-start gap-2 pt-2 border-t">
            <Layers className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
            <span>
              <b>Group-rate override</b>: if a location's <code className="bg-gray-100 px-1 rounded text-xs">group_name</code> has a specific rate, that replaces the default share_rate for rows at that group's locations. E.g. Mercedes 7.2/kWh default → 9.0/kWh at Shell.
            </span>
          </div>
        </div>
      </div>

      {creating && (
        <CreateDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refresh(); }} />
      )}

      {groupsFor && (
        <GroupRatesDialog
          privilege={groupsFor}
          onClose={() => setGroupsFor(null)}
        />
      )}
    </div>
  );
}

interface GroupRate {
  id: string;
  privilege_config_id: string;
  group_name: string;
  share_rate: number;
  notes: string | null;
}

function GroupRatesDialog({ privilege, onClose }: { privilege: PrivilegeConfig; onClose: () => void }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<GroupRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState('');
  const [newRate, setNewRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/privileges/${privilege.id}/group-rates`).then(r => r.json()),
      fetch('/api/v1/report-gen/groups').then(r => r.json()),
    ]).then(([gr, g]) => {
      setItems(gr.items || []);
      setGroups((g.groups || []).map((x: { group_name: string }) => x.group_name));
    }).finally(() => setLoading(false));
    qc.invalidateQueries({ queryKey: ['privileges', 'group-rates', 'all'] });
  };

  useEffect(() => { load(); }, [privilege.id]);

  const add = async () => {
    if (!newGroup.trim() || !newRate) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/privileges/${privilege.id}/group-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: newGroup.trim(), share_rate: parseFloat(newRate) }),
      });
      if (!r.ok) throw new Error(await r.text());
      setNewGroup(''); setNewRate('');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async (override: GroupRate, rate: number) => {
    await fetch(`/api/v1/privileges/${privilege.id}/group-rates/${override.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_name: override.group_name, share_rate: rate }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this override?')) return;
    await fetch(`/api/v1/privileges/${privilege.id}/group-rates/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="font-semibold">Group Rate Overrides</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {privilege.privilege_program_name || privilege.discount_label}
              {privilege.share_rate != null && <> · default <b>{privilege.share_rate}</b>/kWh</>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No overrides — default rate applies everywhere</p>
                )}
                {items.map(o => (
                  <GroupRateRow key={o.id} o={o} onSave={(rate) => save(o, rate)} onDelete={() => remove(o.id)} />
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="text-xs text-gray-500 mb-2">Add override</div>
                <div className="flex gap-2">
                  <select
                    value={newGroup}
                    onChange={e => setNewGroup(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select group...</option>
                    {groups.filter(g => !items.some(i => i.group_name === g)).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={newRate}
                    onChange={e => setNewRate(e.target.value)}
                    placeholder="rate /kWh"
                    className="w-32 border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={add}
                    disabled={!newGroup || !newRate || busy}
                    className="px-3 py-2 bg-[#1a1a2e] text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupRateRow({ o, onSave, onDelete }: {
  o: GroupRate;
  onSave: (rate: number) => void;
  onDelete: () => void;
}) {
  const [rate, setRate] = useState(String(o.share_rate));
  const dirty = parseFloat(rate) !== o.share_rate;
  return (
    <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2 text-sm">
      <span className="flex-1 font-medium">{o.group_name}</span>
      <input
        type="number"
        step="0.01"
        value={rate}
        onChange={e => setRate(e.target.value)}
        className="w-24 border rounded px-2 py-1 text-xs font-mono text-right"
      />
      <span className="text-xs text-gray-400">/kWh</span>
      {dirty && (
        <button
          onClick={() => onSave(parseFloat(rate))}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
          title="Save"
        ><Save className="w-3.5 h-3.5" /></button>
      )}
      <button onClick={onDelete} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CreateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState('credit');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { alert('Privilege Program Name is required'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        privilege_program_name: name.trim(),
        privilege_type: type,
      };
      if (label.trim()) body.discount_label = label.trim();
      if (rate) body.share_rate = parseFloat(rate);
      if (notes.trim()) body.notes = notes.trim();
      const res = await fetch('/api/v1/privileges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (e) {
      alert(`Create failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">New Privilege Config</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Privilege Program Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grab Driver - Privileges(1Mar26-d22)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded" autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Discount Label (optional, for legacy fallback)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Grab Driver - สิทธิ์ชาร์จไฟฟ้า... Used" className="w-full px-3 py-2 text-sm border border-gray-200 rounded font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white">
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Share Rate (THB/kWh)</label>
              <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="empty = use total_discount" className="w-full px-3 py-2 text-sm border border-gray-200 rounded font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded" />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-[#8B1927] text-white text-sm rounded hover:bg-[#701421] disabled:opacity-40 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
