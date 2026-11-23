// Entry points for "Where did it turn?": the once-a-day prompt, the waiting list, the stat line.
import { useEffect, useState } from 'react';
import { Crosshair, X } from 'lucide-react';
import { useNav } from '../lib/nav';
import { allGames } from '../lib/games';
import { getTurning, markPrompted, promptFor, turningStats, waiting, type TurningState } from '../lib/turning';
import { today } from '../lib/db';
import { opponentById } from '../lib/people';
import type { AnyGame } from '../lib/store/types';
import { getRematchRecords, type RematchRecord } from '../lib/rematch';
import { onChange } from '../lib/changes';

const who = (g: AnyGame) => g.opponentName ?? opponentById(g.opponentId)?.name ?? 'Bot';
const when = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Home: at most once a day, offer the newest lost game with a clear turning point. */
export function TurningPrompt() {
  const push = useNav((s) => s.push);
  const [g, setG] = useState<AnyGame | null>(null);
  useEffect(() => {
    void Promise.all([allGames({ includeUnanalyzed: true }), getTurning()]).then(([gs, s]) => {
      const pick = promptFor(gs, s);
      if (pick) { setG(pick); void markPrompted(today()); }
    });
  }, []);
  if (!g) return null;
  return (
    <div className="card flex items-center gap-3 !p-3" data-testid="turning-prompt">
      <Crosshair size={20} className="shrink-0 text-brand-700" />
      <button className="min-w-0 flex-1 text-left text-sm" onClick={() => push({ name: 'turning', gameId: g.id! })}>
        <b>Where did it turn?</b> <span className="text-stone-500">(10 s)</span>
        <span className="block truncate text-xs text-stone-500">Your loss vs {who(g)} · {when(g.endedAt)}</span>
      </button>
      <button className="btn-primary !px-3 !py-1.5 text-sm" onClick={() => push({ name: 'turning', gameId: g.id! })}>Try</button>
      <button aria-label="Not now" className="text-stone-400" onClick={() => setG(null)}><X size={16} /></button>
    </div>
  );
}

/** Past games: lost games still waiting for a quick self-review. */
export function TurningList() {
  const push = useNav((s) => s.push);
  const [list, setList] = useState<AnyGame[]>([]);
  useEffect(() => void Promise.all([allGames({ includeUnanalyzed: true }), getTurning()]).then(([gs, s]) => setList(waiting(gs, s).slice(0, 5))), []);
  if (!list.length) return null;
  return (
    <div className="card !p-0" data-testid="turning-list">
      <div className="px-3.5 pt-3 section-title">Where did it turn? <span className="font-normal text-stone-500">(10 s each)</span></div>
      {list.map((g) => (
        <button key={String(g.id)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm press" onClick={() => push({ name: 'turning', gameId: g.id! })}>
          <Crosshair size={15} className="shrink-0 text-brand-700" />
          <span className="flex-1 truncate">Lost vs {who(g)} · {when(g.endedAt)}</span>
          <span className="text-xs font-semibold text-brand-700 dark:text-brand-500">Try</span>
        </button>
      ))}
    </div>
  );
}

/** Progress: "Found the turning point in X of your last 10". */
export function TurningStat() {
  const [s, setS] = useState<TurningState | null>(null);
  useEffect(() => void getTurning().then(setS), []);
  if (!s || !s.results.length) return null;
  const st = turningStats(s);
  return (
    <div className="card !p-3 text-sm" data-testid="turning-stat">
      <div className="section-title">Where did it turn?</div>
      <p>Found the turning point in <b>{st.found} of your last {st.of}</b>{st.of < 10 ? ' games' : ''}.</p>
      {st.chipOf > 0 && <p className="text-xs text-stone-500">Your reason matched the engine's {st.chipMatched} of {st.chipOf} times.</p>}
    </div>
  );
}

/** Progress: your rematches against chess.com opponents' stand-ins, per opponent. */
export function RematchRecords() {
  const [recs, setRecs] = useState<Record<string, RematchRecord> | null>(null);
  useEffect(() => {
    void getRematchRecords().then(setRecs);
    return onChange('records', () => void getRematchRecords().then(setRecs));
  }, []);
  const rows = Object.entries(recs ?? {}).sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l));
  if (!rows.length) return null;
  return (
    <div className="card !p-3 text-sm" data-testid="rematch-records">
      <div className="section-title">Rematches (chess.com stand-ins)</div>
      {rows.map(([name, r]) => (
        <div key={name} className="flex justify-between py-0.5">
          <span className="truncate">{name}</span>
          <span className="font-semibold tabular-nums">{r.w}W · {r.d}D · {r.l}L</span>
        </div>
      ))}
    </div>
  );
}
