import { useEffect, useMemo, useState } from 'react';
import { Bolt, Upload, Loader2, X, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PageTitle } from '../components/ui/primitives';

type Provider = 'pea' | 'mea';

interface Bill {
  id: string;
  provider: Provider;
  ca: string;
  year_month: string;
  kwh: number | null;
  amount: number | null;
  vat: number | null;
  total: number;
  invoice_no: string | null;
  bill_date: string | null;
  location_id: string | null;
  location_name: string | null;
}

interface PreviewResult {
  provider: Provider;
  file: string;
  parsed: number;
  matched: number;
  unmatched_cas: string[];
  periods: { year_month: string; count: number }[];
  sample: {
    ca: string;
    year_month: string;
    kwh: number | null;
    amount: number | null;
    vat: number | null;
    total: number;
    invoice_no: string | null;
    location_name: string | null;
  }[];
  committed: number;
  dry_run: boolean;
}

const defaultMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function Electricity() {
  const [yearMonth, setYearMonth] = useState(defaultMonth);
  const [providerFilter, setProviderFilter] = useState<'all' | Provider>('all');
  const [search, setSearch] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadFor, setUploadFor] = useState<Provider | null>(null);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ year_month: yearMonth });
    if (providerFilter !== 'all') q.set('provider', providerFilter);
    fetch(`/api/v1/electricity-bills?${q}`)
      .then(r => r.json())
      .then(d => setBills(d.rows || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [yearMonth, providerFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter(b =>
      b.ca.toLowerCase().includes(q) ||
      (b.location_name ?? '').toLowerCase().includes(q) ||
      (b.invoice_no ?? '').toLowerCase().includes(q)
    );
  }, [bills, search]);

  const stats = useMemo(() => {
    const byProv = { mea: 0, pea: 0 };
    const byProvCount = { mea: 0, pea: 0 };
    let mapped = 0;
    for (const b of bills) {
      byProv[b.provider] += b.total;
      byProvCount[b.provider] += 1;
      if (b.location_id) mapped += 1;
    }
    return { byProv, byProvCount, mapped, unmapped: bills.length - mapped };
  }, [bills]);

  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="px-10 py-8 max-w-[1500px] mx-auto">
      <PageTitle
        title={<span className="inline-flex items-center gap-2"><Bolt size={22} strokeWidth={1.75} style={{ color: '#F59E0B' }} /> Electricity Bills</span>}
        subtitle="Uploaded PEA / MEA bills. Auto-fills electricity_cost in monthly reports via CA matching."
      />
      <div className="flex items-center justify-end mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setUploadFor('pea')}
            className="flex items-center gap-2 bg-purple-700 text-white px-4 py-2 rounded-lg hover:bg-purple-800"
          >
            <Upload className="w-4 h-4" /> Upload PEA
          </button>
          <button
            onClick={() => setUploadFor('mea')}
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800"
          >
            <Upload className="w-4 h-4" /> Upload MEA
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500">MEA</div>
          <div className="text-xl font-semibold mt-1">{fmt(stats.byProv.mea)} <span className="text-xs font-normal text-gray-400">THB</span></div>
          <div className="text-xs text-gray-400 mt-1">{stats.byProvCount.mea} bills</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500">PEA</div>
          <div className="text-xl font-semibold mt-1">{fmt(stats.byProv.pea)} <span className="text-xs font-normal text-gray-400">THB</span></div>
          <div className="text-xs text-gray-400 mt-1">{stats.byProvCount.pea} bills</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500">Matched to locations</div>
          <div className="text-xl font-semibold mt-1 text-green-600">{stats.mapped}</div>
          <div className="text-xs text-gray-400 mt-1">/ {bills.length} uploaded</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500">Unmapped CAs</div>
          <div className={`text-xl font-semibold mt-1 ${stats.unmapped ? 'text-orange-600' : 'text-gray-400'}`}>{stats.unmapped}</div>
          <div className="text-xs text-gray-400 mt-1">need CA in locations</div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <input
          type="month"
          value={yearMonth}
          onChange={e => setYearMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        />
        <div className="flex border rounded-lg overflow-hidden text-sm">
          {(['all', 'mea', 'pea'] as const).map(p => (
            <button
              key={p}
              onClick={() => setProviderFilter(p)}
              className={`px-3 py-1.5 ${providerFilter === p ? 'bg-[#1a1a2e] text-white' : 'bg-white hover:bg-gray-50'}`}
            >
              {p === 'all' ? 'All' : p.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by CA, location name, or invoice..."
            className="w-full border rounded-lg pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No bills for {yearMonth}. Upload PEA or MEA files to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Provider</th>
                <th className="px-4 py-2 text-left font-medium">CA</th>
                <th className="px-4 py-2 text-left font-medium">Location</th>
                <th className="px-4 py-2 text-right font-medium">kWh</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium">VAT</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-left font-medium">Invoice No.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${b.provider === 'mea' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {b.provider.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{b.ca}</td>
                  <td className="px-4 py-2">
                    {b.location_name ?? (
                      <span className="text-orange-600 flex items-center gap-1 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" /> unmapped
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(b.kwh)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500">{fmt(b.amount)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500">{fmt(b.vat)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(b.total)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{b.invoice_no ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {uploadFor && (
        <UploadDialog
          provider={uploadFor}
          onClose={() => setUploadFor(null)}
          onDone={() => { setUploadFor(null); load(); }}
        />
      )}
    </div>
  );
}

function UploadDialog({ provider, onClose, onDone }: { provider: Provider; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [committed, setCommitted] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const qs = new URLSearchParams({ provider, dry_run: dryRun ? '1' : '0' });
      const r = await fetch(`/api/v1/electricity-bills/upload?${qs}`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error(await r.text());
      const d: PreviewResult = await r.json();
      if (dryRun) setPreview(d);
      else setCommitted(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const label = provider.toUpperCase();
  const color = provider === 'pea' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-blue-700 hover:bg-blue-800';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Upload {label} bill</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!preview && !committed && (
            <>
              <p className="text-sm text-gray-600">
                {provider === 'pea'
                  ? 'Select the PEA export (.xls — tab-separated).'
                  : 'Select the MEA export (.xlsx).'}
              </p>
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null); }}
                className="block w-full text-sm border rounded-lg p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-sm hover:file:bg-gray-200"
              />
              {file && (
                <div className="border rounded-lg p-3 text-xs flex justify-between">
                  <span className="truncate">{file.name}</span>
                  <span className="text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              )}
              {error && <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>}
            </>
          )}

          {preview && !committed && (
            <PreviewPanel p={preview} />
          )}

          {committed && (
            <div className="space-y-3 text-sm">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-green-800">
                    {committed.committed} bill{committed.committed === 1 ? '' : 's'} saved
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    {committed.matched} matched · {committed.unmatched_cas.length} unmapped CAs
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          {committed ? (
            <button onClick={onDone} className={`px-4 py-2 ${color} text-white rounded-lg text-sm`}>Done</button>
          ) : preview ? (
            <>
              <button onClick={() => { setPreview(null); }} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button
                onClick={() => run(false)}
                disabled={busy}
                className={`px-4 py-2 ${color} text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50`}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm upload ({preview.parsed})
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button
                onClick={() => run(true)}
                disabled={!file || busy}
                className={`px-4 py-2 ${color} text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50`}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Preview
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({ p }: { p: PreviewResult }) {
  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const unmatched = p.parsed - p.matched;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div className="border rounded-lg p-3">
          <div className="text-xs text-gray-500">Parsed</div>
          <div className="text-xl font-semibold">{p.parsed}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-gray-500">Matched</div>
          <div className="text-xl font-semibold text-green-600">{p.matched}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-gray-500">Unmapped</div>
          <div className={`text-xl font-semibold ${unmatched ? 'text-orange-600' : 'text-gray-400'}`}>{unmatched}</div>
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-1">Bill period(s)</div>
        <div className="flex gap-2 flex-wrap">
          {p.periods.map(pd => (
            <span key={pd.year_month} className="text-xs bg-gray-100 rounded px-2 py-1">
              {pd.year_month} · {pd.count}
            </span>
          ))}
        </div>
      </div>

      <details>
        <summary className="text-xs cursor-pointer text-gray-600 select-none">Preview first {p.sample.length} rows</summary>
        <div className="mt-2 max-h-52 overflow-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left">CA</th>
                <th className="px-2 py-1 text-left">Location</th>
                <th className="px-2 py-1 text-right">kWh</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="px-2 py-1 text-right">VAT</th>
                <th className="px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {p.sample.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1 font-mono">{s.ca}</td>
                  <td className="px-2 py-1">{s.location_name ?? <span className="text-orange-600">unmapped</span>}</td>
                  <td className="px-2 py-1 text-right">{fmt(s.kwh)}</td>
                  <td className="px-2 py-1 text-right">{fmt(s.amount)}</td>
                  <td className="px-2 py-1 text-right">{fmt(s.vat)}</td>
                  <td className="px-2 py-1 text-right font-medium">{fmt(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {p.unmatched_cas.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-orange-700 select-none">
            Unmapped CAs ({p.unmatched_cas.length})
          </summary>
          <div className="mt-2 bg-orange-50 rounded p-2 font-mono max-h-24 overflow-auto">
            {p.unmatched_cas.join(', ')}
          </div>
        </details>
      )}
    </div>
  );
}
