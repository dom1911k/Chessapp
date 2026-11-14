// When a human-like opponent resigns (pure).
// Beginners play on to the bitter end (and sometimes swindle a stalemate); from about 1400 people
// resign once the game is clearly gone: several moves in a row a rook or more down in evaluation,
// or facing a forced mate. Cups finals are never resigned early.

type Curve = [number, number][];
const lerp = (c: Curve, x: number) => {
  if (x <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++)
    if (x <= c[i][0]) return c[i - 1][1] + ((x - c[i - 1][0]) / (c[i][0] - c[i - 1][0])) * (c[i][1] - c[i - 1][1]);
  return c[c.length - 1][1];
};

/** Resignation tuning. */
export const RESIGN = {
  /** Evaluation (cp, for the bot) at or below which the game counts as clearly lost. */
  lostCp: [[1000, -1200], [1400, -800], [2000, -600]] as Curve,
  /** Bot moves in a row at or below `lostCp` before resigning is considered. */
  lostMoves: [[1000, 6], [1400, 4], [2000, 3]] as Curve,
  /** Chance per bot move, once lost for long enough, that it resigns. Below 1000: almost never. */
  chance: [[400, 0.003], [999, 0.01], [1000, 0.15], [1400, 0.7], [2000, 0.9]] as Curve,
  /** Facing a forced mate within this many moves counts as lost at once (from `mateFrom`). */
  mateWithin: 6,
  mateFrom: 1200,
  mateChance: [[1200, 0.4], [1400, 0.8], [2000, 0.95]] as Curve,
  /** Never before this move number (and never before `cupFinalMinMove` in a Cups final). */
  minMove: 10,
  cupFinalMinMove: 20,
};

/** Mate scores come through scoreToCp as ±(10000 − 10·n). */
const mateIn = (cp: number) => (Math.abs(cp) >= 9000 ? Math.sign(cp) * Math.round((10000 - Math.abs(cp)) / 10) : null);

export interface ResignInput {
  elo: number;
  moveNo: number;
  /** The bot's best evaluation (cp, its own point of view) at each of its moves, latest last. */
  evals: number[];
  cupFinal?: boolean;
}

/** Should the opponent resign instead of moving? `rng` gives 0..1 samples. */
export function shouldResign(o: ResignInput, rng: () => number = Math.random): boolean {
  if (!o.evals.length) return false;
  if (o.moveNo < (o.cupFinal ? RESIGN.cupFinalMinMove : RESIGN.minMove)) return false;
  const now = o.evals[o.evals.length - 1];
  const m = mateIn(now);
  if (m !== null && m < 0 && -m <= RESIGN.mateWithin && o.elo >= RESIGN.mateFrom) return rng() < lerp(RESIGN.mateChance, o.elo);
  const need = Math.round(lerp(RESIGN.lostMoves, o.elo));
  const limit = lerp(RESIGN.lostCp, o.elo);
  const recent = o.evals.slice(-need);
  if (recent.length < need || recent.some((e) => e > limit)) return false;
  return rng() < lerp(RESIGN.chance, o.elo);
}

/** Collects the bot's evaluations per game (a new game key starts a fresh list). */
export function evalHistory() {
  let key: unknown;
  let evals: number[] = [];
  return (gameKey: unknown, best: number | undefined): number[] => {
    if (gameKey !== key) { key = gameKey; evals = []; }
    if (best !== undefined) evals.push(best);
    return evals;
  };
}
