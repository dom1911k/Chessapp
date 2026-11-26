// Tuning for the Maia-3 opponents. Maia-3 is conditioned on rating, so weak play comes from the
// model itself (human mistakes) rather than from sampling noise: the temperature stays near 1 and
// the rest of the pipeline only trims the stray tail and, higher up, the worst howlers.
// Calibrated against real chess.com players (scripts/maia3/humans.mts, profile.mts, table.mts).

/** Piecewise-linear table: [rating, value] points. */
export type Curve = [number, number][];

export const MAIA3 = {
  /** Model size used by the opponents. */
  size: '23m' as const,
  /**
   * Maia-3's SelfElo (and OppoElo) for a rating on the chess.com scale. Calibrated so each bot's
   * blunders and mistakes per move match real chess.com players at its rating (public 10+0
   * sample, scripts/maia3/humans.mts vs profile.mts). Never below 700, the bottom of Maia-3's
   * training data: weaker bots get there with `temperature` and `alt` instead.
   */
  selfElo: [[100, 700], [200, 700], [400, 815], [600, 905], [800, 1020], [1000, 1100], [1200, 1300], [1400, 1520], [1600, 1600], [1800, 1860], [2000, 2100]] as Curve,
  temperature: [[100, 1.15], [200, 1.1], [400, 1.0], [2000, 1.0]] as Curve,
  /** Extra weight on Maia's 2nd and 3rd choices (weak players go with their second idea more). */
  alt: [[100, 0.3], [200, 0.3], [400, 0], [2000, 0]] as Curve,
  /**
   * Below 600 the bots play at Maia-3's floor with the pipeline of about 1000, which trimmed their
   * howlers like a 1000's: they blundered less than people at 100–500 (14 and 12.5 per 100 moves
   * against 19.3 and 15.1, over 80–120 games). Below 600 the trimming eases: minP × lowTrim,
   * lossScale ÷ lowTrim (1 = the pipeline's).
   */
  lowTrim: [[100, 0.27], [200, 0.27], [400, 0.57], [600, 1]] as Curve,

  /*
   * The rest of the pipeline follows the SelfElo: these curves are keyed by the old app rating
   * that played at that SelfElo (PIPE_SELF), so a bot at a given SelfElo plays exactly as measured.
   */
  pipeSelf: [[400, 20], [600, 330], [800, 490], [1000, 700], [1200, 920], [1400, 1190], [1600, 1500], [1800, 1765], [2000, 2080]] as Curve,
  topP: [[400, 0.99], [1000, 0.985], [2000, 0.98]] as Curve,
  minP: [[400, 0.005], [1000, 0.008], [2000, 0.01]] as Curve,
  /** Moves losing more than `free` cp are made rarer with scale `lossScale` (bigger = gentler). */
  free: [[400, 300], [1000, 260], [1600, 220], [2000, 180]] as Curve,
  lossScale: [[400, 2500], [1000, 1200], [1400, 700], [2000, 450]] as Curve,
  soft: [[400, 0], [2000, 0]] as Curve,
  /** Stockfish veto: cp limit and how often it applies (pipeline scale; none below 1600). */
  vetoFrom: 1600,
  vetoLimit: [[1600, 600], [1800, 400], [2000, 300]] as Curve,
  vetoChance: [[1600, 0.1], [1800, 0.25], [2000, 0.4]] as Curve,
};
