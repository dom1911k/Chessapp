// Maia-3 inputs and outputs (mirrors maia3/dataset.py and scripts/maia3/convert.py).
// Squares are numbered a1 = 0 … h8 = 63. Every position is seen from its own side to move:
// with Black to move the board is mirrored (ranks flipped, colours swapped).

export const HISTORY = 8;
export const PLANES = 12;
export const TOKEN_DIM = HISTORY * PLANES; // 96
export const MOVE_COUNT = 64 * 64 + 256;

const PIECE = 'pnbrqk';

/** 64 × 12 one-hot planes for one FEN, from its side to move. */
function planes(fen: string): Uint8Array {
  const [placement, turn] = fen.split(' ');
  const out = new Uint8Array(64 * PLANES);
  const black = turn === 'b';
  let rank = 7;
  let file = 0;
  for (const ch of placement) {
    if (ch === '/') {
      rank--;
      file = 0;
    } else if (ch >= '1' && ch <= '8') file += Number(ch);
    else {
      const isWhite = ch === ch.toUpperCase();
      const type = PIECE.indexOf(ch.toLowerCase());
      let sq = rank * 8 + file;
      let mine = isWhite;
      if (black) {
        sq ^= 56; // mirror ranks
        mine = !isWhite; // and swap colours
      }
      out[sq * PLANES + type + (mine ? 0 : 6)] = 1;
      file++;
    }
  }
  return out;
}

/**
 * The model's token input for the last position of `fens` (the game so far, oldest first):
 * float32 [64 × 96], the last 8 positions per square, padded with the oldest when short.
 */
export function encodeHistory(fens: string[]): Float32Array {
  const recent = fens.slice(-HISTORY);
  while (recent.length < HISTORY) recent.unshift(recent[0]);
  const out = new Float32Array(64 * TOKEN_DIM);
  recent.forEach((fen, h) => {
    const p = planes(fen);
    for (let sq = 0; sq < 64; sq++) for (let k = 0; k < PLANES; k++) if (p[sq * PLANES + k]) out[sq * TOKEN_DIM + h * PLANES + k] = 1;
  });
  return out;
}

const sqIndex = (s: string) => (s.charCodeAt(0) - 97) + (Number(s[1]) - 1) * 8;
const PROMO = 'qrbn';

/** Index of a move (UCI, e.g. "e2e4", "e7e8q", castling as "e1g1") in the model's output, for the side to move. */
export function moveIndex(uci: string, blackToMove: boolean): number {
  let from = sqIndex(uci.slice(0, 2));
  let to = sqIndex(uci.slice(2, 4));
  if (blackToMove) {
    from ^= 56;
    to ^= 56;
  }
  if (uci.length > 4) return 4096 + ((from % 8) * 8 + (to % 8)) * 4 + PROMO.indexOf(uci[4]);
  return from * 64 + to;
}
