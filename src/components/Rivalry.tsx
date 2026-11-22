// Your rivalry with one opponent: a level that keeps growing with every game, and eight
// matchup badges to collect against them.
import { useState } from 'react';
import { Check, ChevronDown, Swords } from 'lucide-react';
import { opponentById } from '../lib/people';
import { rpOf, type OpponentRecord } from '../lib/people/record';
import { BADGES, rivalryLevel, rivalryRank } from '../lib/people/rivalry';

/** Small "Rivalry 4" chip. */
export function RivalryChip({ rec, className = '' }: { rec?: OpponentRecord; className?: string }) {
  const lv = rivalryLevel(rpOf(rec)).level;
  if (!rec || rec.w + rec.d + rec.l === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-hue-rose-600/90 px-1.5 py-px text-[11px] font-bold text-white tabular-nums ${className}`}>
      <Swords size={10} strokeWidth={2.6} /> {lv}
    </span>
  );
}

/**
 * Your rivalry with the opponent on Home: one compact row (level, progress, the next badge) that
 * opens to the eight badges and how points are earned.
 */
export function RivalryCard({ opponentId, rec }: { opponentId: string; rec?: OpponentRecord }) {
  const [open, setOpen] = useState(false);
  const o = opponentById(opponentId);
  if (!o) return null;
  const lv = rivalryLevel(rpOf(rec));
  const games = rec ? rec.w + rec.d + rec.l : 0;
  const held = new Set(rec?.badges ?? []);
  const next = BADGES.find((b) => !held.has(b.id));
  return (
    <div className="card !p-0">
      <button className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:brightness-95" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="rivalry">
        <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-[8px] bg-hue-rose-600 text-white">
          <span className="text-[11px] leading-none font-bold tracking-wider uppercase opacity-80">Lv</span>
          <span className="text-[15px] leading-none font-extrabold tabular-nums">{lv.level}</span>
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] font-bold">
            Rivalry with {o.name} · {games ? rivalryRank(lv.level) : `Lv ${lv.level}`} <span className="font-semibold text-stone-500 tabular-nums">· {lv.into}/{lv.span}</span>
          </span>
          {games > 0 ? (
            <span className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                <span className="block h-full rounded-full bg-hue-rose-500 transition-[width] duration-700" style={{ width: `${Math.max(3, (lv.into / lv.span) * 100)}%` }} />
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-stone-500 tabular-nums">{rec!.w}W · {rec!.d}D · {rec!.l}L</span>
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-xs text-stone-500">{next ? `Next badge: ${next.label}` : 'All eight badges'}</span>
          )}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-fade-in px-3.5 pb-3.5">
          <div className="grid grid-cols-4 gap-1.5">
            {BADGES.map((b) => {
              const on = held.has(b.id);
              return (
                <span key={b.id} title={b.hint} className={`flex flex-col items-center gap-1 rounded-[8px] px-1 py-1.5 text-center ${on ? 'bg-hue-rose-50 dark:bg-hue-rose-500/10' : 'bg-stone-100 dark:bg-white/[0.04]'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full ${on ? 'bg-hue-rose-600 text-white' : 'ring-2 ring-stone-300 dark:ring-stone-600'}`}>{on && <Check size={12} strokeWidth={4} />}</span>
                  <span className={`text-[11px] leading-tight font-semibold ${on ? 'text-hue-rose-700 dark:text-hue-rose-300' : 'text-stone-500'}`}>{b.label}</span>
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Every finished game counts: win 3, draw 2, loss 1, and one more for a win without help. Each badge adds 3. {next ? `Next badge: ${next.hint.toLowerCase()}.` : 'All eight badges — a complete rivalry.'}
          </p>
        </div>
      )}
    </div>
  );
}
