import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { dailyPick, dailyStreak, gamePuzzles } from '../lib/puzzles/sources';
import { newRating } from '../lib/puzzles/rating';
import { THEME_GROUPS, THEME_SETS, themeLabel } from '../lib/puzzles/themes';
import type { AnyGame, PlyRecord } from '../lib/store/types';
import type { Score } from '../lib/chess/evaluation';
import type { Color } from '../lib/chess/pos';
import type { Puzzle } from '../lib/puzzles/types';

function game(sans: string[], me: Color, ev: number[], mine: Record<number, Partial<PlyRecord>>): AnyGame {
  const c = new Chess();
  const plies: PlyRecord[] = sans.map((s, i) => {
    const before = c.fen();
    const m = c.move(s);
    return { uci: m.lan, san: m.san, color: m.color as Color, fenBefore: before, fenAfter: c.fen(), isUser: m.color === me, evalAfter: { type: 'cp', value: ev[i] } as Score, classification: m.color === me ? 'best' : undefined, ...mine[i] };
  });
  return { id: 7, userColor: me, elo: 700, startFen: new Chess().fen(), startedAt: 0, plies, takebacks: 0, hintsUsed: 0, told: [], endedAt: 1, result: '1-0', reason: '', userResult: 'win', summary: { accuracy: 0, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null }, opponentName: 'Opp' } as AnyGame;
}

describe('puzzle sources', () => {
  it('turns opponent blunders you missed into puzzles from your games', () => {
    // 3...Nd4?? hangs e5; 4.a3? misses Nxe5 / Nxd4.
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'a3', 'Nxf3+'];
    const g = game(sans, 'w', [30, 30, 30, 30, 30, 300, 40, 40], { 6: { classification: 'mistake', comment: { text: ['You missed it.'], themes: ['hangingPiece'], ruleIds: [], arrows: [], highlights: [], bestUci: 'f3d4', bestSan: 'Nxd4' } } });
    const ps = gamePuzzles([g]);
    expect(ps.length).toBe(1);
    expect(ps[0]).toMatchObject({ id: 'g:7:6', setup: 'c6d4', solution: ['f3d4'], acceptGoodAlternatives: true, playedSan: 'a3' });
    expect(ps[0].label).toMatch(/vs Opp/);
    // If you found the punishment, there is no puzzle.
    const found = game(sans, 'w', [30, 30, 30, 30, 30, 300, 300, 300], {});
    expect(gamePuzzles([found]).length).toBe(0);
  });
  it('the daily puzzle is stable for a day and changes the next', () => {
    const pool = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, fen: '', moves: [], rating: 1200, themes: [] }) as Puzzle);
    const a = dailyPick(pool, 20000)!;
    expect(dailyPick([...pool].reverse(), 20000)!.id).toBe(a.id);
    const week = new Set(Array.from({ length: 7 }, (_, k) => dailyPick(pool, 20000 + k)!.id));
    expect(week.size).toBeGreaterThan(4);
    expect(dailyPick([], 1)).toBeNull();
  });
  it('daily streak counts days in a row up to today (or yesterday)', () => {
    const now = new Date(2026, 10, 6, 12);
    const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}`;
    expect(dailyStreak([day(4), day(5), day(6)], now)).toBe(3);
    expect(dailyStreak([day(4), day(5)], now)).toBe(2);
    expect(dailyStreak([day(3), day(5)], now)).toBe(1);
    expect(dailyStreak([], now)).toBe(0);
  });
  it('rating moves like chess.com: up for a solve, down for a miss', () => {
    const s = { rating: 1200, games: 50 };
    expect(newRating(s, 1200, true)).toBeGreaterThan(1200);
    expect(newRating(s, 1200, false)).toBeLessThan(1200);
    expect(newRating(s, 1600, true) - 1200).toBeGreaterThan(newRating(s, 800, true) - 1200);
  });
  it('every theme has a group and a label', () => {
    expect(THEME_SETS.length).toBeGreaterThanOrEqual(30);
    for (const t of THEME_SETS) {
      expect(THEME_GROUPS).toContain(t.group);
      expect(themeLabel(t.id)).toBe(t.label);
    }
    expect(new Set(THEME_SETS.map((t) => t.id)).size).toBe(THEME_SETS.length);
  });
});
