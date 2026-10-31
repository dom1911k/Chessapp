// The game's moves as a numbered table (white | black), like on chess.com. Tap a move to see
// the position after it; the arrows step through the game.
import { useEffect, useRef } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlyRecord } from '../lib/store/types';

/** Chess notation with little piece symbols instead of letters (Nf3 → ♘f3). */
const FIGURINE: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
export const figurine = (san: string) => san.replace(/^[KQRBN]/, (c) => FIGURINE[c]).replace(/=([QRBN])/, (_, c: string) => `=${FIGURINE[c]}`);

/** `view`: index of the ply whose position is shown (-1 = start), or null when following the game. */
export function MoveHistory({ plies, startFen, view, onView }: { plies: PlyRecord[]; startFen: string; view: number | null; onView: (i: number | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = plies.length - 1;
  const shown = view ?? last;
  useEffect(() => {
    const el = ref.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest' });
    else if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [shown, plies.length]);

  const startNo = Number(startFen.split(' ')[5] ?? 1);
  const blackFirst = startFen.split(' ')[1] === 'b';
  // Rows of [white ply index, black ply index]; -1 marks an empty cell.
  const rows: [number, number][] = [];
  for (let i = 0; i < plies.length; i++) {
    const slot = (i + (blackFirst ? 1 : 0)) % 2;
    if (slot === 0 || rows.length === 0) rows.push([slot === 0 ? i : -1, -1]);
    if (slot === 1) rows[rows.length - 1][1] = i;
  }
  const go = (i: number) => onView(i >= last ? null : Math.max(-1, i));
  const cell = (i: number) =>
    i < 0 ? (
      <span />
    ) : (
      <button
        data-active={shown === i}
        onClick={() => go(i)}
        className={`rounded-lg px-2 py-1 text-left font-semibold tabular-nums transition ${
          shown === i ? 'bg-brand-600 text-white shadow-sm' : 'text-stone-700 active:bg-stone-100 dark:text-stone-200 dark:active:bg-stone-800'
        }`}
      >
        {figurine(plies[i].san)}
      </button>
    );

  return (
    <div className="card flex min-h-0 flex-col !p-0">
      <div className="flex items-center justify-between border-b border-stone-100 px-3 py-1.5 dark:border-stone-800">
        <span className="text-[11px] font-bold tracking-[0.08em] text-stone-500 uppercase">Moves</span>
        <div className="flex items-center">
          {[
            { icon: <ChevronFirst size={20} />, label: 'First position', to: -1, off: shown <= -1 },
            { icon: <ChevronLeft size={20} />, label: 'Previous move', to: shown - 1, off: shown <= -1 },
            { icon: <ChevronRight size={20} />, label: 'Next move', to: shown + 1, off: shown >= last },
            { icon: <ChevronLast size={20} />, label: 'Latest move', to: last, off: shown >= last },
          ].map((b) => (
            <button key={b.label} aria-label={b.label} disabled={b.off} onClick={() => go(b.to)} className="rounded-lg p-1.5 text-stone-600 active:bg-stone-100 disabled:opacity-25 dark:text-stone-300 dark:active:bg-stone-800">
              {b.icon}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {rows.length === 0 && <p className="px-1 py-2 text-sm text-stone-400">No moves yet — your turn to start.</p>}
        <div className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-x-1 gap-y-0.5 text-[15px]">
          {rows.map(([w, b], r) => (
            <div key={r} className="contents">
              <span className="text-sm text-stone-400 tabular-nums">{startNo + r}.</span>
              {cell(w)}
              {cell(b)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
