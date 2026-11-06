// Small board helpers kept out of the component so they can be tested: which sound a move
// makes, which squares a premove may target, and which square sits under a screen point.
import { Chess, type Square } from 'chess.js';
import type { SoundName } from '../sound';

const pieceCount = (fen: string) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;

/** The sound for the move that turned `before` into `after`. `myColor` is the side at the bottom. */
export function moveSound(before: string, after: string, lastMove: { from: string; to: string }, myColor: 'w' | 'b'): SoundName {
  const c = new Chess(after);
  const moved = c.get(lastMove.to as Square);
  let wasPawn = false;
  try {
    wasPawn = new Chess(before).get(lastMove.from as Square)?.type === 'p';
  } catch {
    /* not a legal FEN: ignore */
  }
  const promoted = wasPawn && moved?.type !== 'p' && /[18]$/.test(lastMove.to);
  const castle = moved?.type === 'k' && Math.abs(lastMove.to.charCodeAt(0) - lastMove.from.charCodeAt(0)) === 2;
  const mine = !moved || moved.color === myColor;
  if (c.inCheck()) return 'check';
  if (promoted) return 'promote';
  if (pieceCount(after) < pieceCount(before)) return 'capture';
  if (castle) return 'castle';
  return mine ? 'move' : 'moveOpp';
}

/**
 * Squares a premove from `from` may target: the piece's moves as if it were `color`'s turn,
 * plus pawn captures onto empty squares (you may be expecting a recapture there).
 */
export function premoveTargets(fen: string, color: 'w' | 'b', from: string): string[] {
  try {
    const parts = fen.split(' ');
    parts[1] = color;
    parts[3] = '-';
    const c = new Chess(parts.join(' '), { skipValidation: true });
    const piece = c.get(from as Square);
    if (!piece || piece.color !== color) return [];
    const out = new Set(c.moves({ square: from as Square, verbose: true }).map((m) => m.to as string));
    if (piece.type === 'p') {
      const f = from.charCodeAt(0);
      const r = Number(from[1]) + (color === 'w' ? 1 : -1);
      if (r >= 1 && r <= 8)
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (nf < 97 || nf > 104) continue;
          const sq = String.fromCharCode(nf) + r;
          const there = c.get(sq as Square);
          if (!there || there.color !== color) out.add(sq);
        }
    }
    return [...out];
  } catch {
    return [];
  }
}

/** The square under a point (x, y) inside a board rectangle, for the given orientation. */
export function squareAtPoint(r: { left: number; top: number; width: number; height: number }, x: number, y: number, orientation: 'white' | 'black'): string | null {
  const fx = Math.floor(((x - r.left) / r.width) * 8);
  const fy = Math.floor(((y - r.top) / r.height) * 8);
  if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
  const file = orientation === 'white' ? fx : 7 - fx;
  const rank = orientation === 'white' ? 7 - fy : fy;
  return String.fromCharCode(97 + file) + (rank + 1);
}
