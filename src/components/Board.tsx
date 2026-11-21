import { useDragWatchdog } from './dragWatchdog';
import { Chess, type Square } from 'chess.js';
import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Chessboard, defaultArrowOptions } from 'react-chessboard';
import { isPromotion, tryMove, type MoveInput } from '../lib/chess/game';
import { BOARD_THEMES, useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { HAPTIC_PATTERN, moveHaptic, moveSound, premoveTargets as premoveTargetsFor, squareAtPoint } from '../lib/chess/boardfeel';
import type { CoachArrow, CoachHighlight, Tone } from '../lib/coach/types';
import { Check, X } from 'lucide-react';
import { shortWords } from '../lib/chess/words';
import { HIGHLIGHTS } from '../lib/rewards/looks';
import { PieceIcon, renderSet, type PieceCode } from './PieceIcon';

/** Arrow colours (solid: the board applies one opacity to every arrow), chess.com's palette. */
export const TONE_COLOR: Record<Tone, string> = {
  good: '#81b64c',
  bad: '#f8553f',
  info: '#48a7e0',
};
/** Square tints for coach marks: flat fills in the same colour system as the arrows. */
const TONE_BG: Record<Tone, string> = {
  good: 'rgba(129, 182, 76, 0.55)',
  bad: 'rgba(235, 97, 80, 0.6)',
  info: 'rgba(82, 176, 220, 0.5)',
};
/** Arrows: start near the piece's base, a little bolder, one shared opacity. */
const ARROW_OPTIONS = { ...defaultArrowOptions, arrowStartOffset: 0.35, arrowWidthDenominator: 4.5, opacity: 0.8 };
/** Legal-move marks: a dot about a third of the square, a ring on captures (corners clear). */
const DOT = 'radial-gradient(circle closest-side, rgba(0,0,0,.14) 32%, transparent 34%)';
const RING = 'radial-gradient(circle closest-side, transparent 80%, rgba(0,0,0,.14) 81%, rgba(0,0,0,.14) 99%, transparent 100%)';
const COORD = { position: 'absolute', fontSize: 'clamp(9px, 2.9cqw, 15px)', fontWeight: 700, lineHeight: 1, userSelect: 'none' } as const;

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
  /** Tint the last move's squares in this colour (an rgb triplet like "250, 65, 45") instead of yellow. */
  lastMoveColor?: string;
}

/** Animation length per speed setting (ms). */
export const MOVE_MS = { slow: 420, normal: 220, fast: 110, instant: 0 } as const;
/** Arrows and circles you draw yourself (long-press or right-click and drag), chess.com orange. */
const DRAW_COLOR = '#ffaa00';
const PREMOVE_COLOR = '#e05050';
const LONG_PRESS_MS = 420;

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

/** Promotion choices in chess.com's order, from the promotion square towards the centre. */
const PROMO = ['q', 'n', 'r', 'b'] as const;

let boardCount = 0;

