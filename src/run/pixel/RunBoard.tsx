// Run mode's own board: pixel-art pieces on a dithered felt-and-stone board.
// Same interaction as the app's board (tap or drag, promotion picker); normal chess rules.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Chessboard, defaultPieces, type PieceRenderObject } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import { isPromotion, type MoveInput } from '../../lib/chess/game';
import type { CoachArrow, CoachHighlight } from '../../lib/coach/types';
import { cached, spriteFromPieceSvg, textureTile } from './pixelize';
import { usePromise } from './sprites';

const KEYS = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'] as const;
const WHITE = ['#5c4a2e', '#b39a62', '#e9d6a2', '#fff6dc'];
const BLACK = ['#0a0612', '#22133a', '#4a2c78', '#8e68d0'];
const PX = 22;

/** The library's piece SVGs, as markup (rendered once, off-screen). */
function pieceMarkup(): Record<string, string> {
  const out: Record<string, string> = {};
  const host = document.createElement('div');
  const root = createRoot(host);
  for (const k of KEYS) {
    flushSync(() => root.render(defaultPieces[k]({ fill: k[0] === 'w' ? '#ffffff' : '#000000' })));
    out[k] = host.innerHTML;
  }
  root.unmount();
  return out;
}

let piecesPromise: Promise<Record<string, string>> | null = null;
function pixelPieces(): Promise<Record<string, string>> {
  piecesPromise ??= (async () => {
    // Outside React's render/commit (flushSync is not allowed there).
    await new Promise((r) => setTimeout(r, 0));
    const svgs = pieceMarkup();
    const urls = await Promise.all(
      KEYS.map((k) => (k[0] === 'w' ? spriteFromPieceSvg(k, svgs[k], PX, WHITE, '#1b0f22') : spriteFromPieceSvg(k, svgs[k], PX, BLACK, '#d9a441', '#f2c75c'))),
    );
    return Object.fromEntries(KEYS.map((k, i) => [k, urls[i]]));
  })();
  return piecesPromise;
}

function usePixelPieces(): PieceRenderObject | undefined {
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let alive = true;
    void pixelPieces().then((u) => alive && setUrls(u));
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => {
    if (!urls) return undefined;
    return Object.fromEntries(
      KEYS.map((k) => [
        k,
        () => (
          <img
            src={urls[k]}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', imageRendering: 'pixelated', filter: 'drop-shadow(0 2px 0 rgba(0,0,0,.45))' }}
          />
        ),
      ]),
    ) as PieceRenderObject;
  }, [urls]);
}

const TONE: Record<string, string> = { good: 'rgba(94, 229, 154, 0.9)', bad: 'rgba(226, 71, 90, 0.9)', info: 'rgba(79, 179, 255, 0.9)' };
const TONE_BG: Record<string, string> = { good: 'rgba(94, 229, 154, 0.35)', bad: 'rgba(226, 71, 90, 0.42)', info: 'rgba(79, 179, 255, 0.3)' };
const PROMO = ['q', 'r', 'b', 'n'] as const;

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  movable: 'w' | 'b' | null;
  onMove?: (m: MoveInput) => boolean;
  arrows?: CoachArrow[];
  highlights?: CoachHighlight[];
  lastMove?: { from: string; to: string } | null;
  showCoordinates?: boolean;
  /** Small, non-interactive (debrief). */
  mini?: boolean;
}

let boardCount = 0;

