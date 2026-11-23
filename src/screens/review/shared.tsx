// Small pieces both Game Review views use.
import { ReviewIcon } from '../../components/ReviewIcon';
import { plyTimes } from '../../lib/timestats';
import { cornerPos } from '../../lib/chess/kingBadges';
import { opponentById } from '../../lib/people';
import { type ReviewClass } from '../../lib/review';
import type { AnyGame, ImportedGame } from '../../lib/store/types';
import { useEffect, useRef } from 'react';
import { animate } from '../../lib/motion';
import { centre, emit } from '../../lib/fx';

/** Seconds per ply, when the game was played with a clock. */
export const timesOf = (g: AnyGame) => (g.clocks?.length && g.timeControl && /^\d+(\+\d+)?$/.test(g.timeControl) ? plyTimes(g.plies, g.clocks, g.timeControl) : undefined);
export const pending = (g: AnyGame) => g.source === 'chess.com' && !(g as ImportedGame).analyzed;
export const oppName = (g: AnyGame) => g.opponentName ?? opponentById(g.opponentId)?.name ?? 'Bot';

/**
 * The class icon at the top-right corner of the destination square, like chess.com — kept fully
 * inside the board on the h-file (a-file when flipped) and the top rank.
 */
export function SquareIcon({ sq, cls, orientation, small, pop = false }: { sq: string; cls: ReviewClass; orientation: 'white' | 'black'; small?: boolean; /** Stepping onto it: it pops onto the square with a twist. */ pop?: boolean }) {
  const size = small ? 15 : 22;
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (pop) void animate(el.current, [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.25) rotate(6deg)', offset: 0.6 }, { transform: 'none' }], { d: 380, e: 'ease-out' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={el} className="pointer-events-none absolute z-10" style={cornerPos(sq, orientation, size)} data-testid="square-icon">
      <ReviewIcon cls={cls} size={size} ring />
    </span>
  );
}

/** A square flaring on a notable step: teal for a brilliant (with stars), red for a blunder, orange for a mistake or miss (900ms). */
export function SquareFlash({ sq, orientation, color, stars }: { sq: string; orientation: 'white' | 'black'; color: string; stars?: string[] }) {
  const el = useRef<HTMLSpanElement>(null);
  const f = sq.charCodeAt(0) - 97;
  const rk = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - rk : rk;
  useEffect(() => {
    void animate(el.current, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { d: 900 });
    if (stars && el.current) {
      const c = centre(el.current);
      emit({ x: c.x, y: c.y, n: 16, shape: 'star', colors: stars, speed: [60, 200], life: [0.4, 0.8], size: [2.5, 5] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span
      ref={el}
      className="pointer-events-none absolute z-[5] opacity-0"
      style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%', background: `radial-gradient(circle, ${color} 0%, ${color.replace(/[\d.]+\)$/, '0)')} 72%)` }}
      data-testid="square-flash"
    />
  );
}
