import { describe, expect, it } from 'vitest';
import { mistakeReport, phaseOf, trendWord } from '../lib/games/mistakes';
import type { AnyGame, PlyRecord } from '../lib/store/types';
import type { Theme } from '../lib/coach/types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const END = '8/5k2/8/8/8/2R5/5K2/8 w - - 0 50';

/** A game with my mistakes at the given plies (theme, classification, position). */
function game(id: number | string, endedAt: number, slips: { ply: number; theme: Theme; cls?: 'mistake' | 'blunder'; fen?: string }[], over: Partial<AnyGame> = {}): AnyGame {
  const plies: PlyRecord[] = Array.from({ length: 60 }, (_, i) => {
    const s = slips.find((x) => x.ply === i);
    return {
      uci: 'e2e4', san: `m${i}`, color: i % 2 ? 'b' : 'w', fenBefore: s?.fen ?? START, fenAfter: START, isUser: i % 2 === 0,
      classification: s ? (s.cls ?? 'mistake') : 'good',
      comment: s ? ({ themes: ['material', s.theme], bestSan: 'Nf3' } as unknown as PlyRecord['comment']) : undefined,
    };
  });
  return { id, userColor: 'w', elo: 700, startFen: START, startedAt: 0, plies, takebacks: 0, hintsUsed: 0, told: [], endedAt, result: '1-0', reason: '', userResult: 'win', summary: { accuracy: 0, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null }, ...over } as AnyGame;
}

describe('my mistakes report', () => {
  it('phases: opening by move number, endgame by material', () => {
    expect(phaseOf(START, 4)).toBe('opening');
    expect(phaseOf(START, 30)).toBe('middlegame');
    expect(phaseOf(END, 4)).toBe('endgame');
  });
  it('ranks mistake types by games, counts phases and colours, and keeps examples newest first', () => {
    const games = [
      game(1, 100, [{ ply: 4, theme: 'hangingPiece' }, { ply: 30, theme: 'hangingPiece', cls: 'blunder' }]),
      game(2, 300, [{ ply: 40, theme: 'hangingPiece' }, { ply: 50, theme: 'fork', fen: END }]),
      game('cc:x', 200, [{ ply: 10, theme: 'fork' }], { source: 'chess.com', analyzed: true, opponentName: 'Opp', userColor: 'w' } as Partial<AnyGame>),
      // Not analysed yet: ignored.
      game('cc:y', 400, [{ ply: 2, theme: 'pin' }], { source: 'chess.com', analyzed: false } as Partial<AnyGame>),
    ];
    const r = mistakeReport(games);
    expect(r.games).toBe(3);
    expect(r.mistakes).toBe(5);
    expect(r.themes.map((t) => [t.theme, t.games, t.count])).toEqual([['hangingPiece', 2, 3], ['fork', 2, 2]]);
    const hp = r.themes[0];
    expect(hp.share).toBeCloseTo(2 / 3);
    expect(hp.phases).toEqual({ opening: 1, middlegame: 2, endgame: 0 });
    expect(hp.colors).toEqual({ w: 3, b: 0 });
    expect(hp.examples.map((e) => e.gameId)).toEqual([2, 1, 1]);
    expect(hp.examples[0]).toMatchObject({ ply: 40, better: 'Nf3', cls: 'mistake', source: 'app' });
    const fork = r.themes[1];
    expect(fork.phases.endgame).toBe(1);
    expect(fork.examples.find((e) => e.source === 'chess.com')).toMatchObject({ gameId: 'cc:x', opponent: 'Opp' });
    expect(r.phases).toEqual({ opening: 2, middlegame: 2, endgame: 1 });
    // Filters: source and period.
    expect(mistakeReport(games, { src: 'chess.com' }).themes.map((t) => t.theme)).toEqual(['fork']);
    expect(mistakeReport(games, { sinceDays: 1, now: 250 + 864e5 }).games).toBe(1);
  });
  it('trend compares the latest 20 games with the 20 before', () => {
    const games = Array.from({ length: 40 }, (_, i) => game(i, 1000 - i, i < 20 ? (i < 2 ? [{ ply: 4, theme: 'fork' }] : []) : i < 30 ? [{ ply: 4, theme: 'fork' }] : []));
    const fork = mistakeReport(games).themes[0];
    expect(fork.trend).toEqual({ recent: 0.1, before: 0.5 });
    expect(trendWord(fork.trend)).toBe('better');
    expect(trendWord({ recent: 0.5, before: 0.2 })).toBe('worse');
    expect(trendWord({ recent: 0.3, before: 0.25 })).toBe('same');
    expect(mistakeReport(games.slice(0, 30)).themes[0].trend).toBeNull();
  });
});
