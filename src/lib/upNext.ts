// Home's "Up next": the single most useful thing to do after (or instead of) a game, by these
// rules in order:
//  1. your last game has key moments you haven't gone through → that game's review
//     (chess.com imports count once analysed);
//  2. Daily training isn't done today → Daily training;
//  3. the course has a next step → that step;
//  4. otherwise → the Puzzle Path.
// It recomputes whenever Home shows again, so acting on it moves it on.
import { kvGet, kvSet, today } from './db';
import { allGames, opponentLabel } from './games';
import { reviewGame, type Review } from './review';
import { CHAPTERS, courseLevel, courseState, type CourseStep } from './course';
import { boardName, getPathState, levelAt } from './puzzles/path';
import { dueCount } from './store/daily';
import { opponentById } from './people';
import type { AnyGame } from './store/types';

/** One key per game, app or chess.com. */
export const gameKey = (g: Pick<AnyGame, 'source' | 'id' | 'endedAt'>) => `${g.source ?? 'app'}:${g.id ?? g.endedAt}`;

const SEEN = 'reviewsSeen';
/** The games whose review you've opened (kept in the database, so a backup carries it). */
export async function markReviewSeen(g: Pick<AnyGame, 'source' | 'id' | 'endedAt'>): Promise<void> {
  const k = gameKey(g);
  const list = await kvGet<string[]>(SEEN, []);
  if (list.includes(k)) return;
  await kvSet(SEEN, [...list, k].slice(-300));
}
export const reviewSeen = async (g: Pick<AnyGame, 'source' | 'id' | 'endedAt'>) => (await kvGet<string[]>(SEEN, [])).includes(gameKey(g));

/** The moments of yours worth fixing in a game: its key moments where you slipped (at most 3). */
export const fixMoments = (r: Pick<Review, 'moments'>) => r.moments.filter((m) => m.by === 'you').slice(0, 3);

export type UpNext =
  | { kind: 'review'; gameId: number | string; opponent: string; moments: number }
  | { kind: 'daily'; due: number }
  | { kind: 'course'; step: CourseStep; level: number; chapter: string }
  | { kind: 'puzzles'; board: string; level: number; toNext: number };

export interface UpNextInput {
  last?: { gameId: number | string; opponent: string; moments: number; seen: boolean };
  dailyDone: boolean;
  due: number;
  course?: { step: CourseStep; level: number; chapter: string } | null;
  points: number;
}

/** The rules, in order (pure, for the tests). */
export function chooseUpNext(i: UpNextInput): UpNext {
  if (i.last && i.last.moments > 0 && !i.last.seen) return { kind: 'review', gameId: i.last.gameId, opponent: i.last.opponent, moments: i.last.moments };
  if (!i.dailyDone) return { kind: 'daily', due: i.due };
  if (i.course) return { kind: 'course', ...i.course };
  const pos = levelAt(i.points);
  return { kind: 'puzzles', board: boardName(pos.board), level: pos.level, toNext: pos.cost - pos.into };
}

/** Title and the one muted line under it. */
export function upNextText(u: UpNext): { title: string; detail: string } {
  if (u.kind === 'review') return { title: `Review your game vs ${u.opponent}`, detail: `${u.moments} key moment${u.moments === 1 ? '' : 's'}` };
  if (u.kind === 'daily') return { title: 'Daily training', detail: u.due ? `${u.due} position${u.due === 1 ? '' : 's'} from your mistakes` : 'Puzzles picked for your weak spots' };
  if (u.kind === 'course') return { title: `Continue: ${u.step.label}`, detail: `Course · level ${u.level}, ${u.chapter}` };
  return { title: 'Solve puzzles', detail: `${u.board} ${u.level}, ${u.toNext.toLocaleString('en-US')} points to level ${u.level === 20 ? 1 : u.level + 1}` };
}

/** Everything the rules need, read from storage. */
export async function loadUpNext(): Promise<UpNext> {
  const [games, path, due, st] = await Promise.all([allGames(), getPathState(), dueCount(), courseState()]);
  let last: UpNextInput['last'];
  const g = games[0];
  if (g) {
    let moments = 0;
    try {
      moments = fixMoments(reviewGame(g)).length;
    } catch {
      moments = 0;
    }
    last = { gameId: g.id!, opponent: opponentLabel(g, opponentById(g.opponentId)?.name), moments, seen: await reviewSeen(g) };
  }
  const lv = courseLevel(st);
  const step = lv.finished ? undefined : lv.chapter.steps.find((s) => !st.done[s.id]);
  return chooseUpNext({
    last,
    dailyDone: path.flatDays.dailyTrainingDone === today(),
    due,
    course: step ? { step, level: lv.level, chapter: CHAPTERS[lv.level - 1].title } : null,
    points: path.points,
  });
}
