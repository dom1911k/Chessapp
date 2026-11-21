import { useEffect, useRef } from 'react';
import type { ReviewClass } from '../lib/review';
import type { PlyRecord } from '../lib/store/types';
import { ReviewIcon } from './ReviewIcon';

/** The class worth a badge in a move strip (same rule as Game Review's): brilliant, great and the slips. */
export function stripClass(p: PlyRecord): ReviewClass | null {
  if (!p.isUser) return null;
  if (p.special) return p.special;
  const c = p.classification;
  return c === 'inaccuracy' || c === 'mistake' || c === 'blunder' ? c : null;
}

/** The moves so far in one scrolling line, chess.com style: tap a move to look back at it. */
export function MoveList({ plies, startFen, current, onSelect }: { plies: PlyRecord[]; startFen: string; current?: number; onSelect?: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]') as HTMLElement | null;
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center' });
    else el.scrollLeft = el.scrollWidth;
  }, [plies.length, current]);
  const startNo = Number(startFen.split(' ')[5] ?? 1);
  const blackFirst = startFen.split(' ')[1] === 'b';
  return (
    <div
      ref={ref}
      className="no-scrollbar flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto px-3 text-[14px] whitespace-nowrap [mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]"
    >
      {plies.length === 0 && <span className="px-1 text-[13px] text-stone-500">No moves yet</span>}
      {plies.map((p, i) => {
        const idx = i + (blackFirst ? 1 : 0);
        const no = startNo + Math.floor(idx / 2);
        const showNo = idx % 2 === 0 || i === 0;
        const cls = stripClass(p);
        const viewed = current === i;
        const latest = current === undefined && i === plies.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {showNo && <span className={`text-[12px] font-semibold tabular-nums text-stone-500 ${i ? 'ml-1.5' : ''}`}>{no}{idx % 2 === 0 ? '.' : '…'}</span>}
            <button
              data-active={viewed || latest}
              onClick={() => onSelect?.(i)}
              className={`flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-semibold transition-colors ${
                viewed
                  ? 'bg-brand-500 font-bold text-white'
                  : latest
                    ? 'bg-black/[0.08] font-bold text-stone-900 dark:bg-white/[0.12] dark:text-white'
                    : 'text-stone-700 active:bg-black/5 dark:text-stone-300 dark:active:bg-white/5'
              }`}
            >
              {cls && <ReviewIcon cls={cls} size={14} />}
              {p.san}
            </button>
          </span>
        );
      })}
    </div>
  );
}
