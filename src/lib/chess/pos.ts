// Lightweight board model used for tactical analysis (attacks, exchanges,
// pins…). chess.js handles legality; this module answers "who attacks what".

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece {
  type: PieceType;
  color: Color;
}
export interface Pos {
  board: (Piece | null)[]; // index = rank * 8 + file, a1 = 0, h8 = 63
  turn: Color;
  fen: string;
}

export const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const PIECE_NAME: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');

export function sqIndex(name: string): number {
  return (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
}
export function sqName(i: number): string {
  return String.fromCharCode(97 + (i & 7)) + String.fromCharCode(49 + (i >> 3));
}
export const fileOf = (i: number) => i & 7;
export const rankOf = (i: number) => i >> 3;

export function parseFen(fen: string): Pos {
  const [placement, turn] = fen.split(' ');
  const board: (Piece | null)[] = new Array(64).fill(null);
  const rows = placement.split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        f += Number(ch);
        continue;
      }
      const lower = ch.toLowerCase() as PieceType;
      board[(7 - r) * 8 + f] = { type: lower, color: ch === lower ? 'b' : 'w' };
      f++;
    }
  }
  return { board, turn: (turn as Color) ?? 'w', fen };
}

const KNIGHT = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
export const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function step(i: number, df: number, dr: number): number {
  const f = fileOf(i) + df;
  const r = rankOf(i) + dr;
  return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f;
}

export function directionsFor(type: PieceType): number[][] {
  if (type === 'r') return ORTHO;
  if (type === 'b') return DIAG;
  if (type === 'q') return [...ORTHO, ...DIAG];
  return [];
}

/** Squares attacked by the piece standing on `from` (given the board occupancy). */
export function attacksFrom(board: (Piece | null)[], from: number): number[] {
  const p = board[from];
  if (!p) return [];
  const out: number[] = [];
  if (p.type === 'p') {
    const dr = p.color === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const t = step(from, df, dr);
      if (t >= 0) out.push(t);
    }
  } else if (p.type === 'n' || p.type === 'k') {
    for (const [df, dr] of p.type === 'n' ? KNIGHT : KING) {
      const t = step(from, df, dr);
      if (t >= 0) out.push(t);
    }
  } else {
    for (const [df, dr] of directionsFor(p.type)) {
      let t = step(from, df, dr);
      while (t >= 0) {
        out.push(t);
        if (board[t]) break;
        t = step(t, df, dr);
      }
    }
  }
  return out;
}

/** Squares of `color`'s pieces that attack `target`. */
export function attackersOf(board: (Piece | null)[], target: number, color: Color): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && attacksFrom(board, i).includes(target)) out.push(i);
  }
  return out;
}

export function kingSquare(board: (Piece | null)[], color: Color): number {
  return board.findIndex((p) => p?.type === 'k' && p.color === color);
}

/**
 * Static exchange evaluation: material `side` expects to win by starting a
 * capture sequence on `target` (both sides always recapture with their least
 * valuable piece and may stop at any time). Returns 0 if `side` can't capture.
 */
export function see(board: (Piece | null)[], target: number, side: Color): number {
  const b = board.slice();
  const victim = b[target];
  if (!victim || victim.color === side) return 0;
  const gains: number[] = [];
  let captured = VALUE[victim.type];
  let mover = side;
  for (let depth = 0; depth < 32; depth++) {
    const atk = attackersOf(b, target, mover);
    if (!atk.length) break;
    atk.sort((x, y) => VALUE[b[x]!.type] - VALUE[b[y]!.type]);
    const from = atk[0];
    const piece = b[from]!;
    // A king may only capture if the square is no longer defended.
    if (piece.type === 'k') {
      const bb = b.slice();
      bb[target] = piece;
      bb[from] = null;
      if (attackersOf(bb, target, other(mover)).length) break;
    }
    gains.push(captured);
    captured = VALUE[piece.type];
    b[target] = piece;
    b[from] = null;
    mover = other(mover);
  }
  if (!gains.length) return 0;
  // Negamax the gain list backwards: each side can stop capturing.
  let score = 0;
  for (let i = gains.length - 1; i >= 0; i--) score = Math.max(0, gains[i] - score);
  return score;
}

/** Pieces of `color` (not the king) the opponent can win material from right now. */
export function hangingPieces(board: (Piece | null)[], color: Color): { sq: number; loss: number }[] {
  const out: { sq: number; loss: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.color !== color || p.type === 'k') continue;
    const loss = see(board, i, other(color));
    if (loss > 0) out.push({ sq: i, loss });
  }
  return out.sort((a, b) => b.loss - a.loss);
}

export function isDefended(board: (Piece | null)[], sq: number): boolean {
  const p = board[sq];
  if (!p) return false;
  return attackersOf(board, sq, p.color).length > 0;
}

export function material(board: (Piece | null)[], color: Color): number {
  let m = 0;
  for (const p of board) if (p && p.color === color && p.type !== 'k') m += VALUE[p.type];
  return m;
}

/** Material balance from `color`'s point of view. */
export function materialBalance(board: (Piece | null)[], color: Color): number {
  return material(board, color) - material(board, other(color));
}

/** Pieces on a ray from `from` in direction (df, dr), in order. */
export function ray(board: (Piece | null)[], from: number, df: number, dr: number): number[] {
  const out: number[] = [];
  let t = step(from, df, dr);
  while (t >= 0) {
    if (board[t]) out.push(t);
    t = step(t, df, dr);
  }
  return out;
}

/** Apply a UCI move on a raw board (no legality checks; handles castling, e.p., promotion). */
export function applyUci(board: (Piece | null)[], uci: string): (Piece | null)[] {
  const b = board.slice();
  const from = sqIndex(uci.slice(0, 2));
  const to = sqIndex(uci.slice(2, 4));
  const p = b[from];
  if (!p) return b;
  if (p.type === 'k' && Math.abs(fileOf(to) - fileOf(from)) === 2) {
    const rank = rankOf(from);
    const [rf, rt] = fileOf(to) === 6 ? [7, 5] : [0, 3];
    b[rank * 8 + rt] = b[rank * 8 + rf];
    b[rank * 8 + rf] = null;
  }
  if (p.type === 'p' && fileOf(from) !== fileOf(to) && !b[to]) {
    b[rankOf(from) * 8 + fileOf(to)] = null; // en passant
  }
  b[to] = uci.length > 4 ? { type: uci[4] as PieceType, color: p.color } : p;
  b[from] = null;
  return b;
}
