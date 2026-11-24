// Coach Sam's one message at the end of a game: the result, with his verdict on your game-ending
// move folded in ("Ra8# — back-rank mate. You won by checkmate!").
import type { Classification } from '../chess/evaluation';
import { TACTIC_LABEL, type Special, type TacticKey } from '../rewards/career';

/** What the coach knows when the game ends. `verdict`: his take on your game-ending move;
 *  `toFix`: the key moments of yours the review can fix (the summary's "Fix 2 moments"). */
export interface EndInfo {
  opponent?: string;
  verdict?: string;
  toFix?: number;
}

const momentsLine = (n: number) => `${n} moment${n === 1 ? '' : 's'} to fix in the review.`;

/**
 * Coach Sam's one short line at the end of a game, about the game only (the results sheet shows the
 * badges and the challenge a second later, and the review has the moments to fix).
 */
export function resultLine(userResult: 'win' | 'loss' | 'draw', reason: string, e: EndInfo = {}): string {
  const who = e.opponent ?? 'the bot';
  if (userResult === 'win') {
    if (e.verdict) return `${e.verdict} Well played.`;
    return `You beat ${who}${reason === 'checkmate' ? ' by checkmate' : reason === 'time' ? ' on time' : ''}.`;
  }
  if (userResult === 'draw') return `${e.verdict ? `${e.verdict} ` : ''}A draw (${reason}). Solid.`;
  const then = e.toFix ? momentsLine(e.toFix) : 'The review shows where it turned.';
  if (reason === 'resignation') return `Game over. ${then}`;
  return `${who[0].toUpperCase()}${who.slice(1)} got you this time. ${then}`;
}

/** The end message as the feed posts it (one line). */
export const resultLines = (userResult: 'win' | 'loss' | 'draw', reason: string, e: EndInfo = {}): string[] => [resultLine(userResult, reason, e)];

/** The short verdict on a game-ending move: "Ra8# — back-rank mate.", "Qh7# is best.", "Kf3 — a mistake." */
export function endVerdict(san: string, cls: Classification, special?: Special, tactic?: TacticKey): string {
  if (tactic) return `${san} — ${TACTIC_LABEL[tactic].one.toLowerCase()}.`;
  if (special) return `${san} — ${special === 'brilliant' ? 'brilliant' : 'a great move'}!`;
  if (cls === 'best') return `${san} is best.`;
  if (cls === 'good') return `${san} — a good move.`;
  return `${san} — ${cls === 'inaccuracy' ? 'an inaccuracy' : `a ${cls}`}.`;
}

