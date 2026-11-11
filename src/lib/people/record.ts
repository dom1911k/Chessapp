// Head-to-head records and stars per opponent; drives the ladder.
import { kvGet, kvSet } from '../db';
import type { GameRecord } from '../store/types';
import { OPPONENTS } from './index';
import { challengeFor } from './challenges';
import { BADGE_POINTS, badgesEarned, rivalryLevel, rivalryPoints, rivalryXp, type RivalryChange } from './rivalry';

export interface OpponentRecord {
  w: number;
  l: number;
  d: number;
  /** Legacy (best-win quality); stars are now wins, see starsOf. */
  stars: number;
  bestAccuracy: number;
  /** Your result in the most recent game against them. */
  last?: 'win' | 'loss' | 'draw';
  /** Their special challenge is done. */
  challengeDone?: boolean;
  /** Rivalry points (see rivalry.ts); missing on old records, where they are worked out from the score. */
  rp?: number;
  /** Matchup badges earned against them. */
  badges?: string[];
  /** Current run of wins against them. */
  streak?: number;
}

/** Rivalry points, including for records from before rivalries existed (win 3, draw 2, loss 1). */
export const rpOf = (r: OpponentRecord | undefined) => (r ? r.rp ?? r.w * 3 + r.d * 2 + r.l : 0);

export const MAX_STARS = 5;
/** One star per win, up to five. Five stars open the opponent's special challenge. */
export const starsOf = (r: OpponentRecord | undefined) => Math.min(MAX_STARS, r?.w ?? 0);

const KEY = 'opponentStats';
const empty = (): OpponentRecord => ({ w: 0, l: 0, d: 0, stars: 0, bestAccuracy: 0 });

export const getOpponentRecords = () => kvGet<Record<string, OpponentRecord>>(KEY, {});

/** Updates the record after a game: stars, and the special challenge once all 5 stars are in. */
export async function recordOpponentGame(g: GameRecord): Promise<{ stars: number; starsBefore: number; firstWin: boolean; challengeDone: boolean; rivalry: RivalryChange } | null> {
  if (!g.opponentId) return null;
  const all = await getOpponentRecords();
  const r = all[g.opponentId] ?? empty();
  const starsBefore = starsOf(r);
  const firstWin = g.userResult === 'win' && r.w === 0;
  // The challenge counts from the game after the fifth star.
  const ch = starsBefore >= MAX_STARS && !r.challengeDone ? challengeFor(g.opponentId) : undefined;
  const challengeDone = !!ch && ch.check(g);
  if (g.userResult === 'win') r.w++;
  else if (g.userResult === 'loss') r.l++;
  else r.d++;
  r.bestAccuracy = Math.max(r.bestAccuracy, g.summary.accuracy);
  r.last = g.userResult;
  if (challengeDone) r.challengeDone = true;
  // Rivalry: points for every finished game, badges for feats, levels without end.
  const pointsBefore = rpOf({ ...r, w: r.w - (g.userResult === 'win' ? 1 : 0), l: r.l - (g.userResult === 'loss' ? 1 : 0), d: r.d - (g.userResult === 'draw' ? 1 : 0) });
  r.streak = g.userResult === 'win' ? (r.streak ?? 0) + 1 : 0;
  const held = new Set(r.badges ?? []);
  const newBadges = badgesEarned(g, r.streak).filter((b) => !held.has(b));
  r.badges = [...held, ...newBadges];
  const gained = rivalryPoints(g) + newBadges.length * BADGE_POINTS;
  r.rp = pointsBefore + gained;
  const levelBefore = rivalryLevel(pointsBefore).level;
  const levelAfter = rivalryLevel(r.rp).level;
  let xp = 0;
  for (let l = levelBefore + 1; l <= levelAfter; l++) xp += rivalryXp(l);
  all[g.opponentId] = r;
  await kvSet(KEY, all);
  return { stars: starsOf(r), starsBefore, firstWin, challengeDone, rivalry: { pointsBefore, pointsAfter: r.rp, gained, levelBefore, levelAfter, newBadges, xp } };
}

/** The ladder: the first three are open; each further opponent opens when you beat the one before. */
export function isUnlocked(id: string, records: Record<string, OpponentRecord>): boolean {
  const i = OPPONENTS.findIndex((o) => o.id === id);
  if (i < 3) return true;
  if ((records[id]?.w ?? 0) + (records[id]?.l ?? 0) + (records[id]?.d ?? 0) > 0) return true;
  return (records[OPPONENTS[i - 1].id]?.w ?? 0) > 0;
}
