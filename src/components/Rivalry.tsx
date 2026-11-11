// Your rivalry with one opponent: a level that keeps growing with every game, and eight
// matchup badges to collect against them.
import { Check, Swords } from 'lucide-react';
import { opponentById } from '../lib/people';
import { rpOf, type OpponentRecord } from '../lib/people/record';
import { BADGES, rivalryLevel, rivalryRank } from '../lib/people/rivalry';

/** Small "Rivalry 4" chip. */
export function RivalryChip({ rec, className = '' }: { rec?: OpponentRecord; className?: string }) {
  const lv = rivalryLevel(rpOf(rec)).level;
  if (!rec || rec.w + rec.d + rec.l === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md bg-rose-600/90 px-1.5 py-px text-[11px] font-bold text-white tabular-nums ${className}`}>
      <Swords size={10} strokeWidth={2.6} /> {lv}
    </span>
  );
}

export function RivalryCard({ opponentId, rec }: { opponentId: string; rec?: OpponentRecord }) {
  const o = opponentById(opponentId);
  if (!o) return null;
  const lv = rivalryLevel(rpOf(rec));
  const games = rec ? rec.w + rec.d + rec.l : 0;
  const held = new Set(rec?.badges ?? []);
  return (
    <div className="card !p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[30%] bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_12px_-6px_rgba(190,18,60,0.7)]">
          <span className="text-[8px] leading-none font-bold tracking-wider uppercase opacity-80">Lv</span>
          <span className="font-display text-lg leading-none font-semibold tabular-nums">{lv.level}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.08em] text-rose-600 uppercase dark:text-rose-400">Rivalry with {o.name}</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold leading-tight">{rivalryRank(lv.level)}</span>
            <span className="shrink-0 text-xs text-stone-500 tabular-nums">{games ? `${rec!.w}W · ${rec!.d}D · ${rec!.l}L` : 'No games yet'}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600 transition-[width] duration-700" style={{ width: `${Math.max(3, (lv.into / lv.span) * 100)}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-stone-500 tabular-nums">{lv.into}/{lv.span}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {BADGES.map((b) => {
          const on = held.has(b.id);
          return (
            <span key={b.id} title={b.hint} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-center ${on ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-stone-100/70 dark:bg-white/[0.04]'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${on ? 'bg-rose-600 text-white' : 'ring-2 ring-stone-300 dark:ring-stone-600'}`}>{on && <Check size={12} strokeWidth={4} />}</span>
              <span className={`text-[10px] leading-tight font-semibold ${on ? 'text-rose-700 dark:text-rose-300' : 'text-stone-500'}`}>{b.label}</span>
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Every finished game counts: win 3, draw 2, loss 1, and one more for a win without help. Each badge adds 3. {held.size < BADGES.length ? `Next badge: ${BADGES.find((b) => !held.has(b.id))!.hint.toLowerCase()}.` : 'All eight badges — a complete rivalry.'}
      </p>
    </div>
  );
}
