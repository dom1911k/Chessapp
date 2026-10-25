import { db } from './db';

export interface WeekStats {
  puzzlesSolved: number;
  puzzlesTried: number;
  games: number;
  accuracy: number | null;
  blundersPerGame: number | null;
  activeDays: number;
}

const DAY = 864e5;

async function statsBetween(from: number, to: number): Promise<WeekStats> {
  const attempts = await db.attempts.where('at').between(from, to).toArray();
  const games = (await db.games.where('endedAt').between(from, to).toArray());
  const acc = games.length ? games.reduce((a, g) => a + g.summary.accuracy, 0) / games.length : null;
  const bl = games.length ? games.reduce((a, g) => a + g.summary.counts.blunder, 0) / games.length : null;
  const days = new Set([...attempts.map((a) => new Date(a.at).toDateString()), ...games.map((g) => new Date(g.endedAt).toDateString())]);
  return {
    puzzlesSolved: attempts.filter((a) => a.success).length,
    puzzlesTried: attempts.length,
    games: games.length,
    accuracy: acc === null ? null : Math.round(acc),
    blundersPerGame: bl === null ? null : Math.round(bl * 10) / 10,
    activeDays: days.size,
  };
}

/** This week (last 7 days) and the week before, for comparison. */
export async function weeklySummary(now = Date.now()): Promise<{ thisWeek: WeekStats; lastWeek: WeekStats }> {
  return {
    thisWeek: await statsBetween(now - 7 * DAY, now + 1),
    lastWeek: await statsBetween(now - 14 * DAY, now - 7 * DAY),
  };
}
