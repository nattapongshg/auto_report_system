import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Play, Save, Mail, CheckCircle2, AlertCircle, RefreshCw, Trash2, ChevronDown, ChevronRight, Download } from 'lucide-react';

interface PreviewItem {
  location_id: string;
  location_name: string;
  station_code: string | null;
  group_name: string | null;
  station_type: string | null;
  share_basis: 'gp' | 'revenue';
  share_rate: number | null;
  tx_fee_rate: number | null;
  internet_cost: number | null;
  email_recipients: string[];
  ca: string | null;
  entry_id: string | null;
  status: string | null;
  electricity_cost: number | null;
  etax: number | null;
  revenue: number | null;
  kwh: number | null;
  rows: number | null;
  gp: number | null;
  share: number | null;
  file_path: string | null;
  email_sent_at: string | null;
}

interface GroupOpt { group_name: string; count: number; }

interface Template {
  id: string;
  name: string;
  group_name: string | null;
  location_ids: string[];
  email_mapping: Record<string, string[]>;
  updated_at: string;
}

const defaultMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function ReportGen() {
  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [group, setGroup] = useState<string>('');
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [elecOverride, setElecOverride] = useState<Record<string, string>>({});
  const [bulkEmail, setBulkEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saveDialog, setSaveDialog] = useState(false);

  const loadGroups = () => {
    fetch('/api/v1/report-gen/groups')
      .then(r => r.json())
      .then(d => setGroups(d.groups || []));
  };

  const loadTemplates = () => {
    fetch('/api/v1/report-gen/templates')
      .then(r => r.json())
      .then(d => setTemplates(d.items || []));
  };

  useEffect(() => { loadGroups(); loadTemplates(); }, []);

  const loadPreview = async () => {
    if (!yearMonth) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ year_month: yearMonth });
      if (group) q.set('group', group);
      const r = await fetch(`/api/v1/report-gen/preview?${q}`);
      if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
      const d = await r.json();
      setItems(d.items || []);
      const nextEmails: Record<string, string> = {};
      const nextSelected: Record<string, boolean> = {};
      for (const it of d.items || []) {
        nextEmails[it.location_id] = it.email_recipients.join(', ');
        nextSelected[it.location_id] = true;  // default: all selected
      }
      setEmails(nextEmails);
      setSelected(nextSelected);
      setElecOverride({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const applyBulkEmail = () => {
    if (!bulkEmail.trim()) return;
    const visible = filteredItems.map(i => i.location_id);
    setEmails(prev => {
      const next = { ...prev };
      for (const id of visible) next[id] = bulkEmail;
      return next;
    });
    setBulkEmail('');
  };

  const filteredItems = useMemo(() => items, [items]);
  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const effectiveElec = (it: PreviewItem): number => {
    const o = elecOverride[it.location_id];
    if (o !== undefined && o !== '') {
      const v = parseFloat(o);
      return isNaN(v) ? 0 : v;
    }
    return it.electricity_cost ?? 0;
  };

  // Full breakdown per location — mirrors the Excel Summary sheet
  // (share_calc.compute_totals). Recomputes from user's edits to electricity.
  const VAT = 0.07;
  const TRANSFER = 30; // flat bank-transfer fee per invoice (GP basis only)
  const breakdownFor = (it: PreviewItem) => {
    const revenue = it.revenue ?? 0;
    const electricity = effectiveElec(it);
    const internet = it.internet_cost ?? 0;
    const etax = it.etax ?? 0;
    const txRate = it.tx_fee_rate ?? 0;
    const shareRate = it.share_rate ?? 0;
    const isRevenue = it.share_basis === 'revenue';

    const txFee = isRevenue ? 0 : revenue * txRate;
    const vatOnFee = txFee * VAT;
    const transfer = isRevenue ? 0 : TRANSFER;
    const totalFee = txFee + vatOnFee + transfer;
    const internetVat = internet * (1 + VAT);
    const etaxVat = etax * (1 + VAT);
    const remaining = isRevenue
      ? revenue - internetVat
      : revenue - totalFee - electricity - internetVat - etaxVat;
    const shareInclVat = remaining * shareRate;
    const beforeVat = shareInclVat / (1 + VAT);
    const vatPortion = shareInclVat - beforeVat;

    return { revenue, electricity, internet, internetVat, etax, etaxVat,
             txRate, txFee, vatOnFee, transfer, totalFee, remaining, shareRate,
             shareInclVat, beforeVat, vatPortion, isRevenue };
  };

  const totals = useMemo(() => {
    let revenue = 0, electricity = 0, share = 0;
    for (const i of items) {
      if (!selected[i.location_id]) continue;
      const b = breakdownFor(i);
      revenue += b.revenue;
      electricity += b.electricity;
      share += b.shareInclVat;
    }
    return { revenue, electricity, share };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selected, elecOverride]);

  const buildEntry = (i: PreviewItem, skipEmail: boolean) => ({
    location_id: i.location_id,
    electricity_cost: effectiveElec(i),
    internet_cost: i.internet_cost ?? undefined,
    etax: i.etax ?? undefined,
    emails: (emails[i.location_id] || '').split(',').map(s => s.trim()).filter(Boolean),
    skip_email: skipEmail,
  });

  const postRun = async (entries: ReturnType<typeof buildEntry>[]) => {
    const r = await fetch('/api/v1/report-gen/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_month: yearMonth, entries }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<{ processing: number }>;
  };

  const run = async (skipEmail: boolean) => {
    const entries = items.filter(i => selected[i.location_id]).map(i => buildEntry(i, skipEmail));
    if (entries.length === 0) { alert('Select at least one location'); return; }
    const verb = skipEmail ? 'Generate (no email)' : 'Generate + email';
    if (!confirm(`${verb} ${entries.length} report(s) for ${yearMonth}?`)) return;
    setRunning(true);
    try {
      const d = await postRun(entries);
      alert(`Processing ${d.processing} report(s). Refresh to see status.`);
      setTimeout(loadPreview, 3000);
    } catch (e) {
      alert(`Run failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const runOne = async (it: PreviewItem, skipEmail: boolean) => {
    setRowBusy(it.location_id);
    try {
      await postRun([buildEntry(it, skipEmail)]);
      setTimeout(loadPreview, 2000);
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRowBusy(null);
    }
  };

  const loadTemplate = async (t: Template) => {
    setGroup(t.group_name || '');
    await loadPreview();
    // Apply saved selections + emails after preview loaded; use setTimeout so state settles.
    setTimeout(() => {
      const sel: Record<string, boolean> = {};
      const em: Record<string, string> = {};
      for (const id of t.location_ids) sel[id] = true;
      for (const [id, list] of Object.entries(t.email_mapping)) {
        em[id] = (list as string[]).join(', ');
      }
      setSelected(sel);
      setEmails(prev => ({ ...prev, ...em }));
    }, 300);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/v1/report-gen/templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  };

  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="p-8 max-w-[1800px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#8B1927]" /> Report Generation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pick a group, review preview, edit emails, generate + send in one click. Save the setup as a template for next month.
          </p>
        </div>
      </div>

      {/* Selector bar */}
      <div className="bg-white border rounded-xl p-4 mb-5 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Month</label>
          <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-gray-500 mb-1">Group</label>
          <select value={group} onChange={e => setGroup(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">All groups</option>
            {groups.map(g => <option key={g.group_name} value={g.group_name}>{g.group_name} ({g.count})</option>)}
          </select>
        </div>
        <button onClick={loadPreview} disabled={loading} className="bg-[#1a1a2e] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Load Preview
        </button>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="bg-white border rounded-xl p-4 mb-5">
          <div className="text-xs text-gray-500 mb-2">Saved templates</div>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-center border rounded-lg text-sm">
                <button onClick={() => loadTemplate(t)} className="px-3 py-1.5 hover:bg-gray-50">
                  {t.name} <span className="text-xs text-gray-400 ml-1">· {t.location_ids.length}</span>
                </button>
                <button onClick={() => deleteTemplate(t.id)} className="px-2 py-1.5 text-gray-400 hover:text-red-600 border-l">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Summary + bulk email + actions */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white border rounded-xl p-3">
              <div className="text-xs text-gray-500">Selected</div>
              <div className="text-xl font-semibold">{selectedCount} / {items.length}</div>
            </div>
            <div className="bg-white border rounded-xl p-3">
              <div className="text-xs text-gray-500">Σ Revenue</div>
              <div className="text-xl font-semibold tabular-nums">{fmt(totals.revenue)}</div>
            </div>
            <div className="bg-white border rounded-xl p-3">
              <div className="text-xs text-gray-500">Σ Electricity <span className="text-[10px] text-gray-400">(incl VAT)</span></div>
              <div className="text-xl font-semibold tabular-nums">{fmt(totals.electricity)}</div>
            </div>
            <div className="bg-white border rounded-xl p-3">
              <div className="text-xs text-gray-500">Σ Location Share <span className="text-[10px] text-gray-400">(incl VAT)</span></div>
              <div className="text-xl font-semibold tabular-nums text-emerald-700">{fmt(totals.share)}</div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 mb-4 flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={bulkEmail}
              onChange={e => setBulkEmail(e.target.value)}
              placeholder="Bulk set emails for all visible (comma-separated)"
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
            />
            <button onClick={applyBulkEmail} disabled={!bulkEmail.trim()} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              Apply to {items.length}
            </button>
            <button onClick={() => setSaveDialog(true)} className="px-3 py-1.5 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
              <Save className="w-4 h-4" /> Save as Template
            </button>
            <button
              onClick={() => run(true)}
              disabled={running || selectedCount === 0}
              className="border px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
              title="Build Excel files only — no email"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Generate Only ({selectedCount})
            </button>
            <button
              onClick={() => run(false)}
              disabled={running || selectedCount === 0}
              className="bg-[#8B1927] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[#701421] disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Generate + Send ({selectedCount})
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2 w-6"></th>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox"
                      checked={selectedCount === items.length && items.length > 0}
                      onChange={e => {
                        const v = e.target.checked;
                        const next: Record<string, boolean> = {};
                        for (const i of items) next[i.location_id] = v;
                        setSelected(next);
                      }} />
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Location</th>
                  <th className="px-3 py-2 text-left font-medium">Basis / Share</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2 text-right font-medium">Electricity <span className="text-[10px] text-gray-400">(incl VAT)</span></th>
                  <th className="px-3 py-2 text-right font-medium">Net GP <span className="text-[10px] text-gray-400">(incl VAT)</span></th>
                  <th className="px-3 py-2 text-left font-medium">Emails</th>
                  <th className="px-3 py-2 text-center font-medium w-20">Status</th>
                  <th className="px-3 py-2 text-center font-medium w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(it => {
                  const b = breakdownFor(it);
                  const isExpanded = !!expanded[it.location_id];
                  return (
                    <>
                      <tr key={it.location_id} className="border-t hover:bg-gray-50">
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => setExpanded(prev => ({ ...prev, [it.location_id]: !prev[it.location_id] }))}
                                  className="text-gray-400 hover:text-gray-700">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <input type="checkbox"
                            checked={!!selected[it.location_id]}
                            onChange={e => setSelected(prev => ({ ...prev, [it.location_id]: e.target.checked }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{it.location_name}</div>
                          {it.group_name && <div className="text-xs text-gray-400">{it.group_name}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="text-gray-500">{it.share_basis}</span>
                          <span className="ml-2 font-medium">{it.share_rate != null ? `${(it.share_rate * 100).toFixed(0)}%` : '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(b.revenue)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={elecOverride[it.location_id] ?? (it.electricity_cost ?? '')}
                            onChange={e => setElecOverride(prev => ({ ...prev, [it.location_id]: e.target.value }))}
                            placeholder={it.ca ? 'no bill' : 'no CA'}
                            className={`w-28 px-2 py-1 text-xs text-right border rounded font-mono tabular-nums ${
                              effectiveElec(it) === 0 ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                            }`}
                            title="incl VAT (PEA AMOUNT / MEA Total)"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-medium">{fmt(b.shareInclVat)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={emails[it.location_id] ?? ''}
                            onChange={e => setEmails(prev => ({ ...prev, [it.location_id]: e.target.value }))}
                            placeholder="a@x.com, b@x.com"
                            className="w-full border rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusBadge status={it.status} emailSent={!!it.email_sent_at} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {it.file_path && (
                              <a
                                href={`/output/${it.file_path.split(/[\\/]/).pop()}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Download generated Excel"
                                className="p-1.5 border rounded hover:bg-gray-50 text-emerald-700"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => runOne(it, true)} disabled={rowBusy === it.location_id}
                                    title="Generate only (no email)"
                                    className="p-1.5 border rounded hover:bg-gray-50 disabled:opacity-30">
                              {rowBusy === it.location_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => runOne(it, false)} disabled={rowBusy === it.location_id}
                                    title="Generate + send email"
                                    className="p-1.5 bg-[#8B1927] text-white rounded hover:bg-[#701421] disabled:opacity-30">
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={10} className="px-12 py-4">
                            <BreakdownPane b={b} locationName={it.location_name} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {saveDialog && (
        <SaveTemplateDialog
          group={group || null}
          locationIds={items.filter(i => selected[i.location_id]).map(i => i.location_id)}
          emailMapping={Object.fromEntries(
            Object.entries(emails)
              .filter(([id]) => selected[id])
              .map(([id, s]) => [id, s.split(',').map(x => x.trim()).filter(Boolean)])
          )}
          onClose={() => setSaveDialog(false)}
          onSaved={() => { setSaveDialog(false); loadTemplates(); }}
        />
      )}
    </div>
  );
}

type Breakdown = {
  revenue: number; electricity: number;
  internet: number; internetVat: number;
  etax: number; etaxVat: number;
  txRate: number; txFee: number; vatOnFee: number; transfer: number; totalFee: number;
  remaining: number; shareRate: number;
  shareInclVat: number; beforeVat: number; vatPortion: number;
  isRevenue: boolean;
};

function BreakdownPane({ b, locationName }: { b: Breakdown; locationName: string }) {
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const SummaryRow = ({ label, note, value, bold = false, highlight, top }: {
    label?: string; note?: string; value: number; bold?: boolean; highlight?: boolean; top?: boolean;
  }) => (
    <div className={`grid grid-cols-[2fr_2fr_1fr] gap-2 px-2 py-1 ${top ? 'border-t pt-2' : ''} ${highlight ? 'bg-yellow-100' : ''}`}>
      <div className={`text-right ${bold ? 'font-semibold' : ''}`}>{label ?? ''}</div>
      <div className="text-right text-gray-500 text-xs">{note ?? ''}</div>
      <div className={`text-right tabular-nums ${bold ? 'font-semibold' : ''}`}>{fmt(value)}</div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto bg-white border rounded-lg p-3 text-sm">
      <SummaryRow label="Revenue" value={b.revenue} bold />
      {!b.isRevenue && (
        <>
          <SummaryRow top label="Transaction Fee" note={`(${(b.txRate * 100).toFixed(2)}% of Revenue)`} value={b.txFee} />
          <SummaryRow label="VAT" note="(7% of Transaction Fee)" value={b.vatOnFee} />
          <SummaryRow label="Transfer" value={b.transfer} />
          <SummaryRow label="Total Fee" value={b.totalFee} bold />
          <SummaryRow top label="Electricity Cost" value={b.electricity} highlight bold />
          <SummaryRow label="Internet Cost" value={b.internet} />
          <SummaryRow note="Vat 7%" value={b.internetVat} />
          <SummaryRow label="Etax" value={b.etax} />
          <SummaryRow label="Etax (Include Vat)" note="Vat 7%" value={b.etaxVat} />
          <SummaryRow label="คงเหลือ" value={b.remaining} bold />
        </>
      )}
      {b.isRevenue && (
        <>
          <SummaryRow top label="Electricity Cost" value={b.electricity} highlight bold />
          <SummaryRow label="Internet Cost" value={b.internet} />
          <SummaryRow note="Vat 7%" value={b.internetVat} />
          <SummaryRow label="คงเหลือ" value={b.remaining} bold />
        </>
      )}
      <div className="mt-2 bg-blue-50 rounded p-2">
        <SummaryRow
          label={locationName}
          note={b.isRevenue
            ? `(${Math.round(b.shareRate * 100)}% of Revenue)`
            : `(${Math.round(b.shareRate * 100)}% of Gross Profit VAT Incl.)`}
          value={b.shareInclVat} bold
        />
        <SummaryRow label="VAT" note="(7% of Cash In)" value={b.vatPortion} />
        <SummaryRow note="(Before VAT)" value={b.beforeVat} />
      </div>
      <div className="mt-2 border-t-2 border-double pt-2">
        <SummaryRow label="Net GP" note="(VAT Included)" value={b.shareInclVat} bold />
      </div>
    </div>
  );
}

function StatusBadge({ status, emailSent }: { status: string | null; emailSent?: boolean }) {
  if (!status || status === 'pending') return <span className="text-xs text-gray-400">pending</span>;
  if (status === 'generating') return <span className="text-xs text-blue-600 flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> gen</span>;
  if (status === 'sent') {
    return emailSent
      ? <span className="text-xs text-green-600 flex items-center justify-center gap-1"><Mail className="w-3 h-3" /> sent</span>
      : <span className="text-xs text-emerald-700 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> generated</span>;
  }
  if (status === 'failed') return <span className="text-xs text-red-600 flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> failed</span>;
  return <span className="text-xs text-gray-500">{status}</span>;
}

function SaveTemplateDialog({ group, locationIds, emailMapping, onClose, onSaved }: {
  group: string | null;
  locationIds: string[];
  emailMapping: Record<string, string[]>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/v1/report-gen/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, group_name: group, location_ids: locationIds, email_mapping: emailMapping }),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b font-semibold">Save template</div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Template name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly Showrooms" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="text-xs text-gray-500">
            Group: <b>{group || 'all'}</b> · Locations: <b>{locationIds.length}</b> · Email mappings: <b>{Object.keys(emailMapping).length}</b>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button onClick={save} disabled={!name.trim() || busy} className="px-4 py-2 bg-[#1a1a2e] text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
