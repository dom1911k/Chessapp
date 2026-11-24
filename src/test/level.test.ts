import { describe, expect, it } from 'vitest';
import { difficultyFor, solvePrompt, solvedPrompt } from '../lib/puzzles/level';

describe('puzzle helpers', () => {
  it('rates difficulty against your rating', () => {
    expect(difficultyFor(600, 880)).toBe('easy');
    expect(difficultyFor(900, 880)).toBe('medium');
    expect(difficultyFor(1100, 880)).toBe('hard');
    expect(difficultyFor(1300, 880)).toBe('expert');
  });
  it('talks about mate when the puzzle is a mate, and is stable per puzzle', () => {
    expect(solvePrompt(['mateIn2'], 'White', 'abc')).toMatch(/king|checkmate|finish/i);
    expect(solvePrompt(['fork'], 'White', 'abc')).toBe(solvePrompt(['fork'], 'White', 'abc'));
    expect(solvedPrompt({ clean: false, lightning: false, streak: 0, seed: 'x' })).toMatch(/hint|pattern/i);
    expect(solvedPrompt({ clean: true, lightning: true, streak: 0, seed: 'x' })).toMatch(/fast|instantly|quick/i);
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

import { moveHaptic } from '../lib/chess/boardfeel';
describe('haptics', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  it('stays quiet for quiet moves and ticks for captures', () => {
    expect(moveHaptic(START, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { from: 'e2', to: 'e4' })).toBe('none');
    expect(moveHaptic('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', '4k3/8/8/3P4/8/8/8/4K3 b - - 0 1', { from: 'e4', to: 'd5' })).toBe('capture');
  });
  it('buzzes firmly for checks, forks and mate', () => {
    expect(moveHaptic('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'R3k3/8/8/8/8/8/8/4K3 b - - 1 1', { from: 'a1', to: 'a8' })).toBe('key');
    // Knight to c7 forks king and rook (with check).
    expect(moveHaptic('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'r3k3/2N5/8/8/8/8/8/4K3 b - - 1 1', { from: 'b5', to: 'c7' })).toBe('key');
    expect(moveHaptic('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'R5k1/5ppp/8/8/8/8/8/4K3 b - - 1 1', { from: 'a1', to: 'a8' })).toBe('mate');
  });
});

import { FRAMES, TITLES, shownFrame, shownTitle } from '../lib/avatars';
describe('avatar frames and titles', () => {
  const ctx = { level: 3, peak: 900, achievements: {}, challenges: new Set<string>(), gold: 0 };
  it('falls back when the chosen frame or title is not unlocked', () => {
    expect(shownFrame('bronze', ctx).id).toBe('bronze');
    expect(shownFrame('gold', ctx).id).toBe('none');
    expect(shownFrame('emerald', { ...ctx, peak: 1000 }).id).toBe('emerald');
    // Someone who reached level 3 keeps that title; the fallback is your Journey title.
    expect(shownTitle('lvl3', 'Café Shark', ctx)).toBe('Curious Knight');
    expect(shownTitle('contender', 'Café Shark', ctx)).toBe('Café Shark');
    expect(shownTitle('', 'Café Shark', ctx)).toBe('Café Shark');
    expect(TITLES.find((t) => t.id === 'lvl3')?.legacy).toBe(true);
    expect(FRAMES[0].unlock.kind).toBe('free');
  });
});
