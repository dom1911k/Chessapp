import type { Color } from './pos';

/** Engine score, always from White's point of view. */
export type Score = { type: 'cp'; value: number } | { type: 'mate'; value: number };

export type Classification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const CLASS_LABEL: Record<Classification, string> = {
  best: 'Best',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export const CLASS_SYMBOL: Record<Classification, string> = {
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

/** Score from `color`'s point of view. */
export function povScore(s: Score, color: Color): Score {
  return color === 'w' ? s : { type: s.type, value: -s.value } as Score;
}

/** Centipawns, mapping mates to large values (useful for charts and sorting). */
export function scoreToCp(s: Score): number {
  if (s.type === 'cp') return s.value;
  if (s.value === 0) return 0;
  return Math.sign(s.value) * (10000 - Math.abs(s.value) * 10);
}

/** Lichess win-probability model, 0..100 for the side whose POV `s` is in. */
export function winPct(s: Score): number {
  if (s.type === 'mate') return s.value > 0 ? 100 : s.value < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, s.value));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Classify a move from the mover's win% before and after the move. */
export function classify(wpBefore: number, wpAfter: number, isBestMove: boolean): Classification {
  const loss = wpBefore - wpAfter;
  if (isBestMove || loss <= 1) return 'best';
  if (loss < 5) return 'good';
  if (loss < 10) return 'inaccuracy';
  if (loss < 20) return 'mistake';
  return 'blunder';
}

/**
 * Win% saturates once a side is lost or winning (it clamps at ±1000 cp, and a mate is 0 or 100),
 * so throwing away a queen in a lost position, or walking into mate, barely moves it. This floor
 * looks at the unclamped evaluation instead (both scores from the mover's point of view):
 * - a move that lets the opponent force mate when they couldn't before is a blunder (getting
 *   mated sooner when mate was already forced is not);
 * - losing 300+ cp is at least a mistake, 500+ a blunder — unless the mover is still clearly
 *   winning afterwards (+10 or more), e.g. trading down into an easily won position.
 */
export const FLOOR = { mistakeCp: 300, blunderCp: 500, stillWinningCp: 1000 };
const MATE_CP = 10000;
/** Unclamped centipawns for comparing evaluations (mates far beyond any material score). */
const rawCp = (s: Score) => (s.type === 'cp' ? s.value : s.value === 0 ? 0 : Math.sign(s.value) * (MATE_CP - Math.abs(s.value)));
export function floorClass(before: Score | undefined, after: Score | undefined): 'mistake' | 'blunder' | null {
  if (!before || !after) return null;
  const matedBefore = before.type === 'mate' && before.value < 0;
  const matedAfter = after.type === 'mate' && after.value < 0;
  if (matedBefore) return null;
  if (matedAfter) return 'blunder';
  const cpAfter = rawCp(after);
  if (cpAfter >= FLOOR.stillWinningCp) return null;
  const loss = rawCp(before) - cpAfter;
  // In a position that is already decided, engine numbers swing by hundreds between equally
  // hopeless moves; the bar rises with how lopsided it already was.
  const lopsided = Math.min(2500, Math.abs(rawCp(before)));
  if (loss >= Math.max(FLOOR.blunderCp, 0.65 * lopsided)) return 'blunder';
  if (loss >= Math.max(FLOOR.mistakeCp, 0.4 * lopsided)) return 'mistake';
  return null;
}

/** The win% loss a floored move counts as (for accuracy): a mistake 10, a blunder 20. */
export const floorLoss = (f: 'mistake' | 'blunder' | null) => (f === 'blunder' ? 20 : f === 'mistake' ? 10 : 0);

/** Per-move accuracy from the mover's scores before and after, with the floor applied. */
export function accuracyOf(before: Score | undefined, after: Score | undefined): number {
  const wpB = before ? winPct(before) : 50;
  const wpA = after ? winPct(after) : wpB;
  return moveAccuracy(wpB, wpB - Math.max(wpB - wpA, floorLoss(floorClass(before, after))));
}

/** Lichess-style per-move accuracy (0..100) from the win% drop. */
export function moveAccuracy(wpBefore: number, wpAfter: number): number {
  const loss = Math.max(0, wpBefore - wpAfter);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
}

export function formatScore(s: Score): string {
  if (s.type === 'mate') return s.value === 0 ? '#' : `${s.value > 0 ? '' : '-'}M${Math.abs(s.value)}`;
  const v = s.value / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}
