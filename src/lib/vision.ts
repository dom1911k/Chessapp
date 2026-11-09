// Board vision trainer (chess.com's "Vision"): a square's name appears and you tap it, against the
// clock; or a square lights up and you pick its name. Pure helpers; best scores live in kv.
export type VisionMode = 'find' | 'name';
export type VisionSide = 'white' | 'black';
export const ROUND_SECS = 30;

const FILES = 'abcdefgh';
export const ALL_SQUARES = Array.from({ length: 64 }, (_, i) => `${FILES[i % 8]}${Math.floor(i / 8) + 1}`);

/** The square at a grid cell (row 0 = top of the screen) for the side at the bottom. */
export function squareAt(row: number, col: number, side: VisionSide): string {
  const file = side === 'white' ? col : 7 - col;
  const rank = side === 'white' ? 7 - row : row;
  return `${FILES[file]}${rank + 1}`;
}

/** The grid cell of a square for the side at the bottom (inverse of squareAt). */
export function cellOf(sq: string, side: VisionSide): { row: number; col: number } {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  return side === 'white' ? { row: 7 - r, col: f } : { row: r, col: 7 - f };
}

/** A random square, never the same as the last one. */
export function nextSquare(rng: () => number, last?: string): string {
  let s: string;
  do s = ALL_SQUARES[Math.floor(rng() * 64)];
  while (s === last);
  return s;
}

/** Four answer options for "name the square": the answer plus three near-misses, shuffled. */
export function nameOptions(answer: string, rng: () => number): string[] {
  const f = FILES.indexOf(answer[0]);
  const r = Number(answer[1]);
  const near = new Set<string>();
  // Typical mix-ups: the mirrored file/rank (the other side's view), and neighbours.
  const cand = [
    `${FILES[7 - f]}${r}`,
    `${answer[0]}${9 - r}`,
    `${FILES[7 - f]}${9 - r}`,
    `${FILES[Math.max(0, f - 1)]}${r}`,
    `${FILES[Math.min(7, f + 1)]}${r}`,
    `${answer[0]}${Math.max(1, r - 1)}`,
    `${answer[0]}${Math.min(8, r + 1)}`,
  ].filter((s) => s !== answer);
  while (near.size < 3 && cand.length) near.add(cand.splice(Math.floor(rng() * cand.length), 1)[0]);
  while (near.size < 3) {
    const s = nextSquare(rng, answer);
    if (s !== answer) near.add(s);
  }
  const out = [answer, ...near];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const bestKey = (mode: VisionMode, side: VisionSide) => `vision:${mode}:${side}`;
