// Board effects for puzzles: a tick or cross on the square you moved to, a golden burst when
// a puzzle is solved, and a big banner for streak milestones.
import type { CSSProperties } from 'react';
import { Flame } from 'lucide-react';

export type SquareMark = { id: number; sq: string; ok: boolean };

function at(sq: string, orientation: 'white' | 'black'): CSSProperties {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  return { left: `${(col + 0.5) * 12.5}%`, top: `${(row + 0.5) * 12.5}%` };
}

/** ✓ / ✗ badge in the corner of a square. */
export function MoveMark({ mark, orientation }: { mark: SquareMark; orientation: 'white' | 'black' }) {
  const p = at(mark.sq, orientation);
  return (
    <span
      className={`animate-mark pointer-events-none absolute z-20 flex h-[7%] w-[7%] items-center justify-center rounded-full text-[min(3.6vw,18px)] font-black text-white shadow-lg ring-2 ring-white ${
        mark.ok ? 'bg-emerald-500' : 'bg-rose-500'
      }`}
      style={{ left: `calc(${p.left} + 3.6%)`, top: `calc(${p.top} - 3.6%)` }}
    >
      {mark.ok ? '✓' : '✕'}
    </span>
  );
}

/** Golden sparks from the final square, brighter for longer streaks. */
export function SolveBurst({ sq, orientation, power = 1, id }: { sq: string; orientation: 'white' | 'black'; power?: number; id: number }) {
  const p = at(sq, orientation);
  const n = 10 + Math.min(power, 5) * 3;
  const colors = power >= 5 ? ['#f472b6', '#c084fc', '#fde68a'] : power >= 3 ? ['#fb923c', '#fde68a', '#f87171'] : ['#fde68a', '#34d399', '#fbbf24'];
  return (
    <div data-burst={id} className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-md">
      <span className="animate-flash-ring absolute h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ ...p, boxShadow: `0 0 0 4px ${colors[0]}, 0 0 28px 10px ${colors[1]}` }} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const d = 60 + (i % 3) * 22 + power * 6;
        return (
          <span
            key={i}
            className="animate-flash-spark absolute h-2.5 w-2.5 rounded-full"
            style={{ ...p, background: colors[i % colors.length], '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, animationDelay: `${(i % 4) * 25}ms` } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

/** "On fire!" style banner across the board. */
export function ComboBanner({ streak, id }: { streak: number; id: number }) {
  const tier = streak >= 10 ? { text: 'Unstoppable!', bg: 'from-fuchsia-500 to-purple-600' } : streak >= 5 ? { text: 'On fire!', bg: 'from-orange-500 to-rose-600' } : { text: 'Hot streak!', bg: 'from-amber-400 to-orange-500' };
  return (
    <div data-combo={id} className="pointer-events-none absolute inset-x-0 top-[38%] z-30 flex justify-center">
      <span className={`animate-flash-banner flex items-center gap-2 rounded-2xl bg-gradient-to-r ${tier.bg} px-5 py-2 font-display text-2xl font-bold text-white shadow-2xl ring-2 ring-white/70`}>
        <Flame size={24} className="fill-white/40" /> {tier.text} <span className="rounded-lg bg-white/25 px-2 text-xl">×{streak}</span>
      </span>
    </div>
  );
}
