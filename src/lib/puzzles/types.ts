export interface Puzzle {
  id: string;
  /** Position before the opponent's first move (Lichess format). */
  fen: string;
  /** Moves in UCI; moves[0] is the opponent's move, then the solution alternates. */
  moves: string[];
  rating: number;
  themes: string[];
}

/** 'learn' = unrated (custom, learning mode, your games, the daily puzzle). */
export type PuzzleSource = 'rated' | 'theme' | 'daily' | 'review' | 'learn';

export interface PuzzleAttempt {
  id?: number;
  puzzleId: string;
  at: number;
  success: boolean;
  puzzleRating: number;
  ratingBefore: number;
  ratingAfter: number;
  themes: string[];
  source: PuzzleSource;
  hintsUsed: number;
}

export interface RatingPoint {
  id?: number;
  at: number;
  rating: number;
}
