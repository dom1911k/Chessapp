import { describe, expect, it } from 'vitest';
import { endVerdict, resultLine, resultLines } from '../lib/coach/endLine';
import { accuracyText, hasAccuracy, summarize } from '../lib/report';
import { emptyCounts } from '../lib/report';

describe('one short line at the end of a game', () => {
  it('a win keeps the verdict on your last move', () => {
    const v = endVerdict('Ra8#', 'best', undefined, 'backRankMates');
    expect(v).toBe('Ra8# — back-rank mate.');
    expect(resultLines('win', 'checkmate', { opponent: 'Grandpa Tom', verdict: v })).toEqual(['Ra8# — back-rank mate. Well played.']);
  });
  it('reads the last move naturally', () => {
    expect(endVerdict('Qh7#', 'best')).toBe('Qh7# is best.');
    expect(endVerdict('Qxe5', 'good', 'brilliant')).toBe('Qxe5 — brilliant!');
    expect(endVerdict('Kf3', 'mistake')).toBe('Kf3 — a mistake.');
    expect(endVerdict('Kf3', 'inaccuracy')).toBe('Kf3 — an inaccuracy.');
  });
  it('a win without a verdict names how', () => {
    expect(resultLine('win', 'checkmate', { opponent: 'Grandpa Tom' })).toBe('You beat Grandpa Tom by checkmate.');
    expect(resultLine('win', 'time', { opponent: 'Grandpa Tom' })).toBe('You beat Grandpa Tom on time.');
    expect(resultLine('win', 'resignation', { opponent: 'Grandpa Tom' })).toBe('You beat Grandpa Tom.');
  });
  it('a draw keeps the reason', () => {
    expect(resultLine('draw', 'stalemate', { opponent: 'Tom' })).toBe('A draw (stalemate). Solid.');
  });
  it('a loss points at the moments to fix, or at the review', () => {
    expect(resultLine('loss', 'checkmate', { opponent: 'Grandpa Tom', toFix: 2 })).toBe('Grandpa Tom got you this time. 2 moments to fix in the review.');
    expect(resultLine('loss', 'checkmate', { opponent: 'Grandpa Tom', toFix: 1 })).toBe('Grandpa Tom got you this time. 1 moment to fix in the review.');
    expect(resultLine('loss', 'checkmate', { opponent: 'Grandpa Tom' })).toBe('Grandpa Tom got you this time. The review shows where it turned.');
    expect(resultLine('loss', 'resignation', { opponent: 'Grandpa Tom' })).toBe('Game over. The review shows where it turned.');
  });
  it('is one line: no badges, no practice question, no emoji', () => {
    for (const l of [resultLines('win', 'checkmate', { opponent: 'Tom' }), resultLines('loss', 'checkmate', { opponent: 'Tom', toFix: 2 }), resultLines('draw', 'repetition')]) {
      expect(l).toHaveLength(1);
      expect(l[0]).not.toMatch(/badge|practise|challenge|[\u{1F300}-\u{1FAFF}]/u);
    }
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
  it('1 · your last game’s key moments first, until you’ve fixed them', () => {
    const u = chooseUpNext({ ...base, dailyDone: false, last: { gameId: 7, opponent: 'Grandpa Tom', moments: 2, fixed: false } });
    expect(u).toEqual({ kind: 'review', gameId: 7, opponent: 'Grandpa Tom', moments: 2 });
    // Round 5: it names the action it opens.
    expect(upNextText(u)).toEqual({ title: 'Fix 2 moments', detail: 'From your game vs Grandpa Tom' });
    expect(upNextText({ kind: 'review', gameId: 7, opponent: 'Grandpa Tom', moments: 1 }).title).toBe('Fix 1 moment');
    const cc = chooseUpNext({ ...base, last: { gameId: 'cc:1', opponent: 'anna_k', moments: 1, fixed: false, cc: true } });
    expect(upNextText(cc)).toEqual({ title: 'Fix 1 moment', detail: 'From your chess.com game vs anna_k' });
    expect(chooseUpNext({ ...base, dailyDone: false, last: { gameId: 7, opponent: 'Tom', moments: 2, fixed: true } }).kind).toBe('daily');
    expect(chooseUpNext({ ...base, dailyDone: false, last: { gameId: 7, opponent: 'Tom', moments: 0, fixed: false } }).kind).toBe('daily');
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
