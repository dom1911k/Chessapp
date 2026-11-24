// Start your rating from chess.com. Everyone starts at 250 here, so someone who plays at 500 on
// chess.com would see a number far below theirs for weeks. With a chess.com import, Profile offers
// to start the game rating at the chess.com one (rapid, else blitz) when they're more than 150
// apart. Nothing celebrates: looks below the new rating just unlock, and the numbers that roll from
// the value last seen are told the new one so they don't roll.
import { db, kvGet, kvSet } from '../db';
import { getGameRating, restartGameRating } from '../rewards/rating';
import { COSMETICS, isUnlocked, markLooksSeen, unlockContext, type UnlockContext } from '../rewards/cosmetics';
import type { ImportedGame } from '../store/types';

/** The offer shows when the two ratings are further apart than this. */
export const CC_GAP = 150;
/** The chess.com rating when "Not now" was tapped: hidden until it moves by another CC_GAP. */
export const CC_HIDE_KEY = 'ccStartHidden';
/** The numbers that roll from the value you last saw and show the game rating. */
const SEEN_KEYS = ['home.rating', 'more.rating', 'stats.rating'];

export interface CcRating {
  cls: 'rapid' | 'blitz';
  rating: number;
}

/** Your latest chess.com rapid rating, else your latest blitz one. */
export function latestCcRating(games: Pick<ImportedGame, 'timeClass' | 'myRating' | 'endedAt'>[]): CcRating | null {
  for (const cls of ['rapid', 'blitz'] as const) {
    let best: { at: number; rating: number } | null = null;
    for (const g of games) if (g.timeClass === cls && g.myRating > 0 && (!best || g.endedAt > best.at)) best = { at: g.endedAt, rating: g.myRating };
    if (best) return { cls, rating: best.rating };
  }
  return null;
}

/** Whether Profile offers the start: a username, a chess.com rating, a gap over 150, not hidden. */
export function offerShows(o: { user: string; cc: CcRating | null; rating: number; hiddenAt: number | null }): boolean {
  if (!o.user.trim() || !o.cc) return false;
  if (Math.abs(o.cc.rating - o.rating) <= CC_GAP) return false;
  return o.hiddenAt === null || Math.abs(o.cc.rating - o.hiddenAt) >= CC_GAP;
}

export interface CcOffer {
  cc: CcRating | null;
  rating: number;
  /** The Profile card shows (the chess.com screen's row only needs `cc` and a different rating). */
  show: boolean;
}

export async function ccOffer(user: string): Promise<CcOffer> {
  const cc = user.trim() ? latestCcRating(await db.imported.toArray()) : null;
  const { rating } = await getGameRating();
  const hiddenAt = await kvGet<number | null>(CC_HIDE_KEY, null);
  return { cc, rating, show: offerShows({ user, cc, rating, hiddenAt }) };
}

/** "Not now": hidden until the chess.com rating moves by another 150. */
export const hideCcOffer = (ccRating: number) => kvSet(CC_HIDE_KEY, ccRating);

const unlockedLooks = (ctx: UnlockContext) => new Set(COSMETICS.filter((c) => c.unlock.kind !== 'free' && isUnlocked(c, ctx)).map((c) => c.id));

/**
 * Starts your game rating at `rating`. Returns how many looks it unlocked. Those are marked seen,
 * so the next results sheet doesn't announce them: the confirmation line already has.
 */
export async function startFromChessCom(rating: number): Promise<{ newLooks: number }> {
  const before = unlockedLooks(await unlockContext());
  await restartGameRating(rating, { keepPeak: true });
  const fresh = [...unlockedLooks(await unlockContext())].filter((id) => !before.has(id));
  await markLooksSeen(fresh);
  await Promise.all(SEEN_KEYS.map((k) => kvSet(`lastSeen:${k}`, rating)));
  await kvSet(CC_HIDE_KEY, null);
  return { newLooks: fresh.length };
}
