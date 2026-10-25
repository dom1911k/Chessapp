import { Chess, type Square } from 'chess.js';
import { useMemo, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { isPromotion, type MoveInput } from '../lib/chess/game';
import type { CoachArrow, CoachHighlight, Tone } from '../lib/coach/types';

export const TONE_COLOR: Record<Tone, string> = {
  good: 'rgba(34, 160, 90, 0.85)',
  bad: 'rgba(225, 60, 60, 0.85)',
  info: 'rgba(60, 120, 230, 0.85)',
};
const TONE_BG: Record<Tone, string> = {
  good: 'rgba(34, 197, 94, 0.45)',
  bad: 'rgba(239, 68, 68, 0.5)',
  info: 'rgba(59, 130, 246, 0.35)',
};

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  /** Which color the user may move (null = no moves). */
  movable: 'w' | 'b' | 'both' | null;
  onMove?: (m: MoveInput) => boolean;
  arrows?: CoachArrow[];
  highlights?: CoachHighlight[];
  lastMove?: { from: string; to: string } | null;
  showCoordinates?: boolean;
}

const PROMO = ['q', 'r', 'b', 'n'] as const;
const PROMO_GLYPH: Record<string, [string, string]> = { q: ['♕', '♛'], r: ['♖', '♜'], b: ['♗', '♝'], n: ['♘', '♞'] };

export function Board({ fen, orientation, movable, onMove, arrows = [], highlights = [], lastMove, showCoordinates = true }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const canMove = movable === 'both' || movable === turn;

  const targets = useMemo(() => {
    if (!selected) return [];
    return chess.moves({ square: selected as Square, verbose: true });
  }, [chess, selected]);

  const attempt = (from: string, to: string): boolean => {
    if (!canMove || !onMove) return false;
    const legal = chess.moves({ square: from as Square, verbose: true }).some((m) => m.to === to);
    if (!legal) return false;
    if (isPromotion(fen, from, to)) {
      setPromo({ from, to });
      return false;
    }
    setSelected(null);
    return onMove({ from, to });
  };

  const ownPiece = (sq: string) => {
    const p = chess.get(sq as Square);
    return !!p && p.color === turn && canMove;
  };

  const onSquareClick = ({ square }: { square: string }) => {
    if (promo) return;
    if (selected && selected !== square && targets.some((m) => m.to === square)) {
      attempt(selected, square);
      return;
    }
    setSelected(ownPiece(square) && selected !== square ? square : null);
  };

  const squareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { background: 'rgba(250, 204, 21, 0.35)' };
    squareStyles[lastMove.to] = { background: 'rgba(250, 204, 21, 0.45)' };
  }
  for (const h of highlights) squareStyles[h.sq] = { ...squareStyles[h.sq], boxShadow: `inset 0 0 0 4px ${TONE_COLOR[h.tone]}`, background: TONE_BG[h.tone] };
  if (chess.inCheck()) {
    const k = chess.board().flat().find((p) => p?.type === 'k' && p.color === turn);
    if (k) squareStyles[k.square] = { ...squareStyles[k.square], background: 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.4) 55%, transparent 75%)' };
  }
  if (selected) {
    squareStyles[selected] = { ...squareStyles[selected], background: 'rgba(250, 204, 21, 0.6)' };
    for (const m of targets) {
      squareStyles[m.to] = {
        ...squareStyles[m.to],
        background: m.captured
          ? 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.28) 60%)'
          : 'radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 24%)',
      };
    }
  }

  return (
    <div className="relative w-full touch-none select-none">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          showNotation: showCoordinates,
          allowDrawingArrows: false,
          arrows: arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: TONE_COLOR[a.tone] })),
          squareStyles,
          animationDurationInMs: 180,
          darkSquareStyle: { backgroundColor: '#7c9a6a' },
          lightSquareStyle: { backgroundColor: '#eeeed2' },
          boardStyle: { borderRadius: '6px', overflow: 'hidden' },
          dragActivationDistance: 6,
          canDragPiece: ({ square }) => !!square && ownPiece(square),
          onPieceDrag: ({ square }) => square && setSelected(square),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || sourceSquare === targetSquare) return false;
            return attempt(sourceSquare, targetSquare);
          },
          onSquareClick,
        }}
      />
      {promo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40" onClick={() => setPromo(null)}>
          <div className="flex gap-2 rounded-2xl bg-white p-3 shadow-xl dark:bg-stone-800">
            {PROMO.map((p) => (
              <button
                key={p}
                className="h-14 w-14 rounded-xl bg-stone-100 text-4xl leading-none dark:bg-stone-700"
                onClick={(e) => {
                  e.stopPropagation();
                  const m = { ...promo, promotion: p };
                  setPromo(null);
                  setSelected(null);
                  onMove?.(m);
                }}
              >
                {PROMO_GLYPH[p][turn === 'w' ? 0 : 1]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
