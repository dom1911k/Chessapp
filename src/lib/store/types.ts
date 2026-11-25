import type { Stranger } from '../people/stranger';
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

/** Play Coach: Sam at your rating, 150 below (Easier) or 150 above (Harder). */
export type CoachStrength = 'easier' | 'your' | 'harder';

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
  /** A real game (characters, Quick match, stand-ins): no take-backs, hints, coach messages,
   *  warnings or overlays. Every game but Play Coach since round 7. */
  match?: boolean;
  /** The coach level this game was played with (Play Coach; older coached games too). */
  coachLevel?: 'full' | 'warnings' | 'silent';
  /** Time control "seconds+increment" when the clock is on. */
  timeControl?: string;
  /** Clock state: ms left per side, and when the side to move started thinking. */
  clock?: { w: number; b: number; turnStart: number };
  /** Seconds left on the mover's clock after each ply. */
  clocks?: number[];
  /** A rematch against a chess.com opponent (a stand-in bot that opens like them). */
  rematch?: { name: string; lines: string[][]; bookPlies: number };
  /** Against the sparring partner (its rating follows yours). */
  sparring?: boolean;
  /** The opponent's player types this game (src/lib/playerTypes.ts), and their per-game counters (Tilter). */
  types?: string[];
  qstate?: Record<string, number>;
  /** The opponent's form this game: rating points added to how it plays (normal, sd 50, ±100; invisible). */
  form?: number;
  /** This game's think pace for the opponent (round 7; 1 = its usual speed, some games quicker or slower). */
  pace?: number;
  /** A Quick match opponent (round 7): the person, from one seed (a rematch gets them back). */
  stranger?: Stranger;
  /** Draw offers this game (real games only): see src/lib/draws.ts. */
  draws?: import('../draws').DrawState;
  /** Played while their special challenge was open: a fair attempt, so no form. */
  challenge?: boolean;
  /** A Play Coach game against Coach Sam (his strength against yours): practice only, with all the help. */
  coach?: CoachStrength;
  /** Played in a cup (Cups tab): which cup, tier and round. */
  cup?: { id: string; tier: string; round: number };
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
  /** Where the game was played (missing = in this app). */
  source?: 'app' | 'chess.com';
  /** The opponent's name when it isn't one of the app's characters (chess.com username). */
  opponentName?: string;
}

/** A game imported from chess.com (its own table; never counted as an app game). */
export interface ImportedGame extends Omit<GameRecord, 'id'> {
  /** 'cc:<chess.com uuid>' */
  id: string;
  source: 'chess.com';
  url: string;
  pgn: string;
  timeControl: string;
  /** chess.com's class: bullet, blitz, rapid, daily. */
  timeClass: string;
  myRating: number;
  opponentName: string;
  /** Engine analysis done (summary and classifications filled in). */
  analyzed: boolean;
}

/** Any finished game, from the app (numeric id) or imported (string id). */
export type AnyGame = Omit<GameRecord, 'id'> & { id?: number | string };
