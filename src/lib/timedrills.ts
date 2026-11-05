// Time drills: "Convert on the clock" (a won ending, 60 s to mate against Maia) and "Quick
// decisions" (10 positions with one obvious move, 5 s each). Pure parts.
import { tryMove } from './chess/game';
import { DRILLS } from './endgames';
import type { Puzzle } from './puzzles/types';

export const CONVERT_SECONDS = 60;
export const QUICK_SECONDS = 5;
export const QUICK_COUNT = 10;
/** Puzzles at most this hard feed Quick decisions. */
export const QUICK_MAX_RATING = 1100;

/** Winning positions for Convert on the clock: the basic mates from the endgame drills. */
export function convertPositions(): { fen: string; title: string }[] {
  return DRILLS.filter((d) => d.goal === 'mate' && (d.id === 'kqk' || d.id === 'krk')).flatMap((d) => d.fens.map((fen) => ({ fen, title: d.title })));
}

export type QuickKind = 'recapture' | 'free' | 'escape';
export interface QuickItem {
  id: string;
  /** Position after the opponent's move, you to move. */
  fen: string;
  /** The opponent's last move (highlighted). */
  last: string;
  answer: string;
  kind: QuickKind;
}

export const QUICK_LABEL: Record<QuickKind, string> = { recapture: 'Take back', free: 'Free piece', escape: 'Escape the threat' };

/** Turn a puzzle into a quick-decision item, if its first move is an obvious one. */
export function quickItem(p: Puzzle): QuickItem | null {
  if (p.rating > QUICK_MAX_RATING || p.moves.length < 2) return null;
  const setup = tryMove(p.fen, p.moves[0]);
  if (!setup) return null;
  const answer = tryMove(setup.fen, p.moves[1]);
  if (!answer) return null;
  let kind: QuickKind | null = null;
  if (setup.move.captured && answer.move.captured && p.moves[0].slice(2, 4) === p.moves[1].slice(2, 4)) kind = 'recapture';
  else if (p.themes.includes('hangingPiece') && answer.move.captured) kind = 'free';
  else if (p.themes.includes('defensiveMove') && !answer.move.captured) kind = 'escape';
  // Mates and long combinations aren't "obvious" — keep it to the simple kinds.
  if (!kind || p.themes.includes('mateIn1')) return null;
  return { id: p.id, fen: setup.fen, last: p.moves[0], answer: p.moves[1], kind };
}

/** A set of quick decisions, mixing the kinds. */
export function quickSet(puzzles: Puzzle[], n = QUICK_COUNT, rand = Math.random): QuickItem[] {
  const items = puzzles.map(quickItem).filter((x): x is QuickItem => !!x);
  const byKind: Record<QuickKind, QuickItem[]> = { recapture: [], free: [], escape: [] };
  for (const it of items) byKind[it.kind].push(it);
  for (const k of Object.keys(byKind) as QuickKind[]) byKind[k].sort(() => rand() - 0.5);
  const order: QuickKind[] = ['recapture', 'free', 'escape'];
  const out: QuickItem[] = [];
  for (let i = 0; out.length < n && i < n * 3; i++) {
    const it = byKind[order[i % 3]].pop();
    if (it) out.push(it);
  }
  return out.sort(() => rand() - 0.5);
}

/** The answer, or a move that does the same job (captures on the same square for take-backs/free pieces). */
export function quickCorrect(it: QuickItem, uci: string): boolean {
  if (uci === it.answer) return true;
  if (it.kind === 'escape') return false;
  const r = tryMove(it.fen, uci);
  return !!r?.move.captured && uci.slice(2, 4) === it.answer.slice(2, 4);
}
