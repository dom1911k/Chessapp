// Captured pieces and material balance, read straight from the FENs (no move history needed).

export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q';

const VALUE: Record<PieceKind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const KINDS: PieceKind[] = ['p', 'n', 'b', 'r', 'q'];

function count(fen: string) {
  const c = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of fen.split(' ')[0]) {
    const k = ch.toLowerCase() as PieceKind;
    if (!(k in VALUE)) continue;
    c[ch === k ? 'b' : 'w'][k]++;
  }
  return c;
}

export interface Material {
  /** Pieces of each colour that have left the board, cheapest first. */
  lost: { w: PieceKind[]; b: PieceKind[] };
  /** White's material minus black's, in pawns. */
  diff: number;
}

export function material(fen: string, startFen: string): Material {
  const now = count(fen);
  const start = count(startFen);
  const lost = { w: [] as PieceKind[], b: [] as PieceKind[] };
  let diff = 0;
  for (const side of ['w', 'b'] as const) {
    // A promoted pawn shows up as an extra queen and a missing pawn: count it as a lost pawn only.
    let promoted = 0;
    for (const k of KINDS) if (k !== 'p') promoted += Math.max(0, now[side][k] - start[side][k]);
    for (const k of KINDS) {
      const gone = k === 'p' ? start[side].p - now[side].p - promoted : start[side][k] - now[side][k];
      for (let i = 0; i < gone; i++) lost[side].push(k);
      diff += (side === 'w' ? 1 : -1) * VALUE[k] * now[side][k];
    }
  }
  return { lost, diff };
}
