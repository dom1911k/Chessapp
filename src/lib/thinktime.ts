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
import { parseTc } from './clock';

type Curve = [number, number][];
const lerp = (c: Curve, x: number) => {
  if (x <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++)
    if (x <= c[i][0]) return c[i - 1][1] + ((x - c[i - 1][0]) / (c[i][0] - c[i - 1][0])) * (c[i][1] - c[i - 1][1]);
  return c[c.length - 1][1];
};

/** Tuning for think times and time-pressure play (checked with scripts/maia3/thinktime.mts). */
export const THINK = {
  /** Instant moves: forced, book, obvious recapture or a move nearly everyone plays. */
  instantMs: [350, 1100] as [number, number],
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
  useOfBudget: [[400, 0.55], [800, 0.7], [1200, 0.85], [1600, 0.95], [2000, 1.0]] as Curve,
  /** How strongly difficulty stretches the think (by rating): strong players think where it matters. */
  difficultyWeight: [[400, 0.4], [1200, 0.75], [2000, 1.0]] as Curve,
  /** Opening moves (by move number) are quicker. */
  phase: [[1, 0.2], [6, 0.35], [10, 0.7], [14, 1.0]] as Curve,
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
  maxShare: 0.18,
  maxMs: 90_000,
  floorMs: 300,
  /** Time pressure starts below this share of the starting time (at least `pressureMinMs`). */
  pressureShare: 0.1,
  pressureMinMs: 20_000,
  /** Under full pressure: think times shrink to this share, and instant moves get more common. */
  pressureSpeed: 0.3,
  pressureInstant: 0.4,
  /** Under full pressure the play loosens: temperature × (1 + x), minP × (1 - x), free + x cp. */
  pressureTemp: 0.35,
  pressureMinP: 0.6,
  pressureFree: 120,
};

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
}

/** 0 = relaxed … 1 = flag about to fall. */
export function timePressure(leftMs: number, tc: string): number {
  const { base } = parseTc(tc);
  const start = Math.max(THINK.pressureMinMs, base * THINK.pressureShare);
  if (leftMs >= start) return 0;
  return Math.min(1, 1 - Math.max(0, leftMs) / start);
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
  const pressure = timePressure(left, o.tc);
  const cap = Math.min(THINK.maxMs, left * THINK.maxShare * (1 - 0.5 * pressure));
  const floor = left < 15_000 ? THINK.floorMs - 80 : THINK.floorMs;
  const clamp = (ms: number) => Math.round(Math.max(floor + 120 * rng(), Math.min(ms, cap)));
  // Faster time controls are played faster across the board.
  const pace = Math.min(1, Math.max(0.45, base / 600_000) ** 0.35);
  const instant = () => clamp((THINK.instantMs[0] + (THINK.instantMs[1] - THINK.instantMs[0]) * rng() ** 1.6) * pace * (1 - 0.4 * pressure));

  // 1. Obvious moves come at once.
  if (o.forced || o.book) return instant();
  const calm = (o.swing ?? 0) < THINK.swingCp;
  const obvious = (o.recapture && (o.topProb ?? 0) >= THINK.recaptureProb) || (calm && (o.topProb ?? 0) >= THINK.obviousProb);
  if (obvious && rng() >= THINK.obviousThinkChance) return instant();
  if (rng() < THINK.pressureInstant * pressure) return instant();

  // 2. A normal think: a share of the time left, stretched by how hard the position is.
  const movesLeft = Math.max(THINK.minMovesLeft, THINK.movesLeftAt - o.moveNo);
  const budget = left / movesLeft + inc * 0.8;
  const w = lerp(THINK.difficultyWeight, o.elo);
  const diff = 1 + w * (difficulty(o) - 1);
  let ms = budget * lerp(THINK.useOfBudget, o.elo) * lerp(THINK.phase, o.moveNo) * diff * Math.exp(THINK.sigma * normal(rng) - THINK.sigma ** 2 / 2);

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
