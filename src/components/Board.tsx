import { Chess, type Square } from 'chess.js';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Chessboard, defaultPieces, type PieceRenderObject } from 'react-chessboard';
import { isPromotion, tryMove, type MoveInput } from '../lib/chess/game';
import { BOARD_THEMES, useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
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
  /** Ask for a confirmation tap before passing the move on (setting "confirm moves"). */
  confirm?: boolean;
}

const WOOD_FILL = { w: '#f3dcb2', b: '#2e1c0e' };

/** Piece set: classic or wooden colours, optionally larger. Cached per combination. */
const pieceCache = new Map<string, PieceRenderObject>();
function pieceSet(style: 'classic' | 'wood', large: boolean): PieceRenderObject | undefined {
  if (style === 'classic' && !large) return undefined;
  const key = style + large;
  let set = pieceCache.get(key);
  if (!set) {
    set = Object.fromEntries(
      Object.entries(defaultPieces).map(([k, render]) => [
        k,
        (props?: { fill?: string; square?: string; svgStyle?: CSSProperties }) =>
          render({
            ...props,
            fill: style === 'wood' ? WOOD_FILL[k[0] as 'w' | 'b'] : props?.fill,
            svgStyle: {
              ...props?.svgStyle,
              ...(large ? { transform: 'scale(1.16)', transformOrigin: '50% 60%' } : {}),
              ...(style === 'wood' ? { filter: 'drop-shadow(0 1.5px 1px rgba(40,20,5,0.35))' } : {}),
            },
          }),
      ]),
    );
    pieceCache.set(key, set);
  }
  return set;
}

const pieceCount = (fen: string) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;

/** Plays a sound whenever the position changes by one move. */
function useMoveSounds(fen: string, lastMove: { from: string; to: string } | null | undefined) {
  const prev = useRef(fen);
  useEffect(() => {
    const before = prev.current;
    prev.current = fen;
    if (before === fen || !lastMove) return;
    const c = new Chess(fen);
    const moved = c.get(lastMove.to as Square);
    const castle = moved?.type === 'k' && Math.abs(lastMove.to.charCodeAt(0) - lastMove.from.charCodeAt(0)) === 2;
    playSound(c.inCheck() ? 'check' : pieceCount(fen) < pieceCount(before) ? 'capture' : castle ? 'castle' : 'move');
  }, [fen, lastMove]);
}

const PROMO = ['q', 'r', 'b', 'n'] as const;
const PROMO_GLYPH: Record<string, [string, string]> = { q: ['♕', '♛'], r: ['♖', '♜'], b: ['♗', '♝'], n: ['♘', '♞'] };

export function Board({ fen: realFen, orientation, movable, onMove: realOnMove, arrows = [], highlights = [], lastMove: realLast, showCoordinates = true, confirm = false }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [pending, setPending] = useState<{ move: MoveInput; fen: string; san: string } | null>(null);
  const theme = useSettings((s) => BOARD_THEMES[s.boardTheme] ?? BOARD_THEMES.green);
  const large = useSettings((s) => s.largePieces);
  const pieceStyle = useSettings((s) => s.pieceStyle);
  const pieces = pieceSet(pieceStyle, large);
  useEffect(() => setPending(null), [realFen]);
  // With confirmation on, show the move on the board but only submit it after a tap on ✓.
  const fen = pending ? pending.fen : realFen;
  const lastMove = pending ? { from: pending.move.from, to: pending.move.to } : realLast;
  useMoveSounds(fen, lastMove);
  const onMove = (m: MoveInput): boolean => {
    if (!realOnMove) return false;
    if (!confirm) return realOnMove(m);
    const r = tryMove(realFen, m);
    if (!r) return false;
    setPending({ move: m, fen: r.fen, san: r.move.san });
    return true;
  };
  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const canMove = !pending && (movable === 'both' || movable === turn);

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

  // Highlights are layered over the square's own background so wood grain stays visible.
  const base = (sq: string) => {
    const light = (sq.charCodeAt(0) - 97 + Number(sq[1])) % 2 === 0;
    const bg = light ? theme.lightBg : theme.darkBg;
    const col = light ? theme.light : theme.dark;
    return bg ?? `linear-gradient(${col}, ${col})`;
  };
  const tint = (c: string) => `linear-gradient(${c}, ${c})`;
  const layers: Record<string, string[]> = {};
  const add = (sq: string, layer: string) => (layers[sq] ??= []).push(layer);
  const shadows: Record<string, string> = {};
  if (lastMove) {
    add(lastMove.from, tint('rgba(250, 204, 21, 0.32)'));
    add(lastMove.to, tint('rgba(250, 204, 21, 0.42)'));
  }
  for (const h of highlights) {
    add(h.sq, tint(TONE_BG[h.tone]));
    shadows[h.sq] = `inset 0 0 0 4px ${TONE_COLOR[h.tone]}`;
  }
  if (chess.inCheck()) {
    const k = chess.board().flat().find((p) => p?.type === 'k' && p.color === turn);
    if (k) add(k.square, 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.4) 55%, transparent 75%)');
  }
  if (selected) {
    add(selected, tint('rgba(250, 204, 21, 0.55)'));
    for (const m of targets)
      add(
        m.to,
        m.captured
          ? 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.28) 60%)'
          : 'radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 24%)',
      );
  }
  const squareStyles: Record<string, CSSProperties> = {};
  for (const sq of new Set([...Object.keys(layers), ...Object.keys(shadows)])) {
    squareStyles[sq] = { background: [...(layers[sq] ?? []).reverse(), base(sq)].join(', ') };
    if (shadows[sq]) squareStyles[sq].boxShadow = shadows[sq];
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
          animationDurationInMs: 260,
          darkSquareStyle: theme.darkBg ? { background: theme.darkBg } : { backgroundColor: theme.dark },
          lightSquareStyle: theme.lightBg ? { background: theme.lightBg } : { backgroundColor: theme.light },
          ...(pieces ? { pieces } : {}),
          boardStyle: { borderRadius: '6px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(40,20,5,0.25)' },
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
      {pending && (
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center">
          <div className="flex items-center gap-2 rounded-2xl bg-white/95 p-1.5 pl-4 shadow-xl ring-1 ring-stone-200 dark:bg-stone-800/95 dark:ring-stone-700">
            <span className="font-semibold">Play {pending.san}?</span>
            <button className="btn-primary !px-4 !py-2" onClick={() => { const m = pending.move; setPending(null); realOnMove?.(m); }}>✓</button>
            <button className="btn-secondary !px-4 !py-2" onClick={() => setPending(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
