import { describe, expect, it } from 'vitest';
import { DAILY_SOLVER_GOAL, difficultyFor, puzzleLevel, solvePrompt, solveTags, solvedPrompt } from '../lib/puzzles/level';

describe('puzzle levels', () => {
  it('cuts levels from the rating in 100-point bands', () => {
    expect(puzzleLevel(880)).toEqual({ level: 8, into: 80, span: 100, next: 900, pct: 0.8 });
    expect(puzzleLevel(900).level).toBe(9);
    expect(puzzleLevel(899).level).toBe(8);
    expect(puzzleLevel(40).level).toBe(1);
  });
  it('rates difficulty against your rating', () => {
    expect(difficultyFor(600, 880)).toBe('easy');
    expect(difficultyFor(900, 880)).toBe('medium');
    expect(difficultyFor(1100, 880)).toBe('hard');
    expect(difficultyFor(1300, 880)).toBe('expert');
  });
  it('builds the tags shown on the solved square, in order', () => {
    expect(solveTags({ ratingDelta: 8, puzzleRating: 1100, yourRating: 880, speedXp: 3, streak: 4, streakXp: 4 })).toEqual([
      { label: 'Hard', value: '+8', tone: 'gold' },
      { label: 'Speed', value: '+3', tone: 'sky' },
      { label: 'Streak ×4', value: '+4', tone: 'orange' },
    ]);
    expect(solveTags({ ratingDelta: null, speedXp: 0, streak: 1, streakXp: 0 })).toEqual([]);
    expect(solveTags({ ratingDelta: -7, puzzleRating: 700, yourRating: 900, speedXp: 0, streak: 0, streakXp: 0 })[0].value).toBe('-7');
  });
  it('talks about mate when the puzzle is a mate, and is stable per puzzle', () => {
    expect(solvePrompt(['mateIn2'], 'White', 'abc')).toMatch(/king|checkmate|finish/i);
    expect(solvePrompt(['fork'], 'White', 'abc')).toBe(solvePrompt(['fork'], 'White', 'abc'));
    expect(solvedPrompt({ clean: false, lightning: false, streak: 0, seed: 'x' })).toMatch(/hint|pattern/i);
    expect(solvedPrompt({ clean: true, lightning: true, streak: 0, seed: 'x' })).toMatch(/fast|instantly|quick/i);
    expect(DAILY_SOLVER_GOAL).toBe(3);
  });
});

import { winStreak } from '../lib/stats';
describe('win streak', () => {
  it('counts wins from the newest game until the first loss or draw', () => {
    expect(winStreak(['win', 'win', 'loss', 'win'])).toBe(2);
    expect(winStreak(['draw', 'win'])).toBe(0);
    expect(winStreak([])).toBe(0);
  });
});
