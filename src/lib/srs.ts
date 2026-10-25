// Spaced repetition: a fixed interval ladder (1 → 3 → 7 → 14 → 30 → 60 days),
// reset to the first step on failure.
export const INTERVALS = [1, 3, 7, 14, 30, 60];
const DAY = 24 * 60 * 60 * 1000;

export interface Card {
  id: string; // 'p:<puzzleId>' or 'm:<gameId>:<ply>'
  kind: 'puzzle' | 'mistake';
  puzzleId?: string;
  /** Starting position (for Lichess puzzles: before the opponent's setup move). */
  fen: string;
  setup?: string;
  rating?: number;
  /** Solution line in UCI, starting with the user's move. Mistake cards have one move. */
  solution: string[];
  /** For mistake cards: what was played in the game. */
  playedUci?: string;
  playedSan?: string;
  themes: string[];
  label: string;
  explanation?: string[];
  gameId?: number;
  createdAt: number;
  due: number;
  step: number;
  reps: number;
  lapses: number;
  lastReviewed?: number;
  lastResult?: 'pass' | 'fail';
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** First review is due tomorrow. */
export function newCardDue(now = Date.now()): number {
  return startOfDay(now) + DAY;
}

export function reviewCard(card: Card, success: boolean, now = Date.now()): Card {
  const step = success ? Math.min(card.step + 1, INTERVALS.length - 1) : 0;
  return {
    ...card,
    step,
    reps: card.reps + 1,
    lapses: card.lapses + (success ? 0 : 1),
    due: startOfDay(now) + INTERVALS[step] * DAY,
    lastReviewed: now,
    lastResult: success ? 'pass' : 'fail',
  };
}

export function isDue(card: Card, now = Date.now()): boolean {
  return card.due <= now;
}

export function formatDue(card: Card, now = Date.now()): string {
  const days = Math.round((startOfDay(card.due) - startOfDay(now)) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
