// Opponent quirks. Every cup opponent has one you can see; the finalist also has a hidden one.
// Quirks only change Maia/engine behaviour — opening choice, temperature, think time and the
// weight of Maia's move probabilities. Never the rules. Add a quirk by adding an entry to QUIRKS.
import { Chess, type Move } from 'chess.js';
import type { Color } from '../lib/chess/pos';
import { TRAPS } from '../lib/traps';
import { TUNING } from './tuning';

const Q = TUNING.quirks;
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** What a quirk knows about the position when the opponent is to move. */
export interface QuirkCtx {
  fen: string;
  /** SAN from the starting position (Home Prep / Battlefield moves included). */
  sans: string[];
  /** The opponent's move number (1, 2, …). */
  moveNo: number;
  bot: Color;
  me: Color;
  /** The opponent's evaluation (centipawns, its point of view), when known. */
  botEval?: number;
  botLeftMs: number;
  /** Counters kept per game (e.g. Tilter's moves left). */
  state: Record<string, number>;
  /** Your last move. */
  lastUserUci?: string;
  /** The game started from the normal starting position (opening lines apply). */
  fromStart: boolean;
}

export interface Quirk {
  id: string;
  name: string;
  /** Pixel sprite for the icon. */
  glyph: string;
  /** One plain sentence for the opponent card. */
  text: string;
  /** What the icon says when it acts. */
  act: string;
  temp?(c: QuirkCtx): number;
  think?(c: QuirkCtx): number;
  /** Multiply Maia's probability of this move. */
  weight?(c: QuirkCtx, m: Move): number;
  /** A move from the quirk's opening plans (uci), or null. */
  opening?(c: QuirkCtx, rand: () => number): string | null;
  /** Did this quirk visibly act with the move just played? */
  acted?(c: QuirkCtx, m: Move, fromOpening: boolean): boolean;
  /** After your move: change the quirk's counters (e.g. you just won material from it). */
  afterUserMove?(c: QuirkCtx, botMaterialLost: number): Record<string, number> | null;
}

/** The next move for `bot` in any of `lines` that the game is still following. */
export function lineMove(lines: string[][], sans: string[], fen: string, rand: () => number): string | null {
  const n = sans.length;
  const next = lines.filter((l) => l.length > n && sans.every((m, i) => l[i] === m)).map((l) => l[n]);
  if (!next.length) return null;
  const san = next[Math.floor(rand() * next.length)];
  try {
    return new Chess(fen).move(san).lan;
  } catch {
    return null;
  }
}

const isTrade = (m: Move) => !!m.captured && VAL[m.captured] === VAL[m.piece] && m.piece !== 'p';
const queensOff = (fen: string) => !/q/i.test(fen.split(' ')[0]);
const kingFile = (fen: string, color: Color) => {
  const c = new Chess(fen);
  for (const row of c.board()) for (const sq of row) if (sq && sq.type === 'k' && sq.color === color) return sq.square[0];
  return 'e';
};
const mirror = (uci: string) => uci.replace(/[1-8]/g, (r) => String(9 - Number(r)));

const GAMBITS: Record<Color, string[][]> = {
  w: [
    "e4 e5 f4", // King's Gambit
    'e4 e5 d4 exd4 c3', // Danish
    'e4 c5 d4 cxd4 c3', // Smith-Morra
    'e4 e5 Nf3 Nc6 Bc4 Bc5 b4', // Evans
    'd4 d5 c4', // Queen's Gambit
  ].map((l) => l.split(' ')),
  b: [
    'd4 e5', // Englund
    'd4 Nf6 c4 e5', // Budapest
    'd4 Nf6 c4 c5 d5 b5', // Benko
    'e4 e5 Nf3 d5', // Elephant
    'e4 e5 Nf3 f5', // Latvian
    'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5', // Traxler
  ].map((l) => l.split(' ')),
};

const TRAP_LINES: Record<Color, string[][]> = {
  w: TRAPS.filter((t) => t.victim === 'b').map((t) => t.line),
  b: TRAPS.filter((t) => t.victim === 'w').map((t) => t.line),
};

const EARLY_QUEEN: Record<Color, string[][]> = {
  w: ['e4 e5 Qh5', 'e4 e5 Bc4 Nc6 Qf3', 'e4 e5 Bc4 Nf6 Qf3'].map((l) => l.split(' ')),
  b: ['e4 e5 Nf3 Qf6', 'd4 d5 c4 Qd6', 'e4 e5 Bc4 Qg5'].map((l) => l.split(' ')),
};

