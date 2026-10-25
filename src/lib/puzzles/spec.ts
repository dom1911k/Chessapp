import type { Card } from '../srs';
import type { Puzzle } from './types';

/** Everything the puzzle player needs, whatever the puzzle's origin. */
export interface PuzzleSpec {
  id: string;
  kind: 'lichess' | 'mistake';
  fen: string;
  /** Opponent move played automatically before the user starts. */
  setup?: string;
  /** User move, opponent reply, user move, … */
  solution: string[];
  rating?: number;
  themes: string[];
  label?: string;
  /** Mistake puzzles: accept any move the engine rates as good. */
  acceptGoodAlternatives?: boolean;
  playedSan?: string;
  explanation?: string[];
  cardId?: string;
}

export function fromLichess(p: Puzzle): PuzzleSpec {
  return { id: p.id, kind: 'lichess', fen: p.fen, setup: p.moves[0], solution: p.moves.slice(1), rating: p.rating, themes: p.themes };
}

export function fromCard(c: Card): PuzzleSpec {
  return {
    id: c.puzzleId ?? c.id,
    kind: c.kind === 'mistake' ? 'mistake' : 'lichess',
    fen: c.fen,
    setup: c.setup,
    solution: c.solution,
    rating: c.rating,
    themes: c.themes,
    label: c.label,
    acceptGoodAlternatives: c.kind === 'mistake',
    playedSan: c.playedSan,
    explanation: c.explanation,
    cardId: c.id,
  };
}
