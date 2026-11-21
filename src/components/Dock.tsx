// The bottom action bar shared by every board screen (games, puzzles, lessons, drills, model
// games, repertoire): a flat full-width strip like chess.com's, small icon buttons on the left,
// the main action — Next, Continue, Retry — always in the same place on the right.
import type { ReactNode } from 'react';

export function Dock({ children, sticky = false }: { children: ReactNode; /** Stick to the bottom of a scrolling parent instead of sitting below it. */ sticky?: boolean }) {
  return (
    <div className={`safe-bottom z-10 shrink-0 border-t border-black/[0.08] bg-white dark:border-white/[0.06] dark:bg-stone-900 ${sticky ? 'sticky bottom-0 mt-auto' : ''}`}>
      <div className="mx-auto flex h-14 max-w-md items-stretch gap-1 px-2 py-1.5">{children}</div>
    </div>
  );
}

export function DockButton({ label, icon, onClick, disabled, primary, ariaLabel }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; /** Amber accent (hints). */ primary?: boolean; ariaLabel?: string }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex min-w-[58px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold transition-colors active:bg-black/5 disabled:opacity-30 dark:active:bg-white/5 ${
        primary ? 'text-[#946a00] dark:text-[#f7c045]' : 'text-stone-900 dark:text-stone-100'
      }`}
    >
      <span className="flex h-[22px] items-center">{icon}</span>
      {label}
    </button>
  );
}

/** The main action of the screen: wide, on the right, the green chess.com button. */
export function DockMain({ children, onClick, disabled, quiet, ariaLabel }: { children: ReactNode; onClick: () => void; disabled?: boolean; /** A secondary look, for when the main action is not the recommended one. */ quiet?: boolean; ariaLabel?: string }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex flex-[2.2] items-center justify-center gap-1.5 rounded-[10px] px-4 text-[15px] font-bold transition duration-75 disabled:opacity-35 ${
        quiet
          ? 'bg-stone-100 text-stone-800 active:bg-stone-200 dark:bg-stone-800 dark:text-stone-100'
          : 'bg-brand-500 text-white [text-shadow:0_1px_0_rgba(0,0,0,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_var(--color-brand-800)] active:translate-y-[2px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_0_var(--color-brand-800)]'
      }`}
    >
      {children}
    </button>
  );
}
