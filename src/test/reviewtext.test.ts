import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { goodWhy, looseWhy, missedThreat, verdictLine } from '../lib/reviewText';
import { reviewGame } from '../lib/review';

const cp = (value: number) => ({ type: 'cp' as const, value });

/** Plies from a start FEN; `evals` White-POV cp after each ply. */
function game(sans: string[], evals: number[], o: Record<string, unknown> = {}) {
  const c = new Chess();
  const plies = sans.map((san, i) => {
    const before = c.fen();
    const m = c.move(san);
    return { uci: m.lan, san: m.san, color: m.color, fenBefore: before, fenAfter: c.fen(), isUser: m.color === 'w', evalAfter: cp(evals[i]) };
  });
  return { plies, userColor: 'w', startFen: new Chess().fen(), summary: { accuracy: 0, counts: {}, biggestMistakePly: null }, userResult: 'loss', reason: 'resignation', ...o } as never;
}
const sans = 'a3 h6 b3 g6 c3 f6 d3 e6 e3 d6 f3 c6 g3 b6 h3 a6'.split(' ');

describe('Game Review: one-line verdict', () => {
  it('a loss from a winning position names the slip and the phase', () => {
    const evals = [300, 320, 350, 340, 400, 380, 420, 410, 450, 430, -600, -650, -700, -700, -800, -800];
    const g = game(sans, evals);
    expect(verdictLine(g, reviewGame(g))).toMatch(/^You were winning until 6\. f3 — one slip in the (opening|middlegame) cost it\.$/);
  });
  it('a level game lost by one slip, a clean win, and a fair draw', () => {
    const lvl = [20, 10, 30, 20, 10, 0, 20, 10, 0, 10, -600, -600, -700, -700, -700, -700];
    expect(verdictLine(game(sans, lvl), reviewGame(game(sans, lvl)))).toMatch(/^It was level until 6\. f3/);
    const win = [60, 40, 90, 80, 150, 140, 200, 200, 300, 280, 400, 380, 500, 500, 600, 600];
    expect(verdictLine(game(sans, win, { userResult: 'win' }), reviewGame(game(sans, win, { userResult: 'win' })))).toBe('A clean win — no real slips from you.');
    const draw = sans.map(() => 0);
    expect(verdictLine(game(sans, draw, { userResult: 'draw' }), reviewGame(game(sans, draw, { userResult: 'draw' })))).toBe('Level most of the way — a fair draw.');
  });
});

describe('Game Review: plain-language why', () => {
  it('their threat first: mate, or a piece that would be lost', () => {
    // Black threatens …Qxf2# (queen h4, bishop c5); White plays a3 instead of defending.
    const fen = 'r1b1k1nr/pppp1ppp/2n5/2b1p3/2B1P2q/8/PPPP1PPP/RNBQK1NR w KQkq - 4 4';
    expect(missedThreat({ fenBefore: fen, uci: 'a2a3', color: 'w' })).toMatchObject({ san: 'Qxf2#', text: 'They were threatening Qxf2# — checkmate.' });
    // A knight on f3 attacked by a pawn on e4… is threatened with exf3.
    const fen2 = 'rnbqkbnr/pppp1ppp/8/8/4p3/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 3';
    expect(missedThreat({ fenBefore: fen2, uci: 'a2a3', color: 'w' })!.text).toBe('They were threatening exf3, winning your knight on f3.');
  });
  it('a loose piece: defended once but attacked twice, or no defender at all', () => {
    // White bishop on c4, attacked by Black's knight on b6 and queen on f7? Build: knight b6 + bishop e6 attack c4; defended once by the queen e2.
    const c = new Chess('4k3/8/1n2b3/8/2B5/8/4Q3/4K3 w - - 0 1');
    expect(looseWhy({ fenAfter: c.fen(), color: 'w' }, 'c4')).toBe('Your bishop on c4 was defended once but attacked twice.');
    expect(looseWhy({ fenAfter: '4k3/8/1n6/8/2B5/8/8/4K3 w - - 0 1', color: 'w' }, 'c4')).toBe('Your bishop on c4 had no defender, and they attack it with the knight.');
  });
  it('why a good move worked: a fork, a won piece, mate', () => {
    expect(goodWhy({ fenBefore: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', uci: 'b5c7' })).toBe('It forks the king and rook.');
    expect(goodWhy({ fenBefore: '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', uci: 'd1d5' })).toBe('It wins the queen.');
    expect(goodWhy({ fenBefore: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', uci: 'a1a8' })).toBe('It’s checkmate.');
    expect(goodWhy({ fenBefore: new Chess().fen(), uci: 'e2e4' })).toBeNull();
  });
});
