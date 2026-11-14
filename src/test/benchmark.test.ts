import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { bandOf, BANDS } from '../lib/benchmark/bands';
import { blunderKind, phaseOf, Profile, thinkTimes } from '../lib/benchmark/profile';
import { benchmarkOpponents, type BenchDeps } from '../lib/benchmark/humans';
import { benchTable, labelForBand } from '../lib/benchmark/table';

describe('bot-vs-human benchmark', () => {
  it('bands cover 100–1900 in steps of 200', () => {
    expect(BANDS[0]).toMatchObject({ min: 100, max: 300 });
    expect(bandOf(650)!.label).toBe('500–700');
    expect(bandOf(50)).toBeNull();
  });

  it('phases: first ten moves are the opening; little material left is an endgame', () => {
    const start = new Chess().fen();
    expect(phaseOf(start, 5)).toBe('opening');
    expect(phaseOf(start, 20)).toBe('middlegame');
    expect(phaseOf('4k3/8/8/8/8/8/4R3/4K2R w - - 0 40', 40)).toBe('endgame');
  });

  it('think time per ply from the clock after each ply', () => {
    expect(thinkTimes([595, 590, 580, 588], '600')).toEqual([5, 10, 15, 2]);
    expect(thinkTimes([598, 600], '600+2')).toEqual([4, 2]);
  });

  it('classifies blunders: a piece left hanging, a threat ignored', () => {
    // White plays Qh5?? where the queen can be taken by the knight on f6.
    const fen = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 2 3';
    const after = new Chess(fen); after.move('Qh5');
    expect(blunderKind(fen, 'd1h5', after.fen())).toBe('hung');
  });

  it('counts only undecided positions after ply 12, and reports percentages', () => {
    const p = new Profile();
    const fen = new Chess().fen();
    p.addMove({ fen, uci: 'e2e4', fenAfter: fen, best: 30, score: 20, ply: 5 }); // too early
    p.addMove({ fen, uci: 'e2e4', fenAfter: fen, best: 900, score: 0, ply: 20 }); // already decided
    p.addMove({ fen, uci: 'e2e4', fenAfter: fen, best: 30, score: 20, ply: 20 });
    p.addMove({ fen, uci: 'e2e4', fenAfter: fen, best: 30, score: -170, ply: 22 });
    p.addThink('opening', 1);
    p.addThink('middlegame', 9);
    const s = p.summary();
    expect(s.moves).toBe(2);
    expect(s.mistake).toBe(50);
    expect(s.blunder).toBe(0);
    expect(s.think).toMatchObject({ opening: 1, middlegame: 9, fast: 50, moves: 2 });
  });

  it('measures only your opponents\' moves, by their rating band', async () => {
    const c = new Chess();
    const plies = [];
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+', 'Nc3', 'Nxe4', 'O-O', 'Nxc3']) {
      const before = c.fen();
      const m = c.move(san);
      plies.push({ fenBefore: before, fenAfter: c.fen(), uci: m.lan, isUser: m.color === 'w' });
    }
    const seen: string[] = [];
    const deps: BenchDeps = {
      candidates: async (fen) => { seen.push(fen); return new Map([['x', 10]]); },
      scoreAfter: async () => -400,
      prob: async () => 0.01,
    };
    const res = await benchmarkOpponents([{ plies, clocks: plies.map((_, i) => 600 - i * 3), timeControl: '600', elo: 650, myRating: 700 }], deps);
    expect(res).toHaveLength(1);
    expect(res[0].band).toBe('500–700');
    // Black's moves after ply 12 only: plies 13 and 15.
    expect(seen).toEqual([plies[13].fenBefore, plies[15].fenBefore]);
    expect(res[0].moves).toBe(2);
    expect(res[0].blunder).toBe(100);
    expect(res[0].ofBlunders.randomLooking).toBe(100);
    expect(res[0].think!.moves).toBe(8);
  });

  it('pairs each band with the bot whose chess.com estimate is its middle', () => {
    expect(labelForBand(500, 700, -300)).toBe(900);
    expect(labelForBand(100, 300, -300)).toBe(500);
    expect(labelForBand(1700, 1900, -300)).toBe(2000);
    const h = (band: string) => ({ band, games: 5, moves: 300, avgLoss: 0, inacc: 0, mistake: 0, blunder: 10, ofBlunders: { hung: 0, threat: 0, other: 0, randomLooking: 0 } });
    const b = (label: number) => ({ ...h(''), label });
    const rows = benchTable([h('500–700')], [b(900), b(1300)], -300, [{ ...h('500–700'), blunder: 20 }]);
    expect(rows.find((r) => r.band === '500–700')).toMatchObject({ label: 900, bot: { label: 900 }, human: { blunder: 20 } });
  });
});
