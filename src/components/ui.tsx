import { useEffect, type ReactNode } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div className="card safe-bottom w-full max-w-md animate-pop" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Header({ title, back = false, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const pop = useNav((s) => s.pop);
  return (
    <header className="safe-top sticky top-0 z-20 bg-stone-100/90 backdrop-blur dark:bg-stone-950/90">
      <div className="flex h-12 items-center gap-1 px-2">
        {back && (
          <button className="btn-ghost !px-2" onClick={pop} aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <h1 className={`flex-1 truncate text-lg font-bold ${back ? '' : 'pl-2'}`}>{title}</h1>
        {right}
      </div>
    </header>
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
        className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-stone-300 dark:bg-stone-700'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${value === o.value ? 'bg-white shadow-sm dark:bg-stone-600' : 'text-stone-600 dark:text-stone-300'}`}
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
