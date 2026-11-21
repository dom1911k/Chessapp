import { useState, type ReactNode } from 'react';
import { flagExplanation } from '../lib/feedback';
import { COACH, portrait, type Mood } from '../lib/people';
import type { CoachComment } from '../lib/coach/types';
import { CLASS_LABEL, CLASS_SYMBOL, type Classification } from '../lib/chess/evaluation';
import { ThumbsDown } from 'lucide-react';
import { useSettings } from '../lib/settings';

export const CLASS_STYLE: Record<Classification, string> = {
  best: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  good: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-200',
  inaccuracy: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  mistake: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
  blunder: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
};

/** Friendlier words and no red for the gentle coach. */
const GENTLE_LABEL: Record<Classification, string> = { best: 'Great', good: 'Nice', inaccuracy: 'Hmm', mistake: 'Careful', blunder: 'Oops' };
const GENTLE_STYLE: Partial<Record<Classification, string>> = {
  mistake: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  blunder: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
};

export function ClassBadge({ c }: { c: Classification }) {
  const gentle = useSettings((s) => s.coachStyle === 'gentle');
  return (
    <span className={`chip ${(gentle && GENTLE_STYLE[c]) || CLASS_STYLE[c]}`}>
      {gentle ? GENTLE_LABEL[c] : `${CLASS_SYMBOL[c]} ${CLASS_LABEL[c]}`}
    </span>
  );
}

/** Corner radius for a portrait or avatar of a given size: square-ish like chess.com (4px small, 8px hero). */
export const avatarRadius = (size: number) => (size <= 40 ? 4 : size >= 84 ? 8 : 6);

/** Portrait of a person (coach or opponent) in a given mood. */
export function Portrait({ id, mood = 'neutral', size = 44, className = '' }: { id: string; mood?: Mood; size?: number; className?: string }) {
  return (
    <img
      src={portrait(id, mood)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`shrink-0 ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size, borderRadius: avatarRadius(size) }}
    />
  );
}

/** The coach. */
export function CoachAvatar({ mood = 'happy', size = 44 }: { mood?: 'happy' | 'concerned' | 'thinking'; size?: number }) {
  return <Portrait id={COACH.id} mood={mood === 'concerned' ? 'worried' : mood === 'happy' ? 'neutral' : 'neutral'} size={size} />;
}

/**
 * The coach speaking, chess.com style: a white speech bubble (in both themes) with a small tail
 * pointing at his avatar. Its contents render as on a light surface. A small label ("Hint",
 * "Before you move") only when it adds something — the avatar already says who's talking.
 */
export function CoachBubble({
  children,
  mood = 'happy',
  badge,
  special,
  actions,
  compact = false,
  label,
  icon,
}: {
  children: ReactNode;
  mood?: 'happy' | 'concerned' | 'thinking';
  badge?: Classification;
  /** Brilliant (!!) / great (!) move. */
  special?: 'brilliant' | 'great';
  actions?: ReactNode;
  /** Older messages in a conversation: smaller and quieter. */
  compact?: boolean;
  /** Small header, e.g. "Hint" or "Before you move". */
  label?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${compact ? 'opacity-75' : 'animate-pop'}`}>
      <CoachAvatar mood={mood} size={compact ? 32 : 40} />
      <div
        className={`surface-light relative min-w-0 flex-1 rounded-[10px] bg-white text-[#312e2b] shadow-[0_1px_2px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.06] ${compact ? 'px-3 py-2 text-sm' : 'px-3.5 py-3 text-[15px]'} leading-snug`}
      >
        {/* The tail, pointing at the avatar. */}
        <span aria-hidden className={`absolute -left-[7px] h-0 w-0 border-y-[7px] border-r-[8px] border-y-transparent border-r-white ${compact ? 'top-[9px]' : 'top-[13px]'}`} />
        {label && !compact && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] text-stone-500 uppercase">
            {icon}
            {label}
          </div>
        )}
        {special ? (
          <div className="mb-1">
            <span className="chip text-white" style={{ background: special === 'brilliant' ? '#1baca6' : '#5c8bb0' }}>
              {special === 'brilliant' ? '!! Brilliant' : '! Great move'}
            </span>
          </div>
        ) : (
          badge && (
            <div className="mb-1">
              <ClassBadge c={badge} />
            </div>
          )
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
      {done ? 'Thanks — saved for review (Settings → Coach feedback)' : <><ThumbsDown size={13} className="mr-1 inline -translate-y-px" />This explanation seems wrong</>}
    </button>
  );
}
