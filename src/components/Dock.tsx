// The bottom action bar shared by every board screen (games, puzzles, lessons, drills, model
// games, repertoire): small icon buttons on the left, the main action — Next, Continue, Retry —
// always in the same place on the right.
import type { ReactNode } from 'react';

export function Dock({ children, sticky = false }: { children: ReactNode; /** Stick to the bottom of a scrolling parent instead of sitting below it. */ sticky?: boolean }) {
  return (
    <div className={`safe-bottom z-10 shrink-0 px-3 pt-1.5 pb-2 ${sticky ? 'sticky bottom-0 mt-auto' : ''}`}>
      <div className="mx-auto flex max-w-md items-stretch gap-1 rounded-[22px] bg-white/90 p-1.5 shadow-[0_6px_24px_rgba(60,35,15,0.12)] ring-1 ring-black/5 backdrop-blur-xl dark:bg-[#1d1915]/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.5)] dark:ring-white/[0.07]">
        {children}
      </div>
    </div>
  );
}

export function DockButton({ label, icon, onClick, disabled, primary, ariaLabel }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; /** Amber accent (hints). */ primary?: boolean; ariaLabel?: string }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex min-w-[58px] flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-30 ${
        primary ? 'text-amber-600 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'
      }`}
    >
      <span className="flex h-6 items-center">{icon}</span>
      {label}
    </button>
  );
}

/** The main action of the screen: wide, on the right. */
export function DockMain({ children, onClick, disabled, quiet, ariaLabel }: { children: ReactNode; onClick: () => void; disabled?: boolean; /** A secondary look, for when the main action is not the recommended one. */ quiet?: boolean; ariaLabel?: string }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex flex-[2.2] items-center justify-center gap-1.5 rounded-[16px] px-4 text-[15px] font-semibold transition duration-75 active:scale-[0.97] disabled:opacity-35 ${
        quiet ? 'bg-stone-100 text-stone-800 dark:bg-white/10 dark:text-stone-100' : 'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_var(--color-brand-800)]'
      }`}
    >
      {children}
    </button>
  );
}
