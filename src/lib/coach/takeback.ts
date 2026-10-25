import { t } from './templates';
import type { CoachComment } from './types';

/** A short note on why taking back a move was a good idea (or that it was fine). */
export function explainTakeback(comment: CoachComment | undefined, seed: string): string {
  const cls = comment?.classification;
  if (cls === 'mistake' || cls === 'blunder' || cls === 'inaccuracy') {
    const reason = comment?.text[0] ?? 'That move had a problem.';
    return t('takebackGood', { reason }, seed);
  }
  return t('takebackFine', {}, seed);
}
