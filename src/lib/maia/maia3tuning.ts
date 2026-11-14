// Tuning for the Maia-3 opponents. Maia-3 is conditioned on rating, so weak play comes from the
// model itself (human mistakes) rather than from sampling noise: the temperature stays near 1 and
// the rest of the pipeline only trims the stray tail and, higher up, the worst howlers.
// Calibrated with scripts/maia3/selfplay.mts and scripts/maia3/blunders.mts.

/** Piecewise-linear table: [rating, value] points. */
export type Curve = [number, number][];

export const MAIA3 = {
  /** Model size used by the opponents. */
  size: '23m' as const,
  /** The model's SelfElo for an opponent label (stretches the model's rating axis if needed). */
  selfElo: [[400, 400], [2000, 2000]] as Curve,
  temperature: [[400, 1.0], [2000, 1.0]] as Curve,
  topP: [[400, 0.98], [2000, 0.98]] as Curve,
  minP: [[400, 0.01], [2000, 0.01]] as Curve,
  /** Moves losing more than `free` cp are made rarer with scale `lossScale` (bigger = gentler). */
  free: [[400, 300], [1000, 250], [1600, 160], [2000, 120]] as Curve,
  lossScale: [[400, 2000], [1000, 900], [1400, 400], [2000, 200]] as Curve,
  soft: [[400, 0], [2000, 0]] as Curve,
  /** Stockfish veto: cp limit and how often it applies (none below 1600). */
  vetoFrom: 1600,
  vetoLimit: [[1600, 500], [1800, 300], [2000, 180]] as Curve,
  vetoChance: [[1600, 0.2], [1800, 0.5], [2000, 0.8]] as Curve,
};
