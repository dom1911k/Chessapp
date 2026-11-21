import { material, type PieceKind } from '../lib/chess/material';
import { useSettings } from '../lib/settings';
import { isImageSet, PieceIcon, type PieceCode } from './PieceIcon';

const ORDER: PieceKind[] = ['p', 'n', 'b', 'r', 'q'];

/**
 * The pieces one side has taken, chess.com style: small, grouped by kind (pawns first, overlapping
 * within a group) plus "+N" when that side is ahead. `side` is the capturer; the icons are the
 * other colour's pieces, in the chosen piece set. Vector sets get a thin outline in the
 * contrasting colour so dark pieces stay visible in dark mode (image sets have their own).
 */
export function Captured({ fen, startFen, side, className = '' }: { fen: string; startFen: string; side: 'w' | 'b'; className?: string }) {
  const style = useSettings((s) => s.pieceStyle);
  const { lost, diff } = material(fen, startFen);
  const victim = side === 'w' ? 'b' : 'w';
  const taken = lost[victim];
  const lead = side === 'w' ? diff : -diff;
  if (!taken.length && lead <= 0) return <div className={`h-5 ${className}`} />;
  const groups = ORDER.map((k) => ({ k, n: taken.filter((t) => t === k).length })).filter((g) => g.n > 0);
  const key = (k: string) => `${victim}${k.toUpperCase()}` as PieceCode;
  // Outline: dark pieces get a light halo in dark mode; light pieces a soft dark rim in light mode.
  const outline = isImageSet(style)
    ? ''
    : victim === 'b'
      ? 'dark:[filter:drop-shadow(1px_0_0_#e4e2df)_drop-shadow(-1px_0_0_#e4e2df)_drop-shadow(0_1px_0_#e4e2df)_drop-shadow(0_-1px_0_#e4e2df)]'
      : '[filter:drop-shadow(0_0_0.6px_rgba(0,0,0,0.55))] dark:[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.6))]';
  return (
    <div className={`flex h-5 items-center gap-1 ${className}`} aria-label={`Captured ${taken.length} piece${taken.length === 1 ? '' : 's'}`}>
      {groups.map((g) => (
        <span key={g.k} className={`flex ${outline}`}>
          {Array.from({ length: g.n }, (_, i) => (
            <span key={i} className="h-[18px] w-[18px]" style={{ marginLeft: i ? -10 : 0 }}>
              <PieceIcon code={key(g.k)} setId={style} />
            </span>
          ))}
        </span>
      ))}
      {lead > 0 && <span className="ml-0.5 text-xs font-bold text-stone-600 tabular-nums dark:text-stone-300">+{lead}</span>}
    </div>
  );
}
