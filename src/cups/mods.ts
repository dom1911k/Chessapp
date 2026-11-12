// What changes the opponent's play in a cup game: boons (Rattled) and quirks (stage 4). Only Maia/engine behaviour and time ever change;
// the rules of chess never do.
import type { CupGameState } from './game';
import { TUNING } from './tuning';

export interface BotMods {
  /** Added to the opponent's Maia temperature (higher = looser, more human slips). */
  tempDelta: number;
  /** Multiply Maia's probability of a move (uci → factor); 1 = unchanged. */
  reweight?: (uci: string, fen: string) => number;
  /** Think-time multiplier. */
  thinkFactor: number;
  /** A move the opponent wants to play from its opening plans (SAN history → uci or null). */
  openingMove?: (sans: string[], fen: string) => string | null;
}

export function botMods(g: CupGameState): BotMods {
  let tempDelta = 0;
  // Rattled (boon): the opponent plays looser for a few moves after losing material.
  if (g.rattled > 0 && g.boons.includes('rattled')) tempDelta += TUNING.boons.rattledTemp;
  return { tempDelta, thinkFactor: 1 };
}