/** Tablet held sideways (the same rule as the `land:` variant). */
const LAND_QUERY = '(orientation: landscape) and (min-width: 700px)';
function useLandscape() {
  const [land, setLand] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(LAND_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(LAND_QUERY);
    if (!mq) return;
    const on = () => setLand(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return land;
}

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

function BoardInner({ animate = true, fen: realFen, orientation, movable, onMove: realOnMove, arrows = [], highlights = [], lastMove: realLast, showCoordinates = true, confirm = false, premoveColor = null, lastMoveColor }: Props & { animate?: boolean }) {
  // Each board needs its own id: the library looks squares up by id across the whole page.
  const [boardId] = useState(() => `board${++boardCount}`);
  const [selected, setSelected] = useState<string | null>(null);
  const watchdog = useDragWatchdog();
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [pending, setPending] = useState<{ move: MoveInput; fen: string; label: string } | null>(null);
  const theme = useSettings((s) => BOARD_THEMES[s.boardTheme] ?? BOARD_THEMES.green);
  const large = useSettings((s) => s.largePieces);
  const pieceStyle = useSettings((s) => s.pieceStyle);
  const pieces = renderSet(pieceStyle, large);
  const hl = useSettings((s) => (HIGHLIGHTS[s.highlight] ?? HIGHLIGHTS.classic).color);
  const showDots = useSettings((s) => s.showLegalMoves);
  const land = useLandscape();
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
    // The position changed under us (their move, a step in a review): drop the selection and its dots.
    setSelected(null);
  }, [realFen]);
  // No moves allowed (game over, coach paused, a replay): nothing stays selected.
  useEffect(() => {
    if (!movable) {
      setSelected(null);
      setPromo(null);
    }
  }, [movable]);
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
  // A selection only means something while you can move or queue a premove.
  useEffect(() => {
    if (!canMove && !premoving) setSelected(null);
  }, [canMove, premoving]);
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
    // Both squares the same strength, like chess.com.
    add(lastMove.from, tint(`rgba(${lastMoveColor ?? hl}, 0.5)`));
    add(lastMove.to, tint(`rgba(${lastMoveColor ?? hl}, 0.5)`));
  }
  // Coach marks: flat tints, no borders.
  for (const h of highlights) add(h.sq, tint(TONE_BG[h.tone]));
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
  // Your own circles keep a thin ring: a deliberate annotation.
  for (const sq of drawn.circles) shadows[sq] = `inset 0 0 0 3px ${DRAW_COLOR}`;
  if (selected) {
    add(selected, tint(premoving ? 'rgba(220, 60, 60, 0.4)' : `rgba(${hl}, 0.5)`));
    if (showDots) for (const m of targets) add(m.to, m.captured ? RING : DOT);
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
    ...(premove ? [{ startSquare: premove.from, endSquare: premove.to, color: PREMOVE_COLOR }] : []),
  ];
  // The promotion strip: four squares on the promotion file, from the edge towards the centre.
  const promoStrip = promo
    ? (() => {
        const f = promo.to.charCodeAt(0) - 97;
        const r = Number(promo.to[1]) - 1;
        const col = orientation === 'white' ? f : 7 - f;
        const row = orientation === 'white' ? 7 - r : r;
        return { col, top: row === 0, color: turn };
      })()
    : null;

  return (
    <div ref={boardEl} className="relative w-full touch-none select-none [container-type:inline-size]" {...drawHandlers}>
      <Chessboard
        key={watchdog.epoch}
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
          // Coordinates in the opposite square colour (the library would draw brown on every theme).
          darkSquareNotationStyle: { color: theme.coordOnDark ?? theme.light },
          lightSquareNotationStyle: { color: theme.coordOnLight ?? theme.dark },
          alphaNotationStyle: { ...COORD, bottom: '1%', right: '4%' },
          numericNotationStyle: { ...COORD, top: '3%', left: '4%' },
          ...(pieces ? { pieces } : {}),
          // Flat and square, like chess.com (a hint of rounding on tablets).
          boardStyle: { borderRadius: land ? 3 : 0, overflow: 'hidden' },
          arrowOptions: ARROW_OPTIONS,
          // Dragging on a phone: the piece lifts above your finger, the square under it is outlined.
          dropSquareStyle: { boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.75)' },
          draggingPieceStyle: { transform: 'translateY(-30%) scale(1.5)' },
          draggingPieceGhostStyle: { opacity: 0.35 },
          dragActivationDistance: 6,
          canDragPiece: ({ square }) => !!square && ownPiece(square) && !draw.current?.active,
          onPieceDrag: ({ square }) => {
            watchdog.started();
            // A real drag has started: it wins over a pending long-press (otherwise the drawing
            // would swallow the pointer and leave the drag stuck).
            if (draw.current && !draw.current.active) {
              if (draw.current.timer) clearTimeout(draw.current.timer);
              draw.current = null;
            }
            if (square) setSelected(square);
          },
          onPieceDragCancel: watchdog.finished,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            watchdog.finished();
            if (!targetSquare || sourceSquare === targetSquare) return false;
            return attempt(sourceSquare, targetSquare, true);
          },
          onSquareClick,
        }}
      />
      {promo && promoStrip && (
        <div className="absolute inset-0 z-10 bg-black/40" onClick={() => setPromo(null)}>
          <div
            className={`absolute flex w-[12.5%] ${promoStrip.top ? 'top-0 flex-col' : 'bottom-0 flex-col-reverse'}`}
            style={{ left: `${promoStrip.col * 12.5}%` }}
          >
            {PROMO.map((p) => (
              <button
                key={p}
                aria-label={`Promote to ${{ q: 'queen', n: 'knight', r: 'rook', b: 'bishop' }[p]}`}
                className="aspect-square w-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] active:bg-stone-200 dark:bg-[#f2f1ef]"
                onClick={(e) => {
                  e.stopPropagation();
                  const m = { ...promo, promotion: p };
                  setPromo(null);
                  setSelected(null);
                  onMove?.(m);
                }}
              >
                <PieceIcon code={`${promoStrip.color}${p.toUpperCase()}` as PieceCode} />
              </button>
            ))}
            <button
              aria-label="Cancel promotion"
              className="flex h-[calc(100cqw/16)] w-full items-center justify-center bg-stone-100 text-stone-600 shadow-[0_2px_6px_rgba(0,0,0,0.35)] dark:bg-[#d0cecb]"
              onClick={(e) => {
                e.stopPropagation();
                setPromo(null);
              }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
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
