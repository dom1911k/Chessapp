// One entry point for "something happened": XP, weekly goal and achievements.
import { checkAchievements } from './achievements';
import { awardXp, XP } from './xp';
import { checkWeeklyGoal } from './weekly';

export type ProgressEvent =
  | { kind: 'game'; result: 'win' | 'loss' | 'draw'; accuracy: number }
  | { kind: 'puzzle'; success: boolean; clean: boolean; review: boolean }
  | { kind: 'lesson'; first: boolean }
  | { kind: 'drill'; first: boolean }
  | { kind: 'daily' }
  | { kind: 'rush'; solved: number }
  | { kind: 'chapter' };

export function xpFor(e: ProgressEvent): number {
  switch (e.kind) {
    case 'game':
      return XP.gamePlayed + (e.result === 'win' ? XP.gameWon : e.result === 'draw' ? XP.gameDraw : 0) + (e.accuracy >= 80 ? XP.accurateGame : 0);
    case 'puzzle':
      return e.success ? (e.review ? XP.review : XP.puzzle + (e.clean ? XP.cleanPuzzle : 0)) : 0;
    case 'lesson':
      return e.first ? XP.lesson : XP.lessonRepeat;
    case 'drill':
      return e.first ? XP.drill : XP.drillRepeat;
    case 'daily':
      return XP.daily;
    case 'rush':
      return e.solved * XP.rushSolve;
    case 'chapter':
      return XP.chapter;
  }
}

export async function progress(e: ProgressEvent): Promise<number> {
  const xp = xpFor(e);
  // Puzzles happen often: their XP is shown in the puzzle itself, not as a toast.
  await awardXp(xp, e.kind === 'puzzle');
  if (await checkWeeklyGoal()) await awardXp(XP.weeklyGoal, true);
  await checkAchievements();
  return xp;
}
