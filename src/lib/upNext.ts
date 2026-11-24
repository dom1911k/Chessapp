// Home's "Up next": the single most useful thing to do after (or instead of) a game, by these
// rules in order:
//  1. your last game has key moments you haven't fixed → "Fix your key moments" for that game
//     (chess.com imports count once analysed);
//  2. Daily training isn't done today → Daily training;
//  3. the course has a next step → that step;
//  4. otherwise → the Puzzle Path.
// It recomputes whenever Home shows again, so acting on it moves it on.
import { db, kvGet, kvSet, today } from './db';
import { allGames, opponentLabel } from './games';
import { reviewGame, type Review } from './review';
import { CHAPTERS, courseLevel, courseState, type CourseStep } from './course';
import { boardName, getPathState, levelAt } from './puzzles/path';
import { dueCount } from './store/daily';
import { opponentById } from './people';
import { recordAttempt } from './puzzles/record';
import type { PuzzleSpec } from './puzzles/spec';
import type { AnyGame } from './store/types';

/** One key per game, app or chess.com. */
export const gameKey = (g: Pick<AnyGame, 'source' | 'id' | 'endedAt'>) => `${g.source ?? 'app'}:${g.id ?? g.endedAt}`;

type GameRef = Pick<AnyGame, 'source' | 'id' | 'endedAt'>;
const FIXED = 'momentsFixed';
/** The games whose key moments you've gone through in "Fix your key moments" (kept in the
 *  database, so a backup carries it). The flow plays once per game; later it's "Fix moments again". */
export async function markFixed(g: GameRef): Promise<void> {
  const k = gameKey(g);
  const list = await kvGet<string[]>(FIXED, []);
  if (list.includes(k)) return;
  await kvSet(FIXED, [...list, k].slice(-300));
}
export const isFixed = async (g: GameRef) => (await kvGet<string[]>(FIXED, [])).includes(gameKey(g));

/** The key moments of yours worth fixing in a game: the ones where you slipped and the better move
 *  is known (at most 3), in move order. */
export const fixMoments = (g: Pick<AnyGame, 'plies'>, r: Pick<Review, 'moments'>) =>
  r.moments
    .filter((m) => {
      const p = g.plies[m.ply];
      return m.by === 'you' && !!p?.comment?.bestUci && p.comment.bestUci !== p.uci;
    })
    .slice(0, 3);

/** A fixed moment as a practice puzzle: its mistake card when the game made one, else the same
 *  shape on the fly (no card, so nothing new is scheduled). */
export function momentSpec(g: Pick<AnyGame, 'id' | 'plies'>, ply: number, card?: { id: string; themes: string[] }): PuzzleSpec {
  const p = g.plies[ply];
  return {
    id: card?.id ?? `m:${g.id}:${ply}`,
    kind: 'mistake',
    fen: p.fenBefore,
    solution: [p.comment!.bestUci!],
    themes: card?.themes ?? p.comment?.themes ?? [],
    acceptGoodAlternatives: true,
    playedSan: p.san,
    cardId: card?.id,
  };
}

/** A moment counts as practice for its theme, like a mistake reviewed in Daily training: an
 *  attempt (the Skill tree grows from these) and, when there's a card, its spaced repetition.
 *  `hints`: wrong tries plus Show me; only a first-try find counts as clean. */
export async function practiseMoment(g: Pick<AnyGame, 'id' | 'plies'>, ply: number, solved: boolean, hints: number): Promise<void> {
  const card = await db.cards.get(`m:${g.id}:${ply}`);
  await recordAttempt(momentSpec(g, ply, card), solved, hints, 'review');
}

export type UpNext =
  | { kind: 'review'; gameId: number | string; opponent: string; moments: number }
  | { kind: 'daily'; due: number }
  | { kind: 'course'; step: CourseStep; level: number; chapter: string }
  | { kind: 'puzzles'; board: string; level: number; toNext: number };

export interface UpNextInput {
  last?: { gameId: number | string; opponent: string; moments: number; fixed: boolean };
  dailyDone: boolean;
  due: number;
  course?: { step: CourseStep; level: number; chapter: string } | null;
  points: number;
}

/** The rules, in order (pure, for the tests). */
export function chooseUpNext(i: UpNextInput): UpNext {
  if (i.last && i.last.moments > 0 && !i.last.fixed) return { kind: 'review', gameId: i.last.gameId, opponent: i.last.opponent, moments: i.last.moments };
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
      moments = fixMoments(g, reviewGame(g)).length;
    } catch {
      moments = 0;
    }
    last = { gameId: g.id!, opponent: opponentLabel(g, opponentById(g.opponentId)?.name), moments, fixed: await isFixed(g) };
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
