// Player types, shared by the characters, Quick match opponents and Cups (round 7; they began as
// Cups' opponent quirks). A type changes how an opponent plays — the rating it plays at in each
// phase (Maia-3 SelfElo), how strong it thinks you are (OppoElo), its think-time habits, when it
// resigns, opening plans and move preferences — never the rules, and (calibrated) not its overall
// strength. Add a type by adding an entry to QUIRKS (and its numbers to TYPE_TUNING).
import { Chess, type Move } from 'chess.js';
import type { Color } from './chess/pos';
import { TRAPS } from './traps';

/*
 * Each type changes how the opponent plays, not how strong it is (calibrated to 40–60% against a
 * plain bot of the same rating). Controls: `elo` / `openingElo` / `laterElo` shift the rating it
 * plays at (by phase or situation), `oppo` shifts how strong it thinks you are, `think` scales its
 * think time, `pressure` makes time pressure start earlier (>1).
 */
export const TYPE_TUNING = {
  speedster: { think: 0.5, temp: 0.1, pressure: 1.8 },
  timeTrouble: { openingMoves: 12, think: 2.6, lowMs: 60_000, lowTemp: 0.6, pressure: 1.4, forget: 3 },
  gambiteer: { offerMaxMove: 6, openingMoves: 12, openingElo: 0 },
  earlyQueen: { untilMove: 10, weight: 5, oppo: -60, realPlanChance: 0.3, realWeight: 1.5 },
  turtle: { tradeWeight: 2.2, checkWeight: 0.6, temp: -0.15, realTemp: 0, think: 1.2 },
  tilter: { moves: 6, elo: -120, realElo: -60, think: 0.6 },
  comebackKid: { belowCp: -150, elo: 150 },
  slowStarter: { moves: 12, openingElo: -40, laterElo: 60 },
  fastStarter: { moves: 12, openingElo: 200, laterElo: -100, think: 0.7 },
  endgameGrinder: { evenCp: 80, tradeWeight: 2.5, queenTradeWeight: 4, queensOffElo: 100, realQueensOffElo: 50 },
  pawnStormer: { fromMove: 6, weight: 3, realWeight: 2 },
  pawnGrabber: { weight: 4 },
  copycat: { untilMove: 4, weight: 100 },
  uncastled: { untilMove: 18, castleWeight: 0.15, noticeAtMove: 12 },
};

const Q = TYPE_TUNING;
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
  /**
   * Real games (characters, Quick match): one draw per game in [0, 1) that decides whether a type
   * goes for its opening plan this game (Cups leave it out: there the plans always apply).
   */
  plan?: number;
}

/** Does the type go for its plan this game? Always in Cups; in real games with `chance`. */
const goesForPlan = (c: QuirkCtx, chance: number) => c.plan === undefined || c.plan < chance;
/** A real game (characters, Quick match): some types use numbers calibrated to the human benchmark there. */
const real = (c: QuirkCtx) => c.plan !== undefined;