export const QUIRKS: Quirk[] = [
  {
    id: 'speedster', name: 'Speedster', glyph: 'bolt', act: 'Speedster: moves almost at once',
    text: 'Moves fast and a little loose.',
    think: () => Q.speedster.think,
    temp: () => Q.speedster.temp,
    acted: (c) => c.moveNo === 1 || c.moveNo % 10 === 0,
  },
  {
    id: 'timeTrouble', name: 'Time Trouble', glyph: 'hourglass', act: 'Time Trouble: thinking… and thinking',
    text: 'Thinks for ages in the opening, so the clock often runs low — and nerves crack under a minute.',
    think: (c) => (c.moveNo <= Q.timeTrouble.openingMoves ? Q.timeTrouble.think : 1),
    temp: (c) => (c.botLeftMs < Q.timeTrouble.lowMs ? Q.timeTrouble.lowTemp : 0),
    acted: (c) => c.moveNo === 2 || (c.botLeftMs < Q.timeTrouble.lowMs && !c.state.ttLow),
  },
  {
    id: 'gambiteer', name: 'Gambiteer', glyph: 'dice', act: 'Gambiteer: offers a pawn',
    text: 'Opens with a gambit and gives up a pawn for quick play.',
    opening: (c, r) => (c.fromStart ? lineMove(GAMBITS[c.bot], c.sans, c.fen, r) : null),
    acted: (c, m, fromOpening) => fromOpening && m.piece === 'p' && c.moveNo <= Q.gambiteer.offerMaxMove && GAMBITS[c.bot].some((l) => l.length === c.sans.length + 1 && l[c.sans.length] === m.san),
  },
  {
    id: 'trapper', name: 'Trapper', glyph: 'skull', act: 'Trapper: steering into a trap line',
    text: 'Knows the classic opening traps and steers into them whenever it can.',
    opening: (c, r) => (c.fromStart ? lineMove(TRAP_LINES[c.bot], c.sans, c.fen, r) : null),
    acted: (_c, _m, fromOpening) => fromOpening,
  },
  {
    id: 'earlyQueen', name: 'Early Queen', glyph: 'crown', act: 'Early Queen: out comes the queen',
    text: 'Brings the queen out early, looking for quick attacks.',
    opening: (c, r) => (c.fromStart ? lineMove(EARLY_QUEEN[c.bot], c.sans, c.fen, r) : null),
    weight: (c, m) => (m.piece === 'q' && c.moveNo <= Q.earlyQueen.untilMove ? Q.earlyQueen.weight : 1),
    acted: (c, m) => m.piece === 'q' && c.moveNo <= Q.earlyQueen.untilMove,
  },
  {
    id: 'turtle', name: 'Turtle', glyph: 'shield', act: 'Turtle: offers a trade',
    text: 'Plays solid, likes even trades and is happy with a draw.',
    temp: () => Q.turtle.temp,
    weight: (_c, m) => (isTrade(m) ? Q.turtle.tradeWeight : m.san.includes('+') ? Q.turtle.checkWeight : 1),
    acted: (_c, m) => isTrade(m),
  },
  {
    id: 'tilter', name: 'Tilter', glyph: 'flame', act: 'Tilter: on tilt after losing material',
    text: 'After losing material, plays recklessly for a while.',
    temp: (c) => ((c.state.tilt ?? 0) > 0 ? Q.tilter.temp : 0),
    afterUserMove: (_c, lost) => (lost > 0 ? { tilt: Q.tilter.moves } : null),
  },
  {
    id: 'comebackKid', name: 'Comeback Kid', glyph: 'feather', act: 'Comeback Kid: digs in when worse',
    text: 'Plays its most accurate chess when it is losing.',
    temp: (c) => (c.botEval !== undefined && c.botEval < Q.comebackKid.belowCp ? Q.comebackKid.temp : 0),
    acted: (c) => c.botEval !== undefined && c.botEval < Q.comebackKid.belowCp && !c.state.ckOn,
  },
  {
    id: 'slowStarter', name: 'Slow Starter', glyph: 'moon', act: 'Slow Starter: warming up',
    text: `Shaky in the first ${Q.slowStarter.moves} moves, then plays normally.`,
    temp: (c) => (c.moveNo <= Q.slowStarter.moves ? Q.slowStarter.temp : 0),
    acted: (c) => c.moveNo === 1 || c.moveNo === Q.slowStarter.moves + 1,
  },
  {
    id: 'endgameGrinder', name: 'Endgame Grinder', glyph: 'gear', act: 'Endgame Grinder: heading for the endgame',
    text: 'Trades down when the game is even, and is at its best once the queens are off.',
    temp: (c) => (queensOff(c.fen) ? Q.endgameGrinder.queensOffTemp : 0),
    weight: (c, m) => {
      if (c.botEval === undefined || Math.abs(c.botEval) > Q.endgameGrinder.evenCp || !m.captured) return 1;
      if (m.piece === 'q' && m.captured === 'q') return Q.endgameGrinder.queenTradeWeight;
      return isTrade(m) ? Q.endgameGrinder.tradeWeight : 1;
    },
    acted: (_c, m) => isTrade(m),
  },
  {
    id: 'pawnStormer', name: 'Pawn Stormer', glyph: 'axe', act: 'Pawn Stormer: pawns march at your king',
    text: 'Throws the pawns on your king’s side of the board forward.',
    weight: (c, m) => {
      if (m.piece !== 'p' || c.moveNo < Q.pawnStormer.fromMove || m.captured) return 1;
      const kf = kingFile(c.fen, c.me);
      const side = 'fgh'.includes(kf) ? 'fgh' : 'abc'.includes(kf) ? 'abc' : '';
      return side.includes(m.from[0]) ? Q.pawnStormer.weight : 1;
    },
    acted: (c, m) => m.piece === 'p' && !m.captured && c.moveNo >= Q.pawnStormer.fromMove && ('fgh'.includes(kingFile(c.fen, c.me)) ? 'fgh' : 'abc').includes(m.from[0]),
  },
  {
    id: 'pawnGrabber', name: 'Pawn Grabber', glyph: 'bag', act: 'Pawn Grabber: grabs a pawn',
    text: 'Takes any pawn on offer, poisoned or not.',
    weight: (_c, m) => (m.captured === 'p' ? Q.pawnGrabber.weight : 1),
    acted: (_c, m) => m.captured === 'p',
  },
  {
    id: 'copycat', name: 'Copycat', glyph: 'cards', act: 'Copycat: mirrors your move',
    text: 'Copies your moves in the opening while it can.',
    weight: (c, m) => (c.lastUserUci && c.moveNo <= Q.copycat.untilMove && m.lan === mirror(c.lastUserUci) ? Q.copycat.weight : 1),
    acted: (c, m) => !!c.lastUserUci && c.moveNo <= Q.copycat.untilMove && m.lan === mirror(c.lastUserUci),
  },
  {
    id: 'uncastled', name: 'Uncastled', glyph: 'tower', act: 'Uncastled: the king stays in the centre',
    text: 'Delays castling and keeps the king in the centre.',
    weight: (c, m) => (c.moveNo <= Q.uncastled.untilMove && (m.flags.includes('k') || m.flags.includes('q')) ? Q.uncastled.castleWeight : 1),
    acted: (c) => c.moveNo === Q.uncastled.noticeAtMove && 'de'.includes(kingFile(c.fen, c.bot)),
  },
];

