// Helpers for writing lessons compactly and safely: positions are reached by playing real moves
// (so they are always legal), and answers are written in normal notation (SAN).
import { Chess } from 'chess.js';
import type { CoachArrow, CoachHighlight } from '../coach/types';
import type { Lesson, LessonStep } from './data';

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** The position after playing `moves` (SAN, move numbers allowed) from the start or from `from`. */
export function pos(moves: string, from: string = START): string {
  const c = new Chess(from);
  for (const san of moves.split(/\s+/).filter((t) => t && !/^\d+\.+$/.test(t))) {
    try {
      c.move(san.replace(/^\d+\.+/, ''));
    } catch {
      throw new Error(`Lesson line: illegal move ${san} in "${moves}"`);
    }
  }
  return c.fen();
}

const lan = (fen: string, san: string): string => {
  const c = new Chess(fen);
  try {
    return c.move(san).lan;
  } catch {
    throw new Error(`Lesson answer: illegal move ${san} in ${fen}`);
  }
};

type Marks = { arrows?: string[]; good?: string[]; bad?: string[]; info?: string[]; flip?: boolean };

/** "e2e4" → a green arrow; a leading "!" makes it red (a threat), "?" blue (an idea). */
function marks(m: Marks = {}): Pick<LessonStep, 'arrows' | 'highlights' | 'flip'> {
  const arrows: CoachArrow[] = (m.arrows ?? []).map((a) => {
    const tone = a[0] === '!' ? 'bad' : a[0] === '?' ? 'info' : 'good';
    const sq = a.replace(/^[!?]/, '');
    return { from: sq.slice(0, 2), to: sq.slice(2, 4), tone } as CoachArrow;
  });
  const highlights: CoachHighlight[] = [
    ...(m.good ?? []).map((sq) => ({ sq, tone: 'good' }) as CoachHighlight),
    ...(m.bad ?? []).map((sq) => ({ sq, tone: 'bad' }) as CoachHighlight),
    ...(m.info ?? []).map((sq) => ({ sq, tone: 'info' }) as CoachHighlight),
  ];
  return { ...(arrows.length ? { arrows } : {}), ...(highlights.length ? { highlights } : {}), ...(m.flip ? { flip: true } : {}) };
}

/** A step that explains something on a position. */
export const say = (fen: string, text: string, m?: Marks): LessonStep => ({ fen, text, ...marks(m) });

/** A step where you must play one of `answers` (SAN). */
export const play = (fen: string, text: string, answers: string | string[], hint: string, success: string, m?: Marks): LessonStep => ({
  fen,
  text,
  task: { kind: 'moves', solutions: (Array.isArray(answers) ? answers : [answers]).map((a) => lan(fen, a)) },
  hint,
  success,
  ...marks(m),
});

/** A step where any checkmating move is right. */
export const mate = (fen: string, text: string, hint: string, success: string, m?: Marks): LessonStep => ({ fen, text, task: { kind: 'mate' }, hint, success, ...marks(m) });

/** A multiple-choice question; `options[answer]` is right. */
export const ask = (fen: string, text: string, options: string[], answer: number, explain: string, m?: Marks): LessonStep => ({ fen, text, quiz: { options, answer, explain }, ...marks(m) });

export const lesson = (id: string, title: string, icon: string, summary: string, steps: LessonStep[]): Lesson => ({ id, title, icon, summary, steps });
