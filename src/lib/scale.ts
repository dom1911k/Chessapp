// The rating scale. Since v1.55 every rating in the app — bots, your game rating, Cups bands, the
// sparring partner — is a chess.com (rapid) rating: each bot is calibrated so its blunders and
// mistakes per move match real chess.com players at that rating (scripts/maia3/humans.mts,
// profile.mts). Before that, ratings were on the app's own scale ("legacy").
//
// LEGACY_TO_CC says which chess.com rating each old app rating plays like, from the same
// benchmark run on the old bots. It converts stored ratings once (migrate.ts), and lets the
// classic engines (Maia-1, Stockfish), whose settings were tuned on the old scale, keep playing
// at the same strength for a given label.

type Curve = [number, number][];
const lerp = (c: Curve, x: number) => {
  if (x <= c[0][0]) return c[0][1] + (x - c[0][0]) * ((c[1][1] - c[0][1]) / (c[1][0] - c[0][0]));
  for (let i = 1; i < c.length; i++)
    if (x <= c[i][0]) return c[i - 1][1] + ((x - c[i - 1][0]) / (c[i][0] - c[i - 1][0])) * (c[i][1] - c[i - 1][1]);
  const n = c.length;
  return c[n - 1][1] + (x - c[n - 1][0]) * ((c[n - 1][1] - c[n - 2][1]) / (c[n - 1][0] - c[n - 2][0]));
};

/** [old app rating, chess.com rating it plays like]. Increasing in both columns. */
export const LEGACY_TO_CC: Curve = [
  [400, 100],
  [900, 200],
  [1100, 400],
  [1300, 750],
  [1500, 1050],
  [1700, 1350],
  [2000, 1700],
];

export const CC_MIN = 100;
export const CC_MAX = 2000;

/** An old app rating on the chess.com scale (never below 100). */
export const fromLegacy = (old: number) => Math.max(CC_MIN, Math.round(lerp(LEGACY_TO_CC, old)));

/** The old app rating that plays like chess.com `cc` (for the classic engines' tuning tables). */
export const toLegacy = (cc: number) => Math.round(lerp(LEGACY_TO_CC.map(([a, b]) => [b, a] as [number, number]), cc));
