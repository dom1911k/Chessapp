// The Puzzle Path's small pieces, used everywhere: the level badge (chess.com's tilted puzzle
// piece in the board's material), the Daily Solver dots, the streak flame and the path card
// (total points, the orange bar with the next level's badge, "Wood · Level 4  170 / 175").
import { forwardRef, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { odo, reg, usePathUi } from '../../lib/puzzles/pathUi';
import { boardName, levelAt } from '../../lib/puzzles/path';
import { PuzzleTimer } from '../PuzzleProgress';

export { MAT, PZ } from '../../lib/puzzles/art';
import { MAT, PZ, TROPHY_H, TROPHY_W, trophyMarkup } from '../../lib/puzzles/art';
import { ISO } from '../../lib/puzzles/world';

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
            <path d={PZ} fill={on ? '#c98608' : '#2b2927'} className={on ? '' : 'fill-[#b3ada6] dark:fill-[#2b2927]'} transform="translate(0,3)" />
            <path d={PZ} fill={on ? '#f7c631' : '#4b4847'} className={on ? '' : 'fill-[#d3cec8] dark:fill-[#4b4847]'} />
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
        <div className="h-3 overflow-hidden rounded-full bg-[#dcd9d4] dark:bg-[#43403d]">
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

/** "Your pawn has tiles to walk": on the Path's entry points while `seen` is behind your level. */
export function GreenDot({ className = '' }: { className?: string }) {
  return <span className={`absolute h-2.5 w-2.5 rounded-full bg-[#81b64c] ring-2 ring-white dark:ring-[#262522] ${className}`} data-testid="path-dot" />;
}

// ---------- Live pieces: they follow the tally's beats (usePathUi) ----------

/** The header badge (flips when the bar crosses a level). */
export function LiveCrest({ size = 32, onClick }: { size?: number; onClick?: () => void }) {
  const points = usePathUi((s) => s.points);
  const behind = usePathUi((s) => s.behind);
  const pos = levelAt(points);
  return (
    <button ref={reg('crest')} className="relative block [perspective:400px]" onClick={onClick} aria-label="Puzzle path" data-testid="path-crest">
      <PathBadge tier={pos.tier} level={pos.level} size={size} />
      {behind && <GreenDot className="-top-0.5 -right-1" />}
    </button>
  );
}
export function LiveDots() {
  const daily = usePathUi((s) => s.daily);
  return (
    <span ref={reg('dots')} className="flex items-center gap-0.5" aria-label={`Daily Solver ${Math.min(daily, 3)} of 3`} data-testid="solver-dots">
      {[0, 1, 2].map((i) => {
        const on = i < daily;
        return (
          <svg key={i} width="17" height="17" viewBox="0 0 60 60" className={on ? 'drop-shadow-[0_0_3px_rgba(247,198,49,0.55)]' : ''}>
            <path d={PZ} fill={on ? '#c98608' : '#2b2927'} className={on ? '' : 'fill-[#b3ada6] dark:fill-[#2b2927]'} transform="translate(0,3)" />
            <path d={PZ} fill={on ? '#f7c631' : '#4b4847'} className={on ? '' : 'fill-[#d3cec8] dark:fill-[#4b4847]'} />
          </svg>
        );
      })}
    </span>
  );
}
export function LiveFlame({ size = 20, card = false }: { size?: number; card?: boolean }) {
  const streak = usePathUi((s) => s.streak);
  return <StreakFlame ref={reg(card ? 'cardFlame' : 'flame')} streak={streak} size={size} />;
}

/** The points card during and after a tally: odometer, "+N", streak, rating; the bar; level line. */
export function LivePathCard({ rating, ratingDelta, onTap, extra }: { rating?: number | null; ratingDelta?: number | null; onTap?: () => void; extra?: ReactNode }) {
  const points = usePathUi((s) => s.points);
  const gain = usePathUi((s) => s.gain);
  const pos = levelAt(points);
  const next = pos.level === 20 ? { tier: Math.min(7, pos.board + 1), level: 1 } : { tier: pos.tier, level: pos.level + 1 };
  const timer = useContext(PuzzleTimer);
  const total = useRef<HTMLSpanElement | null>(null);
  // At rest the odometer shows the UI points (the tally rolls it itself).
  useEffect(() => odo(total.current, points), [points]);
  return (
    <div className="px-1" onClick={onTap} data-testid="path-card">
      <div className="flex items-baseline gap-2">
        <span
          ref={(el) => {
            total.current = el;
            reg('total')(el);
          }}
          className="odo inline-block origin-left text-[24px] leading-none font-extrabold tabular-nums"
          data-testid="path-total"
        />
        <span ref={reg('gain')} className={`inline-block text-[14px] font-extrabold text-[#81b64c] tabular-nums ${gain ? '' : 'opacity-0'}`} data-testid="path-gain">
          +{gain}
        </span>
        <span className="self-center">
          <LiveFlame size={15} card />
        </span>
        <span className="ml-auto flex items-center gap-3 self-center">
          {rating != null && (
            <span className="text-xs text-stone-500 tabular-nums" data-testid="path-rating">
              Rating {rating}
              {ratingDelta ? ` (${ratingDelta > 0 ? '+' : ''}${ratingDelta})` : ''}
            </span>
          )}
          {timer}
        </span>
      </div>
      <div className="relative mt-2.5 mr-3">
        <div ref={reg('track')} className="relative h-3 overflow-hidden rounded-full bg-[#dcd9d4] dark:bg-[#43403d]">
          <div ref={reg('fill')} className="relative h-full overflow-hidden rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" style={{ width: `${Math.max(2, (pos.into / pos.cost) * 100)}%`, background: 'linear-gradient(180deg,#fbae63,#f3913f 60%,#ec8231)' }}>
            <span ref={reg('sweep')} className="pp-sweep" />
          </div>
        </div>
        <span ref={reg('endBadge')} className="absolute top-1/2 -right-4 -translate-y-1/2">
          <PathBadge tier={next.tier} level={next.level} size={34} />
        </span>
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span>
          <b>{boardName(pos.board)}</b> <span className="text-stone-500">· Level {pos.level}</span>
        </span>
        <span ref={reg('tonext')} className="text-stone-500 tabular-nums" data-testid="path-tonext">
          {pos.into.toLocaleString('en-US')} / {pos.cost.toLocaleString('en-US')}
        </span>
      </div>
      {extra}
    </div>
  );
}

/** A finished board's trophy (the board-complete moment and the Path's trophy card). */
export function BoardTrophy({ board, size = 170, className = '' }: { board: number; size?: number; className?: string }) {
  const u = `bt${useId().replace(/[^a-z0-9]/gi, '')}`;
  const t = Math.min(7, board);
  return <svg className={`overflow-visible ${className}`} width={size} height={(size * TROPHY_H) / TROPHY_W} viewBox={`0 0 ${TROPHY_W} ${TROPHY_H}`} role="img" aria-label={`${boardName(board)} trophy`} dangerouslySetInnerHTML={{ __html: trophyMarkup(t, boardName(board), ISO.TH[t], u) }} />;
}
