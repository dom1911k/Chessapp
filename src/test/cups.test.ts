import { describe, expect, it } from 'vitest';
import { hadProgress, legacyLaurels } from '../cups/legacy';
import { momentCard } from '../cups/bridge';
import { TUNING } from '../cups/tuning';

describe('cups: old Run mode migration', () => {
  it('turns any old progress into a flat Laurel balance', () => {
    expect(legacyLaurels(undefined, 0)).toBe(0);
    expect(legacyLaurels({ embers: 0, unlocked: [], materials: { stone: 0 } }, 0)).toBe(0);
    expect(legacyLaurels({ embers: 120 }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels({ materials: { stone: 3 } }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels({ unlocked: ['board:ash'] }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels(undefined, 4)).toBe(TUNING.legacyLaurels);
    expect(hadProgress({ runs: 2 }, 0)).toBe(true);
    expect(TUNING.legacyLaurels).toBe(3);
  });
});

describe('cups: reviews bridge', () => {
  const m = { fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', playedUci: 'f2f3', playedSan: 'f3', bestUci: 'e2e4', themes: ['kingSafety'], explanation: ['Weakens the king.'] };
  it('makes a review card for a move with a better alternative', () => {
    const c = momentCard('c1', 0, m, 1000)!;
    expect(c).toMatchObject({ id: 'm:cup-c1:0', kind: 'mistake', solution: ['e2e4'], playedUci: 'f2f3', label: 'From a cup', themes: ['kingSafety'] });
    expect(momentCard('c1', 0, { ...m, bestUci: 'f2f3' })).toBeNull();
    expect(momentCard('c1', 0, { ...m, bestUci: undefined })).toBeNull();
  });
});

import { OPPONENTS } from '../lib/people';
import { TIERS, YOU, advances, cupXp, defaultColor, pickField, roundRating, seedBracket, simulateRound, tierInfo, tierOpen, winChance } from '../cups/ladder';
import { applyResult, champion, currentRound, cupMoves, newCup, opponentRating, yourColor, yourOpponent } from '../cups/cup';
import { newCupGame, pressCupClock, toSavedGame } from '../cups/game';
import { material } from '../cups/material';

describe('cups: ladder', () => {
  it('has five tiers in tight 200-point bands', () => {
    expect(TIERS).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
    expect(TIERS.map((t) => tierInfo(t).band)).toEqual([[400, 600], [600, 800], [800, 1000], [1000, 1200], [1200, 1400]]);
  });
  it('raises the opponent gently through the band, the final strongest', () => {
    expect([0, 1, 2].map((r) => roundRating('gold', r))).toEqual([800, 900, 1000]);
    expect(roundRating('bronze', 0)).toBe(400);
  });
  it('picks seven different characters with seed ratings inside the band', () => {
    for (const seed of [1, 2, 3, 99]) {
      const { field, ratings } = pickField('silver', seed);
      expect(new Set(field).size).toBe(7);
      for (const id of field) expect(OPPONENTS.some((o) => o.id === id)).toBe(true);
      expect(Object.values(ratings).every((r) => r >= 600 && r <= 800)).toBe(true);
      expect(ratings[field[0]]).toBe(600);
      expect(ratings[field[6]]).toBe(800);
    }
    const b = seedBracket(pickField('gold', 5).field);
    expect(b[0]).toBe(YOU);
    expect(b.length).toBe(8);
  });
  it('a win advances; a draw advances with Black or with Draw Odds', () => {
    expect(advances('win', 'w')).toBe(true);
    expect(advances('draw', 'w')).toBe(false);
    expect(advances('draw', 'b')).toBe(true);
    expect(advances('draw', 'w', true)).toBe(true);
    expect(advances('loss', 'b', true)).toBe(false);
    expect(defaultColor(0, 4)).toBe('w');
    expect(defaultColor(1, 4)).toBe('b');
  });
  it('carries old trophies over and opens the next tier', () => {
    expect(tierOpen('bronze', {})).toBe(true);
    expect(tierOpen('silver', {})).toBe(false);
    expect(tierOpen('silver', { bronze: 1 })).toBe(true);
    expect(tierOpen('platinum', { gold: 2 })).toBe(true);
    expect(tierOpen('diamond', { gold: 2 })).toBe(false);
    // An old Gold Cup win also opens everything below it.
    expect(tierOpen('silver', { gold: 1 })).toBe(true);
    expect(cupXp('bronze', 'winner')).toBe(80);
    expect(cupXp('diamond', 'quarter')).toBe(0);
    expect(winChance(1400, 400)).toBeGreaterThan(0.99);
  });
  it('simulates only the bots’ matches', () => {
    const c = newCup('bronze', 7, 0);
    const sims = simulateRound(c.rounds[0], c.ratings, c.seed, 0);
    expect(sims.length).toBe(3);
    expect(sims.every((m) => m.a !== YOU && m.b !== YOU && (m.winner === m.a || m.winner === m.b))).toBe(true);
    expect(simulateRound(c.rounds[0], c.ratings, c.seed, 0)).toEqual(sims);
  });
});

describe('cups: a cup from start to finish', () => {
  const rec = (c: ReturnType<typeof newCup>, result: 'win' | 'loss' | 'draw') => ({ opponentId: yourOpponent(c)!, elo: opponentRating(c), color: yourColor(c), result, reason: 'checkmate', moves: 25 });
  it('three wins lift the cup', () => {
    let c = newCup('gold', 42, 0);
    expect(yourOpponent(c)).toBe(c.field[0]);
    c = applyResult(c, rec(c, 'win'));
    expect(currentRound(c)).toBe(1);
    expect(yourColor(c)).toBe('b');
    c = applyResult(c, rec(c, 'draw'));
    expect(currentRound(c)).toBe(2);
    c = applyResult(c, rec(c, 'win'));
    expect(c.place).toBe('winner');
    expect(champion(c)).toBe(YOU);
    expect(cupMoves(c)).toBe(75);
    expect(c.sims.length).toBe(3);
  });
  it('a loss ends it and the bots finish the bracket', () => {
    let c = newCup('silver', 9, 0);
    c = applyResult(c, rec(c, 'loss'));
    expect(c.place).toBe('quarter');
    expect(champion(c)).toBeTruthy();
    expect(champion(c)).not.toBe(YOU);
    expect(yourOpponent(c)).toBeNull();
    let d = newCup('silver', 9, 0);
    d = applyResult(d, rec(d, 'win'));
    d = applyResult(d, { ...rec(d, 'draw'), color: 'w' });
    expect(d.place).toBe('semi');
  });
});

describe('cups: game clock and records', () => {
  const g = newCupGame({ cupId: 'c', tier: 'gold', round: 0, opponentId: 'tom', elo: 800, userColor: 'w', timeControl: '600+0', extraMs: { w: 60_000 }, extraInc: { w: 2000 }, freeMoves: 2 }, 0);
  it('gives each side its own time and increment', () => {
    expect(g.clock).toEqual({ w: 660_000, b: 600_000, turnStart: 0 });
    expect(g.inc).toEqual({ w: 2000, b: 0 });
  });
  it('charges the mover, skips free moves, adds the increment', () => {
    let r = pressCupClock(g, 'w', 5000);
    expect(r.clock.w).toBe(662_000);
    expect(r.freeMoves).toBe(1);
    r = pressCupClock({ ...g, freeMoves: 0 }, 'w', 5000);
    expect(r.clock.w).toBe(657_000);
    r = pressCupClock(g, 'b', 5000);
    expect(r.clock.b).toBe(595_000);
  });
  it('is recorded as a Match-conditions game tagged with the cup', () => {
    const s = toSavedGame({ ...g, rewinds: 1 });
    expect(s).toMatchObject({ match: true, opponentId: 'tom', elo: 800, takebacks: 1, hintsUsed: 0, cup: { id: 'c', tier: 'gold', round: 0 } });
  });
  it('counts captured pieces and the material lead', () => {
    expect(material('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual({ lost: { w: [], b: [] }, diff: 0 });
    expect(material('rnb1kbnr/pppp1ppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1')).toEqual({ lost: { w: ['n'], b: ['p', 'q'] }, diff: 7 });
  });
});
