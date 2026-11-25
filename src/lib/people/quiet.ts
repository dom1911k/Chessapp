// With a clock the opponent stays quiet, like a real game (round 7): a greeting, and a line when
// the game ends. No reactions during play, no summary line. Play Coach still talks.
import type { ChatEvent } from './index';

export const TIMED_LINES = new Set<ChatEvent>(['greet', 'greetRevenge', 'greetRematch', 'botWins', 'botLoses', 'draw', 'userResigned']);

/** A clocked real game (not Play Coach). */
export const timedQuiet = (g: { timeControl?: string; coach?: unknown }) => !!g.timeControl && !g.coach;

/** Does the opponent keep this line to itself? */
export const keepsQuiet = (g: { timeControl?: string; coach?: unknown }, event: ChatEvent) => timedQuiet(g) && !TIMED_LINES.has(event);
