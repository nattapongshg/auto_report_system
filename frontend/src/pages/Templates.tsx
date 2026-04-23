import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Copy, Eye, Loader2, Plus, RefreshCw, Save, Trash2, X,
} from 'lucide-react';
import {
  previewReportTemplate,
  useCreateReportTemplate,
  useDeleteReportTemplate,
  useReportTemplates,
  useSaveReportTemplate,
  type PreviewInputs,
  type PreviewRowResult,
  type ReportTemplate,
  type SummaryRow,
  type TemplateLayoutStyle,
  type TemplateShareBasis,
} from '../lib/queries';

const SHARE_BASIS_OPTIONS: { value: TemplateShareBasis; label: string; desc: string }[] = [
  { value: 'gp', label: 'Gross Profit', desc: 'share_rate × (revenue − fees − electricity − internet − etax)' },
  { value: 'revenue', label: 'Revenue', desc: 'share_rate × (revenue − internet incl. VAT)' },
];

const LAYOUT_STYLE_OPTIONS: { value: TemplateLayoutStyle; label: string; desc: string }[] = [
  { value: 'standard', label: 'Standard', desc: '4-col: label · note · value' },
  { value: 'dealer', label: 'Dealer', desc: '5-col: label · note · THB · value (for WHT settlement)' },
];

const BASIS_COLORS: Record<TemplateShareBasis, string> = {
  gp: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  revenue: 'bg-sky-50 text-sky-700 border-sky-200',
};

const DEFAULT_PREVIEW: PreviewInputs = {
  revenue: 15000,
  electricity_cost: 500,
  internet_cost: 598,
  etax: 5,
  location_share_rate: 0.4,
  evse_count: 1,
  location_name: 'Sample Location',
};

