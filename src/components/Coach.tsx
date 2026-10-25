import { useState, type ReactNode } from 'react';
import { flagExplanation } from '../lib/feedback';
import type { CoachComment } from '../lib/coach/types';
import { CLASS_LABEL, CLASS_SYMBOL, type Classification } from '../lib/chess/evaluation';

export const CLASS_STYLE: Record<Classification, string> = {
  best: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  good: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200',
  inaccuracy: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  mistake: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
  blunder: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
};

export function ClassBadge({ c }: { c: Classification }) {
  return (
    <span className={`chip ${CLASS_STYLE[c]}`}>
      {CLASS_SYMBOL[c]} {CLASS_LABEL[c]}
    </span>
  );
}

/** The coach character: a friendly owl. */
export function CoachAvatar({ mood = 'happy', size = 44 }: { mood?: 'happy' | 'concerned' | 'thinking'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <circle cx="32" cy="34" r="27" fill="#8b6b4a" />
      <path d="M10 18 L20 26 L14 30 Z M54 18 L44 26 L50 30 Z" fill="#6f5338" />
      <ellipse cx="32" cy="44" rx="16" ry="13" fill="#e8d5b5" />
      <circle cx="22" cy="30" r="9" fill="#fff" />
      <circle cx="42" cy="30" r="9" fill="#fff" />
      {mood === 'thinking' ? (
        <>
          <circle cx="24" cy="27" r="4" fill="#2d2d2d" />
          <circle cx="44" cy="27" r="4" fill="#2d2d2d" />
        </>
      ) : (
        <>
          <circle cx="22" cy="31" r="4" fill="#2d2d2d" />
          <circle cx="42" cy="31" r="4" fill="#2d2d2d" />
        </>
      )}
      <circle cx="23.5" cy="29.5" r="1.3" fill="#fff" />
      <circle cx="43.5" cy="29.5" r="1.3" fill="#fff" />
      <path d="M29 37 L35 37 L32 42 Z" fill="#f2a33a" />
      {mood === 'concerned' ? (
        <path d="M14 20 Q22 17 29 22 M35 22 Q42 17 50 20" stroke="#4a3622" strokeWidth="2" fill="none" />
      ) : null}
      <rect x="18" y="8" width="28" height="6" rx="2" fill="#2d2d2d" />
      <rect x="24" y="2" width="16" height="7" rx="1.5" fill="#2d2d2d" />
    </svg>
  );
}

export function CoachBubble({
  children,
  mood = 'happy',
  badge,
  actions,
}: {
  children: ReactNode;
  mood?: 'happy' | 'concerned' | 'thinking';
  badge?: Classification;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 animate-pop">
      <CoachAvatar mood={mood} />
      <div className="card relative flex-1 !p-3 text-[15px] leading-snug">
        {badge && (
          <div className="mb-1">
            <ClassBadge c={badge} />
          </div>
        )}
        <div className="space-y-1">{children}</div>
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Small "this explanation is wrong" link; saves the position for later review. */
export function FlagButton({ fen, uci, comment }: { fen: string; uci: string; comment: CoachComment }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="mt-1 text-xs text-stone-400 underline-offset-2 hover:underline disabled:no-underline"
      disabled={done}
      onClick={() => {
        void flagExplanation(fen, uci, comment);
        setDone(true);
      }}
    >
      {done ? 'Thanks — saved for review (Settings → Coach feedback)' : '👎 This explanation seems wrong'}
    </button>
  );
}
