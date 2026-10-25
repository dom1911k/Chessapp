import { ECO, type OpeningEntry } from './eco';

let index: { moves: string[]; entry: OpeningEntry }[] | null = null;

/** Longest bundled opening whose move sequence is a prefix of the game. */
export function detectOpening(sanMoves: string[]): OpeningEntry | null {
  index ??= ECO.map((entry) => ({ entry, moves: entry.moves.split(' ') }));
  let best: { moves: string[]; entry: OpeningEntry } | null = null;
  for (const o of index) {
    if (o.moves.length > sanMoves.length) continue;
    if (best && o.moves.length <= best.moves.length) continue;
    if (o.moves.every((m, i) => m === sanMoves[i])) best = o;
  }
  return best?.entry ?? null;
}

export type { OpeningEntry } from './eco';
export { ECO } from './eco';
