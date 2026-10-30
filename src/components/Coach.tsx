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

/** Round portrait of a person (coach or opponent) in a given mood. */
export function Portrait({ id, mood = 'neutral', size = 44, className = '' }: { id: string; mood?: Mood; size?: number; className?: string }) {
  return (
    <img
      src={portrait(id, mood)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`shrink-0 rounded-[30%] shadow-[0_2px_8px_rgba(60,35,15,0.18)] ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** The coach. */
export function CoachAvatar({ mood = 'happy', size = 44 }: { mood?: 'happy' | 'concerned' | 'thinking'; size?: number }) {
  return <Portrait id={COACH.id} mood={mood === 'concerned' ? 'worried' : mood === 'happy' ? 'neutral' : 'neutral'} size={size} />;
}

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
  /** Small header, e.g. "Hint" or "Tip of the day" (defaults to the coach's name). */
  label?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${compact ? 'opacity-75' : 'animate-pop'}`}>
      <CoachAvatar mood={mood} size={compact ? 32 : 42} />
      <div className={`card relative flex-1 !rounded-[20px] !rounded-tl-md ${compact ? '!p-2.5 text-sm' : '!p-3.5 text-[15px]'} leading-snug`}>
        {!compact && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] text-brand-700 uppercase dark:text-brand-500">
            {icon}
            {label ?? 'Coach Sam'}
          </div>
        )}
        {special ? (
          <div className="mb-1">
            <span className={`chip text-white ${special === 'brilliant' ? 'bg-gradient-to-r from-teal-500 to-cyan-500' : 'bg-gradient-to-r from-blue-600 to-sky-500'}`}>
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
