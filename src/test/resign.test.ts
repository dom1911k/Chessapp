import { describe, expect, it } from 'vitest';
import { evalHistory, RESIGN, shouldResign } from '../lib/resign';

const always = () => 0;
const rate = (o: Parameters<typeof shouldResign>[0], n = 2000) => {
  let k = 0;
  for (let i = 0; i < n; i++) if (shouldResign(o, () => (i + 0.5) / n)) k++;
  return k / n;
};
const lost = (n: number, cp = -900) => Array.from({ length: n }, () => cp);

describe('human-like resigning', () => {
  it('from about 1400: resigns when clearly lost for four moves', () => {
    expect(rate({ elo: 1400, moveNo: 30, evals: lost(4) })).toBeGreaterThan(0.6);
    expect(shouldResign({ elo: 1400, moveNo: 30, evals: lost(3) }, always)).toBe(false);
    expect(shouldResign({ elo: 1400, moveNo: 30, evals: [...lost(3), -300] }, always)).toBe(false);
    expect(shouldResign({ elo: 1400, moveNo: 30, evals: lost(4, -500) }, always)).toBe(false);
  });

  it('facing a forced mate counts as lost at once', () => {
    const mateIn3Against = -(10000 - 30);
    expect(rate({ elo: 1600, moveNo: 30, evals: [100, mateIn3Against] })).toBeGreaterThan(0.75);
    // Being the one who mates is no reason to resign.
    expect(shouldResign({ elo: 1600, moveNo: 30, evals: [10000 - 30] }, always)).toBe(false);
  });

  it('below 1000: almost never, even when hopelessly lost or about to be mated', () => {
    expect(rate({ elo: 800, moveNo: 40, evals: lost(20, -2000) })).toBeLessThan(0.02);
    expect(rate({ elo: 600, moveNo: 40, evals: [-(10000 - 20)] })).toBeLessThan(0.02);
  });

  it('never in a Cups final before move 20, nor in the first moves of any game', () => {
    expect(shouldResign({ elo: 2000, moveNo: 19, evals: lost(10, -3000), cupFinal: true }, always)).toBe(false);
    expect(shouldResign({ elo: 2000, moveNo: 20, evals: lost(10, -3000), cupFinal: true }, always)).toBe(true);
    expect(shouldResign({ elo: 2000, moveNo: RESIGN.minMove - 1, evals: lost(10, -3000) }, always)).toBe(false);
  });

  it('keeps one evaluation list per game', () => {
    const h = evalHistory();
    h('a', -100);
    expect(h('a', -900)).toEqual([-100, -900]);
    expect(h('b', 50)).toEqual([50]);
    expect(h('b', undefined)).toEqual([50]);
  });
});
