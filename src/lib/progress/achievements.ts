// Achievements: collected forever, never lost. Checked after every activity.
import { useCelebrate } from '../celebrate';
import { db, kvGet, kvSet } from '../db';
import { DRILLS } from '../endgames';
import { LESSONS } from '../lessons/data';
import { MATE_PATTERNS } from '../lessons/mates';
import { OPPONENTS } from '../people';
import { getOpponentRecords } from '../people/record';
import { awardXp, getXp, levelFor, XP } from './xp';
import { weeksMet } from './weekly';

export interface Stats {
  games: number;
  wins: number;
  checkmateWins: number;
  cleanWins: number;
  bestAccuracy: number;
  beaten: Set<string>;
  threeStars: number;
  puzzlesSolved: number;
  reviewsPassed: number;
  rushBest: number;
  lessonsDone: number;
  matesDone: number;
  drillsDone: number;
  dailyDone: number;
  weeksMet: number;
  level: number;
  chaptersDone: number;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** Opponent portrait to show instead of an icon. */
  portrait?: string;
  check: (s: Stats) => boolean;
  progress?: (s: Stats) => [number, number];
}

const count = (n: number, of: (s: Stats) => number) => ({ check: (s: Stats) => of(s) >= n, progress: (s: Stats) => [Math.min(of(s), n), n] as [number, number] });

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-game', icon: 'pawn', title: 'First game', description: 'Play your first game.', ...count(1, (s) => s.games) },
  { id: 'first-win', icon: 'trophy', title: 'First victory', description: 'Win a game.', ...count(1, (s) => s.wins) },
  { id: 'checkmate', icon: 'king', title: 'Checkmate!', description: 'Win a game by checkmate.', ...count(1, (s) => s.checkmateWins) },
  { id: 'clean-win', icon: 'target', title: 'No help needed', description: 'Win without hints or take-backs.', ...count(1, (s) => s.cleanWins) },
  { id: 'accuracy-90', icon: 'microscope', title: 'Sharp eyes', description: 'Play a game with 90% accuracy or more.', check: (s) => s.bestAccuracy >= 90 },
  { id: 'games-25', icon: 'library', title: 'Regular', description: 'Play 25 games.', ...count(25, (s) => s.games) },
  ...OPPONENTS.map((o) => ({
    id: `beat-${o.id}`,
    icon: '',
    portrait: o.id,
    title: `Beat ${o.name}`,
    description: `Win a game against ${o.name} (~${o.elo}).`,
    check: (s: Stats) => s.beaten.has(o.id),
  })),
  { id: 'stars-3', icon: 'star', title: 'Star collector', description: 'Earn 3 stars against 3 opponents.', ...count(3, (s) => s.threeStars) },
  { id: 'puzzles-10', icon: 'sparkles', title: 'Puzzler', description: 'Solve 10 puzzles.', ...count(10, (s) => s.puzzlesSolved) },
  { id: 'puzzles-100', icon: 'brain', title: 'Pattern spotter', description: 'Solve 100 puzzles.', ...count(100, (s) => s.puzzlesSolved) },
  { id: 'puzzles-500', icon: 'gem', title: 'Puzzle master', description: 'Solve 500 puzzles.', ...count(500, (s) => s.puzzlesSolved) },
  { id: 'rush-10', icon: 'zap', title: 'Quick eyes', description: 'Solve 10 in one Puzzle Rush.', ...count(10, (s) => s.rushBest) },
  { id: 'rush-20', icon: 'lightning', title: 'Lightning', description: 'Solve 20 in one Puzzle Rush.', ...count(20, (s) => s.rushBest) },
  { id: 'reviews-25', icon: 'repeat', title: 'It stuck!', description: 'Pass 25 reviews of old mistakes.', ...count(25, (s) => s.reviewsPassed) },
  { id: 'lesson-1', icon: 'cap', title: 'First lesson', description: 'Finish a lesson.', ...count(1, (s) => s.lessonsDone) },
  { id: 'lessons-all', icon: 'scroll', title: 'Scholar', description: 'Finish every lesson.', ...count(LESSONS.length, (s) => s.lessonsDone) },
  { id: 'mates-5', icon: 'king', title: 'Mate hunter', description: 'Learn 5 checkmate patterns.', ...count(5, (s) => s.matesDone) },
  { id: 'mates-all', icon: 'crown', title: 'Mate master', description: 'Learn all 10 checkmate patterns.', ...count(MATE_PATTERNS.length, (s) => s.matesDone) },
  { id: 'drill-1', icon: 'flag', title: 'Endgame explorer', description: 'Complete an endgame drill.', ...count(1, (s) => s.drillsDone) },
  { id: 'drills-all', icon: 'crown', title: 'Endgame expert', description: 'Complete every endgame drill.', ...count(DRILLS.length, (s) => s.drillsDone) },
  { id: 'daily-1', icon: 'calendar', title: 'Daily trainer', description: 'Finish a Daily training session.', ...count(1, (s) => s.dailyDone) },
  { id: 'daily-10', icon: 'calendar', title: 'Good habit', description: 'Finish 10 Daily training sessions (any days you like).', ...count(10, (s) => s.dailyDone) },
  { id: 'week-1', icon: 'sprout', title: 'Weekly goal', description: 'Reach your weekly goal once.', ...count(1, (s) => s.weeksMet) },
  { id: 'week-5', icon: 'tree', title: 'Steady growth', description: 'Reach your weekly goal in 5 weeks (they don\'t need to be in a row).', ...count(5, (s) => s.weeksMet) },
  { id: 'chapter-1', icon: 'map', title: 'On the path', description: 'Finish a chapter of the course.', ...count(1, (s) => s.chaptersDone) },
  { id: 'level-5', icon: 'medal', title: 'Level 5', description: 'Reach level 5.', ...count(5, (s) => s.level) },
  { id: 'level-10', icon: 'award', title: 'Level 10', description: 'Reach level 10.', ...count(10, (s) => s.level) },
];

