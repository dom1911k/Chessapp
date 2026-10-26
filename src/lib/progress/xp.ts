// Experience points and levels. XP only ever goes up — nothing is lost by taking a break.
import { useCelebrate } from '../celebrate';
import { db, kvGet, kvSet, today } from '../db';

export const XP = {
  gamePlayed: 20,
  gameWon: 30,
  gameDraw: 10,
  accurateGame: 10,
  puzzle: 8,
  cleanPuzzle: 4,
  review: 6,
  lesson: 40,
  lessonRepeat: 10,
  drill: 30,
  drillRepeat: 10,
  daily: 30,
  rushSolve: 3,
  chapter: 80,
  achievement: 25,
  weeklyGoal: 50,
} as const;

export const LEVEL_TITLES = [
  'Newcomer',
  'Pawn Pusher',
  'Curious Knight',
  'Bishop in Training',
  'Castle Builder',
  'Fork Finder',
  'Pin Master',
  'Rook Lifter',
  'Endgame Explorer',
  "Queen's Friend",
  'Club Player',
  'Tactician',
  'Strategist',
  'Expert in the Making',
  'Master of the Board',
];

/** Total XP needed to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelFor(total: number): { level: number; into: number; span: number; title: string } {
  let level = 1;
  while (total >= xpForLevel(level + 1)) level++;
  const into = total - xpForLevel(level);
  const span = xpForLevel(level + 1) - xpForLevel(level);
  return { level, into, span, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] };
}

export const getXp = () => kvGet<number>('xp', 0);

/** Adds XP, records it for today, and celebrates level-ups. */
export async function awardXp(amount: number, quiet = false): Promise<number> {
  if (amount <= 0) return getXp();
  const before = await getXp();
  const after = before + amount;
  await kvSet('xp', after);
  const day = today();
  await db.transaction('rw', db.activity, async () => {
    const row = (await db.activity.get(day)) ?? { day, puzzles: 0, games: 0, reviews: 0 };
    await db.activity.put({ ...row, xp: (row.xp ?? 0) + amount });
  });
  const lb = levelFor(before);
  const la = levelFor(after);
  const c = useCelebrate.getState();
  if (la.level > lb.level) {
    c.confetti();
    c.toast({ icon: 'star', title: `Level ${la.level} — ${la.title}!`, text: 'Keep it up!' });
  } else if (!quiet) {
    c.toast({ icon: 'sparkles', title: `+${amount} XP` });
  }
  return after;
}
