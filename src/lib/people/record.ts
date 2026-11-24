// Head-to-head records and badges per opponent; drives the ladder and the special challenges.
import { kvGet, kvSet } from '../db';
import { announceChange } from '../changes';
import type { GameRecord } from '../store/types';
import { OPPONENTS } from './index';
import { challengeFor } from './challenges';
import { BADGES, CHALLENGE_BADGES, badgesEarned, type RivalryChange } from './rivalry';

export interface OpponentRecord {
  w: number;
  l: number;
  d: number;
  /** Legacy (best-win quality, later stars): stored, no longer shown. */
  stars: number;
  bestAccuracy: number;
  /** Your result in the most recent game against them. */
  last?: 'win' | 'loss' | 'draw';
  /** Their special challenge is done. */
  challengeDone?: boolean;
  /** Their special challenge has opened (five badges; or five wins, before badges opened it). */
  challengeOpen?: boolean;
  /** Legacy rivalry points: stored, no longer shown or written. */
  rp?: number;
  /** Matchup badges earned against them. */
  badges?: string[];
  /** Current run of wins against them. */
  streak?: number;
}

/** Legacy: wins up to five were "stars", and five of them opened the challenge (see migrateBadges). */
export const MAX_STARS = 5;
/** Kept for old callers and tests: one star per win, up to five. No longer shown. */
export const starsOf = (r: OpponentRecord | undefined) => Math.min(MAX_STARS, r?.w ?? 0);

/** Badges held against an opponent (only known ids, so a stray one can't count). */
export const badgeCount = (r: OpponentRecord | undefined) => (r?.badges ?? []).filter((b) => BADGES.some((x) => x.id === b)).length;
/** Their special challenge is open: five badges with them, or opened earlier (kept). */
export const challengeOpen = (r: OpponentRecord | undefined) => !!r && (!!r.challengeOpen || badgeCount(r) >= CHALLENGE_BADGES);

const KEY = 'opponentStats';
const empty = (): OpponentRecord => ({ w: 0, l: 0, d: 0, stars: 0, bestAccuracy: 0 });

export const getOpponentRecords = () => kvGet<Record<string, OpponentRecord>>(KEY, {});

/** Updates the record after a game: the score, badges, and the special challenge (it opens at the
 *  fifth badge and counts from the game after). No rivalry points or XP any more. */
export async function recordOpponentGame(g: GameRecord): Promise<{ firstWin: boolean; challengeOpened: boolean; challengeDone: boolean; rivalry: RivalryChange } | null> {
  if (!g.opponentId) return null;
  const all = await getOpponentRecords();
  const r = all[g.opponentId] ?? empty();
  const firstWin = g.userResult === 'win' && r.w === 0;
  const openBefore = challengeOpen(r);
  const ch = openBefore && !r.challengeDone ? challengeFor(g.opponentId) : undefined;
  const challengeDone = !!ch && ch.check(g);
  if (g.userResult === 'win') r.w++;
  else if (g.userResult === 'loss') r.l++;
  else r.d++;
  r.bestAccuracy = Math.max(r.bestAccuracy, g.summary.accuracy);
  r.last = g.userResult;
  if (challengeDone) r.challengeDone = true;
  r.streak = g.userResult === 'win' ? (r.streak ?? 0) + 1 : 0;
  const held = new Set(r.badges ?? []);
  const newBadges = badgesEarned(g, r.streak).filter((b) => !held.has(b));
  r.badges = [...held, ...newBadges];
  const challengeOpened = !openBefore && challengeOpen(r) && !!challengeFor(g.opponentId);
  if (challengeOpened) r.challengeOpen = true;
  all[g.opponentId] = r;
  await kvSet(KEY, all);
  announceChange('records');
  return { firstWin, challengeOpened, challengeDone, rivalry: { newBadges, badges: badgeCount(r), held: r.badges.filter((b) => BADGES.some((x) => x.id === b)) } };
}

const BADGES_KEY = 'badgeModel';
/**
 * One-time (per data set, so also after restoring an old backup): before badges, five wins
 * ("five stars") opened an opponent's special challenge. Anyone who had opened it keeps it.
 */
export async function migrateBadges(): Promise<boolean> {
  if (await kvGet<boolean>(BADGES_KEY, false)) return false;
  const all = await getOpponentRecords();
  let changed = false;
  for (const r of Object.values(all)) {
    if (r.w >= MAX_STARS && !r.challengeOpen) {
      r.challengeOpen = true;
      changed = true;
    }
  }
  if (changed) await kvSet(KEY, all);
  await kvSet(BADGES_KEY, true);
  return changed;
}

/** The ladder: the first three are open; each further opponent opens when you beat the one before. */
export function isUnlocked(id: string, records: Record<string, OpponentRecord>): boolean {
  const i = OPPONENTS.findIndex((o) => o.id === id);
  if (i < 3) return true;
  if ((records[id]?.w ?? 0) + (records[id]?.l ?? 0) + (records[id]?.d ?? 0) > 0) return true;
  return (records[OPPONENTS[i - 1].id]?.w ?? 0) > 0;
}

/**
 * A fresh start against the bots: every record (wins, draws, losses, stars, rivalry, badges,
 * challenges and unlocks) is cleared, so the ladder starts again from the first opponent.
 * Your game history is not touched.
 */
export async function resetOpponentRecords(): Promise<void> {
  await kvSet(KEY, {});
  announceChange('records');
}