const KEY = 'achievements';

export const unlockedAchievements = () => kvGet<Record<string, number>>(KEY, {});

export async function gatherStats(): Promise<Stats> {
  const games = await db.games.toArray();
  const attempts = await db.attempts.toArray();
  const records = await getOpponentRecords();
  const activity = await db.activity.toArray();
  const lessons = await kvGet<string[]>('lessonsDone', []);
  const drills = await kvGet<Record<string, { completed: number }>>('endgameProgress', {});
  const course = await kvGet<Record<string, boolean>>('courseChapters', {});
  return {
    games: games.length,
    wins: games.filter((g) => g.userResult === 'win').length,
    checkmateWins: games.filter((g) => g.userResult === 'win' && g.reason === 'checkmate').length,
    cleanWins: games.filter((g) => g.userResult === 'win' && g.hintsUsed + g.takebacks === 0).length,
    bestAccuracy: Math.max(0, ...games.map((g) => g.summary.accuracy)),
    beaten: new Set(Object.entries(records).filter(([, r]) => r.w > 0).map(([id]) => id)),
    threeStars: Object.values(records).filter((r) => r.stars >= 3).length,
    puzzlesSolved: attempts.filter((a) => a.success && a.source !== 'review').length,
    reviewsPassed: attempts.filter((a) => a.success && a.source === 'review').length,
    rushBest: await kvGet('rushBest', 0),
    lessonsDone: lessons.filter((id) => LESSONS.some((l) => l.id === id)).length,
    matesDone: lessons.filter((id) => MATE_PATTERNS.some((l) => l.id === id)).length,
    drillsDone: Object.values(drills).filter((d) => d.completed > 0).length,
    dailyDone: activity.filter((a) => a.dailyDone).length,
    weeksMet: (await weeksMet()).length,
    level: levelFor(await getXp()).level,
    chaptersDone: Object.values(course).filter(Boolean).length,
  };
}

/** Unlocks anything newly earned; celebrates and gives a little XP for each. */
export async function checkAchievements(): Promise<Achievement[]> {
  const stats = await gatherStats();
  const have = await unlockedAchievements();
  const fresh = ACHIEVEMENTS.filter((a) => !have[a.id] && a.check(stats));
  if (!fresh.length) return [];
  for (const a of fresh) have[a.id] = Date.now();
  await kvSet(KEY, have);
  const c = useCelebrate.getState();
  c.confetti();
  for (const a of fresh) c.toast({ icon: a.portrait ? 'trophy' : a.icon, title: `Achievement: ${a.title}`, text: a.description });
  await awardXp(XP.achievement * fresh.length, true);
  return fresh;
}