export interface Quirk {
  id: string;
  name: string;
  /** Pixel sprite for the icon. */
  glyph: string;
  /** One plain sentence for the opponent card. */
  text: string;
  /** The type in one plain sentence (Scout Report). */
  type: string;
  /** Rating points added to the level it plays at right now (by phase or situation). */
  elo?(c: QuirkCtx): number;
  /** Rating points added to how strong it thinks you are. */
  oppo?(c: QuirkCtx): number;
  /** Time pressure starts this many times earlier (1 = normal). */
  pressure?: number;
  /** Resigning: never (plays on, hoping for stalemate), or early once clearly lost. */
  resign?: 'stubborn' | 'proud';
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

const opening = (c: QuirkCtx, moves: number) => c.moveNo <= moves;

export const QUIRKS: Quirk[] = [
  {
    id: 'speedster', name: 'Speedster', glyph: 'bolt', act: 'Speedster: moves almost at once',
    text: 'Moves fast and a little loose.',
    type: 'Plays everything twice as fast as most people and gets sloppy early when the clock runs down.',
    think: () => Q.speedster.think,
    temp: () => Q.speedster.temp,
    pressure: Q.speedster.pressure,
    acted: (c) => c.moveNo === 1 || c.moveNo % 10 === 0,
  },
  {
    id: 'timeTrouble', name: 'Time Trouble', glyph: 'hourglass', act: 'Time Trouble: thinking… and thinking',
    text: 'Thinks for ages in the opening, so the clock often runs low — and nerves crack under a minute.',
    type: 'Spends ages on the opening, then panics and plays fast and loose when the clock runs low.',
    think: (c) => (opening(c, Q.timeTrouble.openingMoves) ? Q.timeTrouble.think : 1),
    temp: (c) => (c.botLeftMs < Q.timeTrouble.lowMs ? Q.timeTrouble.lowTemp : 0),
    pressure: Q.timeTrouble.pressure,
    acted: (c) => c.moveNo === 2 || (c.botLeftMs < Q.timeTrouble.lowMs && !c.state.ttLow),
  },
  {
    id: 'gambiteer', name: 'Gambiteer', glyph: 'dice', act: 'Gambiteer: offers a pawn',
    text: 'Opens with a gambit and gives up a pawn for quick play.',
    type: 'Opens with gambits and gives up a pawn for quick play; after that, an ordinary player.',
    opening: (c, r) => (c.fromStart ? lineMove(GAMBITS[c.bot], c.sans, c.fen, r) : null),
    elo: (c) => (opening(c, Q.gambiteer.openingMoves) ? Q.gambiteer.openingElo : 0),
    acted: (c, m, fromOpening) => fromOpening && m.piece === 'p' && c.moveNo <= Q.gambiteer.offerMaxMove && GAMBITS[c.bot].some((l) => l.length === c.sans.length + 1 && l[c.sans.length] === m.san),
  },
  {
    id: 'trapper', name: 'Trapper', glyph: 'skull', act: 'Trapper: steering into a trap line',
    text: 'Knows the classic opening traps and steers into them whenever it can.',
    type: 'Steers into the classic opening traps and hopes you fall in.',
    opening: (c, r) => (c.fromStart ? lineMove(TRAP_LINES[c.bot], c.sans, c.fen, r) : null),
    acted: (_c, _m, fromOpening) => fromOpening,
  },
  {
    id: 'earlyQueen', name: 'Overconfident', glyph: 'crown', act: 'Overconfident: out comes the queen',
    text: 'Underrates you: brings the queen out early and goes for quick wins.',
    type: 'Thinks you are weaker than you are, brings the queen out early, takes risks — and resigns in a huff once clearly lost.',
    // In real games the queen sortie is part of some games, not all of them (people vary).
    opening: (c, r) => (c.fromStart && goesForPlan(c, Q.earlyQueen.realPlanChance) ? lineMove(EARLY_QUEEN[c.bot], c.sans, c.fen, r) : null),
    weight: (c, m) => (m.piece === 'q' && c.moveNo <= Q.earlyQueen.untilMove ? (c.plan === undefined ? Q.earlyQueen.weight : goesForPlan(c, Q.earlyQueen.realPlanChance) ? Q.earlyQueen.realWeight : 1) : 1),
    oppo: () => Q.earlyQueen.oppo,
    resign: 'proud',
    acted: (c, m) => m.piece === 'q' && c.moveNo <= Q.earlyQueen.untilMove,
  },
  {
    id: 'turtle', name: 'Turtle', glyph: 'shield', act: 'Turtle: offers a trade',
    text: 'Plays solid, likes even trades and is happy with a draw.',
    type: 'Solid and careful, trades whenever it can and never resigns — it will play on hoping for stalemate.',
    // In real games the Turtle plays at its rating's usual temperature (cooler made it too clean).
    temp: (c) => (real(c) ? Q.turtle.realTemp : Q.turtle.temp),
    think: () => Q.turtle.think,
    weight: (_c, m) => (isTrade(m) ? Q.turtle.tradeWeight : m.san.includes('+') ? Q.turtle.checkWeight : 1),
    resign: 'stubborn',
    acted: (_c, m) => isTrade(m),
  },
  {
    id: 'tilter', name: 'Tilter', glyph: 'flame', act: 'Tilter: on tilt after losing material',
    text: 'After losing material, plays fast and reckless for a while.',
    type: 'Fine until it loses material — then it plays fast and badly for a few moves, and resigns early when it is lost.',
    elo: (c) => ((c.state.tilt ?? 0) > 0 ? (real(c) ? Q.tilter.realElo : Q.tilter.elo) : 0),
    think: (c) => ((c.state.tilt ?? 0) > 0 ? Q.tilter.think : 1),
    afterUserMove: (_c, lost) => (lost > 0 ? { tilt: Q.tilter.moves } : null),
    resign: 'proud',
  },
  {
    id: 'comebackKid', name: 'Comeback Kid', glyph: 'feather', act: 'Comeback Kid: digs in when worse',
    text: 'Plays its best chess when it is losing.',
    type: 'Plays its best chess when worse and never gives up.',
    elo: (c) => (c.botEval !== undefined && c.botEval < Q.comebackKid.belowCp ? Q.comebackKid.elo : 0),
    resign: 'stubborn',
    acted: (c) => c.botEval !== undefined && c.botEval < Q.comebackKid.belowCp && !c.state.ckOn,
  },
  {
    id: 'slowStarter', name: 'Slow Starter', glyph: 'moon', act: 'Slow Starter: warming up',
    text: `Shaky in the first ${Q.slowStarter.moves} moves, then plays normally.`,
    type: 'Shaky in the opening, then settles in and plays its normal game.',
    elo: (c) => (opening(c, Q.slowStarter.moves) ? Q.slowStarter.openingElo : Q.slowStarter.laterElo),
    acted: (c) => c.moveNo === 1 || c.moveNo === Q.slowStarter.moves + 1,
  },
  {
    id: 'fastStarter', name: 'Fast Starter', glyph: 'candle', act: 'Fast Starter: sharp out of the gate',
    text: `Plays the first ${Q.fastStarter.moves} moves fast and sharp, then fades.`,
    type: 'Plays the opening fast and sharp, then fades in long games.',
    elo: (c) => (opening(c, Q.fastStarter.moves) ? Q.fastStarter.openingElo : Q.fastStarter.laterElo),
    think: (c) => (opening(c, Q.fastStarter.moves) ? Q.fastStarter.think : 1),
    acted: (c) => c.moveNo === 1 || c.moveNo === Q.fastStarter.moves + 1,
  },
  {
    id: 'endgameGrinder', name: 'Endgame Grinder', glyph: 'gear', act: 'Endgame Grinder: heading for the endgame',
    text: 'Trades down when the game is even, and is at its best once the queens are off.',
    type: 'Trades down when even, is clearly stronger once the queens are off, and grinds on to the end.',
    elo: (c) => (queensOff(c.fen) ? (real(c) ? Q.endgameGrinder.realQueensOffElo : Q.endgameGrinder.queensOffElo) : 0),
    weight: (c, m) => {
      if (c.botEval === undefined || Math.abs(c.botEval) > Q.endgameGrinder.evenCp || !m.captured) return 1;
      if (m.piece === 'q' && m.captured === 'q') return Q.endgameGrinder.queenTradeWeight;
      return isTrade(m) ? Q.endgameGrinder.tradeWeight : 1;
    },
    resign: 'stubborn',
    acted: (_c, m) => isTrade(m),
  },
  {
    id: 'pawnStormer', name: 'Pawn Stormer', glyph: 'axe', act: 'Pawn Stormer: pawns march at your king',
    text: 'Throws the pawns on your king’s side of the board forward.',
    type: 'Attacks by throwing its pawns at your king.',
    weight: (c, m) => {
      if (m.piece !== 'p' || c.moveNo < Q.pawnStormer.fromMove || m.captured) return 1;
      const kf = kingFile(c.fen, c.me);
      const side = 'fgh'.includes(kf) ? 'fgh' : 'abc'.includes(kf) ? 'abc' : '';
      return side.includes(m.from[0]) ? (real(c) ? Q.pawnStormer.realWeight : Q.pawnStormer.weight) : 1;
    },
    acted: (c, m) => m.piece === 'p' && !m.captured && c.moveNo >= Q.pawnStormer.fromMove && ('fgh'.includes(kingFile(c.fen, c.me)) ? 'fgh' : 'abc').includes(m.from[0]),
  },
  {
    id: 'pawnGrabber', name: 'Pawn Grabber', glyph: 'bag', act: 'Pawn Grabber: grabs a pawn',
    text: 'Takes any pawn on offer, poisoned or not.',
    type: 'Greedy: takes any pawn on offer, poisoned or not.',
    weight: (_c, m) => (m.captured === 'p' ? Q.pawnGrabber.weight : 1),
    acted: (_c, m) => m.captured === 'p',
  },
  {
    id: 'copycat', name: 'Copycat', glyph: 'cards', act: 'Copycat: mirrors your move',
    text: 'Copies your moves in the opening while it can.',
    type: 'Copies your moves in the opening while it can, then plays on its own.',
    weight: (c, m) => (c.lastUserUci && c.moveNo <= Q.copycat.untilMove && m.lan === mirror(c.lastUserUci) ? Q.copycat.weight : 1),
    acted: (c, m) => !!c.lastUserUci && c.moveNo <= Q.copycat.untilMove && m.lan === mirror(c.lastUserUci),
  },
  {
    id: 'uncastled', name: 'Uncastled', glyph: 'tower', act: 'Uncastled: the king stays in the centre',
    text: 'Delays castling and keeps the king in the centre.',
    type: 'Keeps its king in the centre for a long time.',
    weight: (c, m) => (c.moveNo <= Q.uncastled.untilMove && (m.flags.includes('k') || m.flags.includes('q')) ? Q.uncastled.castleWeight : 1),
    acted: (c) => c.moveNo === Q.uncastled.noticeAtMove && 'de'.includes(kingFile(c.fen, c.bot)),
  },
];

export const quirkById = (id: string | undefined) => QUIRKS.find((q) => q.id === id);
export const QUIRK_IDS = QUIRKS.map((q) => q.id);

export interface QuirkEffects {
  temp: number;
  think: number;
  weight: (m: Move) => number;
  /** Rating points added to the level it plays at, and to how strong it thinks you are. */
  elo: number;
  oppo: number;
  /** Time pressure starts this many times earlier. */
  pressure: number;
  /** Resign temperament (stubborn wins over proud). */
  resign?: 'stubborn' | 'proud';
}

/** Combine the active quirks into the opponent's settings for one move. */
export function quirkEffects(ids: string[], c: QuirkCtx): QuirkEffects {
  const qs = ids.map(quirkById).filter((q): q is Quirk => !!q);
  return {
    temp: qs.reduce((t, q) => t + (q.temp?.(c) ?? 0), 0),
    think: qs.reduce((t, q) => t * (q.think?.(c) ?? 1), 1),
    weight: (m) => qs.reduce((w, q) => w * (q.weight?.(c, m) ?? 1), 1),
    elo: qs.reduce((t, q) => t + (q.elo?.(c) ?? 0), 0),
    oppo: qs.reduce((t, q) => t + (q.oppo?.(c) ?? 0), 0),
    pressure: qs.reduce((t, q) => Math.max(t, q.pressure ?? 1), 1),
    resign: qs.some((q) => q.resign === 'stubborn') ? 'stubborn' : qs.some((q) => q.resign === 'proud') ? 'proud' : undefined,
  };
}

/** The types' own opening plans (gambits, traps, early queen): the first type with a move wins. */
export function typeOpening(ids: string[], c: QuirkCtx, rand: () => number): { uci: string; type: string } | null {
  for (const id of ids) {
    const uci = quirkById(id)?.opening?.(c, rand);
    if (uci) return { uci, type: id };
  }
  return null;
}
