import { db, today } from './db';

/** Consecutive days with any training, ending today (or yesterday if today is still empty). */
export async function currentStreak(): Promise<number> {
  const days = new Set((await db.activity.toArray()).filter((a) => a.puzzles + a.games + a.reviews > 0).map((a) => a.day));
  const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Whether anything was trained today (so the streak is safe). */
export async function trainedToday(): Promise<boolean> {
  const a = await db.activity.get(today());
  return !!a && a.puzzles + a.games + a.reviews > 0;
}

export async function bestStreak(): Promise<number> {
  const days = (await db.activity.toArray()).filter((a) => a.puzzles + a.games + a.reviews > 0).map((a) => a.day).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const s of days) {
    const [y, m, dd] = s.split('-').map(Number);
    const d = new Date(y, m - 1, dd);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Wins in a row, newest game first (a loss or a draw ends the run). */
export function winStreak(resultsNewestFirst: ('win' | 'loss' | 'draw')[]): number {
  let n = 0;
  for (const r of resultsNewestFirst) {
    if (r !== 'win') break;
    n++;
  }
  return n;
}

export const BEST_WIN_STREAK = 'bestWinStreak';

/** Your current win streak against the bots (games played in the app). */
export async function currentWinStreak(): Promise<number> {
  const games = await db.games.orderBy('endedAt').reverse().limit(60).toArray();
  return winStreak(games.filter((g) => g.source !== 'chess.com').map((g) => g.userResult));
}
