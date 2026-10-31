// Run mode's own board: hand-drawn pixel pieces on bevelled stone tiles, pixel highlights
// (corner brackets, dots, check aura), gold frame. Same interaction as the app's board
// (tap or drag, promotion picker); normal chess rules.
import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { Chessboard, type PieceRenderObject } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import { isPromotion, type MoveInput } from '../../lib/chess/game';
import type { CoachArrow, CoachHighlight } from '../../lib/coach/types';
import { BOARD_THEMES, overlaySprite, pieceSprite, squareVariant, tileSprite, type BoardTheme, type OverlayKind } from './board';
import { useRunSettings } from '../settings';

const TYPES = ['P', 'N', 'B', 'R', 'Q', 'K'] as const;
const TONE: Record<string, string> = { good: 'rgba(94, 229, 154, 0.9)', bad: 'rgba(255, 90, 106, 0.9)', info: 'rgba(111, 211, 255, 0.9)' };
const PROMO = ['q', 'r', 'b', 'n'] as const;
const FILES = 'abcdefgh';

export const useBoardTheme = (): BoardTheme => {
  const id = useRunSettings((s) => s.board);
  return BOARD_THEMES[id] ?? BOARD_THEMES.crypt;
};

function piecesFor(theme: BoardTheme): PieceRenderObject {
  const out: PieceRenderObject = {};
  for (const c of ['w', 'b'] as const)
    for (const t of TYPES) {
      const url = pieceSprite(theme, c, t);
      out[`${c}${t}`] = () => (
        <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%', imageRendering: 'pixelated', filter: 'drop-shadow(0 2px 0 rgba(0,0,0,.5))' }} />
      );
    }
  return out;
}

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  movable: 'w' | 'b' | null;
  onMove?: (m: MoveInput) => boolean;
  arrows?: CoachArrow[];
  highlights?: CoachHighlight[];
  lastMove?: { from: string; to: string } | null;
  showCoordinates?: boolean;
  /** Small, non-interactive (debrief, shrine). */
  mini?: boolean;
  /** Dim the board (looking back at an earlier position). */
  dimmed?: boolean;
}

let boardCount = 0;

