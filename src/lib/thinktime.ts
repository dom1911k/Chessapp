// How long a human-like opponent thinks, and how it plays when its clock runs low (pure).
//
// A person's think time depends on:
// - the position: how many moves are worth weighing (the spread of Maia-3's move probabilities),
//   whether something just happened (the evaluation swung) and whether only one move holds;
// - the clock: what is left, the increment and how far into the game they are;
// - their strength: stronger players spend their time more evenly and think longer on the moves
//   that matter; weaker players play fast and only now and then stop to think.
// Obvious moves (a forced move, a book move, recapturing what was just taken, a move everyone
// plays) come at once. Below about a tenth of the starting time they speed up and play looser.
// Other time controls than 10+0 (the anchor, matched to people) stretch or squeeze the think by
// (budget / budget at 10+0)^k — people don't spend time in proportion to the clock. Below 10 s with
// no increment only hand speed is left, so a bot can lose on time like a person (round 7).
import { parseTc } from './clock';

type Curve = [number, number][];
const lerp = (c: Curve, x: number) => {
  if (x <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++)
    if (x <= c[i][0]) return c[i - 1][1] + ((x - c[i - 1][0]) / (c[i][0] - c[i - 1][0])) * (c[i][1] - c[i - 1][1]);
  return c[c.length - 1][1];
};

/**
 * Tuning for think times and time-pressure play. Ratings are chess.com ratings. Matched to real
 * chess.com 10+0 players per phase (scripts/maia3/profile.mts THINK_ONLY=1 vs humans.mts).
 */
export const THINK = {
  /** Instant moves: forced, obvious recapture or a move nearly everyone plays. */
  instantMs: [350, 1100] as [number, number],
  /** A known opening move (from its book): quick, but people still take a second or two. */
  bookMs: [700, 2600] as [number, number],
  /** Maia probability above which a move is "obvious" (when nothing just happened). */
  obviousProb: 0.8,
  /** An obvious recapture needs at least this probability. */
  recaptureProb: 0.45,
  /** Chance an obvious (not forced) move still gets a normal think. */
  obviousThinkChance: 0.12,
  /** Expected moves left in the game: max(minMovesLeft, movesLeftAt - moveNo). */
  movesLeftAt: 48,
  minMovesLeft: 16,
  /** Share of the per-move budget a player actually uses (by rating): weaker players play faster. */
  useOfBudget: [[100, 0.47], [400, 0.65], [800, 0.68], [1000, 0.62], [1200, 0.62], [1600, 0.68], [2000, 0.77]] as Curve,
  /** How strongly difficulty stretches the think (by rating): strong players think where it matters. */
  difficultyWeight: [[100, 0.4], [800, 0.75], [1800, 1.0]] as Curve,
  /** Endgames are played faster (by rating: weaker players speed up more). */
  endgameFactor: [[100, 0.6], [1000, 0.6], [1600, 0.7]] as Curve,
  /** Opening moves by rating: weaker players spend longer on them, stronger ones know them. */
  openingScale: [[100, 1.3], [400, 1.3], [600, 1.15], [800, 1.3], [1000, 1.25], [1200, 1.0], [1600, 0.72]] as Curve,
  /** Extra chance of a quick, instinctive move (weaker players play more of them). */
  quickChance: [[100, 0.08], [600, 0.04], [1000, 0]] as Curve,
  /** Opening moves (by move number) are quicker. */
  phase: [[1, 0.35], [6, 0.6], [10, 0.85], [12, 1.0]] as Curve,
  /** Difficulty from the spread: 1 - top probability, mapped to a factor. */
  spread: [[0, 0.5], [0.3, 0.85], [0.55, 1.15], [0.8, 1.45]] as Curve,
  /** Only one move holds (best minus second best, cp, while the game is still open). */
  onlyMoveGap: 150,
  onlyMoveFactor: 1.6,
  /** The evaluation just swung (cp, for the bot) since its last move: something happened. */
  swingCp: 120,
  swingFactor: 1.45,
  /** Positions already decided (|best| above this) are played more briskly. */
  decidedCp: 600,
  decidedFactor: 0.6,
  /** Log-normal spread of think times. */
  sigma: 0.55,
  /** A real long think at a critical moment (chance, multiplier range). */
  longThinkChance: 0.35,
  longThink: [2.0, 3.5] as [number, number],
  /** Never more than this share of the time left, and never more than this. */
  maxShare: 0.28,
  maxMs: 90_000,
  floorMs: 300,
  /** Time pressure starts below this share of the starting time (at least `pressureMinMs`; fitted to people's games lost on time). */
  pressureShare: 0.05,
  pressureMinMs: 25_000,
  /** Under full pressure: think times shrink to this share, and instant moves get more common. */
  pressureSpeed: 0.3,
  pressureInstant: 0.4,
  /** Under full pressure the play loosens: temperature × (1 + x), minP × (1 - x), free + x cp. */
  pressureTemp: 0.35,
  pressureMinP: 0.6,
  pressureFree: 120,
  /** Seconds of increment count this many times towards the budget of a time control (instant moves). */
  incMoves: 40,
  /**
   * Share of the increment a player spends on top of its think, by rating, fitted to chess.com
   * 15+10 games per band: people at 300–500 barely use it (they play 15+10 nearly like 15+0 and
   * finish with 90% of their clock), at 100–300 and 500–900 they spend most of it, and from 1000
   * they think longer than the whole increment.
   */
  incUse: [[200, 1], [400, 0], [600, 0.7], [800, 0.8], [1000, 1.8], [1400, 1.4]] as Curve,
  /** In the first 10 moves people use less of it (they play the opening fast and bank the time). */
  incOpening: 0.5,
  /** The time cap allows this many increments on top of a share of the clock left. */
  incCap: 1.2,
  /**
   * Time controls other than 10+0: the think is stretched by (budget / budget at 10+0)^k, k by
   * rating (fitted to chess.com games at 3+2, 5+0, 15+10 and 30+0), times `openingK` in the first
   * 10 moves (people know their openings whatever the clock).
   */
  tcExponent: [[200, 0.35], [400, 0.5], [1600, 0.55], [2000, 0.6]] as Curve,
  openingK: 1,
  /** With an increment, the pressure starts as if this many increments were on the clock too. */
  incPressureMoves: 5,
  /** Below this with no increment, only hand speed is left: the time cap no longer saves the bot. */
  handMs: 10_000,
  /** A forced move or obvious recapture, and any other move (by rating: weaker players are slower). */
  handInstantMs: [250, 400] as [number, number],
  handMoveMs: [[400, 1300], [1200, 1000], [2000, 750]] as Curve,
  handSpread: 300,
  handMinMs: 600,
  handMaxMs: 1600,
  /** Under time pressure, the chance per move that a player forgets the clock and thinks as usual (most often up to 800). */
  forgetChance: [[400, 0.15], [800, 0.08], [2000, 0.05]] as Curve,
  /** At longer time controls even obvious moves take a moment: instant moves × ratio^instantK. */
  instantK: 1.2,
  /**
   * People spend at a habitual pace and only partly adjust to what's left: the budget is this share
   * of a fixed plan (the time control over `planMoves` moves) and the rest a share of the time left.
   */
  planWeight: 1,
  planMoves: 40,
  /** Each game a player is a little quicker or slower than usual (log-normal), so some games end in a scramble. */
  gamePaceSigma: 0.7,
  gamePace: [0.55, 1.8] as [number, number],
};

