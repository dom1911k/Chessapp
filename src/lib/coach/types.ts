import type { Classification } from '../chess/evaluation';

/** Training themes. Shared by the coach, puzzles, lessons and stats. */
export type Theme =
  | 'hangingPiece'
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'discoveredAttack'
  | 'backRankMate'
  | 'mateIn1'
  | 'mateIn2'
  | 'mate'
  | 'trade'
  | 'opening'
  | 'kingSafety'
  | 'defense'
  | 'endgame'
  | 'trappedPiece'
  | 'capturingDefender'
  | 'deflection'
  | 'promotion'
  | 'material';

export type Tone = 'good' | 'bad' | 'info';

export interface CoachArrow {
  from: string;
  to: string;
  tone: Tone;
}

export interface CoachHighlight {
  sq: string;
  tone: Tone;
}

export interface CoachComment {
  classification?: Classification;
  /** 1–3 short sentences. */
  text: string[];
  themes: Theme[];
  ruleIds: string[];
  arrows: CoachArrow[];
  highlights: CoachHighlight[];
  bestSan?: string;
  bestUci?: string;
  /** The engine's best line from the position before the move (UCI, starts with bestUci). */
  bestLine?: string[];
  /** The opponent's best answer to the move played, and what follows (UCI). */
  replyLine?: string[];
  /** The text already names the better move ("Moving your queen to e2 would have…"), so a
   * separate "Better: Qe2" line would say it twice. Absent on games saved before it existed. */
  namesBest?: boolean;
}

export type FindingKind = 'problem' | 'idea' | 'principle' | 'praise';

export interface Finding {
  rule: string;
  kind: FindingKind;
  theme: Theme;
  text: string;
  arrows?: CoachArrow[];
  highlights?: CoachHighlight[];
  /** The sentence names the better move (templates with {move} / {doMove}). */
  namesBest?: boolean;
}