export function RunBoard({ fen, orientation, movable, onMove, arrows = [], highlights = [], lastMove, showCoordinates = true, mini = false, dimmed = false }: Props) {
  const [id] = useState(() => `runboard${++boardCount}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const theme = useBoardTheme();
  const pieces = useMemo(() => piecesFor(theme), [theme]);

  const chess = useMemo(() => new Chess(fen), [fen]);
  useEffect(() => setSelected(null), [fen]);
  const turn = chess.turn();
  const canMove = !!movable && movable === turn && !!onMove;
  const targets = useMemo(() => (selected ? chess.moves({ square: selected as Square, verbose: true }) : []), [chess, selected]);

  const attempt = (from: string, to: string): boolean => {
    if (!canMove) return false;
    if (!chess.moves({ square: from as Square, verbose: true }).some((m) => m.to === to)) return false;
    if (isPromotion(fen, from, to)) {
      setPromo({ from, to });
      return false;
    }
    setSelected(null);
    return onMove!({ from, to });
  };
  const own = (sq: string) => {
    const p = chess.get(sq as Square);
    return !!p && p.color === turn && canMove;
  };
  const onSquareClick = ({ square }: { square: string }) => {
    if (promo) return;
    if (selected && selected !== square && targets.some((m) => m.to === square)) return void attempt(selected, square);
    setSelected(own(square) && selected !== square ? square : null);
  };

  // Every square gets its own tile (variants) plus pixel overlays.
  const over: Record<string, OverlayKind[]> = {};
  const add = (sq: string, k: OverlayKind) => (over[sq] ??= []).push(k);
  if (lastMove) {
    add(lastMove.from, 'last');
    add(lastMove.to, 'last');
  }
  for (const h of highlights) add(h.sq, h.tone);
  if (chess.inCheck()) {
    const k = chess.board().flat().find((p) => p?.type === 'k' && p.color === turn);
    if (k) add(k.square, 'check');
  }
  if (selected) {
    add(selected, 'sel');
    for (const m of targets) add(m.to, m.captured ? 'cap' : 'move');
  }
  const squareStyles: Record<string, CSSProperties> = {};
  for (let f = 0; f < 8; f++)
    for (let r = 1; r <= 8; r++) {
      const sq = FILES[f] + r;
      const light = (f + r) % 2 === 0;
      const layers = (over[sq] ?? []).slice().reverse().map((k) => `url(${overlaySprite(k)}) 0 0 / 100% 100%`);
      squareStyles[sq] = { background: [...layers, `url(${tileSprite(theme, light, squareVariant(sq))}) 0 0 / 100% 100%`].join(', '), imageRendering: 'pixelated' };
    }

  const [f0, f1] = theme.frame;
  return (
    <div
      className="relative w-full touch-none select-none"
      style={{ padding: mini ? 2 : 5, background: `linear-gradient(180deg, ${f0}, ${f1})`, boxShadow: '0 0 0 2px #1b0f22, 0 0 24px rgba(242,199,92,.2), 0 8px 18px rgba(0,0,0,.6)', filter: dimmed ? 'saturate(.55) brightness(.85)' : undefined }}
    >
      {!mini &&
        ['left-0 top-0', 'right-0 top-0', 'left-0 bottom-0', 'right-0 bottom-0'].map((p) => (
          <span key={p} className={`pointer-events-none absolute z-10 ${p}`} style={{ width: 8, height: 8, background: f0, boxShadow: '0 0 0 2px #1b0f22, inset 0 0 0 2px ' + f1 }} />
        ))}
      <div style={{ boxShadow: 'inset 0 0 0 2px #1b0f22' }}>
        <Chessboard
          options={{
            id,
            position: fen,
            boardOrientation: orientation,
            showNotation: showCoordinates && !mini,
            allowDrawingArrows: false,
            arrows: arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: TONE[a.tone] })),
            squareStyles,
            animationDurationInMs: mini ? 0 : 200,
            lightSquareStyle: { backgroundColor: theme.light[1] },
            darkSquareStyle: { backgroundColor: theme.dark[1] },
            lightSquareNotationStyle: { color: theme.coord[0], fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: 9, opacity: 0.85 },
            darkSquareNotationStyle: { color: theme.coord[1], fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: 9, opacity: 0.85 },
            pieces,
            dragActivationDistance: 6,
            canDragPiece: ({ square }) => !mini && !!square && own(square),
            onPieceDrag: ({ square }) => square && setSelected(square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => (!targetSquare || sourceSquare === targetSquare ? false : attempt(sourceSquare, targetSquare)),
            onSquareClick: mini ? undefined : onSquareClick,
          }}
        />
      </div>
      {promo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55" onClick={() => setPromo(null)}>
          <div className="run-panel flex gap-2 p-3">
            {PROMO.map((p) => (
              <button
                key={p}
                className="h-14 w-14 bg-black/40"
                style={{ boxShadow: '0 0 0 2px #1b0f22, inset 0 0 0 1px var(--gold-dim)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  const m = { ...promo, promotion: p };
                  setPromo(null);
                  setSelected(null);
                  onMove?.(m);
                }}
              >
                <img src={pieceSprite(theme, turn, p.toUpperCase() as 'Q')} alt={p} style={{ imageRendering: 'pixelated', width: '100%' }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A captured-piece row (pixel sprites), cheapest first. */
export function PixelCaptured({ pieces, color, lead }: { pieces: string[]; color: 'w' | 'b'; lead: number }) {
  const theme = useBoardTheme();
  return (
    <div className="flex h-5 items-center">
      {pieces.map((k, i) => (
        <img key={i} src={pieceSprite(theme, color, k.toUpperCase() as 'P')} alt={k} className="pixelated" style={{ width: 20, height: 20, marginLeft: i && pieces[i - 1] === k ? -9 : i ? -3 : 0 }} />
      ))}
      {lead > 0 && <span className="run-sans ml-1 text-[11px] font-black text-[var(--gold-2)]">+{lead}</span>}
    </div>
  );
}
