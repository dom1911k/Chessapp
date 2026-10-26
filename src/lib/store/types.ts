import type { Classification, Score } from '../chess/evaluation';
import type { GameResult } from '../chess/game';
import type { Color } from '../chess/pos';
import type { CoachComment, Theme } from '../coach/types';
import type { Special, TacticCounts } from '../rewards/career';

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
  /** A brilliant or great move by you. */
  special?: Special;
  /** Tactics in this (sound) move of yours. */
  tactics?: TacticCounts;
}

/** One message from Coach Sam in the game's conversation. */
export interface FeedItem {
  id: number;
  kind: 'comment' | 'hint' | 'threat' | 'note' | 'info' | 'result' | 'opening' | 'takeback' | 'explain';
  text: string[];
  classification?: Classification;
  /** Brilliant / great move badge. */
  special?: Special;
  mood?: 'happy' | 'concerned' | 'thinking';
  /** Ply this message is about (for the "seems wrong" link and jumping in review). */
  ply: number;
}

export interface SavedGame {
  id: 'play';
  userColor: Color;
  elo: number;
  /** Opponent character (see lib/people); undefined for custom strength. */
  opponentId?: string;
  startFen: string;
  startedAt: number;
  plies: PlyRecord[];
  takebacks: number;
  hintsUsed: number;
  /** Principle reminders already given this game. */
  told: string[];
  /** Coach conversation so far. */
  feed?: FeedItem[];
  /** Tactics you played this game. */
  tactics?: TacticCounts;
  /** Your lowest winning chance during the game (for comebacks). */
  minWp?: number;
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
