// One entry point for "something happened": the weekly goal and achievements. There is no
// account XP any more (round 4): your rating, the Journey and the Puzzle Path are the numbers that
// grow. The XP already stored stays in the database, unshown.
import { bumpActivity } from '../db';
import { checkAchievements } from './achievements';
import { checkWeeklyGoal } from './weekly';

export type ProgressEvent =
  | { kind: 'game'; result: 'win' | 'loss' | 'draw'; accuracy: number }
  | { kind: 'puzzle'; success: boolean; clean: boolean; review: boolean }
  | { kind: 'lesson'; first: boolean }
  | { kind: 'drill'; first: boolean }
  | { kind: 'daily' }
  | { kind: 'rush'; solved: number }
  | { kind: 'chapter' };

export async function progress(e: ProgressEvent): Promise<void> {
  // Games, puzzles and reviews mark the day themselves; the rest counts as training here, so the
  // weekly goal still sees a lesson-only day.
  if (e.kind === 'lesson' || e.kind === 'drill' || e.kind === 'chapter' || e.kind === 'rush') await bumpActivity('other');
  await checkWeeklyGoal();
  await checkAchievements({}, { quiet: e.kind === 'game' });
}
