// The weekly goal: train on N days of the week (Mon–Sun). Missing a day never resets anything.
import { useCelebrate } from '../celebrate';
import { db, kvGet, kvSet, today } from '../db';

export const GOAL_KEY = 'weeklyGoalDays';
const MET_KEY = 'weeksMet';

export function weekStart(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

export const weekKey = (d = new Date()) => today(weekStart(d));

export async function weeklyGoal(): Promise<{ goal: number; days: number; activeDays: string[]; met: boolean }> {
  const goal = await kvGet(GOAL_KEY, 4);
  const start = weekStart();
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(today(d));
  }
  const rows = await db.activity.bulkGet(keys);
  const activeDays = keys.filter((_, i) => {
    const r = rows[i];
    return r && r.puzzles + r.games + r.reviews + (r.xp ?? 0) > 0;
  });
  return { goal, days: activeDays.length, activeDays, met: activeDays.length >= goal };
}

export const weeksMet = () => kvGet<string[]>(MET_KEY, []);

/** Call after any activity: records and celebrates reaching this week's goal (once per week). */
export async function checkWeeklyGoal(): Promise<boolean> {
  const w = await weeklyGoal();
  if (!w.met) return false;
  const met = await weeksMet();
  const key = weekKey();
  if (met.includes(key)) return false;
  await kvSet(MET_KEY, [...met, key]);
  const c = useCelebrate.getState();
  c.confetti();
  c.toast({ icon: 'sprout', title: 'Weekly goal reached!', text: `${w.goal} training days this week. Enjoy the rest days!` });
  return true;
}
