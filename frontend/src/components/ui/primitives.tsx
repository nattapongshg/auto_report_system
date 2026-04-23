import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════════
// Sharge Auto Report — shared primitives
// Mirrors design_refs/primitives.jsx but built for the real app.
// ═══════════════════════════════════════════════════════════════════

// ─── Status Pill ──────────────────────────────────────────────────

export type Status =
  | 'pending' | 'generating' | 'sent' | 'failed'
  | 'fetching' | 'completed' | 'active' | 'partial' | 'warn';

const STATUS_MAP: Record<Status, { label: string; classes: string; dot: string }> = {
  pending:    { label: 'Pending',    classes: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
  generating: { label: 'Generating', classes: 'bg-blue-50 text-blue-700',  dot: 'bg-blue-500' },
  sent:       { label: 'Sent',       classes: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  failed:     { label: 'Failed',     classes: 'bg-red-50 text-red-700',    dot: 'bg-red-500' },
  fetching:   { label: 'Fetching',   classes: 'bg-blue-50 text-blue-700',  dot: 'bg-blue-500' },
  completed:  { label: 'Completed',  classes: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  active:     { label: 'Active',     classes: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  partial:    { label: 'Partial',    classes: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  warn:       { label: 'Warn',       classes: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
};

export function StatusPill({ status, subtle = false, label }: { status: Status; subtle?: boolean; label?: string }) {
  const s = STATUS_MAP[status];
  const text = label ?? s.label;
  if (subtle) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: `var(--status-${status}-fg, #52525B)` }}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {text}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.classes}`}
      style={{ letterSpacing: '-0.005em' }}
    >
      <span className={`w-[5px] h-[5px] rounded-full ${s.dot}`} />
      {text}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────

type BtnKind = 'primary' | 'primaryG' | 'secondary' | 'ghost' | 'subtle' | 'dark' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: BtnKind;
  size?: BtnSize;
  children: ReactNode;
}

const SIZE_CLASSES: Record<BtnSize, string> = {
  sm: 'text-xs px-2.5 py-1',
  md: 'text-[13px] px-3 py-1.5',
  lg: 'text-[13.5px] px-3.5 py-2',
};

const KIND_CLASSES: Record<BtnKind, string> = {
  primary:   'text-white hover:brightness-110',
  primaryG:  'text-white hover:brightness-110 border-transparent',
  secondary: 'bg-white text-[color:var(--fg-strong)] border-[color:var(--border-default)] hover:bg-[color:var(--bg-subtle)]',
  ghost:     'bg-transparent text-[color:var(--fg-default)] border-transparent hover:bg-[color:var(--bg-muted)]',
  subtle:    'bg-[color:var(--bg-muted)] text-[color:var(--fg-strong)] border-transparent hover:bg-zinc-200',
  dark:      'bg-[color:var(--sharge-navy)] text-white border-[color:var(--sharge-navy)] hover:bg-black',
  danger:    'bg-white text-red-700 border-red-200 hover:bg-red-50',
};

export function Btn({ kind = 'secondary', size = 'md', children, className = '', style, ...rest }: BtnProps) {
  const kindStyle: React.CSSProperties = { ...style };
  if (kind === 'primary') {
    kindStyle.background = 'var(--sharge-red-deep)';
    kindStyle.borderColor = 'var(--sharge-red-deep)';
  }
  if (kind === 'primaryG') {
    kindStyle.background = 'var(--sharge-gradient)';
  }
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_CLASSES[size]} ${KIND_CLASSES[kind]} ${className}`}
      style={{ letterSpacing: '-0.005em', ...kindStyle }}
    >
      {children}
    </button>
  );
}

// ─── Icon Button ──────────────────────────────────────────────────

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'danger' | 'success';
  size?: number;
}

export function IconBtn({ tone = 'default', size = 28, className = '', children, ...rest }: IconBtnProps) {
  const toneClass =
    tone === 'danger' ? 'text-red-700' :
    tone === 'success' ? 'text-emerald-700' :
    'text-[color:var(--fg-muted)]';
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-md border border-transparent bg-transparent hover:bg-[color:var(--bg-muted)] transition-colors ${toneClass} ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hover?: boolean;
  children: ReactNode;
}

export function Card({ padded = true, hover = false, className = '', style, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`bg-white border border-[color:var(--border-default)] rounded-[14px] transition-shadow ${hover ? 'hover:shadow-[var(--shadow-hover)]' : ''} ${className}`}
      style={{
        boxShadow: 'var(--shadow-card)',
        padding: padded ? 20 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Keyboard chip ────────────────────────────────────────────────

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10.5px] font-mono text-[color:var(--fg-muted)] bg-[color:var(--bg-muted)] border border-[color:var(--border-default)] rounded">
      {children}
    </kbd>
  );
}

// ─── Page Title ───────────────────────────────────────────────────

interface PageTitleProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}

export function PageTitle({ title, subtitle, right }: PageTitleProps) {
  return (
    <div className="flex items-start justify-between gap-5 mb-7">
      <div>
        <h1 className="text-[26px] font-semibold text-[color:var(--fg-strong)] leading-[1.15]" style={{ letterSpacing: '-0.025em' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px] text-[color:var(--fg-muted)] leading-normal max-w-[640px]">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

// ─── Section Title ────────────────────────────────────────────────

interface SectionTitleProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function SectionTitle({ eyebrow, title, right, className = '' }: SectionTitleProps) {
  return (
    <div className={`flex items-end justify-between mb-3.5 ${className}`}>
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="text-[15px] font-semibold text-[color:var(--fg-strong)]" style={{ letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

// ─── Trend (up/down percent chip) ─────────────────────────────────

import { ArrowDown, ArrowUp } from 'lucide-react';

export function Trend({ pct }: { pct: number }) {
  const pos = pct >= 0;
  const Arrow = pos ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11.5px] font-medium ${pos ? 'text-emerald-700' : 'text-red-700'}`}
      style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
    >
      <Arrow size={11} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Stat (inline KPI pair) ───────────────────────────────────────

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  accent?: boolean;
  minWidth?: number;
}

export function Stat({ label, value, mono, accent, minWidth = 80 }: StatProps) {
  return (
    <div className="flex flex-col gap-px" style={{ minWidth }}>
      <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
      <span
        className="text-[14px] font-semibold"
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          color: accent ? 'var(--sharge-purple)' : 'var(--fg-strong)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: mono ? '-0.01em' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
