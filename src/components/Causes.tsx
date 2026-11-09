// "Why your mistakes happened": the causes behind your mistakes as bars, plus the timing flags
// and the one habit to work on.
import { Clock3, Crosshair, Eye, Footprints, Hourglass, Puzzle, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { CAUSES, CAUSE_INFO, type Cause, type CauseReport } from '../lib/games/causes';

const ICON: Record<Cause | 'fast' | 'timeTrouble', ReactNode> = {
  missedThreat: <Eye size={15} />,
  hungPiece: <Crosshair size={15} />,
  missedTactic: <Puzzle size={15} />,
  calculation: <Footprints size={15} />,
  plan: <Zap size={15} />,
  fast: <Clock3 size={15} />,
  timeTrouble: <Hourglass size={15} />,
};
const COLOR: Record<Cause, string> = {
  missedThreat: 'bg-red-500',
  hungPiece: 'bg-orange-500',
  missedTactic: 'bg-amber-500',
  calculation: 'bg-violet-500',
  plan: 'bg-sky-500',
};

export function CauseIcon({ c }: { c: Cause | 'fast' | 'timeTrouble' }) {
  return <>{ICON[c]}</>;
}

export function CauseBreakdown({ r, title = 'Why your mistakes happened', bare = false }: { r: CauseReport; title?: string; bare?: boolean }) {
  if (!r.mistakes) return null;
  const max = Math.max(1, ...CAUSES.map((c) => r.totals[c]));
  return (
    <div className={bare ? '' : 'card !p-3'}>
      {!bare && <div className="mb-2 section-title">{title}</div>}
      <div className="space-y-1.5">
        {CAUSES.filter((c) => r.totals[c] > 0).sort((a, b) => r.totals[b] - r.totals[a]).map((c) => (
          <div key={c} className="grid grid-cols-[1.25rem_8.5rem_1fr_1.5rem] items-center gap-2 text-sm">
            <span className="text-stone-500">{ICON[c]}</span>
            <span className="truncate">{CAUSE_INFO[c].label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
              <span className={`block h-full rounded-full ${COLOR[c]}`} style={{ width: `${(r.totals[c] / max) * 100}%` }} />
            </span>
            <span className="text-right font-bold tabular-nums">{r.totals[c]}</span>
          </div>
        ))}
      </div>
      {(r.totals.fast > 0 || r.totals.timeTrouble > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.totals.fast > 0 && <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{ICON.fast} {r.totals.fast} played in a few seconds</span>}
          {r.totals.timeTrouble > 0 && <span className="chip bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">{ICON.timeTrouble} {r.totals.timeTrouble} in time trouble</span>}
        </div>
      )}
      {r.top && (
        <p className="mt-2.5 rounded-xl bg-stone-100 px-3 py-2 text-[13px] leading-snug dark:bg-white/[0.05]">
          <b>Work on this:</b> {CAUSE_INFO[r.top.cause].tip}
          {r.totals.fast >= Math.max(2, r.mistakes * 0.4) && <> {CAUSE_INFO.fast.tip}</>}
        </p>
      )}
    </div>
  );
}