export const quirkById = (id: string | undefined) => QUIRKS.find((q) => q.id === id);
export const QUIRK_IDS = QUIRKS.map((q) => q.id);

/**
 * Quirks for a cup: one visible quirk per character (no repeats in a cup), avoiding the ones
 * you faced most recently while the pool allows.
 */
export function assignQuirks(field: string[], recent: string[], rand: () => number): Record<string, string> {
  const fresh = QUIRK_IDS.filter((q) => !recent.includes(q));
  const stale = QUIRK_IDS.filter((q) => recent.includes(q));
  const order = [...shuffled(fresh, rand), ...shuffled(stale, rand)];
  const out: Record<string, string> = {};
  field.forEach((id, i) => (out[id] = order[i % order.length]));
  return out;
}

/** The finalist's hidden quirk: one not used in this cup, avoiding recent ones. */
export function hiddenQuirk(used: string[], recent: string[], rand: () => number): string {
  const left = QUIRK_IDS.filter((q) => !used.includes(q));
  const fresh = left.filter((q) => !recent.includes(q));
  const pool = fresh.length ? fresh : left.length ? left : QUIRK_IDS;
  return pool[Math.floor(rand() * pool.length)];
}

function shuffled<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Combine the active quirks into the opponent's settings for one move. */
export function quirkEffects(ids: string[], c: QuirkCtx): { temp: number; think: number; weight: (m: Move) => number } {
  const qs = ids.map(quirkById).filter((q): q is Quirk => !!q);
  return {
    temp: qs.reduce((t, q) => t + (q.temp?.(c) ?? 0), 0),
    think: qs.reduce((t, q) => t * (q.think?.(c) ?? 1), 1),
    weight: (m) => qs.reduce((w, q) => w * (q.weight?.(c, m) ?? 1), 1),
  };
}
