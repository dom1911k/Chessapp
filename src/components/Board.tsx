import { Chess, type Square } from 'chess.js';
import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Chessboard, defaultPieces, type PieceRenderObject } from 'react-chessboard';
import { isPromotion, tryMove, type MoveInput } from '../lib/chess/game';
import { BOARD_THEMES, useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { HAPTIC_PATTERN, moveHaptic, moveSound, premoveTargets as premoveTargetsFor, squareAtPoint } from '../lib/chess/boardfeel';
import type { CoachArrow, CoachHighlight, Tone } from '../lib/coach/types';
import { Check, X } from 'lucide-react';
import { shortWords } from '../lib/chess/words';
import { HIGHLIGHTS, PIECE_SETS } from '../lib/rewards/looks';

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
  /** While it's the opponent's turn: the colour that may queue a premove (played when its turn comes). */
  premoveColor?: 'w' | 'b' | null;
}

/** Animation length per speed setting (ms). */
export const MOVE_MS = { slow: 420, normal: 220, fast: 110, instant: 0 } as const;
/** Arrows and circles you draw yourself (long-press or right-click and drag), chess.com orange. */
const DRAW_COLOR = 'rgba(255, 170, 0, 0.85)';
const LONG_PRESS_MS = 420;

/** Piece set (see PIECE_SETS), optionally larger. Cached per combination. */
const pieceCache = new Map<string, PieceRenderObject>();
function pieceSet(style: string, large: boolean): PieceRenderObject | undefined {
  const set0 = PIECE_SETS[style] ?? PIECE_SETS.wood;
  if (!set0.fill && !large) return undefined;
  const key = style + large;
  let set = pieceCache.get(key);
  if (!set) {
    set = Object.fromEntries(
      Object.entries(defaultPieces).map(([k, render]) => [
        k,
        (props?: { fill?: string; square?: string; svgStyle?: CSSProperties }) => {
          const c = k[0] as 'w' | 'b';
          return render({
            ...props,
            fill: set0.fill?.[c] ?? props?.fill,
            svgStyle: {
              ...props?.svgStyle,
              ...(large ? { transform: 'scale(1.16)', transformOrigin: '50% 60%' } : {}),
              ...(set0.filter?.[c] ? { filter: set0.filter[c] } : {}),
            },
          });
        },
      ]),
    );
    pieceCache.set(key, set);
  }
  return set;
}

/** Plays a sound whenever the position changes by one move (yours and the opponent's differ). */
function useMoveSounds(fen: string, lastMove: { from: string; to: string } | null | undefined, orientation: 'white' | 'black') {
  const prev = useRef(fen);
  useEffect(() => {
    const before = prev.current;
    prev.current = fen;
    if (before === fen || !lastMove) return;
    try {
      playSound(moveSound(before, fen, lastMove, orientation === 'white' ? 'w' : 'b'));
      if (useSettings.getState().haptics) {
        const h = moveHaptic(before, fen, lastMove);
        if (h !== 'none') navigator.vibrate?.(HAPTIC_PATTERN[h]);
      }
    } catch {
      /* unreadable position: stay quiet */
    }
  }, [fen, lastMove, orientation]);
}

/** The square under a screen point on a board element. */
const squareAt = (el: HTMLElement, x: number, y: number, orientation: 'white' | 'black') => squareAtPoint(el.getBoundingClientRect(), x, y, orientation);

const PROMO = ['q', 'r', 'b', 'n'] as const;
const PROMO_GLYPH: Record<string, [string, string]> = { q: ['♕', '♛'], r: ['♖', '♜'], b: ['♗', '♝'], n: ['♘', '♞'] };

let boardCount = 0;

export function Board(props: Props) {
  // react-chessboard throws if it can't measure a square (e.g. a board hidden
  // under another screen); redraw instead of taking the whole app down.
  const [attempt, setAttempt] = useState(0);
  return (
    <BoardErrorBoundary key={attempt} onError={() => setAttempt((a) => a + 1)}>
      <BoardInner {...props} animate={attempt < 2} />
    </BoardErrorBoundary>
  );
}

class BoardErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn('Board recovered from an error', e);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function BoardInner({ animate = true, fen: realFen, orientation, movable, onMove: realOnMove, arrows = [], highlights = [], lastMove: realLast, showCoordinates = true, confirm = false, premoveColor = null }: Props & { animate?: boolean }) {
  // Each board needs its own id: the library looks squares up by id across the whole page.
  const [boardId] = useState(() => `board${++boardCount}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [pending, setPending] = useState<{ move: MoveInput; fen: string; label: string } | null>(null);
  const theme = useSettings((s) => BOARD_THEMES[s.boardTheme] ?? BOARD_THEMES.green);
  const large = useSettings((s) => s.largePieces);
  const pieceStyle = useSettings((s) => s.pieceStyle);
  const pieces = pieceSet(pieceStyle, large);
  const hl = useSettings((s) => (HIGHLIGHTS[s.highlight] ?? HIGHLIGHTS.classic).color);
  const showDots = useSettings((s) => s.showLegalMoves);
  const speed = useSettings((s) => s.moveSpeed);
  const premovesOn = useSettings((s) => s.premoves);
  const [premove, setPremove] = useState<MoveInput | null>(null);
  // Your own arrows and circles: cleared by the next move.
  const [drawn, setDrawn] = useState<{ arrows: { from: string; to: string }[]; circles: string[] }>({ arrows: [], circles: [] });
  const boardEl = useRef<HTMLDivElement>(null);
  const draw = useRef<{ from: string; timer: ReturnType<typeof setTimeout> | null; active: boolean; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [drawPreview, setDrawPreview] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    setPending(null);
    setDrawn({ arrows: [], circles: [] });
  }, [realFen]);
  // With confirmation on, show the move on the board but only submit it after a tap on ✓.
  const fen = pending ? pending.fen : realFen;
  const lastMove = pending ? { from: pending.move.from, to: pending.move.to } : realLast;
  useMoveSounds(fen, lastMove, orientation);
  const onMove = (m: MoveInput): boolean => {
    if (!realOnMove) return false;
    if (!confirm) return realOnMove(m);
    const r = tryMove(realFen, m);
    if (!r) return false;
    setPending({ move: m, fen: r.fen, label: shortWords(realFen, r.move.lan) });
    return true;
  };
  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const canMove = !pending && (movable === 'both' || movable === turn);
  // Premoves: while the opponent thinks, your own pieces can be picked up and a move queued.
  const premoving = !canMove && !pending && premovesOn && !!premoveColor && premoveColor !== turn;
  // Play a queued premove as soon as it's your turn (if it's still legal), else drop it.
  useEffect(() => {
    if (!premove || !canMove) return;
    const m = premove;
    setPremove(null);
    const legal = chess.moves({ square: m.from as Square, verbose: true }).some((x) => x.to === m.to);
    if (!legal) return;
    onMove({ ...m, promotion: isPromotion(fen, m.from, m.to) ? 'q' : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMove, fen]);
  useEffect(() => {
    if (!premoveColor) setPremove(null);
  }, [premoveColor]);
  const premoveTargets = (from: string) => (premoveColor ? premoveTargetsFor(fen, premoveColor, from) : []);

  const targets = useMemo(() => {
    if (!selected) return [];
    if (premoving) return premoveTargets(selected).map((to) => ({ to, captured: chess.get(to as Square) ? 'x' : undefined }));
    return chess.moves({ square: selected as Square, verbose: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess, selected, premoving]);

  const attempt = (from: string, to: string, dropped = false): boolean => {
    if (premoving) {
      if (!premoveTargets(from).includes(to)) return false;
      setPremove({ from, to });
      setSelected(null);
      playSound('premove');
      return false;
    }
    if (!canMove || !onMove) return false;
    const legal = chess.moves({ square: from as Square, verbose: true }).some((m) => m.to === to);
    if (!legal) {
      if (dropped) playSound('illegal');
      return false;
    }
    if (isPromotion(fen, from, to)) {
      setPromo({ from, to });
      return false;
    }
    setSelected(null);
    return onMove({ from, to });
  };

  const ownPiece = (sq: string) => {
    const p = chess.get(sq as Square);
    if (premoving) return !!p && p.color === premoveColor;
    return !!p && p.color === turn && canMove;
  };

  const onSquareClick = ({ square }: { square: string }) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (promo) return;
    // A plain tap clears your drawings (and a queued premove), like chess.com.
    if (drawn.arrows.length || drawn.circles.length) setDrawn({ arrows: [], circles: [] });
    if (premove && !selected) {
      setPremove(null);
      return;
    }
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
    // Soft and even, like chess.com: both squares tinted, the arrival square a touch stronger.
    add(lastMove.from, tint(`rgba(${hl}, 0.28)`));
    add(lastMove.to, tint(`rgba(${hl}, 0.36)`));
  }
  for (const h of highlights) {
    add(h.sq, tint(TONE_BG[h.tone]));
    shadows[h.sq] = `inset 0 0 0 4px ${TONE_COLOR[h.tone]}`;
  }
  if (chess.inCheck()) {
    const k = chess.board().flat().find((p) => p?.type === 'k' && p.color === turn);
    // A red glow under the king in check (fuller and with a rim on checkmate).
    const mate = chess.isCheckmate();
    if (k) {
      add(k.square, mate
        ? 'radial-gradient(circle at center, rgba(255,40,40,1) 0%, rgba(220,20,20,0.85) 35%, rgba(170,0,0,0.25) 80%, transparent 95%)'
        : 'radial-gradient(circle at center, rgba(255,60,60,0.95) 0%, rgba(231,30,30,0.6) 32%, rgba(169,0,0,0) 78%)');
      if (mate) shadows[k.square] = 'inset 0 0 0 3px rgba(185,28,28,0.85)';
    }
  }
  if (premove) {
    add(premove.from, tint('rgba(220, 60, 60, 0.45)'));
    add(premove.to, tint('rgba(220, 60, 60, 0.55)'));
  }
  for (const sq of drawn.circles) shadows[sq] = `inset 0 0 0 4px ${DRAW_COLOR}`;
  if (selected) {
    add(selected, tint(premoving ? 'rgba(220, 60, 60, 0.4)' : 'rgba(250, 204, 21, 0.55)'));
    if (showDots) for (const m of targets)
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

  // Long-press (touch) or right-click and drag: draw an arrow; release where you started: a circle.
  const endDraw = (x: number, y: number) => {
    const d = draw.current;
    draw.current = null;
    setDrawPreview(null);
    if (!d) return;
    if (d.timer) clearTimeout(d.timer);
    if (!d.active || !boardEl.current) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 400);
    const to = squareAt(boardEl.current, x, y, orientation);
    if (!to) return;
    setDrawn((cur) => {
      if (to === d.from) {
        const has = cur.circles.includes(to);
        return { ...cur, circles: has ? cur.circles.filter((c) => c !== to) : [...cur.circles, to] };
      }
      const has = cur.arrows.some((a) => a.from === d.from && a.to === to);
      return { ...cur, arrows: has ? cur.arrows.filter((a) => !(a.from === d.from && a.to === to)) : [...cur.arrows, { from: d.from, to }] };
    });
  };
  const drawHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!boardEl.current) return;
      const from = squareAt(boardEl.current, e.clientX, e.clientY, orientation);
      if (!from) return;
      const right = e.button === 2;
      draw.current = { from, active: right, x: e.clientX, y: e.clientY, timer: right ? null : setTimeout(() => {
        if (!draw.current) return;
        draw.current.active = true;
        setSelected(null);
        // Cancel the piece drag the board may be waiting to start (drag-and-drop listens for Escape).
        const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
        document.dispatchEvent(esc);
        window.dispatchEvent(esc);
        try {
          navigator.vibrate?.(12);
        } catch {
          /* no vibration */
        }
      }, LONG_PRESS_MS) };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = draw.current;
      if (!d || !boardEl.current) return;
      // Moving before the long-press fires is a normal drag: stop waiting.
      if (!d.active) {
        // Below the board's drag threshold (6px), so a piece drag and a drawing never overlap.
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 && d.timer) {
          clearTimeout(d.timer);
          draw.current = null;
        }
        return;
      }
      // While drawing, the board's own drag-and-drop must not see the pointer.
      e.stopPropagation();
      const to = squareAt(boardEl.current, e.clientX, e.clientY, orientation);
      setDrawPreview(to && to !== d.from ? { from: d.from, to } : null);
    },
    onPointerUp: (e: React.PointerEvent) => endDraw(e.clientX, e.clientY),
    onPointerCancel: () => {
      if (draw.current?.timer) clearTimeout(draw.current.timer);
      draw.current = null;
      setDrawPreview(null);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  const allArrows = [
    ...arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: TONE_COLOR[a.tone] })),
    ...drawn.arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: DRAW_COLOR })),
    ...(drawPreview ? [{ startSquare: drawPreview.from, endSquare: drawPreview.to, color: DRAW_COLOR }] : []),
    ...(premove ? [{ startSquare: premove.from, endSquare: premove.to, color: 'rgba(220, 60, 60, 0.7)' }] : []),
  ];

  return (
    <div ref={boardEl} className="relative w-full touch-none select-none" {...drawHandlers}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          showNotation: showCoordinates,
          allowDrawingArrows: false,
          arrows: allArrows,
          squareStyles,
          id: boardId,
          animationDurationInMs: animate ? MOVE_MS[speed] ?? 220 : 0,
          darkSquareStyle: theme.darkBg ? { background: theme.darkBg } : { backgroundColor: theme.dark },
          lightSquareStyle: theme.lightBg ? { background: theme.lightBg } : { backgroundColor: theme.light },
          ...(pieces ? { pieces } : {}),
          boardStyle: { borderRadius: '6px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(40,20,5,0.25)' },
          dragActivationDistance: 6,
          canDragPiece: ({ square }) => !!square && ownPiece(square) && !draw.current?.active,
          onPieceDrag: ({ square }) => {
            // A real drag has started: it wins over a pending long-press (otherwise the drawing
            // would swallow the pointer and leave the drag stuck).
            if (draw.current && !draw.current.active) {
              if (draw.current.timer) clearTimeout(draw.current.timer);
              draw.current = null;
            }
            if (square) setSelected(square);
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || sourceSquare === targetSquare) return false;
            return attempt(sourceSquare, targetSquare, true);
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
            <span className="font-semibold">{pending.label}?</span>
            <button className="btn-primary !px-4 !py-2" onClick={() => { const m = pending.move; setPending(null); realOnMove?.(m); }} aria-label="Confirm move"><Check size={20} /></button>
            <button className="btn-secondary !px-4 !py-2" onClick={() => setPending(null)} aria-label="Cancel move"><X size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
