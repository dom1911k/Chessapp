import { describe, expect, it } from 'vitest';
import { flameKey, jigPath, momentSplit } from '../lib/puzzles/moments';
import { newPathState, scorePuzzle, type SolveInput } from '../lib/puzzles/path';

const solve = (over: Partial<SolveInput> = {}): SolveInput => ({ source: 'full', success: true, hintsUsed: 0, seconds: 20, correctMoves: 1, userMoves: 1, promptLevel: 3, puzzleRating: 650, ratingBefore: 650, ratingAfter: 660, setting: 'standard', today: '2026-11-23', ...over });

describe('moments', () => {
  it('the tally stops at before + chips; the moments fill the rest', () => {
    const prev = { ...newPathState(null), points: 300, dailyDay: '2026-11-23', dailyCount: 2 };
    const { award } = scorePuzzle(prev, solve());
    expect(award.moments.map((m) => m.kind)).toEqual(['daily3']);
    const { msum, base, gain } = momentSplit(award);
    expect(msum).toBe(60);
    const chips = award.parts.reduce((x, p) => x + p.points, 0);
    expect(base).toBe(award.before + chips);
    expect(gain).toBe(chips);
    expect(base + msum).toBe(award.after);
  });

  it('no moments: nothing held back', () => {
    const { award } = scorePuzzle(newPathState(null), solve());
    expect(momentSplit(award)).toEqual({ msum: 0, base: award.after, gain: award.total });
  });

  it('streak flame colours climb with the milestone: 15 pink, 30 violet, 50 blue, 100+ gold', () => {
    expect([15, 30, 50, 100, 150].map(flameKey)).toEqual([10, 25, 50, 100, 100]);
  });

  it('jigsaw pieces: a closed path, with a knob and a socket adding curves', () => {
    const plain = jigPath(70, 60, false, false);
    const both = jigPath(70, 60, true, true);
    expect(plain.startsWith('M') && plain.endsWith('Z')).toBe(true);
    expect((plain.match(/C/g) ?? []).length).toBe(0);
    expect((both.match(/C/g) ?? []).length).toBe(4);
    expect(both).not.toContain('NaN');
  });
});
