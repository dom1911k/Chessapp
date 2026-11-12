// Captured pieces and the material balance, from a position.
const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER = ['p', 'n', 'b', 'r', 'q'];

/** Pieces each side has lost (cheapest first) and White's material lead. */
export function material(fen: string): { lost: { w: string[]; b: string[] }; diff: number } {
  const board = fen.split(' ')[0];
  const count = { w: {} as Record<string, number>, b: {} as Record<string, number> };
  for (const ch of board) {
    if (!/[a-z]/i.test(ch)) continue;
    const side = ch === ch.toUpperCase() ? 'w' : 'b';
    const t = ch.toLowerCase();
    count[side][t] = (count[side][t] ?? 0) + 1;
  }
  const lost = { w: [] as string[], b: [] as string[] };
  let value = { w: 0, b: 0 };
  for (const side of ['w', 'b'] as const)
    for (const t of ORDER) {
      const have = count[side][t] ?? 0;
      value = { ...value, [side]: value[side] + have * VAL[t] };
      for (let i = 0; i < Math.max(0, START[t] - have); i++) lost[side].push(t);
    }
  return { lost, diff: value.w - value.b };
}
