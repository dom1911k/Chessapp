// Which kinds of help are on in a game: none in a real game; in a Play Coach game, what Sam talks
// allows (full / warnings). Pure, so the screen and the store agree.
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

export const NO_AIDS: Aids = { comments: false, precheck: false, botNotes: false, safetyOverlay: false, evalBar: false, openings: false, requests: false, reveals: false };

/**
 * Real games (characters, Quick match, chess.com stand-ins) have no help at all, clock or not.
 * Only a Play Coach game has it, following Sam talks: All (full) or Only when it matters (warnings).
 */
export function aidsFor(s: AidSettings, game?: { coach?: string; coachLevel?: CoachLevel }): Aids {
  if (!game?.coach) return NO_AIDS;
  const level = game.coachLevel ?? s.coachLevel ?? 'full';
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

/** Play Coach: Sam's strength for a level (Easier 150 below your rating, Harder 150 above). */
export const coachElo = (rating: number, level: 'easier' | 'your' | 'harder') => Math.max(100, Math.round(rating + (level === 'easier' ? -150 : level === 'harder' ? 150 : 0)));

/** "Your level · practice" under Play Coach's title. */
export const coachLevelLabel = (level: 'easier' | 'your' | 'harder' | undefined) => (level === 'easier' ? 'Easier' : level === 'harder' ? 'Harder' : 'Your level');
