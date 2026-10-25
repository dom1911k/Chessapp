import type { Classification, Score } from '../chess/evaluation';
import type { GameResult } from '../chess/game';
import type { Color } from '../chess/pos';
import type { CoachComment, Theme } from '../coach/types';

export interface PlyRecord {
  uci: string;
  san: string;
  color: Color;
  fenBefore: string;
  fenAfter: string;
  isUser: boolean;
  /** Engine eval of fenAfter (White POV). */
  evalAfter?: Score;
  classification?: Classification;
  accuracy?: number;
  /** Win% lost by this move (mover POV). */
  wpLoss?: number;
  comment?: CoachComment;
}

export interface SavedGame {
  id: 'play';
  userColor: Color;
  elo: number;
  startFen: string;
  startedAt: number;
  plies: PlyRecord[];
  takebacks: number;
  hintsUsed: number;
  /** Principle reminders already given this game. */
  told: string[];
}

export interface GameSummary {
  accuracy: number;
  counts: Record<Classification, number>;
  biggestMistakePly: number | null;
  lessonTheme?: Theme;
  lessonText?: string;
  /** A mistake type that keeps coming back across recent games. */
  pattern?: { theme: Theme; count: number; of: number };
}

export interface GameRecord extends Omit<SavedGame, 'id'> {
  id?: number;
  endedAt: number;
  result: GameResult;
  reason: string;
  userResult: 'win' | 'loss' | 'draw';
  summary: GameSummary;
  opening?: string;
}
