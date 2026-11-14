import { describe, expect, it } from 'vitest';
import { CCMAP, ccMap, ccMapLine, performance, toChessCom } from '../lib/games/ccmap';

const now = Date.UTC(2026, 10, 1);
const app = (elo: number, userResult: 'win' | 'loss' | 'draw', match = true) => ({ elo, userResult, match, endedAt: now - 864e5, plies: [], source: undefined }) as never;
const cc = (myRating: number, userResult: 'win' | 'loss' | 'draw' = 'win') => ({ elo: myRating, myRating, userResult, endedAt: now - 864e5, source: 'chess.com', timeControl: '600+0', plies: [] }) as never;

describe('app rating → chess.com', () => {
  it('uses a typical gap until there are enough games', () => {
    const m = ccMap([], now);
    expect(m.offset).toBe(CCMAP.priorOffset);
    expect(toChessCom(900, m)).toBe(600);
    expect(ccMapLine(m)).toMatch(/usually run about 300 lower/);
  });
  it('measures your own gap from chess.com games and unaided app games', () => {
    // 50% against 1000-rated bots → performs like 1000; chess.com 800 → gap −200.
    const games = [...Array.from({ length: 20 }, (_, i) => app(1000, i % 2 ? 'win' : 'loss')), ...Array.from({ length: 20 }, () => cc(800))];
    const m = ccMap(games, now);
    expect(m.measured).toBeCloseTo(-200, 0);
    expect(m.appPerformance).toBe(1000);
    expect(m.offset).toBeGreaterThan(-300);
    expect(m.offset).toBeLessThan(-200);
    expect(ccMapLine(m)).toMatch(/800 on chess.com and perform like 1000/);
  });
  it('ignores old games and daily games', () => {
    const old = { ...(cc(500) as object), endedAt: now - 400 * 864e5 } as never;
    const daily = { ...(cc(500) as object), timeControl: 'daily' } as never;
    expect(ccMap([...Array.from({ length: 10 }, () => old), ...Array.from({ length: 10 }, () => daily)], now).ccGames).toBe(0);
  });
  it('performance rating is the average opponent shifted by the score', () => {
    expect(performance([app(1000, 'win'), app(1000, 'loss')])).toBeCloseTo(1000);
    expect(performance([app(1000, 'win'), app(1000, 'win'), app(1000, 'win'), app(1000, 'loss')])).toBeGreaterThan(1150);
  });
});
