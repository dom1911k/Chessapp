// Achievements: collected forever, never lost. Checked after every activity.
import { useCelebrate } from '../celebrate';
import { db, kvGet, kvSet } from '../db';
import { DRILLS } from '../endgames';
import { LESSONS } from '../lessons/data';
import { MATE_PATTERNS } from '../lessons/mates';
import { OPPONENTS } from '../people';
import { badgeCount, getOpponentRecords } from '../people/record';
import { getGameRating } from '../rewards/rating';
import { add, BEST_GAME, getCareer, maxOf, type TacticCounts } from '../rewards/career';
import { skillStates } from '../rewards/skills';
import { getPathState, levelAt } from '../puzzles/path';
import { weeksMet } from './weekly';

export interface Stats {
  games: number;
  wins: number;
  checkmateWins: number;
  cleanWins: number;
  bestAccuracy: number;
  beaten: Set<string>;
  /** Most badges you hold against any one opponent. */
  maxBadges: number;
  /** Tactics played in all your games (plus the current game while it's running). */
  career: TacticCounts;
  /** Most of each tactic in a single game. */
  bestGame: TacticCounts;
  comebacks: number;
  spotlessWins: number;
  challengesDone: number;
  goldSkills: number;
  collected: number;
  puzzlesSolved: number;
  reviewsPassed: number;
  rushBest: number;
  lessonsDone: number;
  matesDone: number;
  drillsDone: number;
  dailyDone: number;
  weeksMet: number;
  /** Your best Journey rating (peak), on either rating scale. */
  peak: number;
  chaptersDone: number;
  /** The puzzle path: the board you're on (0 = Wood … 7 = Legend) and your best streak. */
  pathBoard: number;
  pathBestStreak: number;
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
    description: `Win a game against ${o.name} (${o.elo}).`,
    check: (s: Stats) => s.beaten.has(o.id),
  })),
  // Ids kept from before badges and the Journey replaced stars and levels: earned ones stay earned.
  { id: 'stars-3', icon: 'star', title: 'Best friends', description: 'Collect all 8 badges with one opponent.', ...count(8, (s) => s.maxBadges) },
  { id: 'challenge-1', icon: 'flag', title: 'Challenge accepted', description: "Complete an opponent's special challenge.", ...count(1, (s) => s.challengesDone) },
  { id: 'challenge-5', icon: 'trophy', title: 'Challenge champion', description: 'Complete 5 special challenges.', ...count(5, (s) => s.challengesDone) },
  // Tactics played in real games
  { id: 'tac-fork-1', icon: 'fork', title: 'First fork', description: 'Play a fork in a game.', ...count(1, (s) => s.career.forks ?? 0) },
  { id: 'tac-fork-10', icon: 'fork', title: 'Fork collector', description: 'Play 10 forks in your games.', ...count(10, (s) => s.career.forks ?? 0) },
  { id: 'tac-fork-3game', icon: 'utensils', title: 'Fork festival', description: 'Play 3 forks in one game.', ...count(3, (s) => s.bestGame.forks ?? 0) },
  { id: 'tac-royal', icon: 'crown', title: 'Royal fork', description: 'Fork the king and the queen at once.', ...count(1, (s) => s.career.royalForks ?? 0) },
  { id: 'tac-pin-1', icon: 'pin', title: 'Pinned down', description: 'Pin a piece in a game.', ...count(1, (s) => s.career.pins ?? 0) },
  { id: 'tac-pin-10', icon: 'pin', title: 'Pin master', description: 'Play 10 pins in your games.', ...count(10, (s) => s.career.pins ?? 0) },
  { id: 'tac-skewer', icon: 'skewer', title: 'Skewered!', description: 'Play a skewer in a game.', ...count(1, (s) => s.career.skewers ?? 0) },
  { id: 'tac-discovered', icon: 'eye', title: 'Now you see me', description: 'Play a discovered attack in a game.', ...count(1, (s) => s.career.discovered ?? 0) },
  { id: 'tac-queens-10', icon: 'queen', title: 'Queen hunter', description: "Capture your opponent's queen 10 times.", ...count(10, (s) => s.career.queenCaptures ?? 0) },
  { id: 'mate-10', icon: 'king', title: 'Mate collector', description: 'Checkmate your opponent 10 times.', ...count(10, (s) => s.career.checkmates ?? 0) },
  { id: 'mate-backrank', icon: 'castle', title: 'Back-rank hero', description: 'Win with a back-rank mate.', ...count(1, (s) => s.career.backRankMates ?? 0) },
  { id: 'mate-smothered', icon: 'knight', title: 'Smothered!', description: 'Win with a smothered mate.', ...count(1, (s) => s.career.smotheredMates ?? 0) },
  { id: 'promo-1', icon: 'crown', title: 'A new queen', description: 'Promote a pawn in a game.', ...count(1, (s) => s.career.promotions ?? 0) },
  { id: 'brill-1', icon: 'sparkles', title: 'Brilliant!', description: 'Play a brilliant move.', ...count(1, (s) => s.career.brilliant ?? 0) },
  { id: 'brill-5', icon: 'gem', title: 'Genius at work', description: 'Play 5 brilliant moves.', ...count(5, (s) => s.career.brilliant ?? 0) },
  { id: 'great-1', icon: 'zap', title: 'Great find', description: 'Find the only good move in a tricky position.', ...count(1, (s) => s.career.great ?? 0) },
  { id: 'great-10', icon: 'zap', title: 'Sharp eye', description: 'Play 10 great moves.', ...count(10, (s) => s.career.great ?? 0) },
  { id: 'comeback', icon: 'repeat', title: 'Comeback kid', description: 'Win a game after being clearly worse.', ...count(1, (s) => s.comebacks) },
  { id: 'spotless', icon: 'shield', title: 'Spotless', description: 'Win without a single mistake or blunder.', ...count(1, (s) => s.spotlessWins) },
  { id: 'skill-gold', icon: 'medal', title: 'Mastered', description: 'Master a skill (Insights → Skills).', ...count(1, (s) => s.goldSkills) },
  { id: 'collector-10', icon: 'palette', title: 'Collector', description: 'Unlock 10 items for your collection.', ...count(10, (s) => s.collected) },
  { id: 'puzzles-10', icon: 'sparkles', title: 'Puzzler', description: 'Solve 10 puzzles.', ...count(10, (s) => s.puzzlesSolved) },
  { id: 'puzzles-100', icon: 'brain', title: 'Pattern spotter', description: 'Solve 100 puzzles.', ...count(100, (s) => s.puzzlesSolved) },
  { id: 'puzzles-500', icon: 'gem', title: 'Puzzle master', description: 'Solve 500 puzzles.', ...count(500, (s) => s.puzzlesSolved) },
  { id: 'path-stone', icon: 'castle', title: 'Stone board', description: 'Reach the Stone board on the puzzle path.', ...count(1, (s) => s.pathBoard) },
  { id: 'path-silver', icon: 'shield', title: 'Silver board', description: 'Reach the Silver board on the puzzle path.', ...count(3, (s) => s.pathBoard) },
  { id: 'path-crystal', icon: 'gem', title: 'Crystal board', description: 'Reach the Crystal board on the puzzle path.', ...count(4, (s) => s.pathBoard) },
  { id: 'path-legend', icon: 'crown', title: 'Legend board', description: 'Reach the Legend board on the puzzle path.', ...count(7, (s) => s.pathBoard) },
  { id: 'streak-15', icon: 'lightning', title: '15 in a row', description: 'Solve 15 puzzles in a row without a miss.', ...count(15, (s) => s.pathBestStreak) },
  { id: 'streak-30', icon: 'star', title: '30 in a row', description: 'Solve 30 puzzles in a row without a miss.', ...count(30, (s) => s.pathBestStreak) },
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
  { id: 'level-5', icon: 'medal', title: 'Park Rookie', description: 'Reach 500 on your journey.', ...count(500, (s) => s.peak) },
  { id: 'level-10', icon: 'award', title: 'Club Member', description: 'Reach 1000 on your journey.', ...count(1000, (s) => s.peak) },
];

