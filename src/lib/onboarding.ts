// The first-run welcome: who you are, how much chess you know, how often you want to train.
import { db, kvGet, kvSet } from './db';
import { getXp } from './progress/xp';

export type Experience = 'new' | 'rules' | 'club';

export const EXPERIENCE: { id: Experience; title: string; sub: string }[] = [
  { id: 'new', title: 'I am new to chess', sub: 'Start with how the pieces move and how games are won.' },
  { id: 'rules', title: 'I know the rules', sub: 'I can play a game but lose pieces and miss tactics.' },
  { id: 'club', title: 'I play regularly', sub: 'I know tactics and some openings and want to climb.' },
];

export interface StartPlan {
  /** First opponent on the Home screen. */
  opponentId: string;
  /** What the last screen of the welcome offers first. */
  first: 'lesson' | 'game' | 'placement';
  cta: string;
  line: string;
}

/** Where someone with that experience should begin. */
export function startPlan(e: Experience): StartPlan {
  if (e === 'new') return { opponentId: 'lily', first: 'lesson', cta: 'Start my first lesson', line: 'We begin with level 1 of the course: check, checkmate and stalemate. Lily, the gentlest opponent, is waiting when you want a game.' };
  if (e === 'rules') return { opponentId: 'tom', first: 'game', cta: 'Play my first game', line: 'A coached game against Grandpa Tom is the best start: I comment on your moves and you can ask for hints. The course is in the Learn tab.' };
  return { opponentId: 'maya', first: 'placement', cta: 'Find my level', line: 'Eight positions, about two minutes — then the course opens at the right stage for you. Maya is set as your first opponent; pick a stronger one any time.' };
}

export const GOAL_CHOICES = [2, 3, 4, 5, 7];

const KEY = 'onboarded';
/** True on a truly fresh install (people who already use the app never see the welcome). */
export async function needsOnboarding(): Promise<boolean> {
  if (await kvGet<boolean>(KEY, false)) return false;
  const used = (await getXp()) > 0 || (await db.games.count()) > 0 || (await kvGet<string[]>('lessonsDone', [])).length > 0;
  if (used) await kvSet(KEY, true);
  return !used;
}
export const finishOnboarding = () => kvSet(KEY, true);
