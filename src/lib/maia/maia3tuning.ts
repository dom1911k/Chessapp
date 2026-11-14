// Tuning for the Maia-3 opponents. Maia-3 is conditioned on rating, so weak play comes from the
// model itself (human mistakes) rather than from sampling noise: the temperature stays near 1 and
// the rest of the pipeline only trims the stray tail and, higher up, the worst howlers.
// Calibrated with scripts/maia3/selfplay.mts and scripts/maia3/blunders.mts.

/** Piecewise-linear table: [rating, value] points. */
export type Curve = [number, number][];

export const MAIA3 = {
  /** Model size used by the opponents. */
  size: '23m' as const,
  /**
   * The model's SelfElo (and OppoElo) for an opponent label. Raw Maia-3 games between neighbouring
   * ratings come out only ~100 apart (the model is compressed), so the axis is stretched until
   * neighbouring bots are ~200 apart; bot 1200 ≈ raw Maia-3 1200 (52.5% in 40 games).
   * Ladder (40 games/pair): 168, 168, 338, 191, 203, 179, 228, 228 → 400…2000 spans ~1700.
   */
  selfElo: [[400, 20], [600, 330], [800, 490], [1000, 700], [1200, 920], [1400, 1190], [1600, 1500], [1800, 1765], [2000, 2080]] as Curve,
  temperature: [[400, 1.0], [2000, 1.0]] as Curve,
  topP: [[400, 0.99], [1000, 0.985], [2000, 0.98]] as Curve,
  minP: [[400, 0.005], [1000, 0.008], [2000, 0.01]] as Curve,
  /** Moves losing more than `free` cp are made rarer with scale `lossScale` (bigger = gentler). */
  free: [[400, 300], [1000, 260], [1600, 220], [2000, 180]] as Curve,
  lossScale: [[400, 2500], [1000, 1200], [1400, 700], [2000, 450]] as Curve,
  soft: [[400, 0], [2000, 0]] as Curve,
  /** Stockfish veto: cp limit and how often it applies (none below 1600). */
  vetoFrom: 1600,
  vetoLimit: [[1600, 600], [1800, 400], [2000, 300]] as Curve,
  vetoChance: [[1600, 0.1], [1800, 0.25], [2000, 0.4]] as Curve,
};
