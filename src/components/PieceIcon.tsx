// One way to draw a chess piece everywhere (board, captured pieces, previews, promotion, intro):
// image sets (Kaneo) as <img>, fill sets as react-chessboard's vector pieces recoloured.
import type { CSSProperties } from 'react';
import { defaultPieces, type PieceRenderObject } from 'react-chessboard';
import { PIECE_SETS, type PieceSet } from '../lib/rewards/looks';
import { useSettings } from '../lib/settings';

export type PieceCode = keyof typeof defaultPieces;

const setOf = (id: string): PieceSet => PIECE_SETS[id] ?? PIECE_SETS.kaneo;

const IMG_STYLE: CSSProperties = { width: '100%', height: '100%', display: 'block', pointerEvents: 'none' };

/** One piece of a set, filling its box. `setId` defaults to the chosen piece set. */
export function PieceIcon({ code, setId, size, className = '' }: { code: PieceCode; setId?: string; size?: number; className?: string }) {
  const chosen = useSettings((s) => s.pieceStyle);
  const set = setOf(setId ?? chosen);
  const box: CSSProperties | undefined = size ? { width: size, height: size } : undefined;
  const c = code[0] as 'w' | 'b';
  if (set.images?.[code]) {
    return (
      <span className={`block ${className}`} style={box}>
        <img src={set.images[code]} alt="" draggable={false} style={IMG_STYLE} />
      </span>
    );
  }
  return (
    <span className={`block ${className}`} style={{ ...box, filter: set.filter?.[c] }}>
      {defaultPieces[code]({ fill: set.fill?.[c] })}
    </span>
  );
}

/** Whether a set is drawn from images (no outline hack needed: the art has its own). */
export const isImageSet = (id: string) => !!setOf(id).images;

/** The piece renderers react-chessboard should use for a set (undefined = its own defaults). Cached. */
const cache = new Map<string, PieceRenderObject>();
export function renderSet(setId: string, large: boolean): PieceRenderObject | undefined {
  const set = setOf(setId);
  if (!set.images && !set.fill && !large) return undefined;
  const key = setId + large;
  let out = cache.get(key);
  if (out) return out;
  const scale: CSSProperties = large ? { transform: 'scale(1.16)', transformOrigin: '50% 60%' } : {};
  out = Object.fromEntries(
    Object.entries(defaultPieces).map(([k, render]) => [
      k,
      set.images?.[k]
        ? () => <img src={set.images![k]} alt="" draggable={false} style={{ ...IMG_STYLE, ...scale }} />
        : (props?: { fill?: string; square?: string; svgStyle?: CSSProperties }) => {
            const c = k[0] as 'w' | 'b';
            return render({
              ...props,
              fill: set.fill?.[c] ?? props?.fill,
              svgStyle: { ...props?.svgStyle, ...scale, ...(set.filter?.[c] ? { filter: set.filter[c] } : {}) },
            });
          },
    ]),
  );
  cache.set(key, out);
  return out;
}
