// Playtest tools (long-press the Cups title): grant Laurels, and the cup tools added by later stages.
import type { ReactNode } from 'react';
import { useCupsMeta } from '../meta';
import { Sheet } from './Sheet';

export const devBtn = 'run-sans rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold ring-1 ring-white/15 active:bg-white/20';

export function DevPanel({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
  const meta = useCupsMeta();
  return (
    <Sheet onClose={onClose}>
        <div className="flex items-center justify-between">
          <div className="run-title text-lg font-bold">Dev panel</div>
          <button className={devBtn} onClick={onClose}>Close</button>
        </div>
        <div className="run-label mt-3">Laurels · {meta.laurels}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <button className={devBtn} onClick={() => void meta.addLaurels(5)}>+5 Laurels</button>
          <button className={devBtn} onClick={() => void meta.addLaurels(-meta.laurels)}>Reset Laurels</button>
        </div>
        {children}
    </Sheet>
  );
}