export function Templates() {
  const { data: templates = [], isLoading, refetch } = useReportTemplates();
  const save = useSaveReportTemplate();
  const create = useCreateReportTemplate();
  const del = useDeleteReportTemplate();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReportTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewInputs, setPreviewInputs] = useState<PreviewInputs>(DEFAULT_PREVIEW);

  // When the expanded template changes, reset the draft to its latest server copy.
  useEffect(() => {
    if (!expandedId) return setDraft(null);
    const server = templates.find((t) => t.id === expandedId);
    if (server) setDraft(JSON.parse(JSON.stringify(server)));
  }, [expandedId, templates]);

  const toggleExpand = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
    setCreating(false);
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({
        id: draft.id,
        patch: {
          name: draft.name,
          description: draft.description,
          share_basis: draft.share_basis,
          layout_style: draft.layout_style,
          params: draft.params,
          summary_layout: draft.summary_layout,
          is_default_for_group: draft.is_default_for_group,
        },
      });
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (t: ReportTemplate) => {
    if (t.is_builtin) return alert('Built-in templates cannot be deleted.');
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await del.mutateAsync(t.id);
  };

  const handleDuplicate = async (t: ReportTemplate) => {
    const base: Partial<ReportTemplate> = {
      code: `${t.code}_copy_${Date.now()}`,
      name: `${t.name} (copy)`,
      description: t.description,
      share_basis: t.share_basis,
      layout_style: t.layout_style,
      params: t.params,
      summary_layout: t.summary_layout,
    };
    const created = await create.mutateAsync(base);
    setExpandedId(created.id);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Report Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure what appears in the Summary sheet and which fields pull live.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              setCreating((v) => !v);
              setExpandedId(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </header>

      {creating && (
        <CreateForm
          onCancel={() => setCreating(false)}
          onCreated={(t) => {
            setCreating(false);
            setExpandedId(t.id);
          }}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const isOpen = expandedId === t.id;
            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(t.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{t.name}</span>
                      <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {t.code}
                      </code>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${BASIS_COLORS[t.share_basis]}`}>
                        {t.share_basis}
                      </span>
                      {t.layout_style === 'dealer' && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          dealer
                        </span>
                      )}
                      {t.is_builtin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                          built-in
                        </span>
                      )}
                      {t.is_default_for_group && (
                        <span className="text-xs text-gray-500">
                          default · <span className="font-medium">{t.is_default_for_group}</span>
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{t.summary_layout.length} rows</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(t);
                    }}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {!t.is_builtin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(t);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </button>

                {isOpen && draft && (
                  <Editor
                    draft={draft}
                    onChange={setDraft}
                    previewInputs={previewInputs}
                    onPreviewInputsChange={setPreviewInputs}
                    onSave={handleSave}
                    saving={save.isPending}
                    readonly={t.is_builtin && t.is_default_for_group !== null ? false : false /* builtins still editable for layout */}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Editor ────────────────────────────────────────────────────────

interface EditorProps {
  draft: ReportTemplate;
  onChange: (d: ReportTemplate) => void;
  previewInputs: PreviewInputs;
  onPreviewInputsChange: (i: PreviewInputs) => void;
  onSave: () => void;
  saving: boolean;
  readonly?: boolean;
}

function Editor({
  draft, onChange, previewInputs, onPreviewInputsChange, onSave, saving,
}: EditorProps) {
  const set = <K extends keyof ReportTemplate>(k: K, v: ReportTemplate[K]) =>
    onChange({ ...draft, [k]: v });

  const [preview, setPreview] = useState<PreviewRowResult[] | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Auto-preview on mount + on draft changes (debounced).
  useEffect(() => {
    const t = setTimeout(async () => {
      setPreviewing(true);
      setPreviewErr(null);
      try {
        const result = await previewReportTemplate(draft, previewInputs);
        setPreview(result.rows);
      } catch (e) {
        setPreviewErr((e as Error).message);
      } finally {
        setPreviewing(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [draft, previewInputs]);

  const updateRow = (idx: number, patch: Partial<SummaryRow>) => {
    const next = draft.summary_layout.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    set('summary_layout', next);
  };

  const deleteRow = (idx: number) => {
    set('summary_layout', draft.summary_layout.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    const nextRowNum = Math.max(0, ...draft.summary_layout.map((r) => r.row)) + 1;
    set('summary_layout', [...draft.summary_layout, { row: nextRowNum, label: '', value: '' }]);
  };

  const updateParam = (k: string, v: string) => {
    const num = parseFloat(v);
    if (isNaN(num)) return;
    set('params', { ...draft.params, [k]: num });
  };

  const addParam = () => {
    const name = prompt('Param name (e.g. wht_rate)');
    if (!name) return;
    set('params', { ...draft.params, [name]: 0 });
  };

  const removeParam = (k: string) => {
    const next = { ...draft.params };
    delete next[k];
    set('params', next);
  };

  const paramEntries = useMemo(() => Object.entries(draft.params), [draft.params]);

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <div className="grid grid-cols-[1fr_420px] divide-x divide-gray-200">
        {/* ─── Left: editable template fields ─── */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Name</span>
              <input
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Default for group</span>
              <input
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={draft.is_default_for_group ?? ''}
                disabled={draft.is_builtin}
                placeholder="— none —"
                onChange={(e) => set('is_default_for_group', e.target.value || null)}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Description</span>
            <input
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-gray-600 block mb-1">Share basis</span>
              <div className="flex gap-2">
                {SHARE_BASIS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => set('share_basis', opt.value)}
                    className={`flex-1 text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                      draft.share_basis === opt.value
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-gray-500 text-[11px] mt-0.5 leading-tight">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-600 block mb-1">Layout style</span>
              <div className="flex gap-2">
                {LAYOUT_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => set('layout_style', opt.value)}
                    className={`flex-1 text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                      draft.layout_style === opt.value
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-gray-500 text-[11px] mt-0.5 leading-tight">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Params */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Params (constants available to formulas)</span>
              <button
                onClick={addParam}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> add
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1">
              {paramEntries.length === 0 && (
                <div className="text-xs text-gray-400 px-2 py-1">No params</div>
              )}
              {paramEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <code className="text-xs text-gray-700 w-32 truncate">{k}</code>
                  <input
                    type="number"
                    step="0.0001"
                    value={v}
                    onChange={(e) => updateParam(k, e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                  />
                  <button
                    onClick={() => removeParam(k)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary layout */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Summary layout ({draft.summary_layout.length} rows)</span>
              <button
                onClick={addRow}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> add row
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-12">Row</th>
                    <th className="px-2 py-1.5 text-left w-24">Kind</th>
                    <th className="px-2 py-1.5 text-left">Label</th>
                    <th className="px-2 py-1.5 text-left">Note</th>
                    <th className="px-2 py-1.5 text-left">Value formula</th>
                    <th className="px-2 py-1.5 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {draft.summary_layout.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={r.row}
                          onChange={(e) => updateRow(idx, { row: parseInt(e.target.value) || 0 })}
                          className="w-10 px-1 py-0.5 border border-gray-200 rounded text-xs"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={r.kind ?? 'default'}
                          onChange={(e) => updateRow(idx, { kind: e.target.value as SummaryRow['kind'] })}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                        >
                          <option value="default">default</option>
                          <option value="header">header</option>
                          <option value="share">share</option>
                          <option value="net_gp">net_gp</option>
                          <option value="dealer_header">dealer_header</option>
                          <option value="section">section</option>
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={r.label ?? ''}
                          onChange={(e) => updateRow(idx, { label: e.target.value })}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                          placeholder="Label"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={r.note ?? ''}
                          onChange={(e) => updateRow(idx, { note: e.target.value })}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs"
                          placeholder="e.g. {{pct(vat_rate)}} of ..."
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={r.value ?? ''}
                          onChange={(e) => updateRow(idx, { value: e.target.value })}
                          className="w-full px-1 py-0.5 border border-gray-200 rounded text-xs font-mono"
                          placeholder="e.g. revenue * tx_rate"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <button
                          onClick={() => deleteRow(idx)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
              Context: <code className="bg-gray-100 px-1">revenue</code>, <code className="bg-gray-100 px-1">electricity_cost</code>, <code className="bg-gray-100 px-1">internet_cost</code>, <code className="bg-gray-100 px-1">etax</code>, <code className="bg-gray-100 px-1">share_rate</code>, <code className="bg-gray-100 px-1">sharge_rate</code>, <code className="bg-gray-100 px-1">vat_rate</code>, <code className="bg-gray-100 px-1">evse_count</code>, plus params + <code className="bg-gray-100 px-1">location_share</code>, <code className="bg-gray-100 px-1">total_payment_to_sharge</code>, etc.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {/* ─── Right: WYSIWYG preview (mimics Excel Summary sheet) ─── */}
        <div className="p-4 bg-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Preview · Summary sheet</span>
            {previewing && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {([
              ['revenue', 'Revenue'],
              ['electricity_cost', 'Electricity'],
              ['internet_cost', 'Internet'],
              ['etax', 'Etax'],
              ['location_share_rate', 'Share rate'],
              ['evse_count', 'EVSE'],
            ] as [keyof PreviewInputs, string][]).map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
                <input
                  type="number"
                  step="any"
                  value={(previewInputs[k] as number) ?? 0}
                  onChange={(e) =>
                    onPreviewInputsChange({ ...previewInputs, [k]: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-0.5 w-full px-2 py-1 text-xs border border-gray-200 rounded bg-white"
                />
              </label>
            ))}
          </div>

          {previewErr && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-2">
              {previewErr}
            </div>
          )}

          <ExcelPreview rows={preview ?? []} layoutStyle={draft.layout_style} />
        </div>
      </div>
    </div>
  );
}

// ─── Excel-style WYSIWYG preview ───────────────────────────────────

function ExcelPreview({
  rows,
  layoutStyle,
}: {
  rows: PreviewRowResult[];
  layoutStyle: TemplateLayoutStyle;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded p-6 text-center text-xs text-gray-400">
        No rows in layout.
      </div>
    );
  }

  // Fill out gaps between row numbers so the preview lines up like the real
  // spreadsheet (empty rows between sections are visible).
  const maxRow = Math.max(...rows.map((r) => r.row ?? 0), 1);
  const byRow = new Map<number, PreviewRowResult>();
  rows.forEach((r) => byRow.set(r.row, r));

  const gridRows: (PreviewRowResult | null)[] = [];
  for (let i = 1; i <= maxRow; i++) gridRows.push(byRow.get(i) ?? null);

  const isDealer = layoutStyle === 'dealer';

  return (
    <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
      {/* Fake column headers (A, B, C, ...) to sell the "spreadsheet" feel */}
      <div
        className="grid text-[10px] text-gray-400 bg-gray-50 border-b border-gray-200"
        style={{
          gridTemplateColumns: isDealer
            ? '32px 1.1fr 1.3fr 40px 90px'
            : '32px 1.3fr 1.2fr 110px',
        }}
      >
        <div className="px-1 py-0.5 text-center border-r border-gray-200">#</div>
        <div className="px-2 py-0.5 border-r border-gray-200">B</div>
        <div className="px-2 py-0.5 border-r border-gray-200">C</div>
        <div className="px-2 py-0.5 border-r border-gray-200 text-center">D</div>
        {isDealer && <div className="px-2 py-0.5 text-right">E</div>}
      </div>

      <div className="text-[11px] font-['Calibri',sans-serif]">
        {gridRows.map((r, idx) => (
          <ExcelRow key={idx} row={r} rowNum={idx + 1} isDealer={isDealer} />
        ))}
      </div>
    </div>
  );
}

function ExcelRow({
  row,
  rowNum,
  isDealer,
}: {
  row: PreviewRowResult | null;
  rowNum: number;
  isDealer: boolean;
}) {
  const gridTemplate = isDealer
    ? '32px 1.1fr 1.3fr 40px 90px'
    : '32px 1.3fr 1.2fr 110px';
  const baseCell = 'px-2 py-1 border-r border-b border-gray-200 overflow-hidden whitespace-nowrap text-ellipsis';

  // Blank row — keep the grid cells so borders line up.
  if (!row) {
    return (
      <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="px-1 py-1 text-[10px] text-gray-300 text-center border-r border-b border-gray-200">
          {rowNum}
        </div>
        <div className={baseCell}>&nbsp;</div>
        <div className={baseCell}>&nbsp;</div>
        <div className={baseCell}>&nbsp;</div>
        {isDealer && <div className={baseCell}>&nbsp;</div>}
      </div>
    );
  }

  const fill = row.fill;
  const bold = row.bold || row.kind === 'net_gp' || row.kind === 'header' || row.kind === 'dealer_header';
  const kindClass = kindRowClass(row);
  const fillClass = fillCellClass(fill);
  const bottom = row.border === 'bottom' ? 'border-b-2 border-b-gray-700' : '';

  const fmt = (v: number | null) =>
    v == null ? '' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Dealer 5-col: [B=label, C=note, D=THB, E=value]
  if (isDealer) {
    if (row.kind === 'section') {
      return (
        <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
          <RowNumber n={rowNum} />
          <div className={`${baseCell} font-bold`}>{row.label}</div>
          <div className={baseCell}>&nbsp;</div>
          <div className={baseCell}>&nbsp;</div>
          <div className={baseCell}>&nbsp;</div>
        </div>
      );
    }
    return (
      <div className={`grid ${kindClass} ${bottom}`} style={{ gridTemplateColumns: gridTemplate }}>
        <RowNumber n={rowNum} />
        <div className={`${baseCell} ${fillClass} ${bold ? 'font-bold' : ''}`}>
          {row.label ?? ''}
        </div>
        <div className={`${baseCell} ${fillClass} text-gray-600`}>{row.note ?? ''}</div>
        <div className={`${baseCell} ${fillClass} text-center text-gray-500`}>
          {row.value != null ? 'THB' : ''}
        </div>
        <div className={`${baseCell} ${fillClass} text-right tabular-nums ${bold ? 'font-bold' : ''}`}>
          {row.error ? <span className="text-red-600" title={row.error}>#ERR</span> : fmt(row.value)}
        </div>
      </div>
    );
  }

  // Standard 4-col: [B=label, C=note, D=value]
  if (row.kind === 'header') {
    return (
      <div className={`grid ${kindClass}`} style={{ gridTemplateColumns: gridTemplate }}>
        <RowNumber n={rowNum} />
        <div className={`${baseCell} text-center font-bold border-gray-500`}>{row.label ?? 'Revenue'}</div>
        <div className={`${baseCell} border-gray-500`}>&nbsp;</div>
        <div className={`${baseCell} text-right tabular-nums font-bold border-gray-500`}>
          {row.error ? <span className="text-red-600">#ERR</span> : fmt(row.value)}
        </div>
      </div>
    );
  }

  if (row.kind === 'net_gp') {
    return (
      <div className={`grid ${kindClass}`} style={{ gridTemplateColumns: gridTemplate }}>
        <RowNumber n={rowNum} />
        <div className={`${baseCell} text-center font-bold text-base`}>{row.label ?? 'Net GP'}</div>
        <div className={`${baseCell} text-center font-semibold`}>{row.note ?? ''}</div>
        <div className={`${baseCell} text-right tabular-nums font-bold text-base border-t-2 border-b-2 border-gray-700`}>
          {row.error ? <span className="text-red-600">#ERR</span> : fmt(row.value)}
        </div>
      </div>
    );
  }

  if (row.kind === 'share') {
    return (
      <div className={`grid ${kindClass} ${bottom}`} style={{ gridTemplateColumns: gridTemplate }}>
        <RowNumber n={rowNum} />
        <div className={`${baseCell} text-right font-semibold`}
          style={{ color: '#8B4513' }}>{row.label ?? ''}</div>
        <div className={`${baseCell} text-center`} style={{ color: '#8B4513' }}>{row.note ?? ''}</div>
        <div className={`${baseCell} text-right tabular-nums font-semibold`} style={{ color: '#8B4513' }}>
          {row.error ? <span className="text-red-600">#ERR</span> : fmt(row.value)}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid ${bottom}`} style={{ gridTemplateColumns: gridTemplate }}>
      <RowNumber n={rowNum} />
      <div className={`${baseCell} text-right ${bold ? 'font-bold' : ''}`}>{row.label ?? ''}</div>
      <div className={`${baseCell} text-center text-gray-600`}>{row.note ?? ''}</div>
      <div className={`${baseCell} ${fillClass} text-right tabular-nums ${bold ? 'font-bold' : ''}`}>
        {row.error ? <span className="text-red-600" title={row.error}>#ERR</span> : fmt(row.value)}
      </div>
    </div>
  );
}

function RowNumber({ n }: { n: number }) {
  return (
    <div className="px-1 py-1 text-[10px] text-gray-400 text-center border-r border-b border-gray-200 bg-gray-50">
      {n}
    </div>
  );
}

function kindRowClass(r: PreviewRowResult): string {
  if (r.kind === 'header') return 'border border-gray-500';
  if (r.kind === 'dealer_header') return 'bg-[#B4E1BF]';
  if (r.kind === 'share') return 'bg-[#DAEEF3]';
  return '';
}

function fillCellClass(fill: string | null | undefined): string {
  switch (fill) {
    case 'yellow':
      return 'bg-[#FFFF00]';
    case 'orange':
      return 'bg-[#FFC000]';
    case 'green':
      return 'bg-[#B4E1BF]';
    case 'light_blue':
      return 'bg-[#DAEEF3]';
    default:
      return '';
  }
}

// ─── Create form ──────────────────────────────────────────────────

function CreateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (t: ReportTemplate) => void;
}) {
  const create = useCreateReportTemplate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<TemplateShareBasis>('gp');
  const [layout, setLayout] = useState<TemplateLayoutStyle>('standard');

  const submit = async () => {
    if (!code.trim() || !name.trim()) return alert('code + name required');
    try {
      const t = await create.mutateAsync({
        code: code.trim(),
        name: name.trim(),
        share_basis: basis,
        layout_style: layout,
        params: layout === 'dealer'
          ? { vat_rate: 0.07, wht_rate: 0.03 }
          : { vat_rate: 0.07, tx_rate: 0.0365, transfer_fee: 30 },
        summary_layout: [
          { row: 2, kind: layout === 'dealer' ? 'dealer_header' : 'header', label: 'Revenue', value: 'revenue' },
        ],
      });
      onCreated(t);
    } catch (e) {
      alert(`Create failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
      <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto_auto] gap-2 items-end">
        <label className="block">
          <span className="text-xs text-gray-600">Code</span>
          <input
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="my_template"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Name</span>
          <input
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Template"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Basis</span>
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as TemplateShareBasis)}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="gp">Gross Profit</option>
            <option value="revenue">Revenue</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Layout</span>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as TemplateLayoutStyle)}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="standard">Standard</option>
            <option value="dealer">Dealer</option>
          </select>
        </label>
        <button
          onClick={submit}
          disabled={create.isPending}
          className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg disabled:opacity-50"
        >
          Create
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
