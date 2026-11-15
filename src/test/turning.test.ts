import { describe, expect, it } from 'vitest';
import { chipForCause, isEligible, promptFor, spotOn, turningPoint, turningStats, waiting, type TurningState } from '../lib/turning';

// A game as plies with evals after each ply (cp, White's view); the user is White.
const ply = (i: number, cp: number) => ({ isUser: i % 2 === 0, color: i % 2 === 0 ? 'w' : 'b', san: 'x', uci: 'e2e4', fenBefore: '', fenAfter: '', evalAfter: { type: 'cp', value: cp } });
const game = (cps: number[], o: Record<string, unknown> = {}) => ({ id: 1, userColor: 'w', userResult: 'loss', endedAt: 100, source: 'chess.com', analyzed: true, plies: cps.map((c, i) => ply(i, c)), ...o }) as never;

describe('where did it turn?', () => {
  it('finds the biggest drop of 2+ pawns from roughly even or better, on your own move', () => {
    //            0    1    2     3     4      5      6
    const g = game([30, 20, 40, -30, -400, -380, -900]);
    // ply 4: from -30 to -400 (drop 370, from roughly even). ply 6: from -380 (already lost) — ignored.
    expect(turningPoint(g)).toMatchObject({ ply: 4, drop: 370 });
    expect(turningPoint(game([20, 10, 0, 0, -150, -100]))).toBeNull();
  });

  it('only lost imports, Match-conditions games and cup knockouts with a turning point qualify', () => {
    const cps = [30, 20, 40, -30, -400, -380];
    expect(isEligible(game(cps))).toBe(true);
    expect(isEligible(game(cps, { userResult: 'win' }))).toBe(false);
    expect(isEligible(game(cps, { analyzed: false }))).toBe(false);
    expect(isEligible(game(cps, { source: undefined }))).toBe(false);
    expect(isEligible(game(cps, { source: undefined, match: true }))).toBe(true);
    expect(isEligible(game(cps, { source: undefined, cup: { id: 'c', tier: 'gold', round: 1 } }))).toBe(true);
  });

  it('"spot on" within one of your own moves', () => {
    const g = game([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(spotOn(g, 4, 4)).toBe(true);
    expect(spotOn(g, 2, 4)).toBe(true);
    expect(spotOn(g, 6, 4)).toBe(true);
    expect(spotOn(g, 8, 4)).toBe(false);
    expect(spotOn(g, 5, 4)).toBe(false);
  });

  it('prompts at most once a day; the rest wait in a list; done and skipped games leave it', () => {
    const cps = [30, 20, 40, -30, -400, -380];
    const gs = [game(cps, { id: 'a', endedAt: 1 }), game(cps, { id: 'b', endedAt: 2 }), game(cps, { id: 'c', endedAt: 3, userResult: 'win' })];
    const s: TurningState = { results: [], skipped: [] };
    expect(waiting(gs, s).map((g) => g.id)).toEqual(['b', 'a']);
    expect(promptFor(gs, s, '2026-11-15')!.id).toBe('b');
    expect(promptFor(gs, { ...s, promptDay: '2026-11-15' }, '2026-11-15')).toBeNull();
    expect(waiting(gs, { results: [{ gameId: 'b', at: 1, found: true }], skipped: ['a'] })).toEqual([]);
  });

  it('stat: found X of the last 10, and how often the reason matched', () => {
    const results = Array.from({ length: 12 }, (_, i) => ({ gameId: i, at: i, found: i % 3 === 0, chipMatched: i < 4 ? undefined : i % 2 === 0 }));
    expect(turningStats({ results, skipped: [] })).toEqual({ found: 3, of: 10, chipMatched: 4, chipOf: 8 });
    expect(chipForCause('hungPiece')).toBe('hung');
    expect(chipForCause('missedThreat')).toBe('threat');
    expect(chipForCause('timeTrouble')).toBe('time');
    expect(chipForCause('calculation')).toBe('plan');
  });
});
