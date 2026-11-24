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

describe('Home: Up next', async () => {
  const { chooseUpNext, upNextText } = await import('../lib/upNext');
  const step = { id: 's1', kind: 'lesson' as const, lessonId: 'checkmate', label: 'Check, checkmate & stalemate' };
  const base = { dailyDone: true, due: 0, course: null, points: 0 };
  it('1 · your last game’s key moments first, until you’ve opened its review', () => {
    const u = chooseUpNext({ ...base, dailyDone: false, last: { gameId: 7, opponent: 'Grandpa Tom', moments: 2, seen: false } });
    expect(u).toEqual({ kind: 'review', gameId: 7, opponent: 'Grandpa Tom', moments: 2 });
    expect(upNextText(u)).toEqual({ title: 'Review your game vs Grandpa Tom', detail: '2 key moments' });
    expect(chooseUpNext({ ...base, dailyDone: false, last: { gameId: 7, opponent: 'Tom', moments: 2, seen: true } }).kind).toBe('daily');
    expect(chooseUpNext({ ...base, dailyDone: false, last: { gameId: 7, opponent: 'Tom', moments: 0, seen: false } }).kind).toBe('daily');
  });
  it('2 · Daily training when it isn’t done today', () => {
    expect(upNextText(chooseUpNext({ ...base, dailyDone: false, due: 5 }))).toEqual({ title: 'Daily training', detail: '5 positions from your mistakes' });
  });
  it('3 · the course’s next step', () => {
    const u = chooseUpNext({ ...base, course: { step, level: 2, chapter: 'Checkmate' } });
    expect(upNextText(u).title).toBe('Continue: Check, checkmate & stalemate');
  });
  it('4 · otherwise the Puzzle Path, with the points to the next level', () => {
    const u = chooseUpNext({ ...base, points: 0 });
    expect(u.kind).toBe('puzzles');
    expect(upNextText(u).title).toBe('Solve puzzles');
    expect(upNextText(u).detail).toMatch(/^Wood 1, \d+ points to level 2$/);
  });
});
