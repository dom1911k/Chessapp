// Good days and bad days (round 7): each game the opponent plays a little above or below its
// rating. Normal, sd 50 points, clamped to ±100; invisible, stored on the game for the benchmark.
// Not for Play Coach, Cups or special challenges.
export const FORM = { sd: 50, max: 100 };

/** One game's form offset (Box–Muller). */
export function drawForm(rand: () => number = Math.random): number {
  const u = Math.max(1e-9, rand());
  const v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.round(Math.max(-FORM.max, Math.min(FORM.max, z * FORM.sd)));
}

/** Today's form for a new game: none for Play Coach or a special challenge (Cups don't ask). */
export const formFor = (o: { coach?: unknown; challenge?: boolean }, rand: () => number = Math.random): number | undefined =>
  o.coach || o.challenge ? undefined : drawForm(rand);
