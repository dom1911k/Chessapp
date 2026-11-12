// What changes the opponent's play and the clocks in a cup game. Stage 2: nothing yet — boons
// (stage 3) and quirks (stage 4) plug in here. Only Maia/engine behaviour and time ever change;
// the rules of chess never do.
import type { CupGameState } from './game';

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

export function botMods(_g: CupGameState): BotMods {
  void _g;
  return { tempDelta: 0, thinkFactor: 1 };
}
