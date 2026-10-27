import { defaultPieces } from 'react-chessboard';
import { material } from '../lib/chess/material';
import { PIECE_SETS } from '../lib/rewards/looks';
import { useSettings } from '../lib/settings';

/**
 * The pieces one side has taken (small, grouped by kind) plus "+N" when that side is ahead.
 * `side` is the capturer; the icons are the other colour's pieces.
 */
export function Captured({ fen, startFen, side, className = '' }: { fen: string; startFen: string; side: 'w' | 'b'; className?: string }) {
  const style = useSettings((s) => s.pieceStyle);
  const { lost, diff } = material(fen, startFen);
  const victim = side === 'w' ? 'b' : 'w';
  const taken = lost[victim];
  const lead = side === 'w' ? diff : -diff;
  if (!taken.length && lead <= 0) return null;
  const set = PIECE_SETS[style] ?? PIECE_SETS.wood;
  const groups = taken.reduce<{ k: string; n: number }[]>((acc, k) => {
    const last = acc[acc.length - 1];
    if (last?.k === k) last.n++;
    else acc.push({ k, n: 1 });
    return acc;
  }, []);
  const key = (k: string) => `${victim}${k.toUpperCase()}` as keyof typeof defaultPieces;
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label={`Captured ${taken.length} pieces`}>
      {groups.map((g) => (
        <span key={g.k} className="flex">
          {Array.from({ length: g.n }, (_, i) => (
            <span key={i} className="h-[18px] w-[18px]" style={{ marginLeft: i ? -9 : 0, filter: set.filter?.[victim] }}>
              {defaultPieces[key(g.k)]({ fill: set.fill?.[victim] })}
            </span>
          ))}
        </span>
      ))}
      {lead > 0 && <span className="text-xs font-bold text-stone-500 tabular-nums">+{lead}</span>}
    </div>
  );
}
