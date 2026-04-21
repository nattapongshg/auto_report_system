import { useEffect, useRef, useState } from 'react';
import { FileDown, Loader2, Send, X } from 'lucide-react';

interface Props {
  locationName: string;
  locationId: string;
  defaultElectricity: string;
  defaultInternet: string;
  defaultEtax: string;
  isResend?: boolean;
  onClose: () => void;
  onSend: (payload: {
    electricity_cost: number;
    internet_cost: number;
    etax: number;
    email_recipients: string[];
    skip_email?: boolean;
  }) => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendReportDialog(p: Props) {
  const [electricity, setElectricity] = useState(p.defaultElectricity);
  const [internet, setInternet] = useState(p.defaultInternet);
  const [etax, setEtax] = useState(p.defaultEtax);
  const [emails, setEmails] = useState<string[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load default emails from the location config
  useEffect(() => {
    fetch(`/api/v1/locations`)
      .then(r => r.json())
      .then(d => {
        const loc = (d.items || []).find((l: { id: string }) => l.id === p.locationId);
        const recip = loc?.email_recipients || [];
        setEmails(Array.isArray(recip) ? recip : []);
      })
      .finally(() => setLoadingEmails(false));
  }, [p.locationId]);

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

  const handleBlur = () => draft.trim() && commit(draft);

  const remove = (email: string) => setEmails(prev => prev.filter(e => e !== email));

  const validateAndBuild = (): {
    electricity_cost: number; internet_cost: number; etax: number; email_recipients: string[]
  } | null => {
    const elec = parseFloat(electricity);
    if (!elec || elec <= 0) { alert('Electricity cost must be > 0'); return null; }
    return {
      electricity_cost: elec,
      internet_cost: parseFloat(internet) || 598,
      etax: parseFloat(etax) || 0,
      email_recipients: emails,
    };
  };

  const handleSend = async () => {
    const payload = validateAndBuild();
    if (!payload) return;
    if (payload.email_recipients.length === 0) {
      if (!confirm('No email recipients — send anyway (file saved, no email)?')) return;
    }
    setSending(true);
    try {
      await p.onSend({ ...payload, skip_email: false });
    } finally {
      setSending(false);
    }
  };

  const handleGenerate = async () => {
    const payload = validateAndBuild();
    if (!payload) return;
    setGenerating(true);
    try {
      await p.onSend({ ...payload, skip_email: true });
    } finally {
      setGenerating(false);
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={p.onClose}>
      <div className="bg-white rounded-xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{p.isResend ? 'Resend Report' : 'Send Report'}</h2>
            <p className="text-xs text-[#636E72] mt-0.5">
              {p.locationName}
              {p.isResend && <span className="ml-2 text-amber-600">· will re-generate Excel with current data</span>}
            </p>
          </div>
          <button onClick={p.onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#636E72] mb-1">Electricity *</label>
              <input
                type="number"
                step="0.01"
                value={electricity}
                onChange={e => setElectricity(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-[#636E72] mb-1">Internet</label>
              <input
                type="number"
                step="0.01"
                value={internet}
                onChange={e => setInternet(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-[#636E72] mb-1">eTax</label>
              <input
                type="number"
                step="0.01"
                value={etax}
                onChange={e => setEtax(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#636E72] mb-1">
              Email Recipients
              <span className="text-gray-400 ml-2 font-normal">Enter / comma / space to add</span>
            </label>
            <div
              className="w-full min-h-[42px] px-2 py-1.5 border border-gray-200 rounded-lg flex flex-wrap gap-1.5 items-center focus-within:border-[#8B1927]"
              onClick={() => inputRef.current?.focus()}
            >
              {emails.map(e => (
                <span
                  key={e}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                >
                  {e}
                  <button
                    onClick={(ev) => { ev.stopPropagation(); remove(e); }}
                    className="hover:bg-blue-200 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKey}
                onBlur={handleBlur}
                placeholder={loadingEmails ? 'Loading defaults...' : emails.length === 0 ? 'user@example.com' : ''}
                disabled={loadingEmails}
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent py-1"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {emails.length} recipient(s). Defaults loaded from this location's config.
            </p>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-between gap-2 bg-gray-50">
          <button onClick={p.onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={sending || generating}
              title="Create Excel without sending email (for preview)"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Generate Only
            </button>
            <button
              onClick={handleSend}
              disabled={sending || generating}
              className="flex items-center gap-2 px-4 py-2 bg-[#8B1927] text-white text-sm rounded-lg hover:bg-[#701421] disabled:opacity-40"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
