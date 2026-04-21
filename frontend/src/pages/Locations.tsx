import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Search, Wand2 } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  station_code: string | null;
  is_report_enabled: boolean;
  location_share_rate: number | null;
  transaction_fee_rate: number | null;
  electricity_cost: number | null;
  internet_cost: number | null;
  etax: number | null;
  email_recipients: string[] | null;
  group_name: string | null;
}

type Draft = Partial<Omit<Location, 'id' | 'name' | 'station_code'>> & {
  email_recipients_text?: string;
};

const PCT_FIELDS: Array<keyof Draft> = ['location_share_rate', 'transaction_fee_rate'];

export function Locations() {
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');

  // Bulk apply inputs — report is 3-state: '' = no change, 'on' = enable, 'off' = disable
  const [bulk, setBulk] = useState({ report: '' as '' | 'on' | 'off', share: '', txFee: '', internet: '', etax: '', email: '', group: '' });

  const load = () => {
    setLoading(true);
    fetch('/api/v1/locations')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateDraft = (id: string, patch: Draft) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const isDirty = (loc: Location): boolean => {
    const d = drafts[loc.id];
    if (!d) return false;
    return Object.entries(d).some(([k, v]) => {
      if (k === 'email_recipients_text') {
        const orig = (loc.email_recipients ?? []).join(', ');
        return (v ?? '') !== orig;
      }
      const origVal = (loc as unknown as Record<string, unknown>)[k];
      return v !== origVal;
    });
  };

  const buildPayload = (d: Draft): Record<string, unknown> => {
    const payload: Record<string, unknown> = { ...d };
    if ('email_recipients_text' in payload) {
      const text = (payload.email_recipients_text as string) || '';
      payload.email_recipients = text.split(',').map((s) => s.trim()).filter(Boolean);
      delete payload.email_recipients_text;
    }
    for (const k of PCT_FIELDS) {
      if (k in payload && typeof payload[k] === 'string') {
        payload[k] = parseFloat(payload[k] as string) / 100;
      }
    }
    return payload;
  };

  const saveOne = async (loc: Location) => {
    const d = drafts[loc.id];
    if (!d) return;
    setSavingId(loc.id);
    try {
      const res = await fetch(`/api/v1/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(d)),
      });
      if (!res.ok) throw new Error(await res.text());
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[loc.id];
        return next;
      });
      load();
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSavingId(null);
    }
  };

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.group_name) set.add(i.group_name);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (onlyEnabled && !i.is_report_enabled) return false;
      if (groupFilter && i.group_name !== groupFilter) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || (i.station_code ?? '').toLowerCase().includes(q);
    });
  }, [items, search, onlyEnabled, groupFilter]);

  const dirtyLocs = useMemo(() => items.filter(isDirty), [items, drafts]);

  const saveAll = async () => {
    if (dirtyLocs.length === 0) return;
    setSavingAll(true);
    try {
      await Promise.all(dirtyLocs.map((loc) =>
        fetch(`/api/v1/locations/${loc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(drafts[loc.id])),
        })
      ));
      setDrafts({});
      load();
    } catch (e) {
      alert(`Save all failed: ${(e as Error).message}`);
    } finally {
      setSavingAll(false);
    }
  };

  const applyBulk = () => {
    const patch: Draft = {};
    if (bulk.report === 'on') patch.is_report_enabled = true;
    else if (bulk.report === 'off') patch.is_report_enabled = false;
    if (bulk.share !== '') patch.location_share_rate = bulk.share as unknown as number;
    if (bulk.txFee !== '') patch.transaction_fee_rate = bulk.txFee as unknown as number;
    if (bulk.internet !== '') patch.internet_cost = bulk.internet as unknown as number;
    if (bulk.etax !== '') patch.etax = bulk.etax as unknown as number;
    if (bulk.email !== '') patch.email_recipients_text = bulk.email;
    if (bulk.group !== '') patch.group_name = bulk.group;
    if (Object.keys(patch).length === 0) {
      alert('Enter at least one field to apply');
      return;
    }
    if (!confirm(`Apply these values to ${filtered.length} location(s)?`)) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const loc of filtered) {
        next[loc.id] = { ...next[loc.id], ...patch };
      }
      return next;
    });
    setBulk({ report: '', share: '', txFee: '', internet: '', etax: '', email: '', group: '' });
  };

  const toggleAllVisible = (enable: boolean) => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const loc of filtered) {
        if (loc.is_report_enabled !== enable) {
          next[loc.id] = { ...next[loc.id], is_report_enabled: enable };
        }
      }
      return next;
    });
  };

  const enabledCount = items.filter((i) => i.is_report_enabled).length;

  return (
    <div className="p-8 max-w-[1600px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <button
          onClick={saveAll}
          disabled={dirtyLocs.length === 0 || savingAll}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B1927] text-white rounded-lg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#701421]"
        >
          {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All ({dirtyLocs.length})
        </button>
      </div>
      <p className="text-sm text-[#636E72] mb-6">
        Per-location monthly-report config — share rate, fees, costs, and email recipients.
      </p>

      <div className="luxury-card p-5 mb-5">
        <p className="text-sm">
          <span className="font-semibold">{items.length}</span> locations ·{' '}
          <span className="font-semibold text-[#0B8457]">{enabledCount}</span> report-enabled
          {dirtyLocs.length > 0 && (
            <span className="ml-2 text-amber-600">· {dirtyLocs.length} unsaved</span>
          )}
        </p>

        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or station code..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={onlyEnabled}
              onChange={(e) => setOnlyEnabled(e.target.checked)}
            />
            Report-enabled only
          </label>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All groups</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
            <option value="__none__" disabled>──</option>
          </select>
        </div>
      </div>

      {/* Bulk apply */}
      <div className="luxury-card p-4 mb-5 bg-blue-50/30 border-blue-100">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-semibold text-blue-900">Bulk Apply</p>
          <span className="text-xs text-[#636E72]">
            Fill any field then click Apply — updates all <b>{filtered.length}</b> visible rows (as drafts, not saved yet)
          </span>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-24">
            <label className="block text-xs text-[#636E72] mb-1">Report</label>
            <select
              value={bulk.report}
              onChange={(e) => setBulk({ ...bulk, report: e.target.value as '' | 'on' | 'off' })}
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-white"
            >
              <option value="">—</option>
              <option value="on">Enable</option>
              <option value="off">Disable</option>
            </select>
          </div>
          <Field label="Share %" value={bulk.share} onChange={(v) => setBulk({ ...bulk, share: v })} placeholder="40" w="w-20" />
          <Field label="Tx Fee %" value={bulk.txFee} onChange={(v) => setBulk({ ...bulk, txFee: v })} placeholder="3.65" w="w-20" />
          <Field label="Internet" value={bulk.internet} onChange={(v) => setBulk({ ...bulk, internet: v })} placeholder="598" w="w-24" />
          <Field label="eTax" value={bulk.etax} onChange={(v) => setBulk({ ...bulk, etax: v })} placeholder="0" w="w-20" />
          <Field label="Email" value={bulk.email} onChange={(v) => setBulk({ ...bulk, email: v })} placeholder="a@x.com, b@x.com" w="flex-1" type="text" />
          <Field label="Group" value={bulk.group} onChange={(v) => setBulk({ ...bulk, group: v })} placeholder="BYD / Shell / Bangchak" w="w-32" type="text" />
          <button
            onClick={applyBulk}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-30"
          >
            Apply to {filtered.length}
          </button>
        </div>
      </div>

      <div className="luxury-card overflow-hidden">
        {loading ? (
          <p className="text-gray-400 p-8 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 p-8 text-center">No locations match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2.5 font-medium text-[#636E72]">Location</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#636E72]">
                  <div className="flex items-center justify-center gap-1">
                    <span>Report</span>
                    <button
                      onClick={() => toggleAllVisible(true)}
                      title="Enable all visible"
                      className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100"
                    >
                      +all
                    </button>
                    <button
                      onClick={() => toggleAllVisible(false)}
                      title="Disable all visible"
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                    >
                      −all
                    </button>
                  </div>
                </th>
                <th className="text-right px-3 py-2.5 font-medium text-[#636E72]" title="location_share_rate">Share %</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#636E72]" title="transaction_fee_rate">Tx Fee %</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#636E72]">Internet</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#636E72]">eTax</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#636E72] w-32">Group</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#636E72]">Email Recipients</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((loc) => {
                const d = drafts[loc.id] || {};
                const dirty = isDirty(loc);
                const emailText =
                  d.email_recipients_text !== undefined
                    ? d.email_recipients_text
                    : (loc.email_recipients ?? []).join(', ');
                const enabled = d.is_report_enabled ?? loc.is_report_enabled;
                const share =
                  d.location_share_rate !== undefined
                    ? String(d.location_share_rate)
                    : loc.location_share_rate != null
                    ? (loc.location_share_rate * 100).toFixed(2)
                    : '';
                const txFee =
                  d.transaction_fee_rate !== undefined
                    ? String(d.transaction_fee_rate)
                    : loc.transaction_fee_rate != null
                    ? (loc.transaction_fee_rate * 100).toFixed(2)
                    : '';
                const internet =
                  d.internet_cost !== undefined
                    ? String(d.internet_cost)
                    : loc.internet_cost != null
                    ? String(loc.internet_cost)
                    : '';
                const etax =
                  d.etax !== undefined
                    ? String(d.etax)
                    : loc.etax != null
                    ? String(loc.etax)
                    : '';
                return (
                  <tr key={loc.id} className={dirty ? 'bg-yellow-50/40' : 'hover:bg-gray-50/50'}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{loc.name}</p>
                      {loc.station_code && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{loc.station_code}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateDraft(loc.id, { is_report_enabled: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={share}
                        onChange={(e) => updateDraft(loc.id, { location_share_rate: e.target.value as unknown as number })}
                        className="w-20 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                        placeholder="40.00"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={txFee}
                        onChange={(e) => updateDraft(loc.id, { transaction_fee_rate: e.target.value as unknown as number })}
                        className="w-20 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                        placeholder="3.65"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={internet}
                        onChange={(e) => updateDraft(loc.id, { internet_cost: e.target.value as unknown as number })}
                        className="w-24 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={etax}
                        onChange={(e) => updateDraft(loc.id, { etax: e.target.value as unknown as number })}
                        className="w-20 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={d.group_name !== undefined ? (d.group_name ?? '') : (loc.group_name ?? '')}
                        onChange={(e) => updateDraft(loc.id, { group_name: e.target.value || null })}
                        placeholder="—"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                        list="group-options"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={emailText}
                        onChange={(e) => updateDraft(loc.id, { email_recipients_text: e.target.value })}
                        placeholder="a@x.com, b@x.com"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded font-mono"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => saveOne(loc)}
                        disabled={!dirty || savingId === loc.id}
                        className="flex items-center gap-1 px-2 py-1 bg-[#8B1927] text-white rounded text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#701421] cursor-pointer"
                      >
                        {savingId === loc.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-[#636E72] mt-3">
        Share % and Tx Fee % are entered as percent (e.g. 40.00 = 0.40). Email recipients are
        comma-separated. Rows with unsaved edits are highlighted.
      </p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, w, type = 'number' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; w: string; type?: string;
}) {
  return (
    <div className={w}>
      <label className="block text-xs text-[#636E72] mb-1">{label}</label>
      <input
        type={type}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-xs border border-gray-200 rounded font-mono bg-white"
      />
    </div>
  );
}
