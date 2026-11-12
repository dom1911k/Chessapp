import { describe, expect, it } from 'vitest';
import { SYSTEMS, afterRun, lineLevel, linePlies, nextLine, repertoireLines, validLine, yourPlies } from '../lib/repertoire';

describe('repertoire', () => {
  it('every built-in line is legal and has moves for your side', () => {
    const ids = SYSTEMS.flatMap((s) => s.lines.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SYSTEMS)
      for (const l of s.lines) {
        expect(() => linePlies(l.moves), l.id).not.toThrow();
        expect(yourPlies(l).length, l.id).toBeGreaterThanOrEqual(4);
        expect(l.color, l.id).toBe(s.slot === 'white' ? 'w' : 'b');
      }
  });
  it('tracks runs and picks the weakest line next', () => {
    let st = afterRun({}, 'a', true, '2026-01-01');
    expect(lineLevel(st.a)).toBe(2);
    st = afterRun(afterRun(st, 'a', true, '2026-01-02'), 'a', true, '2026-01-03');
    expect(lineLevel(st.a)).toBe(3);
    st = afterRun(st, 'b', false, '2026-01-03');
    expect(lineLevel(st.b)).toBe(1);
    const lines = [{ id: 'a', name: 'A', color: 'w' as const, moves: 'e4 e5 Nf3 Nc6' }, { id: 'b', name: 'B', color: 'w' as const, moves: 'd4 d5 c4 e6' }, { id: 'c', name: 'C', color: 'w' as const, moves: 'c4 e5 Nc3 Nf6' }];
    expect(nextLine(lines, st)!.id).toBe('c');
    expect(nextLine([], st)).toBeNull();
  });
  it('builds the line list from picks and custom lines, and validates recordings', () => {
    const r = { picks: { white: 'london', d4: 'kid' }, custom: [{ id: 'x', name: 'Mine', color: 'b' as const, moves: 'e4 c5 Nf3 d6', custom: true }] };
    const ids = repertoireLines(r).map((l) => l.id);
    expect(ids).toContain('lo-main');
    expect(ids).toContain('kid-main');
    expect(ids).toContain('x');
    expect(ids).not.toContain('it-main');
    expect(validLine('e4 e5 Nf3 Nc6')).toBe(true);
    expect(validLine('e4 e5')).toBe(false);
    expect(validLine('e4 e5 Ke3 Nc6')).toBe(false);
  });
});

import { chooseHumanMove, humanParams, moveProbs } from '../lib/maia';
describe('human-like move choice', () => {
  // Logits for: a main move, a decent second, a howler people do play sometimes, and a stray tail move.
  const logits = new Map([['e2e4', 2.0], ['d2d4', 1.2], ['g1f3', 0.3], ['a2a4', -3.5]]);
  const seq = (n: number) => { let i = 0; return () => ((i++ * 0.6180339887) % 1 + 1 / (2 * n)) % 1; };
  const tally = (cands?: Map<string, number>, elo = 1200) => {
    const r = seq(2000); const c: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) { const m = chooseHumanMove(logits, elo, cands, r)!; c[m] = (c[m] ?? 0) + 1; }
    return c;
  };
  it('never plays the stray tail move', () => {
    expect(moveProbs(logits)[0][0]).toBe('e2e4');
    expect(tally().a2a4 ?? 0).toBe(0);
  });
  it('makes a move that loses a lot much rarer, but keeps small inaccuracies', () => {
    const plain = tally();
    const costly = tally(new Map([['e2e4', 30], ['d2d4', -20], ['g1f3', -600]]));
    expect(costly.g1f3 ?? 0).toBeLessThan((plain.g1f3 ?? 0) * 0.4);
    expect(costly.d2d4).toBeGreaterThan(plain.d2d4 * 0.9);
  });
  it('weaker opponents are damped less', () => {
    const cands = new Map([['e2e4', 30], ['d2d4', -20], ['g1f3', -600]]);
    expect(tally(cands, 600).g1f3 ?? 0).toBeGreaterThan(tally(cands, 1600).g1f3 ?? 0);
    expect(humanParams(1600).lossScale).toBeLessThan(humanParams(800).lossScale);
  });
});

