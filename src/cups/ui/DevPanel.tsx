// Playtest tools (long-press the Cups title): grant Laurels, and the cup tools added by later stages.
import type { ReactNode } from 'react';
import { useCupsMeta } from '../meta';

export const devBtn = 'run-sans rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold ring-1 ring-white/15 active:bg-white/20';

export function DevPanel({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
  const meta = useCupsMeta();
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/60" onClick={onClose}>
      <div className="run-panel max-h-[80%] w-full overflow-y-auto rounded-b-none p-4" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}
