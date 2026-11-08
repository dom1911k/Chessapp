import { useEffect, useRef } from 'react';
import { CLASS_SYMBOL } from '../lib/chess/evaluation';
import type { PlyRecord } from '../lib/store/types';

const SYMBOL_COLOR: Record<string, string> = {
  inaccuracy: 'text-amber-600',
  mistake: 'text-orange-600',
  blunder: 'text-red-600',
  best: 'text-emerald-600',
  good: 'text-lime-600',
};

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
      className="no-scrollbar flex min-h-9 items-center gap-0.5 overflow-x-auto px-3 py-1 text-[13px] whitespace-nowrap [mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]"
    >
      {plies.length === 0 && <span className="px-1 text-stone-400">No moves yet</span>}
      {plies.map((p, i) => {
        const idx = i + (blackFirst ? 1 : 0);
        const no = startNo + Math.floor(idx / 2);
        const showNo = idx % 2 === 0 || i === 0;
        const cls = p.isUser && p.classification && p.classification !== 'good' && p.classification !== 'best' ? p.classification : null;
        return (
          <span key={i} className="flex items-center gap-1">
            {showNo && <span className={`text-[11px] font-semibold tabular-nums text-stone-400 ${i ? 'ml-1.5' : ''}`}>{no}{idx % 2 === 0 ? '.' : '…'}</span>}
            <button
              data-active={current === i || (current === undefined && i === plies.length - 1)}
              onClick={() => onSelect?.(i)}
              className={`rounded-md px-1.5 py-0.5 font-semibold transition-colors ${
                current === i
                  ? 'bg-brand-600 text-white shadow-sm'
                  : current === undefined && i === plies.length - 1
                    ? 'bg-stone-900/[0.07] text-stone-900 dark:bg-white/10 dark:text-white'
                    : 'text-stone-600 active:bg-stone-900/5 dark:text-stone-300 dark:active:bg-white/5'
              }`}
            >
              {p.san}
              {cls && <span className={`ml-0.5 font-bold ${current === i ? '' : SYMBOL_COLOR[cls]}`}>{CLASS_SYMBOL[cls]}</span>}
            </button>
          </span>
        );
      })}
    </div>
  );
}