const KEY = 'achievements';

export const unlockedAchievements = () => kvGet<Record<string, number>>(KEY, {});

export async function gatherStats(extra: TacticCounts = {}): Promise<Stats> {
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
    maxBadges: Math.max(0, ...Object.values(records).map((r) => badgeCount(r))),
    career: add(await getCareer(), extra),
    bestGame: maxOf(await kvGet<TacticCounts>(BEST_GAME, {}), extra),
    comebacks: games.filter((g) => g.userResult === 'win' && (g.minWp ?? 50) <= 20).length,
    spotlessWins: games.filter((g) => g.userResult === 'win' && g.summary.counts.mistake + g.summary.counts.blunder === 0 && g.plies.filter((p) => p.isUser).length >= 10).length,
    challengesDone: Object.values(records).filter((r) => r.challengeDone).length,
    goldSkills: Object.values(await skillStates(extra)).filter((x) => x.tier === 3).length,
    collected: await collectedCount(),
    puzzlesSolved: attempts.filter((a) => a.success && a.source !== 'review').length,
    reviewsPassed: attempts.filter((a) => a.success && a.source === 'review').length,
    rushBest: await kvGet('rushBest', 0),
    lessonsDone: lessons.filter((id) => LESSONS.some((l) => l.id === id)).length,
    matesDone: lessons.filter((id) => MATE_PATTERNS.some((l) => l.id === id)).length,
    drillsDone: Object.values(drills).filter((d) => d.completed > 0).length,
    dailyDone: activity.filter((a) => a.dailyDone).length,
    weeksMet: (await weeksMet()).length,
    peak: Math.max((await getGameRating()).peak, await kvGet<number>('legacyPeak', 0)),
    chaptersDone: Object.values(course).filter(Boolean).length,
    ...(await pathStats()),
  };
}
async function pathStats() {
  const p = await getPathState();
  return { pathBoard: levelAt(p.points).board, pathBestStreak: p.bestStreak };
}

/**
 * Unlocks anything newly earned; celebrates with a toast unless `quiet` (games: the results sheet
 * lists them instead).
 */
export async function checkAchievements(extra: TacticCounts = {}, opts: { quiet?: boolean } = {}): Promise<Achievement[]> {
  const stats = await gatherStats(extra);
  const have = await unlockedAchievements();
  const fresh = ACHIEVEMENTS.filter((a) => !have[a.id] && a.check(stats));
  if (!fresh.length) return [];
  for (const a of fresh) have[a.id] = Date.now();
  await kvSet(KEY, have);
  if (!opts.quiet) {
    // A toast each, no confetti (confetti is for wins).
    const c = useCelebrate.getState();
    for (const a of fresh) c.toast({ icon: a.portrait ? 'trophy' : a.icon, title: `Achievement: ${a.title}`, text: a.description });
  }
  return fresh;
}

/** Unlocked (non-free) collection items — computed without importing the catalogue (avoids a cycle). */
async function collectedCount(): Promise<number> {
  return (await kvGet<string[]>('cosmeticsSeen', [])).length;
}