/** A time control's budget against 10+0's: base plus `incMoves` increments. */
export function budgetRatio(tc: string): number {
  const { base, inc } = parseTc(tc);
  return (base + THINK.incMoves * inc) / 600_000;
}

/** One game's think pace for the opponent (1 = its usual speed). */
export function drawPace(rng: () => number = Math.random): number {
  const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
  const s = THINK.gamePaceSigma;
  return Math.round(Math.max(THINK.gamePace[0], Math.min(THINK.gamePace[1], Math.exp(s * z - (s * s) / 2))) * 100) / 100;
}

export interface ThinkInput {
  /** The opponent's rating. */
  elo: number;
  moveNo: number;
  leftMs: number;
  tc: string;
  book?: boolean;
  forced?: boolean;
  /** Maia's probability of the move it plays and of its top move. */
  topProb?: number;
  /** Number of moves worth weighing (Maia moves at ≥ 5%). */
  sensible?: number;
  /** The move recaptures on the square the other side just captured on. */
  recapture?: boolean;
  /** Best and second-best engine scores for the bot (cp), if known. */
  best?: number;
  second?: number;
  /** How much the evaluation moved (for the bot) since its previous move, cp. */
  swing?: number;
  /** Little material left (people play endgames faster, mostly on instinct and technique). */
  endgame?: boolean;
  /** Forgets the clock this many times as often as most players of its rating (Time Trouble). */
  forget?: number;
  /** This game's think pace (drawPace; 1 = usual). */
  pace?: number;
  /** Its types' think factor (Speedster quicker, Time Trouble slower in the opening): inside the time cap. */
  mult?: number;
}

