// Draw offers in real games, both ways (round 7). Pure rules; the play store asks them.
// Not in Cups or Play Coach. The result reason is 'agreement' ("Draw by agreement").

export const DRAWS = {
  /** You can offer from this move on, and again only after this many more moves. */
  fromMove: 10,
  againAfterMoves: 10,
  /** The bot accepts at +0.5 or less for itself in an endgame or after move 30, or when it's worse (−1.5). */
  levelCp: 50,
  lateMove: 30,
  worseCp: -150,
  /** Turtle and Endgame Grinder accept more readily: up to +1, and from move 20. */
  readyCp: 100,
  readyMove: 20,
  /** The bot offers only from 800, at most twice a game, ten moves apart. */
  offerFromElo: 800,
  maxBotOffers: 2,
  /** When its evaluation stayed within ±0.3 for 6 of its moves in an endgame, or the position repeated twice. */
  quietCp: 30,
  quietMoves: 6,
};

/** Types that want a draw sooner, and types that play on. */
const READY = new Set(['turtle', 'endgameGrinder']);
const PLAYS_ON = new Set(['gambiteer', 'comebackKid', 'tilter']);

export interface DrawState {
  /** Ply of your last offer. */
  userAt?: number;
  /** Offers the bot has made, and the ply of its last one. */
  botCount?: number;
  botAt?: number;
  /** An offer waiting for an answer. */
  pending?: 'user' | 'bot';
}

/** "Offer draw" is on: a real game, from move 10, and 10 moves after your last offer. */
export function canOfferDraw(g: { plies: unknown[]; coach?: unknown; cup?: unknown; draws?: DrawState }): boolean {
  if (g.coach || g.cup) return false;
  const moveNo = Math.floor(g.plies.length / 2) + 1;
  if (moveNo < DRAWS.fromMove || g.draws?.pending) return false;
  return g.draws?.userAt === undefined || g.plies.length - g.draws.userAt >= DRAWS.againAfterMoves * 2;
}

/**
 * Does the bot accept your offer? `evalCp` is its evaluation for itself. Below 800 people play on
 * unless clearly worse; Turtle and Endgame Grinder accept more readily; Gambiteer, Comeback Kid
 * and Tilter decline.
 */
export function botAcceptsDraw(o: { evalCp: number | undefined; elo: number; moveNo: number; endgame: boolean; types?: string[] }): boolean {
  if (o.evalCp === undefined) return false;
  const types = o.types ?? [];
  if (types.some((t) => PLAYS_ON.has(t))) return false;
  if (o.evalCp <= DRAWS.worseCp) return true;
  if (o.elo < 800) return false;
  const ready = types.some((t) => READY.has(t));
  const level = ready ? DRAWS.readyCp : DRAWS.levelCp;
  const late = o.endgame || o.moveNo > (ready ? DRAWS.readyMove : DRAWS.lateMove);
  return late && o.evalCp <= level;
}

/** Does the bot offer a draw after its move? `evals`: its evaluations after each of its moves (for itself). */
export function botOffersDraw(o: { elo: number; draws?: DrawState; plies: number; evals: number[]; endgame: boolean; repeated: boolean; types?: string[] }): boolean {
  if (o.elo < DRAWS.offerFromElo || o.draws?.pending) return false;
  if ((o.draws?.botCount ?? 0) >= DRAWS.maxBotOffers) return false;
  if (o.draws?.botAt !== undefined && o.plies - o.draws.botAt < DRAWS.againAfterMoves * 2) return false;
  if ((o.types ?? []).some((t) => PLAYS_ON.has(t))) return false;
  const recent = o.evals.slice(-DRAWS.quietMoves);
  const quiet = o.endgame && recent.length >= DRAWS.quietMoves && recent.every((e) => Math.abs(e) <= DRAWS.quietCp);
  return quiet || o.repeated;
}

/** The position after the last ply has been on the board twice before (a third time now). */
export function repeatedTwice(fens: string[]): boolean {
  const key = (f: string) => f.split(' ').slice(0, 4).join(' ');
  const last = key(fens[fens.length - 1] ?? '');
  return fens.slice(0, -1).filter((f) => key(f) === last).length >= 2;
}
