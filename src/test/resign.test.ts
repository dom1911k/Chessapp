import { describe, expect, it } from 'vitest';
import { evalHistory, RESIGN, shouldResign } from '../lib/resign';

const always = () => 0;
const rate = (o: Parameters<typeof shouldResign>[0], n = 2000) => {
  let k = 0;
  for (let i = 0; i < n; i++) if (shouldResign(o, () => (i + 0.5) / n)) k++;
  return k / n;
};
const lost = (n: number, cp = -900) => Array.from({ length: n }, () => cp);

describe('human-like resigning (round 7: fitted to how people\'s games end)', () => {
  it('once clearly lost for three moves, a small chance on each move; stronger players a little more', () => {
    expect(rate({ elo: 1000, moveNo: 30, evals: lost(3) })).toBeGreaterThanOrEqual(0.05);
    expect(rate({ elo: 1000, moveNo: 30, evals: lost(3) })).toBeLessThan(0.08);
    expect(rate({ elo: 200, moveNo: 30, evals: lost(3) })).toBeLessThan(rate({ elo: 700, moveNo: 30, evals: lost(3) }));
    expect(shouldResign({ elo: 1400, moveNo: 30, evals: lost(2) }, always)).toBe(false);
    expect(shouldResign({ elo: 1400, moveNo: 30, evals: [...lost(3), -300] }, always)).toBe(false);
    expect(shouldResign({ elo: 1400, moveNo: 30, evals: lost(3, -300) }, always)).toBe(false);
    // Stronger players count a game as lost sooner (−4 at 1400, −5 below 1000).
    expect(shouldResign({ elo: 800, moveNo: 30, evals: lost(3, -450) }, always)).toBe(false);
    expect(shouldResign({ elo: 1400, moveNo: 30, evals: lost(3, -450) }, always)).toBe(true);
  });

  it('over a lost stretch most players give up in the end; beginners often play on', () => {
    const giveUp = (elo: number, moves: number) => 1 - (1 - rate({ elo, moveNo: 30, evals: lost(3) })) ** moves;
    expect(giveUp(1000, 20)).toBeGreaterThan(0.65);
    expect(giveUp(200, 20)).toBeLessThan(0.5);
    expect(giveUp(200, 20)).toBeGreaterThan(0.25);
  });

  it('facing a forced mate counts as lost at once from 1200 (now and then)', () => {
    const mateIn3Against = -(10000 - 30);
    expect(rate({ elo: 1600, moveNo: 30, evals: [100, mateIn3Against] })).toBeGreaterThan(0.2);
    expect(rate({ elo: 1600, moveNo: 30, evals: [100, mateIn3Against] })).toBeLessThan(0.3);
    expect(rate({ elo: 800, moveNo: 30, evals: [100, mateIn3Against] })).toBe(0);
    // Being the one who mates is no reason to resign.
    expect(shouldResign({ elo: 1600, moveNo: 30, evals: [10000 - 30] }, always)).toBe(false);
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

describe('resign temperament (Cups player types)', () => {
  it('stubborn never resigns; proud resigns early once clearly lost, at any rating', () => {
    expect(shouldResign({ elo: 2000, moveNo: 40, evals: lost(10, -3000), temperament: 'stubborn' }, always)).toBe(false);
    expect(shouldResign({ elo: 400, moveNo: 20, evals: [-800, -800, -800], temperament: 'proud' }, always)).toBe(true);
    expect(shouldResign({ elo: 400, moveNo: 20, evals: [-300, -800, -800], temperament: 'proud' }, always)).toBe(false);
    expect(shouldResign({ elo: 400, moveNo: 19, evals: [-900, -900], temperament: 'proud', cupFinal: true }, always)).toBe(false);
  });
});
