import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { addBackHandler, useNav } from '../lib/nav';
import type { Score } from '../lib/chess/evaluation';
import { SOFT } from '../lib/motion';

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
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-3" onClick={onClose}>
      <div className="card safe-bottom animate-pop w-full max-w-md !rounded-t-[14px] !rounded-b-none !p-5 sm:!rounded-[14px]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />
        {title && <h2 className="mb-3 text-xl font-extrabold tracking-[-0.01em]">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Header({ title, back = false, right, subtitle, leading }: { title: string; back?: boolean; right?: ReactNode; subtitle?: string; leading?: ReactNode }) {
  const pop = useNav((s) => s.pop);
  return (
    <header className="safe-top sticky top-0 z-20 bg-stone-100 dark:bg-stone-950">
      <div className="flex min-h-14 items-center gap-1 px-2">
        {back && (
          <button className="flex h-10 w-10 items-center justify-center rounded-full text-stone-700 active:bg-stone-200 dark:text-stone-200 dark:active:bg-stone-800" onClick={pop} aria-label="Back">
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>
        )}
        {leading && <div className="mr-1 flex shrink-0 items-center">{leading}</div>}
        <div className={`min-w-0 flex-1 ${back || leading ? '' : 'pl-3'}`}>
          <h1 className="truncate text-[20px] leading-tight font-extrabold tracking-[-0.015em]">{title}</h1>
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
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-brand-500' : 'bg-stone-300 dark:bg-stone-700'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-[8px] bg-stone-200 p-1 dark:bg-stone-900">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[6px] px-3 py-2 text-sm font-bold transition ${value === o.value ? 'bg-white text-stone-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)] dark:bg-stone-800 dark:text-white dark:shadow-none' : 'text-stone-500 active:text-stone-700 dark:text-stone-400'}`}
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

/** The number on an eval bar, chess.com style: no sign (the end it sits at says who), M3 for mates, 10+ when huge. */
export function evalBarText(s: Score): string {
  if (s.type === 'mate') return s.value === 0 ? '#' : `M${Math.abs(s.value)}`;
  const v = Math.abs(s.value) / 100;
  return v > 9.9 ? '10+' : v.toFixed(1);
}

/**
 * The evaluation bar beside a board (games, analysis, review): fixed white and charcoal halves in
 * both themes, as tall as the board, with an optional number at the end of the side ahead.
 */
export function EvalBar({ whitePct, orientation, score, width = 14 }: { whitePct: number; orientation: 'white' | 'black'; score?: Score; width?: number }) {
  const pct = Math.max(3, Math.min(97, whitePct));
  const whiteAhead = whitePct >= 50;
  const atBottom = whiteAhead === (orientation === 'white');
  return (
    <div
      className={`relative flex shrink-0 overflow-hidden rounded-[3px] bg-[#403d39] ring-1 ring-black/15 ${orientation === 'white' ? 'flex-col-reverse' : 'flex-col'}`}
      style={{ width }}
      data-testid="eval-bar"
    >
      {/* The white share springs to its new value (transform only). */}
      <div className={`absolute inset-x-0 h-full bg-white ${orientation === 'white' ? 'bottom-0 origin-bottom' : 'top-0 origin-top'}`} style={{ transform: `scaleY(${pct / 100})`, transition: `transform ${SOFT.d + 120}ms ${SOFT.e}` }} />
      {score && (
        <span
          className={`absolute inset-x-0 text-center text-[10px] leading-none font-extrabold tracking-tight tabular-nums ${whiteAhead ? 'text-[#403d39]' : 'text-white'}`}
          style={{ [atBottom ? 'bottom' : 'top']: 3 }}
        >
          {evalBarText(score)}
        </span>
      )}
    </div>
  );
}

/** A friendly empty state: an icon, a line or two, and an optional action. */
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-stone-200/70 text-stone-500 dark:bg-white/[0.06] dark:text-stone-400">{icon}</span>
      <p className="mt-1 font-semibold">{title}</p>
      {text && <p className="max-w-xs text-sm leading-snug text-stone-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Grey placeholder blocks while a screen loads (instead of a blank page). */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="card h-24 animate-pulse !bg-stone-200/50 !shadow-none dark:!bg-white/[0.04]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card h-16 animate-pulse !bg-stone-200/40 !shadow-none dark:!bg-white/[0.03]" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

/**
 * A top-aligned scrolling area with a soft fade at the bottom while there's more below (coach
 * panels). With `onMore`, a small "More" pill sits on the bottom edge while it overflows.
 */
export function FadeScroll({ children, className = '', testId, onMore }: { children: ReactNode; className?: string; testId?: string; onMore?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // At least a line hidden (padding alone overflows by a few px).
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 16);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, []);
  const area = (
    <div ref={ref} className={`min-h-0 flex-1 overflow-y-auto ${more ? '[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]' : ''} ${className}`} data-testid={testId}>
      {children}
    </div>
  );
  if (!onMore) return area;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {area}
      {more && (
        <button
          className="absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white py-0.5 pr-2 pl-2.5 text-[12px] font-bold text-[#312e2b] shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
          onClick={onMore}
          data-testid="coach-more"
        >
          More <ChevronDown size={14} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}
