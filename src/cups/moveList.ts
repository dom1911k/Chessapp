// The cup game's move list: numbered tokens for the opening the game started after (dimmed)
// and the moves played, numbered from the start position.
export interface MoveToken {
  /** "12." before a White move, "12…" before a Black move that opens the list. */
  no?: string;
  san: string;
  dim: boolean;
  last: boolean;
}

export function moveTokens(prelude: string[], sans: string[], startFen: string): MoveToken[] {
  const [, side, , , , full] = startFen.split(' ');
  const toks: MoveToken[] = [];
  const push = (list: string[], firstNo: number, blackFirst: boolean, dim: boolean, lastIdx: number) =>
    list.forEach((san, i) => {
      const k = i + (blackFirst ? 1 : 0);
      const no = firstNo + Math.floor(k / 2);
      toks.push({ no: k % 2 === 0 ? `${no}.` : i === 0 ? `${no}…` : undefined, san, dim, last: i === lastIdx });
    });
  if (prelude.length) push(prelude, 1, false, true, -1);
  push(sans, Number(full) || 1, side === 'b', false, sans.length - 1);
  return toks;
}
