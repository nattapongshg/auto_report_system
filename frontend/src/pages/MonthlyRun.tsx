import { useEffect, useMemo, useState } from 'react';
import { Database, Download, FileDown, Loader2, Send, Search, RefreshCw, Layers, Upload } from 'lucide-react';
import { StatusBadge } from './Dashboard';
import { SendReportDialog } from '../components/SendReportDialog';
import { GroupReportDialog } from '../components/GroupReportDialog';

interface Snapshot { id: string; year_month: string; total_rows: number; status: string; fetched_at: string | null; }
interface Entry {
  id: string; location_name: string; location_id: string; status: string; year_month: string;
  electricity_cost: number | null; internet_cost: number | null; etax: number | null;
  bill_image_url: string | null;
  preview_rows: number | null; preview_revenue: number | null; preview_kwh: number | null;
  preview_gp: number | null; preview_share: number | null;
  file_name: string | null; email_sent_at: string | null; email_error: string | null;
}

type Draft = { electricity: string; internet: string; etax: string };

export function MonthlyRun() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState('');
  const [filterReady, setFilterReady] = useState<'all' | 'ready' | 'sent' | 'pending'>('all');
  const [sendingDialog, setSendingDialog] = useState<Entry | null>(null);
  const [groups, setGroups] = useState<{ group_name: string; location_count: number }[]>([]);
  const [groupHistory, setGroupHistory] = useState<Record<string, { status: string; file_name: string | null; preview_share: number | null }>>({});
  const [groupDialog, setGroupDialog] = useState<{ group_name: string; location_count: number } | null>(null);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [newMonth, setNewMonth] = useState(defaultMonth);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadSnapshots = () => {
    fetch('/api/v1/monthly/snapshots').then(r => r.json()).then(d => setSnapshots(d.items));
  };

  const loadEntries = async (snapshotId: string) => {
    const d = await fetch(`/api/v1/workflow/${snapshotId}`).then(r => r.json());
    setEntries(d.items);
    setDrafts(prev => {
      const next: Record<string, Draft> = { ...prev };
      for (const e of d.items as Entry[]) {
        if (!next[e.id]) {
          next[e.id] = {
            electricity: e.electricity_cost != null && e.electricity_cost > 0 ? String(e.electricity_cost) : '',
            internet: e.internet_cost != null ? String(e.internet_cost) : '598',
            etax: e.etax != null ? String(e.etax) : '0',
          };
        }
      }
      return next;
    });
  };

  useEffect(() => { loadSnapshots(); }, []);

  useEffect(() => {
    fetch('/api/v1/group-reports/groups').then(r => r.json()).then(d => setGroups(d.items || []));
  }, []);

  const loadGroupHistory = async (snapshotId: string) => {
    const d = await fetch(`/api/v1/group-reports/${snapshotId}/history`).then(r => r.json());
    const map: Record<string, { status: string; file_name: string | null; preview_share: number | null }> = {};
    for (const g of d.items || []) {
      map[g.group_name] = {
        status: g.status,
        file_name: g.file_name,
        preview_share: g.preview_share,
      };
    }
    setGroupHistory(map);
  };

  useEffect(() => {
    if (selectedSnapshot) loadGroupHistory(selectedSnapshot.id);
  }, [selectedSnapshot]);

  useEffect(() => {
    const hasGenerating = entries.some(e => e.status === 'generating') || snapshots.some(s => s.status === 'fetching');
    if (!hasGenerating) return;
    const interval = setInterval(() => {
      loadSnapshots();
      if (selectedSnapshot) loadEntries(selectedSnapshot.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [entries, snapshots, selectedSnapshot]);

  const handleFetch = async () => {
    setFetching(true);
    await fetch('/api/v1/monthly/snapshots/fetch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_month: newMonth, question_id: 1144 }),
    });
    loadSnapshots();
    setFetching(false);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('year_month', newMonth);
      fd.append('question_id', '1144');
      fd.append('file', uploadFile);
      const r = await fetch('/api/v1/monthly/snapshots/upload', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      alert(`Uploaded ${d.inserted} rows for ${d.year_month}` + (d.dropped_out_of_month ? ` (dropped ${d.dropped_out_of_month} out-of-month)` : ''));
      setUploadFile(null);
      loadSnapshots();
    } catch (e) {
      alert(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectSnapshot = async (s: Snapshot) => {
    setSelectedSnapshot(s);
    setDrafts({});
    await fetch(`/api/v1/workflow/init/${s.id}`, { method: 'POST' });
    loadEntries(s.id);
  };

  const handleResetSnapshot = async () => {
    if (!selectedSnapshot) return;
    if (!confirm(`Delete all ${entries.length} entries for ${selectedSnapshot.year_month} and re-initialize with current locations? Any unsent progress will be lost.`)) return;
    await fetch(`/api/v1/workflow/reset/${selectedSnapshot.id}`, { method: 'DELETE' });
    setDrafts({});
    setEntries([]);
    await fetch(`/api/v1/workflow/init/${selectedSnapshot.id}`, { method: 'POST' });
    loadEntries(selectedSnapshot.id);
  };

  const updateDraft = (entryId: string, field: keyof Draft, value: string) => {
    setDrafts(prev => ({ ...prev, [entryId]: { ...prev[entryId], [field]: value } }));
  };

  const dispatchSend = async (entry: Entry, payload: {
    electricity_cost: number; internet_cost: number; etax: number;
    email_recipients: string[]; skip_email?: boolean;
  }) => {
    if (!selectedSnapshot) return;
    setSendingId(entry.id);
    try {
      const res = await fetch(`/api/v1/workflow/${selectedSnapshot.id}/send/${entry.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        alert(`Send failed: ${err}`);
        return;
      }
      setSendingDialog(null);
      await loadEntries(selectedSnapshot.id);
    } catch (e) {
      alert(`Network error: ${(e as Error).message}`);
    } finally {
      setSendingId(null);
    }
  };

  const handleGenerateOnly = async (entry: Entry) => {
    if (!selectedSnapshot) return;
    const d = drafts[entry.id];
    const elec = parseFloat(d?.electricity || '') || entry.electricity_cost || 0;
    if (!elec || elec <= 0) {
      alert(`Enter electricity cost for ${entry.location_name} first (inline or via Send dialog).`);
      return;
    }
    await dispatchSend(entry, {
      electricity_cost: elec,
      internet_cost: parseFloat(d?.internet || '') || entry.internet_cost || 598,
      etax: parseFloat(d?.etax || '') || entry.etax || 0,
      email_recipients: [],
      skip_email: true,
    });
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return entries.filter(e => {
      if (s && !e.location_name.toLowerCase().includes(s)) return false;
      if (filterReady === 'ready') {
        const d = drafts[e.id];
        if (!d || !parseFloat(d.electricity)) return false;
      } else if (filterReady === 'sent') {
        if (e.status !== 'sent') return false;
      } else if (filterReady === 'pending') {
        if (e.status === 'sent') return false;
      }
      return true;
    });
  }, [entries, search, filterReady, drafts]);

  const total = entries.length;
  const sentCount = entries.filter(e => e.status === 'sent').length;
  const generatingCount = entries.filter(e => e.status === 'generating').length;

  return (
    <div className="p-8 max-w-[1600px]">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Monthly Reports</h1>
      <p className="text-sm text-[#636E72] mb-6">Fetch month data → pick location → enter electricity → send</p>

      <div className="luxury-card p-6 mb-5">
        <StepHeader num={1} title="Fetch Monthly Data" />
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <input type="month" value={newMonth} onChange={(e) => setNewMonth(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          <button onClick={handleFetch} disabled={fetching} className="accent-button flex items-center gap-2">
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {fetching ? 'Fetching...' : 'Fetch via Metabase'}
          </button>
          <span className="text-xs text-gray-400">— or —</span>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            className="text-xs border border-gray-200 rounded-lg p-1.5 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-xs hover:file:bg-gray-200"
          />
          <button
            onClick={handleUpload}
            disabled={!uploadFile || uploading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload Export File'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Either fetch from Metabase (needs VPN) or upload the Q1144 export (.xlsx/.csv) for the selected month.
        </p>
        {snapshots.length > 0 && (
          <div className="mt-4 space-y-2">
            {snapshots.map(s => (
              <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedSnapshot?.id === s.id ? 'border-[#8B1927] bg-red-50/30' : 'border-gray-100 hover:border-gray-200'}`} onClick={() => s.status === 'completed' && handleSelectSnapshot(s)}>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{s.year_month}</span>
                  <StatusBadge status={s.status} />
                  {s.total_rows > 0 && <span className="text-xs text-[#636E72] font-mono">{s.total_rows.toLocaleString()} rows</span>}
                </div>
                {s.status === 'completed' && <span className="text-xs text-[#8B1927] font-medium">Select →</span>}
                {s.status === 'fetching' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSnapshot && groups.length > 0 && (
        <div className="luxury-card p-6 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </span>
              <h2 className="font-semibold">Group Reports (Consolidated)</h2>
            </div>
            <span className="text-xs text-[#636E72] ml-2">
              1 Excel + 1 email per group
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {groups.map(g => {
              const hist = groupHistory[g.group_name];
              return (
                <div key={g.group_name} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{g.group_name}</p>
                      <p className="text-xs text-[#636E72]">{g.location_count} locations</p>
                    </div>
                    {hist && <StatusBadge status={hist.status} />}
                  </div>
                  {hist?.preview_share != null && (
                    <p className="text-xs text-[#636E72] mb-2">
                      GP Share: <span className="font-mono font-semibold" style={{ color: '#6A1B9A' }}>
                        {hist.preview_share.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => setGroupDialog(g)}
                      className="flex-1 text-xs px-2 py-1.5 bg-[#8B1927] text-white rounded hover:bg-[#701421]"
                    >
                      {hist?.status === 'sent' ? 'Resend' : 'Send'}
                    </button>
                    {hist?.file_name && (
                      <a href={`/output/${hist.file_name}`} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedSnapshot && (
        <div className="luxury-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <StepHeader num={2} title="Send Reports per Location" />
            <div className="ml-auto flex items-center gap-4 text-xs text-[#636E72]">
              <span>Total: <b>{total}</b></span>
              <span>Sent: <b className="text-emerald-600">{sentCount}</b></span>
              {generatingCount > 0 && <span>Generating: <b className="text-blue-600">{generatingCount}</b></span>}
              <button
                onClick={handleResetSnapshot}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                title="Delete all entries and re-init with current locations"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search location..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <select
              value={filterReady}
              onChange={e => setFilterReady(e.target.value as typeof filterReady)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">All ({total})</option>
              <option value="ready">Has electricity</option>
              <option value="sent">Sent ({sentCount})</option>
              <option value="pending">Not sent</option>
            </select>
            <span className="text-xs text-gray-400">Showing {filtered.length}</span>
          </div>

          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b sticky top-0">
                  <th className="text-left px-3 py-2.5 font-medium text-[#636E72]">Location</th>
                  <th className="text-left px-3 py-2.5 font-medium text-[#636E72] w-28">Status</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-32">Electricity *</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-24">Internet</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-20">eTax</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-16">Rows</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-24">kWh</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-28">Revenue</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-28">GP Share</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#636E72] w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => {
                  const d = drafts[e.id];
                  const locked = e.status === 'sent' || e.status === 'generating';
                  const isSending = sendingId === e.id || e.status === 'generating';
                  return (
                    <tr key={e.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-medium text-sm">{e.location_name}</td>
                      <td className="px-3 py-2"><StatusBadge status={e.status} /></td>
                      <td className="px-3 py-2 text-right">
                        {locked ? (
                          <span className="font-mono text-xs">{e.electricity_cost?.toLocaleString() ?? '-'}</span>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            value={d?.electricity ?? ''}
                            onChange={ev => updateDraft(e.id, 'electricity', ev.target.value)}
                            placeholder="0.00"
                            className="w-28 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono focus:border-[#8B1927] focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {locked ? (
                          <span className="font-mono text-xs">{e.internet_cost?.toLocaleString() ?? '-'}</span>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            value={d?.internet ?? ''}
                            onChange={ev => updateDraft(e.id, 'internet', ev.target.value)}
                            className="w-20 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {locked ? (
                          <span className="font-mono text-xs">{e.etax?.toLocaleString() ?? '-'}</span>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            value={d?.etax ?? ''}
                            onChange={ev => updateDraft(e.id, 'etax', ev.target.value)}
                            className="w-16 px-2 py-1 text-xs text-right border border-gray-200 rounded font-mono"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{e.preview_rows ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{e.preview_kwh ? e.preview_kwh.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{e.preview_revenue ? e.preview_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold" style={{ color: '#6A1B9A' }}>{e.preview_share ? e.preview_share.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {e.status === 'sent' && e.file_name && (
                            <a href={`/output/${e.file_name}`} className="inline-flex items-center p-1.5 text-emerald-700 hover:bg-emerald-50 rounded" title="Download generated file">
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleGenerateOnly(e)}
                            disabled={isSending}
                            className="inline-flex items-center p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                            title="Generate Excel only (no email)"
                          >
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setSendingDialog(e)}
                            disabled={isSending}
                            className={`inline-flex items-center gap-1 px-3 py-1 text-xs text-white rounded disabled:opacity-50 ${
                              e.status === 'sent' ? 'bg-gray-500 hover:bg-gray-600' :
                              e.status === 'failed' ? 'bg-amber-600 hover:bg-amber-700' :
                              'bg-[#8B1927] hover:bg-[#7a1520]'
                            }`}
                            title={e.status === 'sent' ? 'Re-generate and send again' : (e.email_error || 'Send')}
                          >
                            {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            {isSending ? 'Sending...' :
                              e.status === 'sent' ? 'Resend' :
                              e.status === 'failed' ? 'Retry' : 'Send'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No locations match</p>
            )}
          </div>
        </div>
      )}

      {groupDialog && selectedSnapshot && (
        <GroupReportDialog
          snapshotId={selectedSnapshot.id}
          groupName={groupDialog.group_name}
          locationCount={groupDialog.location_count}
          onClose={() => setGroupDialog(null)}
          onSent={() => {
            setGroupDialog(null);
            setTimeout(() => loadGroupHistory(selectedSnapshot.id), 8000);
          }}
        />
      )}

      {sendingDialog && (
        <SendReportDialog
          locationName={sendingDialog.location_name}
          locationId={sendingDialog.location_id}
          defaultElectricity={
            drafts[sendingDialog.id]?.electricity ||
            (sendingDialog.electricity_cost ? String(sendingDialog.electricity_cost) : '')
          }
          defaultInternet={drafts[sendingDialog.id]?.internet ?? String(sendingDialog.internet_cost ?? 598)}
          defaultEtax={drafts[sendingDialog.id]?.etax ?? String(sendingDialog.etax ?? 0)}
          isResend={sendingDialog.status === 'sent' || sendingDialog.status === 'failed'}
          onClose={() => setSendingDialog(null)}
          onSend={(payload) => dispatchSend(sendingDialog, payload)}
        />
      )}
    </div>
  );
}

function StepHeader({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 h-7 rounded-full bg-[#8B1927]/10 text-[#8B1927] text-xs font-bold flex items-center justify-center">{num}</span>
      <h2 className="font-semibold">{title}</h2>
    </div>
  );
}
