import { describe, expect, it } from 'vitest';
import { dayPartOf, insights, openingFamily, profileStats, scorePct, speedOf } from './profile';
import type { AnyGame, PlyRecord } from '../store/types';

const FULL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const END = '4k3/8/8/8/8/8/4P3/4K2R w - - 0 1';
const ply = (fenBefore: string, isUser: boolean, accuracy: number): PlyRecord => ({ uci: 'e2e4', san: 'e4', color: 'w', fenBefore, fenAfter: fenBefore, isUser, accuracy });

let id = 0;
function game(o: Partial<AnyGame> = {}): AnyGame {
  return {
    id: ++id,
    userColor: 'w',
    elo: 1000,
    startFen: FULL,
    startedAt: 0,
    endedAt: new Date(2026, 0, 5, 10).getTime(),
    plies: [],
    takebacks: 0,
    hintsUsed: 0,
    told: [],
    result: '1-0',
    reason: 'checkmate',
    userResult: 'win',
    summary: { accuracy: 80, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null },
    ...o,
  } as AnyGame;
}

describe('profileStats', () => {
  it('counts the record, sorts best wins by rating and averages accuracy per week', () => {
    const now = new Date(2026, 0, 10).getTime();
    const list = [
      game({ elo: 900, endedAt: now - 864e5 }),
      game({ elo: 1400, endedAt: now - 2 * 864e5, summary: { accuracy: 90, counts: {} as never, biggestMistakePly: null } }),
      game({ elo: 2000, userResult: 'loss', endedAt: now - 9 * 864e5, summary: { accuracy: 60, counts: {} as never, biggestMistakePly: null } }),
      game({ userResult: 'draw', endedAt: now - 3 * 864e5 }),
    ];
    const p = profileStats(list, () => 'Bot', 12, now);
    expect(p.score).toEqual({ w: 2, d: 1, l: 1 });
    expect(p.bestWins.map((b) => b.rating)).toEqual([1400, 900]);
    expect(p.accuracyByWeek).toEqual([
      { week: 1, accuracy: 60, games: 1 },
      { week: 0, accuracy: 83, games: 3 },
    ]);
  });
  it('leaves unanalysed imports out of accuracy', () => {
    const p = profileStats([game({ source: 'chess.com', analyzed: false } as Partial<AnyGame>)], () => 'x');
    expect(p.accuracy).toBeNull();
    expect(p.score.w).toBe(1);
  });
});

describe('insights', () => {
  it('finds the weakest phase from your move accuracies', () => {
    const plies = [...Array(10)].flatMap(() => [ply(FULL, true, 90), ply(FULL, false, 10)]).concat([...Array(6)].map(() => ply(END, true, 50)));
    const r = insights([game({ plies })]);
    expect(r.phases.find((p) => p.phase === 'opening')!.accuracy).toBe(90);
    expect(r.phases.find((p) => p.phase === 'endgame')!.accuracy).toBe(50);
    expect(r.phases.find((p) => p.phase === 'middlegame')!.accuracy).toBeNull();
    expect(r.weakestPhase).toBe('endgame');
  });
  it('groups results by colour, opening family, time of day and speed', () => {
    const list = [
      game({ opening: 'Sicilian Defense: Najdorf', userColor: 'b', userResult: 'loss' }),
      game({ opening: 'Sicilian Defense, Alapin', userColor: 'b', userResult: 'draw' }),
      game({ opening: 'Italian Game', userResult: 'win', timeControl: '180+2' }),
      game({ userResult: 'win', endedAt: new Date(2026, 0, 5, 23).getTime() }),
    ];
    const r = insights(list);
    expect(r.colors).toEqual([
      { key: 'w', score: { w: 2, d: 0, l: 0 }, pct: 100 },
      { key: 'b', score: { w: 0, d: 1, l: 1 }, pct: 25 },
    ]);
    expect(r.openings.black).toEqual([{ key: 'Sicilian Defense', score: { w: 0, d: 1, l: 1 }, pct: 25 }]);
    expect(r.openings.white).toEqual([]);
    expect(r.dayParts.map((x) => x.key)).toEqual(['morning', 'night']);
    expect(r.speeds.map((x) => [x.key, x.score.w])).toEqual([['blitz', 1], ['untimed', 1]]);
  });
});

describe('helpers', () => {
  it('buckets speed like chess.com', () => {
    expect(speedOf(game({ timeControl: '60' }))).toBe('bullet');
    expect(speedOf(game({ timeControl: '180+2' }))).toBe('blitz');
    expect(speedOf(game({ timeControl: '600' }))).toBe('rapid');
    expect(speedOf(game({ timeControl: '1/86400' }))).toBe('daily');
    expect(speedOf(game({}))).toBe('untimed');
  });
  it('names day parts, opening families and score', () => {
    expect(dayPartOf(new Date(2026, 0, 1, 8).getTime())).toBe('morning');
    expect(dayPartOf(new Date(2026, 0, 1, 14).getTime())).toBe('afternoon');
    expect(dayPartOf(new Date(2026, 0, 1, 19).getTime())).toBe('evening');
    expect(dayPartOf(new Date(2026, 0, 1, 2).getTime())).toBe('night');
    expect(openingFamily('Queen\'s Gambit Declined: Exchange')).toBe("Queen's Gambit Declined");
    expect(scorePct({ w: 1, d: 1, l: 2 })).toBe(38);
  });
});
