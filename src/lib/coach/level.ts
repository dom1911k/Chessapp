// Which kinds of help are on in a game: the coach level (full / warnings only / silent) in
// normal games, nothing at all in Match conditions. Pure, so the screen and the store agree.
import type { Settings } from '../settings';

export type CoachLevel = 'full' | 'warnings' | 'silent';
export const COACH_LEVELS: { id: CoachLevel; label: string; text: string }[] = [
  { id: 'full', label: 'Full', text: 'Coach Sam comments, warns, explains mistakes and shows threats.' },
  { id: 'warnings', label: 'Warnings only', text: 'Only the "are you sure?" warning before a blunder. Nothing else unless you ask.' },
  { id: 'silent', label: 'Silent', text: "No comments and no warnings. Hints and take-backs still work if you ask." },
];

export interface Aids {
  /** Coach comments on your moves (and the pause after a mistake). */
  comments: boolean;
  /** "Are you sure?" before a move that hangs a piece or allows mate. */
  precheck: boolean;
  /** Notes about threats from the opponent's moves. */
  botNotes: boolean;
  safetyOverlay: boolean;
  evalBar: boolean;
  /** Opening names announced as you play. */
  openings: boolean;
  /** On-request help: hint, take-back, threats, explain. */
  requests: boolean;
  /** Celebrations that would give a move's quality away (brilliant flash, the opponent's "oops"). */
  reveals: boolean;
}

type AidSettings = Pick<Settings, 'checkBeforeMove' | 'botNotes' | 'safetyOverlay' | 'showEvalBar' | 'coachStyle'> & { coachLevel?: CoachLevel };

export function aidsFor(s: AidSettings, game?: { match?: boolean; coachLevel?: CoachLevel }): Aids {
  if (game?.match) return { comments: false, precheck: false, botNotes: false, safetyOverlay: false, evalBar: false, openings: false, requests: false, reveals: false };
  const level = game?.coachLevel ?? s.coachLevel ?? 'full';
  if (level === 'silent') return { comments: false, precheck: false, botNotes: false, safetyOverlay: false, evalBar: false, openings: false, requests: true, reveals: true };
  if (level === 'warnings') return { comments: false, precheck: s.checkBeforeMove, botNotes: false, safetyOverlay: false, evalBar: false, openings: false, requests: true, reveals: true };
  return { comments: s.coachStyle !== 'off', precheck: s.checkBeforeMove, botNotes: s.botNotes && s.coachStyle !== 'off', safetyOverlay: s.safetyOverlay, evalBar: s.showEvalBar, openings: s.coachStyle === 'detailed', requests: true, reveals: true };
}

/** Wins needed at a level before the app suggests stepping down. */
export const STEP_DOWN_WINS = 5;
/** The next level down (silent → Match conditions). */
export const nextLevel = (l: CoachLevel): CoachLevel | 'match' => (l === 'full' ? 'warnings' : l === 'warnings' ? 'silent' : 'match');

/** Suggest stepping down after STEP_DOWN_WINS wins at the current level since it was chosen. */
export function stepDownSuggestion(games: { coachLevel?: CoachLevel; match?: boolean; userResult: string; endedAt: number; source?: string }[], level: CoachLevel, since: number): { wins: number; to: CoachLevel | 'match' } | null {
  const wins = games.filter((g) => g.source !== 'chess.com' && !g.match && (g.coachLevel ?? 'full') === level && g.endedAt >= since && g.userResult === 'win').length;
  return wins >= STEP_DOWN_WINS ? { wins, to: nextLevel(level) } : null;
}
