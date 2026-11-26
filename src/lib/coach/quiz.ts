// Play Coach quick questions (round 7, Phase 4): at most one every 5 of your moves, never in the
// first 6, and only when there's a clear answer you can tap on the board:
//   threat      "What's my threat?" after a Sam move that creates one (the piece he attacks, or
//               the square he threatens to mate on)
//   undefended  "Which of your pieces is undefended?" when one or two of yours hang
//   fork        "There's a fork for you here. Can you find it?" (the square the forking piece goes to)
// Pure: the play store asks after each of Sam's moves.
import { Chess } from 'chess.js';
import { applyUci, attackersOf, hangingPieces, other, parseFen, PIECE_NAME, see, sqIndex, sqName, type Color } from '../chess/pos';
import { mateThreats, moveMotifs } from './tactics';

export type QuizKind = 'threat' | 'undefended' | 'fork';

export interface Question {
  kind: QuizKind;
  prompt: string;
  /** Squares that count as a right answer. */
  answers: string[];
  /** The one-line why, shown after the answer. */
  why: string;
}

export const QUIZ = { everyMoves: 5, fromMove: 7 };

/** Is a question allowed now? `yourMoves`: moves you've made; `lastAt`: your move count at the last question. */
export function quizAllowed(o: { yourMoves: number; lastAt?: number; busy: boolean }): boolean {
  if (o.busy || o.yourMoves + 1 < QUIZ.fromMove) return false;
  return o.lastAt === undefined || o.yourMoves - o.lastAt >= QUIZ.everyMoves;
}

const name = (t: string | undefined) => PIECE_NAME[(t ?? 'p') as keyof typeof PIECE_NAME];

/** A threat Sam's move (`uci` from `fenBefore`) creates: mate next move, or a new attack on one of your pieces. */
export function threatQuestion(fenBefore: string, uci: string): Question | null {
  const c = new Chess(fenBefore);
  let m;
  try {
    m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
  if (c.isGameOver() || c.inCheck()) return null;
  const sam = m.color as Color;
  const you = other(sam);
  const mates = mateThreats(c.fen(), sam);
  if (mates.length) {
    const sqs = [...new Set(mates.map((u) => u.slice(2, 4)))];
    if (sqs.length > 2) return null;
    return { kind: 'threat', prompt: "What's my threat? Tap the square I'm going for.", answers: sqs, why: `I was threatening mate on ${sqs[0]}.` };
  }
  const before = parseFen(fenBefore).board;
  const after = applyUci(before, uci);
  const was = new Set(hangingPieces(before, you).map((h) => h.sq));
  const to = sqIndex(m.to);
  const fresh = hangingPieces(after, you).filter((h) => !was.has(h.sq) && after[h.sq]?.type !== 'p' && attackersOf(after, h.sq, sam).includes(to));
  if (fresh.length !== 1) return null;
  const h = fresh[0];
  return { kind: 'threat', prompt: "What's my threat? Tap the piece I'm attacking.", answers: [sqName(h.sq)], why: `My ${name(m.piece)} attacks your ${name(after[h.sq]?.type)} on ${sqName(h.sq)}, and it isn't safe there.` };
}

/** One or two of your pieces (not pawns) hang in `fen` (you to move). */
export function undefendedQuestion(fen: string, you: Color): Question | null {
  const board = parseFen(fen).board;
  const hang = hangingPieces(board, you).filter((h) => board[h.sq]?.type !== 'p');
  if (hang.length < 1 || hang.length > 2) return null;
  const sqs = hang.map((h) => sqName(h.sq));
  const first = hang[0];
  return { kind: 'undefended', prompt: 'Which of your pieces is undefended? Tap it.', answers: sqs, why: `Your ${name(board[first.sq]?.type)} on ${sqName(first.sq)} can be taken${hang.length === 2 ? `, and so can your ${name(board[hang[1].sq]?.type)} on ${sqName(hang[1].sq)}` : ''}.` };
}

/** You have a fork in `fen` (you to move): a move that attacks two things at once and is safe. */
export function forkQuestion(fen: string): Question | null {
  const c = new Chess(fen);
  const board = parseFen(fen).board;
  const you = c.turn() as Color;
  const hits: { to: string; san: string; targets: string[] }[] = [];
  for (const m of c.moves({ verbose: true })) {
    const f = moveMotifs(fen, m.lan).find((x) => x.kind === 'fork');
    if (!f || f.kind !== 'fork') continue;
    const after = applyUci(board, m.lan);
    // The forking piece mustn't simply be lost on its square.
    if (see(after, sqIndex(m.to), other(you)) > 0) continue;
    hits.push({ to: m.to, san: m.san, targets: f.fork.targets.map((s) => name(after[s]?.type)) });
  }
  const squares = [...new Set(hits.map((h) => h.to))];
  if (!hits.length || squares.length > 2) return null;
  const h = hits[0];
  return { kind: 'fork', prompt: "There's a fork for you here. Can you find it? Tap the square.", answers: squares, why: `${h.san} attacks my ${h.targets[0]} and my ${h.targets[1]} at once.` };
}

/**
 * The question after Sam's move `samUci` from `fenBefore` (you're to move in `fenAfter`), if any:
 * his threat first, then a fork for you, then your undefended pieces.
 */
export function pickQuestion(o: { fenBefore: string; samUci: string; fenAfter: string; you: Color }): Question | null {
  return threatQuestion(o.fenBefore, o.samUci) ?? forkQuestion(o.fenAfter) ?? undefendedQuestion(o.fenAfter, o.you);
}

/** Is `sq` a right answer? */
export const quizRight = (q: Question, sq: string) => q.answers.includes(sq);

/** The review's line: "Questions: 3 of 4 right" (a skipped question counts as asked, not right). */
export function quizLine(quiz: { ok: boolean }[] | undefined): string | null {
  if (!quiz?.length) return null;
  return `Questions: ${quiz.filter((q) => q.ok).length} of ${quiz.length} right`;
}
