// The Puzzle Path's small pieces, used everywhere: the level badge (chess.com's tilted puzzle
// piece in the board's material), the Daily Solver dots, the streak flame and the path card
// (total points, the orange bar with the next level's badge, "Wood · Level 4  170 / 175").
import { forwardRef, useContext, useId, type ReactNode } from 'react';
import { boardName, levelAt } from '../../lib/puzzles/path';
import { PuzzleTimer } from '../PuzzleProgress';

/** The badge outline (60×60 box), from the prototype. */
export const PZ = 'M14,14 H23 C22,10 24,6.5 28.5,6.5 C33,6.5 35,10 34,14 H42 Q46,14 46,18 V25 C50,24 53.5,26 53.5,30.5 C53.5,35 50,37 46,36 V46 Q46,50 42,50 H14 Q10,50 10,46 V18 Q10,14 14,14 Z';
/** Each board's material: highlight, mid, shade (Wood adds grain). */
export const MAT: [string, string, string][] = [
  ['#e3b27a', '#b8773f', '#7d4a22'],
  ['#eef0f2', '#b3b9be', '#7d848b'],
  ['#f7c48c', '#c97a3c', '#7a3f16'],
  ['#ffffff', '#c6d0d9', '#7e8b97'],
  ['#e6fbff', '#5cc8e6', '#1a7e9e'],
  ['#e2c8ff', '#9b5de5', '#4a1d8a'],
  ['#ffb3b3', '#e0383e', '#7a1018'],
  ['#fff3b0', '#f2b51c', '#8a5a05'],
];

export function PathBadge({ tier, level, size = 32, tilt = -12, className = '', title }: { tier: number; level: number; size?: number; tilt?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  const [a, b, c] = MAT[Math.min(7, tier)];
  const big = level > 99;
  return (
    <svg className={`shrink-0 overflow-visible ${className}`} width={size} height={size} viewBox="0 0 60 60" role="img" aria-label={title ?? `${boardName(tier)} level ${level}`}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset=".55" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <path d={PZ} />
        </clipPath>
      </defs>
      <g transform={`rotate(${tilt} 30 30)`}>
        <path d={PZ} fill={c} transform="translate(0,4)" />
        <path d={PZ} fill={`url(#${id}g)`} />
        {tier === 0 ? (
          <g clipPath={`url(#${id}c)`} opacity=".38">
            {[10, 16, 22, 28, 34, 40, 46].map((y, k) => (
              <path key={y} d={`M8,${y} q12,${k % 2 ? -3 : 3} 24,0 t24,0`} stroke="#6b3a14" strokeWidth="1.2" fill="none" />
            ))}
          </g>
        ) : (
          <path d="M12,16 L30,16 L16,40 Z" fill="#fff" opacity=".22" clipPath={`url(#${id}c)`} />
        )}
        <path d={PZ} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" />
        <text x="28" y={big ? 36 : 37.5} textAnchor="middle" fontSize={big ? 14 : level > 9 ? 17 : 19} fontWeight="800" fill="#fff8ec" stroke={c} strokeWidth="3.2" paintOrder="stroke" fontFamily="'Plus Jakarta Sans Variable',system-ui,sans-serif">
          {level}
        </text>
      </g>
    </svg>
  );
}

/** Three small puzzle pieces that fill gold with each clean solve today (a check once done). */
export function SolverDots({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Daily Solver ${Math.min(count, 3)} of 3`} data-testid="solver-dots">
      {[0, 1, 2].map((i) => {
        const on = i < count;
        return (
          <svg key={i} width="17" height="17" viewBox="0 0 60 60" className={on ? 'drop-shadow-[0_0_3px_rgba(247,198,49,0.55)]' : ''}>
            <path d={PZ} fill={on ? '#c98608' : '#2b2927'} transform="translate(0,3)" />
            <path d={PZ} fill={on ? '#f7c631' : '#4b4847'} />
          </svg>
        );
      })}
    </span>
  );
}

/** Flame colour by streak: grey, then yellow, orange and pink. */
export const flameColor = (streak: number) => (streak >= 10 ? '#e8459a' : streak >= 5 ? '#f0782a' : streak >= 1 ? '#f7c045' : '#8b8987');

export const StreakFlame = forwardRef<HTMLSpanElement, { streak: number; size?: number; className?: string }>(function StreakFlame({ streak, size = 20, className = '' }, ref) {
  const c = flameColor(streak);
  return (
    <span ref={ref} className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Streak ${streak}`} data-testid="streak-flame">
      <svg width={size} height={size} viewBox="0 0 24 24" style={streak >= 3 ? { filter: `drop-shadow(0 0 4px ${c}99)` } : undefined}>
        <path d="M12 2.5c.8 3.2 3.6 4.8 4.9 7.6 1.6 3.4.2 8.6-4.9 9.4-4.6.7-7.6-2.6-7.2-6.6.2-2.2 1.4-3.5 2.4-4.6.2 1.7 1 2.8 2.1 3.2-.6-3.4.6-6.8 2.7-9z" fill={c} />
        <path d="M12.2 11.2c.5 1.6 2 2.4 2.3 4 .4 2-1 3.6-2.6 3.6-1.8 0-3-1.5-2.7-3.1.2-1 .8-1.6 1.3-2.1.1.8.5 1.2 1 1.4-.2-1.5.1-2.8.7-3.8z" fill="#fff" opacity=".55" />
      </svg>
      <span className="text-[15px] font-extrabold tabular-nums" style={{ color: streak ? c : undefined }}>
        {streak}
      </span>
    </span>
  );
});

/** chess.com's points row: the total, this puzzle's gain, the streak, the rating; then the bar. */
export function PathCard({ points, gain, streak, rating, ratingDelta, extra }: { points: number; gain?: number; streak: number; rating?: number | null; ratingDelta?: number | null; extra?: ReactNode }) {
  const pos = levelAt(points);
  const next = pos.level === 20 ? { tier: Math.min(7, pos.board + 1), level: 1 } : { tier: pos.tier, level: pos.level + 1 };
  const timer = useContext(PuzzleTimer);
  return (
    <div className="px-1" data-testid="path-card">
      <div className="flex items-baseline gap-2">
        <span className="text-[24px] leading-none font-extrabold tabular-nums">{points.toLocaleString('en-US')}</span>
        {gain ? <span className="text-[14px] font-extrabold text-[#81b64c] tabular-nums">+{gain}</span> : null}
        <StreakFlame streak={streak} size={15} className="self-center" />
        <span className="ml-auto flex items-center gap-3 self-center">
          {rating != null && (
            <span className="text-xs text-stone-500 tabular-nums">
              Rating {rating}
              {ratingDelta ? ` (${ratingDelta > 0 ? '+' : ''}${ratingDelta})` : ''}
            </span>
          )}
          {timer}
        </span>
      </div>
      <div className="relative mt-2.5 mr-3">
        <div className="h-3 overflow-hidden rounded-full bg-[#43403d]">
          <div className="h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" style={{ width: `${Math.max(2, (pos.into / pos.cost) * 100)}%`, background: 'linear-gradient(90deg,#fbae63,#f3913f 55%,#ec8231)' }} />
        </div>
        <PathBadge tier={next.tier} level={next.level} size={34} className="absolute top-1/2 -right-4 -translate-y-1/2" />
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span>
          <b>{boardName(pos.board)}</b> <span className="text-stone-500">· Level {pos.level}</span>
        </span>
        <span className="text-stone-500 tabular-nums">
          {pos.into.toLocaleString('en-US')} / {pos.cost.toLocaleString('en-US')}
        </span>
      </div>
      {extra}
    </div>
  );
}
