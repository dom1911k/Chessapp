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
