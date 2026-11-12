// What changes the opponent's play in a cup game: the Rattled boon and the opponent's quirks.
// Only Maia/engine behaviour and think time ever change; the rules of chess never do.
import { Chess, type Move } from 'chess.js';
import type { CupGameState } from './game';
import { quirkEffects, quirkById, type QuirkCtx } from './quirks';
import { TUNING } from './tuning';

export interface BotMods {
  /** Added to the opponent's Maia temperature (higher = looser, more human slips). */
  tempDelta: number;
  /** Multiply Maia's probability of a move (uci → factor); 1 = unchanged. */
  reweight?: (uci: string) => number;
  /** Think-time multiplier. */
  thinkFactor: number;
}

/** Quirks in force this game: the visible one, plus the finalist's hidden one. */
export const activeQuirks = (g: Pick<CupGameState, 'quirks' | 'hidden'>) => [...g.quirks, ...(g.hidden ? [g.hidden] : [])];

/** The opponent's situation, as quirks see it. */
export function quirkCtx(g: CupGameState, fen: string, extra: { botEval?: number; botLeftMs: number }): QuirkCtx {
  const sans = [...(g.prelude ?? []), ...g.plies.map((p) => p.san)];
  const bot = g.userColor === 'w' ? 'b' : 'w';
  const lastUser = [...g.plies].reverse().find((p) => p.isUser);
  return {
    fen,
    sans,
    moveNo: Math.floor(sans.length / 2) + 1,
    bot,
    me: g.userColor,
    botEval: extra.botEval,
    botLeftMs: extra.botLeftMs,
    state: g.qstate,
    lastUserUci: lastUser?.uci,
    fromStart: g.startFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' || !!g.prelude,
  };
}

export function botMods(g: CupGameState, ctx: QuirkCtx): BotMods {
  const q = quirkEffects(activeQuirks(g), ctx);
  let tempDelta = q.temp;
  // Rattled (boon): the opponent plays looser for a few moves after losing material.
  if (g.rattled > 0 && g.boons.includes('rattled')) tempDelta += TUNING.boons.rattledTemp;
  const moves = new Map<string, Move>(new Chess(ctx.fen).moves({ verbose: true }).map((m) => [m.lan, m]));
  return {
    tempDelta,
    thinkFactor: q.think,
    reweight: (uci) => {
      const m = moves.get(uci);
      return m ? q.weight(m) : 1;
    },
  };
}

/** The quirks' own opening plans (first quirk with a move wins). */
export function quirkOpening(g: CupGameState, ctx: QuirkCtx, rand: () => number): { uci: string; quirk: string } | null {
  for (const id of activeQuirks(g)) {
    const uci = quirkById(id)?.opening?.(ctx, rand);
    if (uci) return { uci, quirk: id };
  }
  return null;
}
