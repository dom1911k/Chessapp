import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { flagResult, fmtClock, humanThinkMs, lowTime, newClock, parseTc, pressClock, sensibleMoves, timeLeft, TIME_CONTROLS } from '../lib/clock';
import { moveTimes, obviousReason, timeAdvice, timeStats } from '../lib/timestats';
import { convertPositions, quickCorrect, quickItem, quickSet } from '../lib/timedrills';
import type { PlyRecord } from '../lib/store/types';
import type { Color } from '../lib/chess/pos';
import type { Puzzle } from '../lib/puzzles/types';

describe('chess clock', () => {
  it('offers the six time controls and runs the side to move, with increment', () => {
    expect(TIME_CONTROLS).toEqual(['180+2', '300+0', '600+0', '600+5', '900+10', '1800+0']);
    expect(parseTc('180+2')).toEqual({ base: 180000, inc: 2000 });
    let c = newClock('180+2', 0);
    expect(timeLeft(c, 'w', 'w', 10000)).toBe(170000);
    expect(timeLeft(c, 'b', 'w', 10000)).toBe(180000);
    c = pressClock(c, 'w', '180+2', 10000);
    expect(c.w).toBe(172000);
    expect(c.turnStart).toBe(10000);
    expect(timeLeft(c, 'b', 'b', 15000)).toBe(175000);
  });
  it('warns under 10% of the start time and formats like a clock', () => {
    expect(lowTime(59000, '600+0')).toBe(true);
    expect(lowTime(61000, '600+0')).toBe(false);
    expect(lowTime(0, '600+0')).toBe(false);
    expect(fmtClock(600000)).toBe('10:00');
    expect(fmtClock(65400)).toBe('1:05');
    expect(fmtClock(9400)).toBe('0:09.4');
  });
  it('a flag loses, unless the other side has no mating material', () => {
    expect(flagResult('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'b')).toEqual({ result: '1-0', reason: 'time' });
    expect(flagResult('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'w')).toEqual({ result: '1/2-1/2', reason: 'time vs insufficient material' });
    expect(flagResult('4k3/8/8/8/8/8/8/2N1K3 b - - 0 1', 'b').result).toBe('1/2-1/2');
  });
  it('human-like thinking: quick in the opening and when low, longer in complex positions', () => {
    const o = { moveNo: 20, sensible: 4, leftMs: 300000, tc: '600+0' };
    const mid = humanThinkMs(o, 0.5);
    expect(humanThinkMs({ ...o, moveNo: 3 }, 0.5)).toBeLessThan(mid);
    expect(humanThinkMs({ ...o, book: true }, 0.5)).toBeLessThan(mid);
    expect(humanThinkMs({ ...o, sensible: 1 }, 0.5)).toBeLessThan(mid);
    expect(humanThinkMs({ ...o, sensible: 6 }, 0.5)).toBeGreaterThan(mid);
    expect(humanThinkMs({ ...o, leftMs: 20000 }, 0.5)).toBeLessThan(mid / 3);
    // Never more than a fifth of what's left, never instant.
    expect(humanThinkMs({ ...o, leftMs: 5000, sensible: 6 }, 1)).toBeLessThanOrEqual(1000);
    expect(humanThinkMs({ ...o, moveNo: 1, book: true }, 0)).toBeGreaterThanOrEqual(350);
  });
  it('sensible moves = Maia moves with at least 5% probability', () => {
    expect(sensibleMoves(new Map([['e2e4', 3], ['d2d4', 2.8], ['a2a3', -3]]))).toBe(2);
    expect(sensibleMoves(new Map())).toBe(1);
  });
});

/** Plies from SAN moves, from my side. */
function plies(sans: string[], me: Color): PlyRecord[] {
  const c = new Chess();
  return sans.map((s) => {
    const before = c.fen();
    const m = c.move(s);
    return { uci: m.lan, san: m.san, color: m.color as Color, fenBefore: before, fenAfter: c.fen(), isUser: m.color === me };
  });
}

describe('time stats', () => {
  const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'O-O', 'd6', 'Bg5', 'h6', 'Bxf6', 'Qxf6', 'Nc3', 'O-O', 'Nd5', 'Qd8', 'c3', 'a6'];
  // 3+2: my clock after each of my moves (white), theirs after theirs.
  const mine = [181, 180, 160, 100, 101, 102, 70, 72, 73, 74];
  const theirs = [181, 181, 181, 181, 181, 181, 181, 181, 181, 181];
  const clocks = sans.map((_, i) => (i % 2 === 0 ? mine[i / 2] : theirs[(i - 1) / 2]));
  it('time per move from the clocks (increment included)', () => {
    const t = moveTimes(plies(sans, 'w'), clocks, '180+2', 'w');
    expect(t.map((m) => m.secs)).toEqual([1, 3, 22, 62, 1, 1, 34, 0, 1, 1]);
    expect(t[3]).toMatchObject({ moveNo: 4, san: 'd3', secs: 62 });
  });
  it('spots easy moves: recaptures, the only legal move, escaping check', () => {
    const p = plies(['e4', 'd5', 'exd5', 'Qxd5'], 'b');
    expect(obviousReason(p[3], p[2])).toBe('a recapture');
    expect(obviousReason(p[1], p[0])).toBeNull();
  });
  it('one plain sentence of advice', () => {
    const st = timeStats(plies(sans, 'w'), clocks, '180+2', 'w')!;
    expect(st.longest.map((m) => m.moveNo)).toEqual([4, 7, 3]);
    expect(st.advice).toMatch(/^You used \d+% of your time on moves \d+–\d+\.$/);
    expect(timeAdvice([{ ply: 0, moveNo: 1, san: 'e4', secs: 1 }], 1, 600, 0, true)).toMatch(/^You ran out of time/);
    expect(timeAdvice([], 0, 600, 1, false)).toMatch(/easy move/);
    // No clocks (or a daily game): no stats.
    expect(timeStats(plies(sans, 'w'), [], '180+2', 'w')).toBeNull();
    expect(timeStats(plies(sans, 'w'), clocks, 'daily', 'w')).toBeNull();
  });
});

describe('time drills', () => {
  it('Convert on the clock uses the winning mate positions', () => {
    const ps = convertPositions();
    expect(ps.length).toBeGreaterThanOrEqual(4);
    for (const p of ps) expect(() => new Chess(p.fen)).not.toThrow();
  });
  it('Quick decisions: recaptures, free pieces and escapes from easy puzzles', () => {
    // 1.e4 d5, puzzle: White takes d5, Black must take back.
    const recap: Puzzle = { id: 'r', fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', moves: ['e4d5', 'd8d5'], rating: 600, themes: [] };
    const it = quickItem(recap)!;
    expect(it.kind).toBe('recapture');
    expect(it.answer).toBe('d8d5');
    expect(quickCorrect(it, 'd8d5')).toBe(true);
    // Too hard, or a mate puzzle: not "obvious".
    expect(quickItem({ ...recap, rating: 1500 })).toBeNull();
    expect(quickItem({ ...recap, themes: ['mateIn1'] })).toBeNull();
    const set = quickSet(Array.from({ length: 12 }, (_, i) => ({ ...recap, id: `r${i}` })), 10, () => 0.3);
    expect(set.length).toBe(10);
  });
});
