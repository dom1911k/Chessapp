import { defaultPieces } from 'react-chessboard';
import { material, type PieceKind } from '../lib/chess/material';
import { PIECE_SETS } from '../lib/rewards/looks';
import { useSettings } from '../lib/settings';

const ORDER: PieceKind[] = ['p', 'n', 'b', 'r', 'q'];

/**
 * The pieces one side has taken, chess.com style: small, grouped by kind (pawns first, overlapping
 * within a group) plus "+N" when that side is ahead. `side` is the capturer; the icons are the
 * other colour's pieces. Every piece gets a thin outline in the contrasting colour so dark pieces
 * stay visible in dark mode and light pieces on light backgrounds.
 */
export function Captured({ fen, startFen, side, className = '' }: { fen: string; startFen: string; side: 'w' | 'b'; className?: string }) {
  const style = useSettings((s) => s.pieceStyle);
  const { lost, diff } = material(fen, startFen);
  const victim = side === 'w' ? 'b' : 'w';
  const taken = lost[victim];
  const lead = side === 'w' ? diff : -diff;
  if (!taken.length && lead <= 0) return <div className={`h-5 ${className}`} />;
  const set = PIECE_SETS[style] ?? PIECE_SETS.wood;
  const groups = ORDER.map((k) => ({ k, n: taken.filter((t) => t === k).length })).filter((g) => g.n > 0);
  const key = (k: string) => `${victim}${k.toUpperCase()}` as keyof typeof defaultPieces;
  // Outline: dark pieces get a light halo in dark mode; light pieces a soft dark rim in light mode.
  const outline =
    victim === 'b'
      ? 'dark:[filter:drop-shadow(1px_0_0_#e7ded0)_drop-shadow(-1px_0_0_#e7ded0)_drop-shadow(0_1px_0_#e7ded0)_drop-shadow(0_-1px_0_#e7ded0)]'
      : '[filter:drop-shadow(0_0_0.6px_rgba(0,0,0,0.55))] dark:[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.6))]';
  return (
    <div className={`flex h-5 items-center gap-1 ${className}`} aria-label={`Captured ${taken.length} piece${taken.length === 1 ? '' : 's'}`}>
      {groups.map((g) => (
        <span key={g.k} className={`flex ${outline}`}>
          {Array.from({ length: g.n }, (_, i) => (
            <span key={i} className="h-5 w-5" style={{ marginLeft: i ? -11 : 0, filter: set.filter?.[victim] }}>
              {defaultPieces[key(g.k)]({ fill: set.fill?.[victim] })}
            </span>
          ))}
        </span>
      ))}
      {lead > 0 && <span className="ml-0.5 text-xs font-bold text-stone-600 tabular-nums dark:text-stone-300">+{lead}</span>}
    </div>
  );
}
