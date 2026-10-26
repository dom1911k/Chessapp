// Head-to-head records and stars per opponent; drives the ladder.
import { kvGet, kvSet } from '../db';
import type { GameRecord } from '../store/types';
import { OPPONENTS } from './index';

export interface OpponentRecord {
  w: number;
  l: number;
  d: number;
  /** Best result: 1★ win, 2★ win with ≤2 hints/take-backs, 3★ win with none. */
  stars: number;
  bestAccuracy: number;
  /** Your result in the most recent game against them. */
  last?: 'win' | 'loss' | 'draw';
}

const KEY = 'opponentStats';
const empty = (): OpponentRecord => ({ w: 0, l: 0, d: 0, stars: 0, bestAccuracy: 0 });

export const getOpponentRecords = () => kvGet<Record<string, OpponentRecord>>(KEY, {});

export function starsFor(g: Pick<GameRecord, 'userResult' | 'hintsUsed' | 'takebacks'>): number {
  if (g.userResult !== 'win') return 0;
  const help = g.hintsUsed + g.takebacks;
  return help === 0 ? 3 : help <= 2 ? 2 : 1;
}

/** Updates the record after a game; returns stars earned and whether they improved. */
export async function recordOpponentGame(g: GameRecord): Promise<{ stars: number; improved: boolean; firstWin: boolean } | null> {
  if (!g.opponentId) return null;
  const all = await getOpponentRecords();
  const r = all[g.opponentId] ?? empty();
  const stars = starsFor(g);
  const firstWin = g.userResult === 'win' && r.w === 0;
  if (g.userResult === 'win') r.w++;
  else if (g.userResult === 'loss') r.l++;
  else r.d++;
  const improved = stars > r.stars;
  r.stars = Math.max(r.stars, stars);
  r.bestAccuracy = Math.max(r.bestAccuracy, g.summary.accuracy);
  r.last = g.userResult;
  all[g.opponentId] = r;
  await kvSet(KEY, all);
  return { stars, improved, firstWin };
}

/** The ladder: the first three are open; each further opponent opens when you beat the one before. */
export function isUnlocked(id: string, records: Record<string, OpponentRecord>): boolean {
  const i = OPPONENTS.findIndex((o) => o.id === id);
  if (i < 3) return true;
  if ((records[id]?.w ?? 0) + (records[id]?.l ?? 0) + (records[id]?.d ?? 0) > 0) return true;
  return (records[OPPONENTS[i - 1].id]?.w ?? 0) > 0;
}
