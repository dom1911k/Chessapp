// Coach Sam's one message at the end of a game: the result, with his verdict on your game-ending
// move folded in ("Ra8# — back-rank mate. You won by checkmate!").
import type { Classification } from '../chess/evaluation';
import { TACTIC_LABEL, type Special, type TacticKey } from '../rewards/career';

/** Badges from the game: how many are new, how many you now hold, and whether the fifth opened the challenge. */
export interface BadgeNews {
  fresh: number;
  held: number;
  opened?: boolean;
}

/** Coach Sam's words at the end of a game. `verdict`: what he thinks of your game-ending move, said first. */
export function resultLines(userResult: 'win' | 'loss' | 'draw', reason: string, badges?: BadgeNews, opponent?: string, verdict?: string): string[] {
  const who = opponent ?? 'the bot';
  const starLine = opponent && badges?.fresh
    ? [`${badges.fresh === 1 ? 'A new badge' : `${badges.fresh} new badges`} with ${who}: ${badges.held}/8.${badges.opened ? ` That opens ${who}'s special challenge!` : ''}`]
    : [];
  if (verdict && userResult === 'win') return [`${verdict} You won${reason === 'checkmate' ? ' by checkmate' : ''}!`, ...starLine];
  if (verdict && userResult === 'draw') return [`${verdict} It's a draw (${reason}).`];
  if (userResult === 'win')
    return [
      `You won against ${who}${reason === 'checkmate' ? ' by checkmate' : reason === 'resignation' ? ` — ${opponent ?? 'the bot'} resigned` : ''}!`,
      ...starLine,
    ];
  if (userResult === 'draw') return [`A draw (${reason}). That's a solid result!`];
  if (reason === 'resignation') return ['Game over. Every game teaches us something — let\'s look at the report together.'];
  return [`${who} got you this time. Let's learn from it — the report shows the turning point.`];
}

/** The short verdict on a game-ending move: "Ra8# — back-rank mate.", "Qh7# is best.", "Kf3 — a mistake." */
export function endVerdict(san: string, cls: Classification, special?: Special, tactic?: TacticKey): string {
  if (tactic) return `${san} — ${TACTIC_LABEL[tactic].one.toLowerCase()}.`;
  if (special) return `${san} — ${special === 'brilliant' ? 'brilliant' : 'a great move'}!`;
  if (cls === 'best') return `${san} is best.`;
  if (cls === 'good') return `${san} — a good move.`;
  return `${san} — ${cls === 'inaccuracy' ? 'an inaccuracy' : `a ${cls}`}.`;
}

