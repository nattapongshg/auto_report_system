import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Download, FileDown, Loader2, Search, Send, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  snapshotId: string;
  groupName: string;
  locationCount: number;
  onClose: () => void;
  onSent: () => void;
}

interface GroupLoc {
  id: string;
  name: string;
  station_code: string | null;
  electricity_cost: number | null;
  internet_cost: number | null;
  etax: number | null;
  preview_rows?: number | null;
}

interface Preview {
  rows: number;
  kwh: number;
  revenue: number;
  location_count: number;
}

interface Input {
  electricity: string;
  internet: string;
  etax: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_INTERNET = 598;

export function GroupReportDialog(p: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [locs, setLocs] = useState<GroupLoc[]>([]);
  const [inputs, setInputs] = useState<Record<string, Input>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [shareRate, setShareRate] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/group-reports/${p.snapshotId}/preview/${encodeURIComponent(p.groupName)}`).then(r => r.json()),
      fetch(`/api/v1/group-reports/groups/${encodeURIComponent(p.groupName)}/locations?snapshot_id=${p.snapshotId}`).then(r => r.json()),
    ]).then(([pv, ll]) => {
      setPreview(pv);
      const items: GroupLoc[] = ll.items || [];
      setLocs(items);
      const seed: Record<string, Input> = {};
      for (const l of items) {
        seed[l.id] = {
          electricity: l.electricity_cost && l.electricity_cost > 0 ? String(l.electricity_cost) : '',
          internet: l.internet_cost != null ? String(l.internet_cost) : String(DEFAULT_INTERNET),
          // etax comes pre-computed from monthly_location_inputs (etax_count × 1 THB)
          etax: l.etax != null ? String(l.etax) : '',
        };
      }
      setInputs(seed);
    }).finally(() => setLoading(false));
  }, [p.snapshotId, p.groupName]);

  const updateInput = (id: string, field: keyof Input, value: string) =>
    setInputs(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const applyToAll = (field: keyof Input, value: string) =>
    setInputs(prev => {
      const next: Record<string, Input> = {};
      for (const k of Object.keys(prev)) next[k] = { ...prev[k], [field]: value };
      return next;
    });

  const commit = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    const valid = parts.filter(e => EMAIL_RE.test(e));
    if (valid.length === 0) return;
    setEmails(prev => Array.from(new Set([...prev, ...valid])));
    setDraft('');
  };
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && emails.length > 0) {
      setEmails(prev => prev.slice(0, -1));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locs.filter(l => {
      if (onlyEmpty) {
        const v = parseFloat(inputs[l.id]?.electricity || '0');
        if (v > 0) return false;
      }
      if (!q) return true;
      return l.name.toLowerCase().includes(q) || (l.station_code || '').toLowerCase().includes(q);
    });
  }, [locs, inputs, search, onlyEmpty]);

  const totals = useMemo(() => {
    let elec = 0, internet = 0, etax = 0, electricity_filled = 0;
    for (const l of locs) {
      const i = inputs[l.id];
      if (!i) continue;
      const e = parseFloat(i.electricity) || 0;
      elec += e;
      if (e > 0) electricity_filled++;
      internet += parseFloat(i.internet) || 0;
      etax += parseFloat(i.etax) || 0;
    }
    return { elec, internet, etax, electricity_filled };
  }, [inputs, locs]);

  const call = async (skip_email: boolean) => {
    if (totals.electricity_filled === 0) {
      alert('Please enter electricity cost for at least one location');
      return;
    }
    if (totals.electricity_filled < locs.length) {
      if (!confirm(`Only ${totals.electricity_filled}/${locs.length} locations have electricity cost. Continue?`)) return;
    }
    if (!skip_email && emails.length === 0) {
      if (!confirm('No email recipients — send anyway (file saved, no email)?')) return;
    }

    const body = {
      group_name: p.groupName,
      location_inputs: locs.map(l => ({
        location_id: l.id,
        electricity_cost: parseFloat(inputs[l.id]?.electricity || '0') || 0,
        internet_cost: parseFloat(inputs[l.id]?.internet || '0') || DEFAULT_INTERNET,
        etax: parseFloat(inputs[l.id]?.etax || '0') || 0,
      })),
      share_rate: shareRate ? parseFloat(shareRate) / 100 : null,
      email_recipients: emails,
      skip_email,
    };

    const setter = skip_email ? setGenerating : setSending;
    setter(true);
    try {
      const res = await fetch(`/api/v1/group-reports/${p.snapshotId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { alert(`Failed: ${await res.text()}`); return; }
      alert(skip_email ? 'Generating... check history in ~10s' : 'Sending... check history in ~10s');
      p.onSent();
    } finally {
      setter(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={p.onClose}>
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Send Group Report — {p.groupName}</h2>
            <p className="text-xs text-[#636E72] mt-0.5">
              <b>{p.locationCount}</b> locations
              {preview && <> · {preview.rows.toLocaleString()} rows · Revenue {preview.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB</>}
            </p>
          </div>
          <button onClick={p.onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-auto flex-1">
          {/* Shared config */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#636E72] mb-1">Share % (override — empty = use locations' rate)</label>
              <input
                type="number" step="0.01"
                value={shareRate} onChange={e => setShareRate(e.target.value)}
                placeholder="40"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#636E72] mb-1">Email Recipients (Enter / , / space to add)</label>
              <div
                className="w-full min-h-[42px] px-2 py-1.5 border border-gray-200 rounded-lg flex flex-wrap gap-1 items-center focus-within:border-[#8B1927]"
                onClick={() => inputRef.current?.focus()}
              >
                {emails.map(e => (
                  <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                    {e}
                    <button onClick={(ev) => { ev.stopPropagation(); setEmails(prev => prev.filter(x => x !== e)); }} className="hover:bg-blue-200 rounded p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKey}
                  onBlur={() => draft.trim() && commit(draft)}
                  placeholder={emails.length === 0 ? 'hq@group.com' : ''}
                  className="flex-1 min-w-[120px] text-sm outline-none bg-transparent py-1"
                />
              </div>
            </div>
          </div>

          {/* Per-location inputs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-semibold text-[#636E72]">Per-Location Inputs</label>
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search location..."
                  className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded"
                />
              </div>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={onlyEmpty} onChange={e => setOnlyEmpty(e.target.checked)} />
                Only empty electricity
              </label>
              <span className="text-xs text-gray-400">Showing {filtered.length}/{locs.length}</span>
            </div>

            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="max-h-[45vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-[#636E72]">Location</th>
                      <th className="text-right px-3 py-2 font-medium text-[#636E72] w-32">
                        Electricity
                        <button onClick={() => setBatchOpen(true)} className="ml-1 text-[10px] text-blue-600 hover:underline" title="Batch fill by pasting name+amount">batch</button>
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-[#636E72] w-24">
                        Internet
                        <button onClick={() => applyToAll('internet', String(DEFAULT_INTERNET))} className="ml-1 text-[10px] text-blue-600 hover:underline">598</button>
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-[#636E72] w-20" title="1 THB per e-tax document (pre-VAT). Auto-computed from etax_number count">
                        eTax
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</td></tr>
                    ) : filtered.map(l => {
                      const inp = inputs[l.id] || { electricity: '', internet: String(DEFAULT_INTERNET), etax: '0' };
                      return (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5">
                            <p className="text-[13px] font-medium">{l.name}</p>
                            {l.station_code && <p className="text-[10px] text-gray-400 font-mono">{l.station_code}</p>}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number" step="0.01"
                              value={inp.electricity}
                              onChange={e => updateInput(l.id, 'electricity', e.target.value)}
                              placeholder="0.00"
                              className="w-28 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number" step="0.01"
                              value={inp.internet}
                              onChange={e => updateInput(l.id, 'internet', e.target.value)}
                              className="w-20 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <input
                              type="number" step="0.01"
                              value={inp.etax}
                              onChange={e => updateInput(l.id, 'etax', e.target.value)}
                              className="w-16 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 border-t px-3 py-2 text-xs flex items-center justify-between">
                <span className="text-[#636E72]">
                  Filled: <b>{totals.electricity_filled}/{locs.length}</b>
                </span>
                <div className="flex gap-4 font-mono">
                  <span>Electric: <b>{totals.elec.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></span>
                  <span>Internet: <b>{totals.internet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></span>
                  <span>eTax: <b>{totals.etax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-between bg-gray-50">
          <button onClick={p.onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <div className="flex gap-2">
            <button
              onClick={() => call(true)}
              disabled={sending || generating}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Generate Only
            </button>
            <button
              onClick={() => call(false)}
              disabled={sending || generating}
              className="flex items-center gap-2 px-4 py-2 bg-[#8B1927] text-white text-sm rounded-lg hover:bg-[#701421] disabled:opacity-40"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Group Report
            </button>
          </div>
        </div>
      </div>

      {batchOpen && (
        <BatchElectricityDialog
          locations={locs}
          onClose={() => setBatchOpen(false)}
          onApply={(updates) => {
            setInputs(prev => {
              const next = { ...prev };
              for (const [id, value] of updates) {
                next[id] = { ...next[id], electricity: value };
              }
              return next;
            });
            setBatchOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Normalize a string for fuzzy matching
function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
}

interface BatchMatch {
  raw_name: string;
  raw_amount: string;
  amount: number | null;
  matched: GroupLoc | null;
  candidates: GroupLoc[];
}

function BatchElectricityDialog({ locations, onClose, onApply }: {
  locations: GroupLoc[];
  onClose: () => void;
  onApply: (updates: [string, string][]) => void;
}) {
  const [text, setText] = useState('');
  const [matches, setMatches] = useState<BatchMatch[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[] | null>(null);
  const [nameCol, setNameCol] = useState<string>('');
  const [amountCol, setAmountCol] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const rows = locations.map(l => ({
      'Location Name': l.name,
      'Station Code': l.station_code || '',
      'Electricity (THB)': '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // column widths
    ws['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Electricity');
    XLSX.writeFile(wb, `electricity_template_${locations.length}_locations.xlsx`);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', codepage: 65001 });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (rows.length === 0) { alert('File is empty'); return; }
    setParsedRows(rows);
    const cols = Object.keys(rows[0]);
    // Auto-guess columns
    const nameGuess = cols.find(c => /name|location|address|station|ชื่อ|สถานี/i.test(c)) || cols[0];
    const amountGuess = cols.find(c => /inv.?\s*amt|amount|electric|total|cost|ค่า|รวม/i.test(c)) || cols[cols.length - 1];
    setNameCol(nameGuess);
    setAmountCol(amountGuess);
  };

  const applyColumns = () => {
    if (!parsedRows || !nameCol || !amountCol) return;
    const out: BatchMatch[] = [];
    for (const r of parsedRows) {
      const rawName = String(r[nameCol] ?? '').trim();
      const rawAmountStr = String(r[amountCol] ?? '').replace(/[,฿\s]/g, '');
      if (!rawName) continue;
      const amount = parseFloat(rawAmountStr);
      const amountValid = !isNaN(amount);

      const nkey = norm(rawName);
      let matched: GroupLoc | null = null;
      const candidates: GroupLoc[] = [];
      for (const l of locations) {
        const locKey = norm(l.name);
        const codeKey = norm(l.station_code || '');
        if (locKey === nkey || codeKey === nkey) { matched = l; break; }
        if (locKey.includes(nkey) || nkey.includes(locKey) || (codeKey && nkey.includes(codeKey))) {
          candidates.push(l);
        }
      }
      if (!matched && candidates.length === 1) matched = candidates[0];

      out.push({
        raw_name: rawName,
        raw_amount: rawAmountStr,
        amount: amountValid ? amount : null,
        matched,
        candidates,
      });
    }
    setMatches(out);
  };

  const parse = () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const out: BatchMatch[] = [];
    for (const line of lines) {
      // Split by tab, comma, or multi-space. Amount = last numeric token; name = rest.
      const parts = line.split(/[\t,;]|\s{2,}/).map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      // Last numeric token is amount
      let amount: number | null = null;
      let amountIdx = -1;
      for (let i = parts.length - 1; i >= 0; i--) {
        const cleaned = parts[i].replace(/[,฿]/g, '').trim();
        const n = parseFloat(cleaned);
        if (!isNaN(n) && cleaned.match(/^-?\d+(\.\d+)?$/)) {
          amount = n;
          amountIdx = i;
          break;
        }
      }
      if (amountIdx < 0) continue;
      const name = parts.slice(0, amountIdx).join(' ').trim() || parts.filter((_, i) => i !== amountIdx).join(' ');

      // Match: exact > startsWith > contains > station_code
      const nkey = norm(name);
      let matched: GroupLoc | null = null;
      const candidates: GroupLoc[] = [];
      for (const l of locations) {
        const locKey = norm(l.name);
        const codeKey = norm(l.station_code || '');
        if (locKey === nkey || codeKey === nkey) {
          matched = l;
          break;
        }
        if (locKey.includes(nkey) || nkey.includes(locKey) || (codeKey && nkey.includes(codeKey))) {
          candidates.push(l);
        }
      }
      if (!matched && candidates.length === 1) matched = candidates[0];

      out.push({ raw_name: name, raw_amount: parts[amountIdx], amount, matched, candidates });
    }
    setMatches(out);
  };

  const manualPick = (index: number, locId: string) => {
    setMatches(prev => {
      if (!prev) return prev;
      const loc = locations.find(l => l.id === locId) || null;
      return prev.map((m, i) => i === index ? { ...m, matched: loc } : m);
    });
  };

  const apply = () => {
    if (!matches) return;
    const updates: [string, string][] = [];
    for (const m of matches) {
      if (m.matched && m.amount != null) {
        updates.push([m.matched.id, String(m.amount)]);
      }
    }
    if (updates.length === 0) { alert('No matched rows'); return; }
    onApply(updates);
  };

  const matchedCount = matches?.filter(m => m.matched).length || 0;
  const totalAmount = matches?.filter(m => m.matched && m.amount != null).reduce((s, m) => s + (m.amount || 0), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4" /> Batch Fill Electricity
            </h2>
            <p className="text-xs text-[#636E72] mt-0.5">Paste rows: location name + amount. Separators: tab / comma / multi-space.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-auto flex-1">
          {!matches && !parsedRows && (
            <>
              {/* Download template + File upload */}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded hover:bg-blue-100"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Template
                  </button>
                  <span className="text-xs text-[#636E72]">
                    Pre-filled with {locations.length} locations — fill "Electricity (THB)" column then upload back
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#8B1927] text-white text-sm rounded hover:bg-[#701421]"
                  >
                    <Upload className="w-4 h-4" /> Upload CSV / Excel
                  </button>
                  <span className="text-xs text-[#636E72]">
                    Any .csv / .xlsx with location & amount columns
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span>OR paste</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`Bangchak Bgn-Asia 2\t128543.44\nBangchak Bangna\t80290.03\nASIA, 128543.44\n...`}
                rows={8}
                className="w-full p-3 text-sm border border-gray-200 rounded-lg font-mono"
              />
              <p className="text-xs text-[#636E72]">
                Match keys: location name (exact/contains) or station code.
              </p>
            </>
          )}

          {parsedRows && !matches && (
            <>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs">
                ✓ Loaded <b>{fileName}</b> — {parsedRows.length} rows, {Object.keys(parsedRows[0] || {}).length} columns
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#636E72] mb-1">Name / Location column</label>
                  <select
                    value={nameCol} onChange={e => setNameCol(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  >
                    {Object.keys(parsedRows[0] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#636E72] mb-1">Amount column (THB)</label>
                  <select
                    value={amountCol} onChange={e => setAmountCol(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  >
                    {Object.keys(parsedRows[0] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <p className="text-xs text-[#636E72] px-3 py-2 bg-gray-50 border-b">Preview (first 3 rows)</p>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-1.5">Name</th>
                      <th className="text-right px-3 py-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{String(r[nameCol] ?? '').slice(0, 60)}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{String(r[amountCol] ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {matches && (
            <>
              <div className="flex items-center gap-4 text-xs text-[#636E72]">
                <span>Parsed: <b>{matches.length}</b></span>
                <span>Matched: <b className="text-emerald-600">{matchedCount}</b></span>
                <span>Unmatched: <b className="text-amber-600">{matches.length - matchedCount}</b></span>
                <span className="ml-auto">Total: <b className="font-mono">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></span>
              </div>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-[#636E72]">Pasted Name</th>
                      <th className="text-right px-3 py-2 font-medium text-[#636E72] w-28">Amount</th>
                      <th className="text-left px-3 py-2 font-medium text-[#636E72]">Matched Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {matches.map((m, i) => (
                      <tr key={i} className={m.matched ? '' : 'bg-amber-50/30'}>
                        <td className="px-3 py-1.5 text-xs text-[#636E72]">{m.raw_name}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs">
                          {m.amount != null ? m.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : <span className="text-red-500">?</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={m.matched?.id || ''}
                            onChange={e => manualPick(i, e.target.value)}
                            className={`w-full text-xs border rounded px-2 py-1 ${m.matched ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30'}`}
                          >
                            <option value="">— pick location —</option>
                            {locations.map(l => (
                              <option key={l.id} value={l.id}>
                                {l.name} {l.station_code ? `(${l.station_code})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-between bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          {matches ? (
            <div className="flex gap-2">
              <button onClick={() => { setMatches(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">← Back</button>
              <button onClick={apply} className="px-4 py-2 bg-[#8B1927] text-white text-sm rounded-lg hover:bg-[#701421]">
                Apply {matchedCount} matches
              </button>
            </div>
          ) : parsedRows ? (
            <div className="flex gap-2">
              <button onClick={() => { setParsedRows(null); setFileName(''); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">← Back</button>
              <button onClick={applyColumns} disabled={!nameCol || !amountCol} className="px-4 py-2 bg-[#8B1927] text-white text-sm rounded-lg hover:bg-[#701421] disabled:opacity-40">
                Match Rows
              </button>
            </div>
          ) : (
            <button onClick={parse} disabled={!text.trim()} className="px-4 py-2 bg-[#8B1927] text-white text-sm rounded-lg hover:bg-[#701421] disabled:opacity-40">
              Parse & Match (from paste)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
