// "Where did it turn?" — a quick self-review of lost games (pure parts and storage).
// A lost game qualifies when one of your moves dropped the evaluation by at least two pawns from
// a position that was roughly even or better: that move is the turning point. You scrub the game
// without evals, tap the move you think lost it, optionally say why, then see the answer.
import type { AnyGame, ImportedGame } from './store/types';
import type { Cause } from './games/causes';
import { povScore, scoreToCp } from './chess/evaluation';
import { kvGet, kvSet, today } from './db';

export const TURNING = {
  /** The drop that makes a turning point (cp), from at least this evaluation (cp, your side). */
  minDropCp: 200,
  fromCp: -50,
  /** "Spot on" when your pick is within this many of your own moves of the real one. */
  slack: 1,
  /** Results kept for the stat. */
  keep: 50,
};

export type ReasonChip = 'hung' | 'threat' | 'time' | 'plan';
export const REASON_CHIPS: { id: ReasonChip; label: string }[] = [
  { id: 'hung', label: 'Hung a piece' },
  { id: 'threat', label: 'Missed their threat' },
  { id: 'time', label: 'Low on time' },
  { id: 'plan', label: 'Plan went wrong' },
];

/** Which chip the engine's cause of the mistake corresponds to. */
export function chipForCause(cause: Cause | 'fast' | 'timeTrouble' | undefined): ReasonChip | null {
  if (!cause) return null;
  if (cause === 'hungPiece') return 'hung';
  if (cause === 'missedThreat') return 'threat';
  if (cause === 'timeTrouble' || cause === 'fast') return 'time';
  return 'plan';
}

export interface TurningPoint {
  /** Index of the ply (your move). */
  ply: number;
  /** Your evaluation before and after it (cp). */
  before: number;
  after: number;
  drop: number;
}

const clampCp = (x: number) => Math.max(-1500, Math.min(1500, x));

/** The biggest drop of at least two pawns from roughly even or better, on one of your moves. */
export function turningPoint(g: Pick<AnyGame, 'plies' | 'userColor'>): TurningPoint | null {
  let prev = 0;
  let best: TurningPoint | null = null;
  g.plies.forEach((p, i) => {
    const after = p.evalAfter ? clampCp(scoreToCp(povScore(p.evalAfter, g.userColor))) : prev;
    if (p.isUser && p.evalAfter) {
      const drop = prev - after;
      if (prev >= TURNING.fromCp && drop >= TURNING.minDropCp && (!best || drop > best.drop)) best = { ply: i, before: prev, after, drop };
    }
    prev = after;
  });
  return best;
}

/** Lost chess.com imports (analysed), Match-conditions games and cup knockouts with a turning point. */
export function isEligible(g: AnyGame): boolean {
  if (g.userResult !== 'loss') return false;
  const kind = g.source === 'chess.com' ? (g as ImportedGame).analyzed : g.match || !!g.cup;
  return !!kind && !!turningPoint(g);
}

/** Your own moves (ply indices) in order. */
export const myPlies = (g: Pick<AnyGame, 'plies'>) => g.plies.map((p, i) => (p.isUser ? i : -1)).filter((i) => i >= 0);

/** Was the pick within `slack` of your moves from the turning point? */
export function spotOn(g: Pick<AnyGame, 'plies'>, pick: number, tp: number): boolean {
  const mine = myPlies(g);
  const a = mine.indexOf(pick);
  const b = mine.indexOf(tp);
  return a >= 0 && b >= 0 && Math.abs(a - b) <= TURNING.slack;
}

// ---- Storage --------------------------------------------------------------------------------

export interface TurningResult {
  gameId: string | number;
  at: number;
  found: boolean;
  chip?: ReasonChip;
  /** Your chip matched the engine's reason (when both are known). */
  chipMatched?: boolean;
}
export interface TurningState {
  results: TurningResult[];
  /** Games you skipped (they leave the list). */
  skipped: (string | number)[];
  /** The day the prompt last showed. */
  promptDay?: string;
}

const KEY = 'turningPoints';
export const getTurning = () => kvGet<TurningState>(KEY, { results: [], skipped: [] });

export async function saveResult(r: TurningResult): Promise<void> {
  const s = await getTurning();
  await kvSet(KEY, { ...s, results: [...s.results.filter((x) => x.gameId !== r.gameId), r].slice(-TURNING.keep) });
}
export async function skipGame(id: string | number): Promise<void> {
  const s = await getTurning();
  await kvSet(KEY, { ...s, skipped: [...new Set([...s.skipped, id])].slice(-200) });
}
export async function markPrompted(day = today()): Promise<void> {
  const s = await getTurning();
  await kvSet(KEY, { ...s, promptDay: day });
}

/** Eligible games not yet done or skipped, newest first. */
export function waiting(games: AnyGame[], s: TurningState): AnyGame[] {
  const done = new Set<string | number>([...s.results.map((r) => r.gameId), ...s.skipped]);
  return games.filter((g) => g.id !== undefined && !done.has(g.id) && isEligible(g)).sort((a, b) => b.endedAt - a.endedAt);
}

/** The game to prompt for today (at most one prompt a day), or null. */
export function promptFor(games: AnyGame[], s: TurningState, day = today()): AnyGame | null {
  if (s.promptDay === day) return null;
  return waiting(games, s)[0] ?? null;
}

/** "Found the turning point in X of your last 10" and how often the chip matched. */
export function turningStats(s: TurningState, last = 10): { found: number; of: number; chipMatched: number; chipOf: number } {
  const r = s.results.slice(-last);
  const chips = r.filter((x) => x.chipMatched !== undefined);
  return { found: r.filter((x) => x.found).length, of: r.length, chipMatched: chips.filter((x) => x.chipMatched).length, chipOf: chips.length };
}