import { BADGES, badgesEarned, levelSpan, rivalryLevel, rivalryPoints, rivalryRank, rivalryXp } from '../lib/people/rivalry';
import { rpOf } from '../lib/people/record';
describe('rivalries', () => {
  const game = (o: Record<string, unknown> = {}) => ({ userResult: 'win', userColor: 'w', hintsUsed: 0, takebacks: 0, reason: 'checkmate', match: false, summary: { accuracy: 90 }, plies: Array.from({ length: 40 }, (_, i) => ({ isUser: i % 2 === 0, fenAfter: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })), ...o }) as never;
  it('every finished game earns points; a clean win earns the most', () => {
    expect(rivalryPoints({ userResult: 'win', hintsUsed: 0, takebacks: 0 })).toBe(4);
    expect(rivalryPoints({ userResult: 'win', hintsUsed: 1, takebacks: 0 })).toBe(3);
    expect(rivalryPoints({ userResult: 'draw', hintsUsed: 0, takebacks: 0 })).toBe(2);
    expect(rivalryPoints({ userResult: 'loss', hintsUsed: 0, takebacks: 0 })).toBe(1);
  });
  it('levels never cap and each takes a little longer', () => {
    expect(rivalryLevel(0)).toMatchObject({ level: 1, into: 0, span: 6 });
    expect(rivalryLevel(6).level).toBe(2);
    expect(rivalryLevel(6 + 8 + 3)).toMatchObject({ level: 3, into: 3, span: 10 });
    expect(rivalryLevel(100000).level).toBeGreaterThan(100);
    expect(levelSpan(5)).toBeGreaterThan(levelSpan(4));
    expect(rivalryRank(1)).toBe('New face');
    expect(rivalryRank(6)).toBe('Rival');
    expect(rivalryRank(40)).toBe('Legendary rivalry');
    expect(rivalryXp(3)).toBe(30);
    expect(rivalryXp(50)).toBe(100);
  });
  it('awards matchup badges for feats in a win only', () => {
    expect(badgesEarned(game(), 1).sort()).toEqual(['clean', 'mate', 'quick', 'sharp', 'white'].sort());
    expect(badgesEarned(game({ userColor: 'b', match: true, hintsUsed: 2, summary: { accuracy: 60 }, reason: 'resignation' }), 3).sort()).toEqual(['black', 'match', 'quick', 'streak'].sort());
    expect(badgesEarned(game({ userResult: 'loss' }), 0)).toEqual([]);
    expect(BADGES.length).toBe(8);
  });
  it('gives old records their points from the score', () => {
    expect(rpOf({ w: 5, l: 2, d: 1, stars: 0, bestAccuracy: 0 })).toBe(19);
    expect(rpOf({ w: 5, l: 2, d: 1, stars: 0, bestAccuracy: 0, rp: 40 })).toBe(40);
    expect(rpOf(undefined)).toBe(0);
  });
});

import { EXPERIENCE, GOAL_CHOICES, startPlan } from '../lib/onboarding';
import { opponentById } from '../lib/people';
describe('onboarding', () => {
  it('starts each kind of player in the right place', () => {
    expect(startPlan('new')).toMatchObject({ opponentId: 'lily', first: 'lesson' });
    expect(startPlan('rules')).toMatchObject({ opponentId: 'tom', first: 'game' });
    expect(startPlan('club')).toMatchObject({ opponentId: 'maya', first: 'placement' });
    for (const e of EXPERIENCE) expect(opponentById(startPlan(e.id).opponentId)).toBeTruthy();
    expect(GOAL_CHOICES).toContain(4);
  });
});
