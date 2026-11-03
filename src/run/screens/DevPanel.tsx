// Playtest tools (long-press the room title or the Run logo): skip room, gold, relics,
// consumables, Composure, restart, and copy the playtest log.
import { useEffect, useState } from 'react';
import { allPlaytests, allRuns } from '../db';
import { TUNING as T } from '../tuning';
import type { Playtest, Run } from '../types';
import { CONSUMABLES, RELICS } from '../content';
import { ALL_CONSUMABLES, ALL_RELICS } from '../rules';
import { useRun } from '../store';

export function DevPanel({ onClose }: { onClose: () => void }) {
  const s = useRun();
  const run = s.run;
  const [msg, setMsg] = useState('');
  const copy = async () => {
    const all = await allPlaytests();
    const text = JSON.stringify(all, null, 1);
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`Copied ${all.length} playtests.`);
    } catch {
      setMsg(text.slice(0, 2000));
    }
  };
  const btn = 'run-sans rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold ring-1 ring-white/15 active:bg-white/20';
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onClose}>
      <div className="run-panel max-h-[80%] w-full overflow-y-auto rounded-b-none p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="run-title text-lg font-bold">Dev panel</div>
          <button className={btn} onClick={onClose}>Close</button>
        </div>
        {run && (
          <>
            <div className="run-label mt-3">Room</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button className={btn} onClick={() => s.dev.skipRoom(true)}>Skip room (win)</button>
              <button className={btn} onClick={() => s.dev.skipRoom(false)}>Fail room</button>
              {run.phase === 'room' && (
                <button className={btn} onClick={() => (onClose(), setTimeout(() => s.dev.fakeChain(), 150))}>
                  Fake 12-trigger chain (×mult mid-way)
                </button>
              )}
            </div>
            <div className="run-label mt-3">Resources</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <button className={btn} onClick={() => s.dev.gold(10)}>+10 gold</button>
              <span className="run-sans text-xs">Composure:</span>
              {[0, 1, 3, 5, 7].map((n) => (
                <button key={n} className={btn} onClick={() => s.dev.composure(n)}>{n}</button>
              ))}
            </div>
            <div className="run-label mt-3">Give relic</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ALL_RELICS.map((id) => (
                <button key={id} className={`${btn} ${run.relics.includes(id) ? 'opacity-40' : ''}`} onClick={() => s.dev.relic(id)}>
                  {RELICS[id].name}
                </button>
              ))}
            </div>
            <div className="run-label mt-3">Give card (ignores the carry limit)</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ALL_CONSUMABLES.map((id) => (
                <button key={id} className={btn} onClick={() => s.dev.consumable(id)}>
                  {CONSUMABLES[id].name}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="run-label mt-3">Run</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <button className={btn} onClick={() => (void s.newRun(), onClose())}>Restart run</button>
          <button className={btn} onClick={() => void copy()}>Copy playtests (JSON)</button>
        </div>
        {msg && <div className="run-sans mt-2 text-xs break-all text-[var(--ink-dim)]">{msg}</div>}
        <Stats />
      </div>
    </div>
  );
}

/** Playtest numbers: win rate per difficulty, average fun, share of time spent in rooms. */
function Stats() {
  const [data, setData] = useState<{ runs: Run[]; tests: Playtest[] } | null>(null);
  useEffect(() => {
    void Promise.all([allRuns(), allPlaytests()]).then(([runs, tests]) => setData({ runs, tests }));
  }, []);
  if (!data) return null;
  const done = data.runs.filter((r) => r.ended && !r.abandoned);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const timed = done.filter((r) => r.roomMs !== undefined && r.endedAt);
  const roomShare = timed.reduce((a, r) => a + (r.roomMs ?? 0), 0) / Math.max(1, timed.reduce((a, r) => a + (r.endedAt! - r.startedAt), 0));
  const fun = data.tests.filter((t) => t.fun > 0);
  const earned = done.reduce((a, r) => a + (r.goldEarned ?? 0), 0);
  const spent = done.reduce((a, r) => a + (r.goldSpent ?? 0), 0);
  return (
    <div className="mt-4">
      <div className="run-label">Stats ({done.length} finished runs)</div>
      <table className="run-sans mt-1 w-full text-xs">
        <tbody>
          {(Object.keys(T.difficulty) as (keyof typeof T.difficulty)[]).map((d) => {
            const rs = done.filter((r) => (r.difficulty ?? 'adept') === d);
            return (
              <tr key={d}>
                <td className="py-0.5">{T.difficulty[d].name}</td>
                <td className="text-right">
                  {rs.filter((r) => r.ended === 'won').length}/{rs.length} won · {pct(rs.filter((r) => r.ended === 'won').length, rs.length)}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="py-0.5">Average fun</td>
            <td className="text-right">{fun.length ? (fun.reduce((a, t) => a + t.fun, 0) / fun.length).toFixed(1) : '–'} ({fun.length} ratings)</td>
          </tr>
          <tr>
            <td className="py-0.5">Time in rooms</td>
            <td className="text-right">{timed.length ? `${Math.round(roomShare * 100)}%` : '–'} ({timed.length} timed runs)</td>
          </tr>
          <tr>
            <td className="py-0.5">Battlefield picks (best / ok / avg cp behind)</td>
            <td className="text-right">
              {(() => {
                const bs = done.map((r) => r.results.find((x) => x.battlefield)?.battlefield).filter((x) => !!x);
                if (!bs.length) return '–';
                return `${bs.filter((b) => b!.rank === 1).length}/${bs.length} · ${bs.filter((b) => b!.rank > 1 && b!.gold > 0).length} · ${Math.round(bs.reduce((a, b) => a + b!.lossCp, 0) / bs.length)}`;
              })()}
            </td>
          </tr>
          <tr>
            <td className="py-0.5">Gold earned / spent per run</td>
            <td className="text-right">
              {done.length ? `${Math.round(earned / done.length)} / ${Math.round(spent / done.length)}` : '–'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
