// When a human-like opponent resigns (pure).
// Fitted to how people's chess.com games end (round 7, scripts/maia3/humanends.mts): the share of
// games that end in resignation grows from about 30% at 100–300 to about 60% from 900, and people
// resign when the engine has them several pawns down (about −7 to −9 below 1000, sooner above).
// Once clearly lost for a few moves, a bot resigns with a small chance on each move, so beginners
// often play on and some swindle a stalemate, while stronger players resign sooner. Cups finals are
// never resigned early.

type Curve = [number, number][];
const lerp = (c: Curve, x: number) => {
  if (x <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++)
    if (x <= c[i][0]) return c[i - 1][1] + ((x - c[i - 1][0]) / (c[i][0] - c[i - 1][0])) * (c[i][1] - c[i - 1][1]);
  return c[c.length - 1][1];
};

/** Resignation tuning (fitted to chess.com end reasons per band; see humanends.mts and thinkfit.mts ends). */
export const RESIGN = {
  /** Evaluation (cp, for the bot) at or below which the game counts as clearly lost. */
  lostCp: [[200, -500], [1000, -500], [1400, -400], [2000, -350]] as Curve,
  /** Bot moves in a row at or below `lostCp` before resigning is considered. */
  lostMoves: [[200, 3], [2000, 3]] as Curve,
  /** Chance per bot move, once lost for long enough, that it resigns. */
  chance: [[200, 0.025], [400, 0.04], [700, 0.05], [1000, 0.06], [1200, 0.04], [2000, 0.035]] as Curve,
  /** Facing a forced mate within this many moves counts as lost at once (from `mateFrom`). */
  mateWithin: 6,
  mateFrom: 1200,
  mateChance: [[1200, 0.2], [2000, 0.3]] as Curve,
  /** Proud types (any rating): resign once at or below `lostCp` for `moves` moves, or facing mate. */
  proud: { lostCp: -700, moves: 3, chance: 0.85 },
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
  /** Player type: stubborn never resigns; proud resigns early once clearly lost. */
  temperament?: 'stubborn' | 'proud';
}

/** Should the opponent resign instead of moving? `rng` gives 0..1 samples. */
export function shouldResign(o: ResignInput, rng: () => number = Math.random): boolean {
  if (!o.evals.length || o.temperament === 'stubborn') return false;
  if (o.moveNo < (o.cupFinal ? RESIGN.cupFinalMinMove : RESIGN.minMove)) return false;
  const now = o.evals[o.evals.length - 1];
  if (o.temperament === 'proud') {
    const m = mateIn(now);
    const recent = o.evals.slice(-RESIGN.proud.moves);
    const lost = (m !== null && m < 0) || (recent.length >= RESIGN.proud.moves && recent.every((e) => e <= RESIGN.proud.lostCp));
    return lost && rng() < RESIGN.proud.chance;
  }
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
