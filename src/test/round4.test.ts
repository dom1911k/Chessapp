import { describe, expect, it } from 'vitest';
import { endVerdict, resultLines } from '../lib/coach/endLine';
import { accuracyText, hasAccuracy, summarize } from '../lib/report';
import { emptyCounts } from '../lib/report';

describe('one message at the end of a game', () => {
  it('folds the last move’s verdict into the result', () => {
    const v = endVerdict('Ra8#', 'best', undefined, 'backRankMates');
    expect(v).toBe('Ra8# — back-rank mate.');
    expect(resultLines('win', 'checkmate', 1, undefined, v)[0]).toBe('Ra8# — back-rank mate. You won by checkmate!');
  });
  it('reads naturally without a tactic, and for a draw', () => {
    expect(endVerdict('Qh7#', 'best')).toBe('Qh7# is best.');
    expect(endVerdict('Qxe5', 'good', 'brilliant')).toBe('Qxe5 — brilliant!');
    expect(endVerdict('Kf3', 'mistake')).toBe('Kf3 — a mistake.');
    expect(endVerdict('Kf3', 'inaccuracy')).toBe('Kf3 — an inaccuracy.');
    expect(resultLines('draw', 'stalemate', 0, 'Tom', 'Kf3 — a mistake.')).toEqual(["Kf3 — a mistake. It's a draw (stalemate)."]);
  });
  it('keeps the usual words when the game ended some other way', () => {
    expect(resultLines('win', 'resignation', 1, 'Tom')[0]).toBe('You won against Tom — Tom resigned! 🎉');
  });
});

describe('accuracy with no moves', () => {
  it('is "—", not 0%, when none of your moves were analysed', () => {
    const s = summarize([]);
    expect(hasAccuracy(s)).toBe(false);
    expect(accuracyText(s.accuracy, hasAccuracy(s), 1)).toBe('—');
  });
  it('shows the number once a move of yours counts', () => {
    const counts = { ...emptyCounts(), best: 1 };
    expect(hasAccuracy({ counts })).toBe(true);
    expect(accuracyText(84, true)).toBe('84%');
    expect(accuracyText(84, true, 1)).toBe('84.0%');
  });
});