export function RunBoard({ fen, orientation, movable, onMove, arrows = [], highlights = [], lastMove, showCoordinates = true, mini = false }: Props) {
  const [id] = useState(() => `runboard${++boardCount}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const pieces = usePixelPieces();
  const light = usePromise(() => textureTile('light', 8, ['#3a2c52', '#43345f', '#4c3c6c', '#56457a'], 7), 'light', 'tx:light');
  const dark = usePromise(() => textureTile('dark', 8, ['#13291f', '#183226', '#1d3b2d', '#234535'], 3), 'dark', 'tx:dark');
  const piecesReady = !!pieces || !!cached('pc:wK:22');

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

  const tile = (url: string | null, fallback: string): CSSProperties =>
    url ? { backgroundImage: `url(${url})`, backgroundSize: mini ? '16px 16px' : '32px 32px', imageRendering: 'pixelated' } : { backgroundColor: fallback };
  const layers: Record<string, string[]> = {};
  const add = (sq: string, l: string) => (layers[sq] ??= []).push(l);
  const shadows: Record<string, string> = {};
  const tint = (c: string) => `linear-gradient(${c}, ${c})`;
  if (lastMove) {
    add(lastMove.from, tint('rgba(242, 199, 92, 0.22)'));
    add(lastMove.to, tint('rgba(242, 199, 92, 0.34)'));
  }
  for (const h of highlights) {
    add(h.sq, tint(TONE_BG[h.tone]));
    shadows[h.sq] = `inset 0 0 0 3px ${TONE[h.tone]}`;
  }
  if (chess.inCheck()) {
    const k = chess.board().flat().find((p) => p?.type === 'k' && p.color === turn);
    if (k) add(k.square, 'radial-gradient(circle, rgba(255,60,80,0.95) 0%, rgba(255,60,80,0.45) 50%, transparent 72%)');
  }
  if (selected) {
    add(selected, tint('rgba(255, 231, 163, 0.45)'));
    for (const m of targets)
      add(m.to, m.captured ? 'radial-gradient(circle, transparent 56%, rgba(255,231,163,0.55) 58%, rgba(255,231,163,0.55) 66%, transparent 68%)' : 'conic-gradient(from 45deg at 50% 50%, rgba(255,231,163,.8) 0 25%, transparent 0 50%, rgba(255,231,163,.8) 0 75%, transparent 0) 50% 50% / 22% 22% no-repeat');
  }
  const baseBg = (isLight: boolean) => {
    const url = isLight ? light : dark;
    return url ? `url(${url}) 0 0 / ${mini ? 16 : 32}px ${mini ? 16 : 32}px` : isLight ? '#43345f' : '#183226';
  };
  const squareStyles: Record<string, CSSProperties> = {};
  for (const sq of new Set([...Object.keys(layers), ...Object.keys(shadows)])) {
    const isLight = (sq.charCodeAt(0) - 97 + Number(sq[1])) % 2 === 0;
    squareStyles[sq] = { background: [...(layers[sq] ?? []).reverse(), baseBg(isLight)].join(', '), imageRendering: 'pixelated' };
    if (shadows[sq]) squareStyles[sq].boxShadow = shadows[sq];
  }

  return (
    <div className="relative w-full touch-none select-none" style={{ padding: mini ? 2 : 4, background: 'linear-gradient(180deg,#e0a93a,#8a5a1c)', borderRadius: 4, boxShadow: '0 0 0 2px #1b0f22, 0 0 24px rgba(242,199,92,.25), 0 8px 18px rgba(0,0,0,.6)' }}>
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
            animationDurationInMs: mini ? 0 : 220,
            lightSquareStyle: tile(light, '#43345f'),
            darkSquareStyle: tile(dark, '#183226'),
            lightSquareNotationStyle: { color: '#c9a6ff', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, opacity: 0.8 },
            darkSquareNotationStyle: { color: '#7fd1a5', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, opacity: 0.8 },
            ...(pieces ? { pieces } : {}),
            boardStyle: { opacity: piecesReady ? 1 : 0.0 },
            dragActivationDistance: 6,
            canDragPiece: ({ square }) => !mini && !!square && own(square),
            onPieceDrag: ({ square }) => square && setSelected(square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => (!targetSquare || sourceSquare === targetSquare ? false : attempt(sourceSquare, targetSquare)),
            onSquareClick: mini ? undefined : onSquareClick,
          }}
        />
      </div>
      {promo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55" onClick={() => setPromo(null)}>
          <div className="run-panel flex gap-2 p-3">
            {PROMO.map((p) => {
              const k = `${turn}${p.toUpperCase()}`;
              const url = cached(`pc:${k}:${PX}`);
              return (
                <button
                  key={p}
                  className="h-14 w-14 rounded-lg bg-black/40 ring-1 ring-[var(--gold-dim)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    const m = { ...promo, promotion: p };
                    setPromo(null);
                    setSelected(null);
                    onMove?.(m);
                  }}
                >
                  {url ? <img src={url} alt={p} style={{ imageRendering: 'pixelated', width: '100%' }} /> : p.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
