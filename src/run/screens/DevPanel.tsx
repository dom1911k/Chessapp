// Playtest tools (long-press the room title or the Run logo): skip room, gold, relics,
// consumables, Composure, restart, and copy the playtest log.
import { useState } from 'react';
import { allPlaytests } from '../db';
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
      </div>
    </div>
  );
}
