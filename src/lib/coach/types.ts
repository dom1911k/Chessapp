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
}

export type FindingKind = 'problem' | 'idea' | 'principle' | 'praise';

export interface Finding {
  rule: string;
  kind: FindingKind;
  theme: Theme;
  text: string;
  arrows?: CoachArrow[];
  highlights?: CoachHighlight[];
}