/** Where time pressure starts for a time control (ms on the clock, increment not counted). */
const pressureStart = (base: number) => Math.max(THINK.pressureMinMs, base * THINK.pressureShare);

/** 0 = relaxed … 1 = flag about to fall. An increment eases it (a few moves' worth counts). */
export function timePressure(leftMs: number, tc: string): number {
  const { base, inc } = parseTc(tc);
  const start = pressureStart(base);
  const left = Math.max(0, leftMs) + inc * THINK.incPressureMoves;
  if (left >= start) return 0;
  return Math.min(1, 1 - left / start);
}

/**
 * How much a time control stretches the think against 10+0: (base / 10 min)^(k − 1) on the part of
 * the per-move budget that comes from the base time (the increment is added on top: people use it).
 */
export function tcStretch(tc: string, elo: number, moveNo: number): number {
  const ratio = parseTc(tc).base / 600_000;
  if (!(ratio > 0) || ratio === 1) return 1;
  const k = lerp(THINK.tcExponent, elo) * (moveNo <= 10 ? THINK.openingK : 1);
  return ratio ** (k - 1);
}

/** Hand speed only: below 10 s with no increment (weaker players move the pieces slower). */
function handMs(o: ThinkInput, quick: boolean, rng: () => number): number {
  if (quick) return THINK.handInstantMs[0] + (THINK.handInstantMs[1] - THINK.handInstantMs[0]) * rng();
  const ms = lerp(THINK.handMoveMs, o.elo) + THINK.handSpread * (2 * rng() - 1);
  return Math.max(THINK.handMinMs, Math.min(THINK.handMaxMs, ms));
}

/** How the move picker loosens under time pressure (merge into humanParams). */
export function pressureParams(p: { temperature: number; minP: number; free: number }, pressure: number): { temperature: number; minP: number; free: number } {
  if (pressure <= 0) return p;
  return {
    temperature: p.temperature * (1 + THINK.pressureTemp * pressure),
    minP: p.minP * (1 - THINK.pressureMinP * pressure),
    free: p.free + THINK.pressureFree * pressure,
  };
}

