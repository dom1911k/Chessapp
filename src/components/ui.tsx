import { useEffect, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { addBackHandler, useNav } from '../lib/nav';

/** Register an Android back-button handler while `active`. */
export function useBackHandler(fn: () => boolean | void, active = true) {
  useEffect(() => {
    if (!active) return;
    return addBackHandler(fn);
  }, [fn, active]);
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useBackHandler(onClose, open);
  if (!open) return null;
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-stone-950/45 p-3 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div className="card safe-bottom animate-pop w-full max-w-md !rounded-[28px] !p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />
        {title && <h2 className="font-display mb-3 text-xl font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Header({ title, back = false, right, subtitle }: { title: string; back?: boolean; right?: ReactNode; subtitle?: string }) {
  const pop = useNav((s) => s.pop);
  return (
    <header className="safe-top sticky top-0 z-20 bg-stone-100/85 backdrop-blur-md dark:bg-stone-950/85">
      <div className="flex min-h-14 items-center gap-1 px-2">
        {back && (
          <button className="flex h-10 w-10 items-center justify-center rounded-full text-stone-700 active:bg-stone-200 dark:text-stone-200 dark:active:bg-stone-800" onClick={pop} aria-label="Back">
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
        )}
        <div className={`min-w-0 flex-1 ${back ? '' : 'pl-3'}`}>
          <h1 className="font-display truncate text-[22px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
          {subtitle && <div className="truncate text-xs text-stone-500">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1 pr-1">{right}</div>
      </div>
    </header>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800">
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-brand-600' : 'bg-stone-300 dark:bg-stone-700'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-stone-200/80 p-1 dark:bg-stone-800">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${value === o.value ? 'bg-white text-stone-900 shadow-[0_1px_3px_rgba(40,25,10,0.15)] dark:bg-stone-600 dark:text-white' : 'text-stone-500 dark:text-stone-400'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function EvalBar({ whitePct, orientation }: { whitePct: number; orientation: 'white' | 'black' }) {
  const pct = Math.max(3, Math.min(97, whitePct));
  return (
    <div className={`flex w-2.5 shrink-0 overflow-hidden rounded bg-stone-800 ${orientation === 'white' ? 'flex-col-reverse' : 'flex-col'}`}>
      <div className="bg-stone-100 transition-all duration-500" style={{ height: `${pct}%` }} />
    </div>
  );
}
