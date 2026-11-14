// One-time move of every stored rating to the chess.com scale (see scale.ts). Runs at start-up
// whenever the stored data is still on the old scale, including after restoring an old backup.
import { db, kvGet, kvSet } from './db';
import { fromLegacy } from './scale';
import type { GameRating } from './rewards/rating';

export const SCALE_KEY = 'ratingScale';
export const SCALE_VERSION = 2;
/** Your peak rating on the old scale: rewards it had earned stay unlocked. */
export const LEGACY_PEAK_KEY = 'legacyPeak';
/** Shown once on Home after the move. */
export const SCALE_NEWS_KEY = 'scaleNews';

export async function migrateRatingScale(): Promise<boolean> {
  if ((await kvGet<number>(SCALE_KEY, 1)) >= SCALE_VERSION) return false;
  const rating = await kvGet<GameRating | null>('gameRating', null);
  const hadData = !!rating || (await db.games.count()) > 0;
  if (rating) {
    await kvSet(LEGACY_PEAK_KEY, rating.peak);
    await kvSet('gameRating', { ...rating, rating: fromLegacy(rating.rating), peak: fromLegacy(rating.peak), history: rating.history.map((h) => ({ ...h, rating: fromLegacy(h.rating) })) });
  }
  // Your past games against the bots (chess.com imports are already on that scale).
  await db.games.toCollection().modify((g) => { g.elo = fromLegacy(g.elo); });
  const cur = await db.current.get('play');
  if (cur) await db.current.put({ ...cur, elo: fromLegacy(cur.elo) });
  const spar = await kvGet<{ rating: number } | null>('sparring', null);
  if (spar) await kvSet('sparring', { ...spar, rating: fromLegacy(spar.rating) });
  const cup = await kvGet<{ ratings?: Record<string, number>; yours?: { elo: number }[] } | null>('cupState', null);
  if (cup) {
    await kvSet('cupState', {
      ...cup,
      ratings: Object.fromEntries(Object.entries(cup.ratings ?? {}).map(([k, v]) => [k, fromLegacy(v)])),
      yours: (cup.yours ?? []).map((r) => ({ ...r, elo: fromLegacy(r.elo) })),
    });
  }
  const cupGame = await kvGet<{ elo: number } | null>('cupGame', null);
  if (cupGame) await kvSet('cupGame', { ...cupGame, elo: fromLegacy(cupGame.elo) });
  await kvSet(SCALE_KEY, SCALE_VERSION);
  if (hadData) await kvSet(SCALE_NEWS_KEY, true);
  return true;
}
