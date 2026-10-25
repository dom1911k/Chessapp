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
