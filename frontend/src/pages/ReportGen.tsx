import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Database, Download,
  FileSpreadsheet, Loader2, Mail, Play, RefreshCw, Save, Search,
  Send, Trash2, Wand2, X,
} from 'lucide-react';
import {
  Btn, Card, PageTitle, Stat, StatusPill,
} from '../components/ui/primitives';
import type { Status } from '../components/ui/primitives';

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

interface GroupOpt { group_name: string; count: number }

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

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
};

// map backend status → primitive StatusPill status
function toStatus(s: string | null | undefined, emailSent: boolean): Status {
  if (!s || s === 'pending') return 'pending';
  if (s === 'generating') return 'generating';
  if (s === 'sent') return emailSent ? 'sent' : 'completed';
  if (s === 'failed') return 'failed';
  return 'pending';
}

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
  const [filter, setFilter] = useState<'all' | 'pending' | 'generating' | 'sent' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const loadGroups = () => {
    fetch('/api/v1/report-gen/groups')
      .then((r) => r.json())
      .then((d) => setGroups(d.groups || []));
  };
  const loadTemplates = () => {
    fetch('/api/v1/report-gen/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.items || []));
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
        nextSelected[it.location_id] = true;
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

  const effectiveElec = (it: PreviewItem): number => {
    const o = elecOverride[it.location_id];
    if (o !== undefined && o !== '') {
      const v = parseFloat(o);
      return isNaN(v) ? 0 : v;
    }
    return it.electricity_cost ?? 0;
  };

  const VAT = 0.07;
  const TRANSFER = 30;
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
    return {
      revenue, electricity, internet, internetVat, etax, etaxVat,
      txRate, txFee, vatOnFee, transfer, totalFee, remaining, shareRate,
      shareInclVat, beforeVat, vatPortion, isRevenue,
    };
  };

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, generating: 0, sent: 0, failed: 0 };
    for (const i of items) {
      const s = (i.status || 'pending') as keyof typeof c;
      if (s in c) (c[s] as number) += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter !== 'all' && (i.status || 'pending') !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!i.location_name.toLowerCase().includes(q) &&
            !(i.station_code ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, search]);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

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

  const applyBulkEmail = () => {
    if (!bulkEmail.trim()) return;
    setEmails((prev) => {
      const next = { ...prev };
      for (const i of filtered) next[i.location_id] = bulkEmail;
      return next;
    });
    setBulkEmail('');
  };

  const buildEntry = (i: PreviewItem, skipEmail: boolean) => ({
    location_id: i.location_id,
    electricity_cost: effectiveElec(i),
    internet_cost: i.internet_cost ?? undefined,
    etax: i.etax ?? undefined,
    emails: (emails[i.location_id] || '').split(',').map((s) => s.trim()).filter(Boolean),
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
    const entries = items
      .filter((i) => selected[i.location_id])
      .map((i) => buildEntry(i, skipEmail));
    if (entries.length === 0) return alert('Select at least one location');
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
    setTimeout(() => {
      const sel: Record<string, boolean> = {};
      const em: Record<string, string> = {};
      for (const id of t.location_ids) sel[id] = true;
      for (const [id, list] of Object.entries(t.email_mapping)) {
        em[id] = (list as string[]).join(', ');
      }
      setSelected(sel);
      setEmails((prev) => ({ ...prev, ...em }));
    }, 300);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/v1/report-gen/templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  };

  const toggleAll = () => {
    if (selectedCount === filtered.length) setSelected({});
    else {
      const next: Record<string, boolean> = {};
      for (const i of filtered) next[i.location_id] = true;
      setSelected(next);
    }
  };

  const clearSelection = () => setSelected({});

  return (
    <div className="min-h-screen">
      <div className="px-10 py-8 max-w-[1500px] mx-auto">
        <PageTitle
          title="Monthly Run"
          subtitle="Fetch month data → enter electricity costs → review GP share → send branded reports to partners."
          right={
            <>
              <Btn kind="secondary" onClick={loadPreview} disabled={loading}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Re-fetch
              </Btn>
              <Btn
                kind="primaryG"
                onClick={() => run(false)}
                disabled={running || selectedCount === 0}
              >
                {running ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send all ready
              </Btn>
            </>
          }
        />

        {/* Month ribbon + stats */}
        <Card padded={false} className="mb-4">
          <div
            className="flex items-center gap-4 px-[18px] py-3.5"
            style={{ borderBottom: '1px solid var(--border-soft)' }}
          >
            <span className="eyebrow">Billing Month</span>
            <div className="flex gap-1">
              <input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] font-mono num rounded-md border border-[color:var(--border-default)] bg-white focus-ring"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] rounded-md border border-[color:var(--border-default)] bg-white focus-ring"
              >
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g.group_name} value={g.group_name}>
                    {g.group_name} ({g.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <Stat label="Locations" value={counts.all} />
              <Stat label="Revenue" value={`฿${fmtCompact(totals.revenue)}`} mono />
              <Stat label="GP Share" value={`฿${fmtCompact(totals.share)}`} mono accent />
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-[18px] py-2.5 text-[12px]"
            style={{ background: 'var(--bg-app)', color: 'var(--fg-muted)' }}
          >
            <Database size={12} />
            <span>Preview:</span>
            <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{yearMonth}</span>
            <span style={{ color: 'var(--fg-subtle)' }}>·</span>
            <span>{items.length} locations loaded</span>
            {group && (
              <>
                <span style={{ color: 'var(--fg-subtle)' }}>·</span>
                <span>group: <b style={{ color: 'var(--fg-default)' }}>{group}</b></span>
              </>
            )}
          </div>
        </Card>

        {/* Saved templates */}
        {templates.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="eyebrow" style={{ fontSize: 10 }}>Saved</span>
            {templates.map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center bg-white rounded-md"
                style={{ border: '1px solid var(--border-default)', fontSize: 12 }}
              >
                <button
                  onClick={() => loadTemplate(t)}
                  className="px-2.5 py-1 hover:bg-[color:var(--bg-subtle)] rounded-l-md"
                >
                  {t.name}
                  <span className="ml-1 num text-[10.5px]" style={{ color: 'var(--fg-subtle)' }}>
                    · {t.location_ids.length}
                  </span>
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="px-2 py-1 text-[color:var(--fg-subtle)] hover:text-red-600"
                  style={{ borderLeft: '1px solid var(--border-soft)' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[13px]">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* Filter chips + search */}
            <div className="flex items-center gap-2 mb-3">
              {([
                { k: 'all', label: 'All', n: counts.all, dot: undefined },
                { k: 'pending', label: 'Pending', n: counts.pending, dot: '#A1A1AA' },
                { k: 'generating', label: 'Generating', n: counts.generating, dot: '#3B82F6' },
                { k: 'sent', label: 'Sent', n: counts.sent, dot: '#10B981' },
                { k: 'failed', label: 'Failed', n: counts.failed, dot: '#EF4444' },
              ] as const).map((f) => {
                const on = filter === f.k;
                return (
                  <button
                    key={f.k}
                    onClick={() => setFilter(f.k)}
                    className="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[12px] font-medium transition-colors"
                    style={{
                      background: on ? 'var(--fg-strong)' : 'white',
                      color: on ? 'white' : 'var(--fg-default)',
                      border: `1px solid ${on ? 'var(--fg-strong)' : 'var(--border-default)'}`,
                    }}
                  >
                    {f.dot && <span className="w-[5px] h-[5px] rounded-full" style={{ background: f.dot }} />}
                    {f.label}
                    <span
                      className="num text-[11px]"
                      style={{ color: on ? 'rgba(255,255,255,0.7)' : 'var(--fg-subtle)' }}
                    >
                      {f.n}
                    </span>
                  </button>
                );
              })}
              <div className="relative ml-auto w-[280px]">
                <Search size={13} className="absolute left-2.5 top-2 text-[color:var(--fg-subtle)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code…"
                  className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-[color:var(--border-default)] rounded-md bg-white focus-ring"
                />
              </div>
            </div>

            {/* Bulk bar */}
            {selectedCount > 0 && (
              <div
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-white text-[12.5px] mb-2.5"
                style={{ background: 'var(--sharge-navy)' }}
              >
                <CheckCircle2 size={13} />
                <span>
                  <b>{selectedCount}</b> selected
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
                <div className="flex items-center gap-1.5 flex-1">
                  <Wand2 size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  <input
                    value={bulkEmail}
                    onChange={(e) => setBulkEmail(e.target.value)}
                    placeholder="Bulk set emails for visible"
                    className="bg-white/10 border border-white/10 rounded-md px-2.5 py-1 text-[12px] text-white placeholder:text-white/40 focus:outline-none flex-1 max-w-[360px]"
                  />
                  <button
                    onClick={applyBulkEmail}
                    disabled={!bulkEmail.trim()}
                    className="px-2.5 py-1 rounded-md text-[12px] bg-white/10 hover:bg-white/20 disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
                <button
                  onClick={() => setSaveDialog(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] bg-white/10 hover:bg-white/20"
                >
                  <Save size={11} /> Save template
                </button>
                <button
                  onClick={() => run(true)}
                  disabled={running}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] bg-white/10 hover:bg-white/20 disabled:opacity-40"
                >
                  <FileSpreadsheet size={11} /> Generate only
                </button>
                <button
                  onClick={() => run(false)}
                  disabled={running}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] text-white disabled:opacity-40"
                  style={{ background: 'var(--sharge-gradient)' }}
                >
                  <Send size={11} /> Send selected
                </button>
                <button
                  onClick={clearSelection}
                  className="ml-1 text-[12px] text-white/60 hover:text-white"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Main table */}
            <Card padded={false} className="overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
                <table className="w-full border-collapse text-[13px]">
                  <thead
                    className="sticky top-0 z-10"
                    style={{ background: 'var(--bg-app)' }}
                  >
                    <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <Th w={32} className="pl-4">
                        <input
                          type="checkbox"
                          checked={selectedCount > 0 && selectedCount === filtered.length}
                          onChange={toggleAll}
                        />
                      </Th>
                      <Th w={32} />
                      <Th>Location</Th>
                      <Th w={96}>Status</Th>
                      <Th align="right" w={72}>Basis</Th>
                      <Th align="right" w={108}>Electricity ฿</Th>
                      <Th align="right" w={110}>Revenue ฿</Th>
                      <Th align="right" w={110}>GP Share ฿</Th>
                      <Th w={220}>Emails</Th>
                      <Th align="right" w={136} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((it) => (
                      <Row
                        key={it.location_id}
                        it={it}
                        selected={!!selected[it.location_id]}
                        expanded={!!expanded[it.location_id]}
                        rowBusy={rowBusy === it.location_id}
                        electricityValue={elecOverride[it.location_id] ?? (it.electricity_cost ?? '')}
                        email={emails[it.location_id] ?? ''}
                        breakdown={breakdownFor(it)}
                        onToggleSelect={() =>
                          setSelected((prev) => ({ ...prev, [it.location_id]: !prev[it.location_id] }))
                        }
                        onToggleExpand={() =>
                          setExpanded((prev) => ({ ...prev, [it.location_id]: !prev[it.location_id] }))
                        }
                        onElecChange={(v) => setElecOverride((prev) => ({ ...prev, [it.location_id]: v }))}
                        onEmailChange={(v) => setEmails((prev) => ({ ...prev, [it.location_id]: v }))}
                        onSend={() => runOne(it, false)}
                        onGenerate={() => runOne(it, true)}
                      />
                    ))}
                    {filtered.length === 0 && !loading && (
                      <tr>
                        <td colSpan={10} className="text-center py-10 text-[color:var(--fg-subtle)] text-[13px]">
                          No matching locations.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div
                className="flex items-center gap-4 px-4 py-2.5 text-[12px]"
                style={{
                  background: 'var(--bg-app)',
                  color: 'var(--fg-muted)',
                  borderTop: '1px solid var(--border-soft)',
                }}
              >
                <span>
                  Showing{' '}
                  <b style={{ color: 'var(--fg-default)' }}>{filtered.length}</b> of {items.length}
                </span>
                <span className="ml-auto flex gap-3">
                  <span>
                    Σ Revenue{' '}
                    <b className="num" style={{ color: 'var(--fg-default)' }}>
                      ฿{fmt(totals.revenue)}
                    </b>
                  </span>
                  <span>
                    Σ Electricity{' '}
                    <b className="num" style={{ color: 'var(--fg-default)' }}>
                      ฿{fmt(totals.electricity)}
                    </b>
                  </span>
                  <span>
                    Σ GP Share{' '}
                    <b className="num" style={{ color: 'var(--sharge-purple)' }}>
                      ฿{fmt(totals.share)}
                    </b>
                  </span>
                </span>
              </div>
            </Card>
          </>
        )}

        {items.length === 0 && !loading && !error && (
          <Card className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
              style={{ background: 'var(--sharge-red-tint)' }}>
              <Play size={18} style={{ color: 'var(--sharge-red-deep)' }} />
            </div>
            <div className="text-[15px] font-semibold text-[color:var(--fg-strong)] mb-1">
              Load a preview to get started
            </div>
            <div className="text-[13px] text-[color:var(--fg-muted)] mb-4">
              Pick a billing month, optionally filter by group, then Re-fetch.
            </div>
            <Btn kind="primary" onClick={loadPreview} disabled={loading}>
              <RefreshCw size={13} />
              Load preview for {yearMonth}
            </Btn>
          </Card>
        )}
      </div>

      {saveDialog && (
        <SaveTemplateDialog
          group={group || null}
          locationIds={items.filter((i) => selected[i.location_id]).map((i) => i.location_id)}
          emailMapping={Object.fromEntries(
            Object.entries(emails)
              .filter(([id]) => selected[id])
              .map(([id, s]) => [id, s.split(',').map((x) => x.trim()).filter(Boolean)]),
          )}
          onClose={() => setSaveDialog(false)}
          onSaved={() => {
            setSaveDialog(false);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}

// ─── Table primitives ──────────────────────────────────────────────

function Th({
  children, align = 'left', w, className = '',
}: {
  children?: React.ReactNode; align?: 'left' | 'right' | 'center'; w?: number; className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-[10.5px] font-semibold uppercase whitespace-nowrap ${className}`}
      style={{
        textAlign: align,
        color: 'var(--fg-muted)',
        letterSpacing: '0.08em',
        width: w,
      }}
    >
      {children}
    </th>
  );
}

interface RowProps {
  it: PreviewItem;
  selected: boolean;
  expanded: boolean;
  rowBusy: boolean;
  electricityValue: string | number;
  email: string;
  breakdown: Breakdown;
  onToggleSelect(): void;
  onToggleExpand(): void;
  onElecChange(v: string): void;
  onEmailChange(v: string): void;
  onSend(): void;
  onGenerate(): void;
}

function Row({
  it, selected, expanded, rowBusy,
  electricityValue, email, breakdown,
  onToggleSelect, onToggleExpand, onElecChange, onEmailChange, onSend, onGenerate,
}: RowProps) {
  const elecNum =
    electricityValue === '' || electricityValue == null
      ? (it.electricity_cost ?? 0)
      : typeof electricityValue === 'number'
      ? electricityValue
      : parseFloat(electricityValue) || 0;

  const status = toStatus(it.status, !!it.email_sent_at);

  return (
    <Fragment>
      <tr
        style={{
          borderBottom: '1px solid var(--border-hair)',
          background: selected ? 'var(--sharge-red-tint)' : 'transparent',
          height: 40,
        }}
      >
        <td className="pl-4">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
        </td>
        <td>
          <button
            onClick={onToggleExpand}
            className="w-6 h-6 grid place-items-center text-[color:var(--fg-subtle)] hover:text-[color:var(--fg-default)]"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-3 py-2">
          <div className="text-[13px] font-medium text-[color:var(--fg-strong)]">
            {it.location_name}
          </div>
          <div
            className="flex items-center gap-1.5 text-[10.5px] mt-px"
            style={{ color: 'var(--fg-subtle)' }}
          >
            <span className="num">{it.station_code ?? '—'}</span>
            {it.group_name && (
              <>
                <span style={{ color: 'var(--border-default)' }}>·</span>
                <span>{it.group_name}</span>
              </>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <StatusPill status={status} />
        </td>
        <td className="px-3 py-2 text-right text-[11.5px]">
          <span style={{ color: 'var(--fg-muted)' }}>{it.share_basis}</span>
          <span className="ml-1.5 num font-medium" style={{ color: 'var(--fg-default)' }}>
            {it.share_rate != null ? `${Math.round(it.share_rate * 100)}%` : '—'}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            step="0.01"
            value={electricityValue}
            onChange={(e) => onElecChange(e.target.value)}
            placeholder={it.ca ? 'no bill' : 'no CA'}
            title="incl VAT (PEA AMOUNT / MEA Total)"
            className="w-[88px] px-2 py-1 text-[12px] text-right rounded-[5px] num focus-ring"
            style={{
              fontFamily: 'var(--font-mono)',
              border: `1px solid ${elecNum === 0 ? '#FDBA74' : 'var(--border-default)'}`,
              background: elecNum === 0 ? '#FFF7ED' : 'white',
            }}
          />
        </td>
        <TdN v={fmt(breakdown.revenue)} />
        <TdN v={fmt(breakdown.shareInclVat)} accent />
        <td className="px-3 py-2">
          <input
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="a@x.com, b@x.com"
            className="w-full px-2 py-1 text-[11.5px] num rounded-[5px] focus-ring"
            style={{
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--border-default)',
              background: 'white',
            }}
          />
        </td>
        <td className="px-3 py-2 pr-4 text-right">
          <div className="inline-flex items-center gap-1">
            {it.file_path && (
              <a
                href={`/output/${it.file_path.split(/[\\/]/).pop()}`}
                target="_blank"
                rel="noreferrer"
                title="Download generated Excel"
                className="w-7 h-7 grid place-items-center rounded-md text-emerald-700 hover:bg-emerald-50"
                style={{ border: '1px solid var(--border-default)' }}
              >
                <Download size={13} />
              </a>
            )}
            <button
              onClick={onGenerate}
              disabled={rowBusy}
              title="Generate only"
              className="w-7 h-7 grid place-items-center rounded-md hover:bg-[color:var(--bg-subtle)] disabled:opacity-30"
              style={{ border: '1px solid var(--border-default)', color: 'var(--fg-muted)' }}
            >
              {rowBusy ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            </button>
            <Btn kind="primary" size="sm" onClick={onSend} disabled={rowBusy}>
              <Mail size={11} /> Send
            </Btn>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: 'var(--bg-subtle)' }}>
          <td colSpan={10} className="px-16 py-4">
            <BreakdownPane b={breakdown} locationName={it.location_name} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function TdN({ v, accent }: { v: string; accent?: boolean }) {
  return (
    <td
      className="px-3 py-2 text-right text-[12px] num"
      style={{
        fontFamily: 'var(--font-mono)',
        color: accent ? 'var(--sharge-purple)' : 'var(--fg-default)',
        fontWeight: accent ? 600 : 400,
      }}
    >
      {v}
    </td>
  );
}

// ─── Breakdown pane (summary-sheet mirror) ─────────────────────────

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
  const f = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const L = ({
    label, note, value, bold = false, highlight, top,
  }: {
    label?: string; note?: string; value: number; bold?: boolean; highlight?: boolean; top?: boolean;
  }) => (
    <div
      className={`grid grid-cols-[2fr_2fr_1fr] gap-2 px-2 py-1 rounded text-[12.5px] ${top ? 'border-t border-[color:var(--border-soft)] pt-2 mt-1' : ''}`}
      style={{ background: highlight ? '#FFFBE8' : undefined }}
    >
      <div className={`text-right ${bold ? 'font-semibold text-[color:var(--fg-strong)]' : ''}`}>{label ?? ''}</div>
      <div className="text-right text-[11.5px]" style={{ color: 'var(--fg-muted)' }}>{note ?? ''}</div>
      <div className={`text-right num ${bold ? 'font-semibold' : ''}`} style={{ fontFamily: 'var(--font-mono)' }}>{f(value)}</div>
    </div>
  );
  return (
    <div
      className="max-w-3xl mx-auto p-3"
      style={{
        background: 'white',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
      }}
    >
      <L label="Revenue" value={b.revenue} bold />
      {!b.isRevenue && (
        <>
          <L top label="Transaction Fee" note={`(${(b.txRate * 100).toFixed(2)}% of Revenue)`} value={b.txFee} />
          <L label="VAT" note="(7% of Transaction Fee)" value={b.vatOnFee} />
          <L label="Transfer" value={b.transfer} />
          <L label="Total Fee" value={b.totalFee} bold />
          <L top label="Electricity Cost" value={b.electricity} highlight bold />
          <L label="Internet Cost" value={b.internet} />
          <L note="Vat 7%" value={b.internetVat} />
          <L label="Etax" value={b.etax} />
          <L label="Etax (Include Vat)" note="Vat 7%" value={b.etaxVat} />
          <L label="คงเหลือ" value={b.remaining} bold />
        </>
      )}
      {b.isRevenue && (
        <>
          <L top label="Electricity Cost" value={b.electricity} highlight bold />
          <L label="Internet Cost" value={b.internet} />
          <L note="Vat 7%" value={b.internetVat} />
          <L label="คงเหลือ" value={b.remaining} bold />
        </>
      )}
      <div className="mt-2 rounded p-2" style={{ background: '#EFF6FF' }}>
        <L
          label={locationName}
          note={b.isRevenue
            ? `(${Math.round(b.shareRate * 100)}% of Revenue)`
            : `(${Math.round(b.shareRate * 100)}% of Gross Profit VAT Incl.)`}
          value={b.shareInclVat}
          bold
        />
        <L label="VAT" note="(7% of Cash In)" value={b.vatPortion} />
        <L note="(Before VAT)" value={b.beforeVat} />
      </div>
      <div className="mt-2 pt-2" style={{ borderTop: '2px double var(--border-default)' }}>
        <L label="Net GP" note="(VAT Included)" value={b.shareInclVat} bold />
      </div>
    </div>
  );
}

// ─── Save template dialog ──────────────────────────────────────────

function SaveTemplateDialog({
  group, locationIds, emailMapping, onClose, onSaved,
}: {
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
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(10,10,15,0.45)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-[14px] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-soft)' }}
        >
          <div>
            <div className="eyebrow">Save setup</div>
            <div className="text-[17px] font-semibold text-[color:var(--fg-strong)]">
              Save as template
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 grid place-items-center rounded-md hover:bg-[color:var(--bg-muted)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="eyebrow block mb-1.5">Template name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Showrooms"
              className="w-full px-3 py-2 text-[13px] rounded-md bg-white focus-ring"
              style={{ border: '1px solid var(--border-default)' }}
              autoFocus
            />
          </div>
          <div
            className="text-[12px] flex gap-4 p-3 rounded-md"
            style={{ background: 'var(--bg-subtle)', color: 'var(--fg-muted)' }}
          >
            <span>Group: <b style={{ color: 'var(--fg-default)' }}>{group || 'all'}</b></span>
            <span>Locations: <b style={{ color: 'var(--fg-default)' }}>{locationIds.length}</b></span>
            <span>Emails: <b style={{ color: 'var(--fg-default)' }}>{Object.keys(emailMapping).length}</b></span>
          </div>
        </div>
        <div
          className="flex justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-subtle)' }}
        >
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" onClick={save} disabled={!name.trim() || busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </Btn>
        </div>
      </div>
    </div>
  );
}