/** A standard normal sample (Box–Muller) from a 0..1 source. */
function normal(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Difficulty factor of the position (about 0.5 easy … 3 critical). */
export function difficulty(o: ThinkInput): number {
  let d = lerp(THINK.spread, 1 - (o.topProb ?? 0.5));
  if (o.best !== undefined && Math.abs(o.best) < THINK.decidedCp && o.second !== undefined && o.best - o.second >= THINK.onlyMoveGap) d *= THINK.onlyMoveFactor;
  if ((o.swing ?? 0) >= THINK.swingCp) d *= THINK.swingFactor;
  if (o.best !== undefined && Math.abs(o.best) >= THINK.decidedCp) d *= THINK.decidedFactor;
  return d;
}

/** Is this a moment to stop and think hard (only one move holds, or something just happened)? */
export const critical = (o: ThinkInput) =>
  (o.best !== undefined && Math.abs(o.best) < THINK.decidedCp && o.second !== undefined && o.best - o.second >= THINK.onlyMoveGap) || (o.swing ?? 0) >= THINK.swingCp;

/** Think time in ms. `rng` gives 0..1 samples. */
export function botThinkMs(o: ThinkInput, rng: () => number = Math.random): number {
  const { base, inc } = parseTc(o.tc);
  const left = Math.max(0, o.leftMs);
  let pressure = timePressure(left, o.tc);
  // Under pressure a weaker player now and then forgets the clock and thinks as if it had time.
  const forgot = pressure > 0 && rng() < lerp(THINK.forgetChance, o.elo) * (o.forget ?? 1);
  const thinkLeft = forgot ? Math.max(left, pressureStart(base)) : left;
  if (forgot) pressure = 0;
  // With an increment people treat it as theirs to spend, even when that's more than the clock
  // holds right now (that's how 3+2 games are lost on time).
  const cap = Math.min(THINK.maxMs, thinkLeft * THINK.maxShare * (1 - 0.5 * pressure) + inc * THINK.incCap);
  const floor = left < 15_000 ? THINK.floorMs - 80 : THINK.floorMs;
  // Below 10 s with no increment only hand speed is left: the cap no longer keeps the flag up.
  const hands = !inc && left < THINK.handMs;
  const clamp = (ms0: number, quick = false) => {
    const ms = ms0 * (o.mult ?? 1);
    if (hands) return Math.round(quick ? handMs(o, true, rng) : Math.max(Math.min(ms, cap), handMs(o, false, rng)));
    return Math.round(Math.max(floor + 120 * rng(), Math.min(ms, cap)));
  };
  // Faster time controls are played faster across the board; at longer ones even obvious moves take a moment.
  const ratio = budgetRatio(o.tc);
  const pace = ratio > 1 ? ratio ** THINK.instantK : Math.min(1, Math.max(0.45, base / 600_000) ** 0.35);
  const instant = (quick = false) => clamp((THINK.instantMs[0] + (THINK.instantMs[1] - THINK.instantMs[0]) * rng() ** 1.6) * pace * (1 - 0.4 * pressure), quick);

  // 1. Obvious moves come at once; known opening moves nearly so.
  if (o.forced) return instant(true);
  if (o.book) return clamp((THINK.bookMs[0] + (THINK.bookMs[1] - THINK.bookMs[0]) * rng() ** 1.4) * pace * (1 - 0.4 * pressure), true);
  const calm = (o.swing ?? 0) < THINK.swingCp;
  const recapture = !!o.recapture && (o.topProb ?? 0) >= THINK.recaptureProb;
  const obvious = recapture || (calm && (o.topProb ?? 0) >= THINK.obviousProb);
  if (obvious && rng() >= THINK.obviousThinkChance) return instant(recapture);
  if (rng() < THINK.pressureInstant * pressure + lerp(THINK.quickChance, o.elo)) return instant();

  // 2. A normal think: a share of the time left, stretched by how hard the position is, and by the
  //    time control against 10+0 (not in proportion: see tcStretch).
  const movesLeft = Math.max(THINK.minMovesLeft, THINK.movesLeftAt - o.moveNo);
  const fromBase = ((1 - THINK.planWeight) * (thinkLeft / movesLeft) + THINK.planWeight * (base / THINK.planMoves)) * tcStretch(o.tc, o.elo, o.moveNo);
  const budget = fromBase + inc * lerp(THINK.incUse, o.elo) * (o.moveNo <= 10 ? THINK.incOpening : 1);
  const w = lerp(THINK.difficultyWeight, o.elo);
  const diff = 1 + w * (difficulty(o) - 1);
  let ms = budget * (o.pace ?? 1) * lerp(THINK.useOfBudget, o.elo) * lerp(THINK.phase, o.moveNo) * (o.endgame ? lerp(THINK.endgameFactor, o.elo) : 1) * (o.moveNo <= 10 ? lerp(THINK.openingScale, o.elo) : 1) * diff * Math.exp(THINK.sigma * normal(rng) - THINK.sigma ** 2 / 2);

  // 3. At a critical moment, now and then a real long think (stronger players more often).
  if (o.moveNo > 8 && critical(o) && rng() < THINK.longThinkChance * w * (1 - pressure)) ms *= THINK.longThink[0] + (THINK.longThink[1] - THINK.longThink[0]) * rng();
  ms *= 1 - (1 - THINK.pressureSpeed) * pressure;
  return clamp(ms);
}

/** The bot's move recaptures on the square the other side just captured on. */
export function isRecapture(lastUci: string | undefined, lastWasCapture: boolean, uci: string): boolean {
  return !!lastUci && lastWasCapture && uci.slice(2, 4) === lastUci.slice(2, 4);
}

/** What the think-time model needs from Maia's logits, the engine's candidates and the last move. */
export function positionInfo(
  logits: Map<string, number> | undefined,
  candidates: Map<string, number> | undefined,
  uci: string,
  last?: { uci: string; san: string },
): Pick<ThinkInput, 'topProb' | 'sensible' | 'recapture' | 'best' | 'second'> {
  let topProb: number | undefined;
  let sensible: number | undefined;
  if (logits?.size) {
    const vals = [...logits.values()];
    const mx = Math.max(...vals);
    const ps = vals.map((v) => Math.exp(v - mx));
    const z = ps.reduce((a, b) => a + b, 0);
    topProb = Math.max(...ps) / z;
    sensible = Math.max(1, ps.filter((p) => p / z >= 0.05).length);
  }
  const scores = candidates?.size ? [...candidates.values()].sort((a, b) => b - a) : [];
  return { topProb, sensible, recapture: isRecapture(last?.uci, !!last?.san.includes('x'), uci), best: scores[0], second: scores[1] };
}

/** Remembers the bot's last best score per game, to see how much the evaluation swung since. */
export function swingTracker() {
  let key: unknown;
  let last: number | undefined;
  return (gameKey: unknown, best: number | undefined): number => {
    if (gameKey !== key) { key = gameKey; last = undefined; }
    const swing = best === undefined || last === undefined ? 0 : Math.abs(best - last);
    if (best !== undefined) last = best;
    return swing;
  };
}
