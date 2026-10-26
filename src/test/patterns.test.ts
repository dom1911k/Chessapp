import { describe, expect, it } from 'vitest';
import { trappedPieces } from '../lib/coach/tactics';
import { explainMove } from '../lib/coach';
import type { AnalysisResult } from '../lib/engine/types';

const line = (fen: string, pv: string[], cp = 0): AnalysisResult => ({ fen, depth: 12, bestMove: pv[0], lines: [{ multipv: 1, depth: 12, score: { type: 'cp', value: cp }, pv }] });

describe('new patterns', () => {
  it('finds a trapped bishop', () => {
    // Bishop a7 is attacked by the rook; b8 is covered by the rook and b6 by the c7 pawn.
    const fen = 'r3k3/B1p5/1p6/8/8/8/8/4K3 w - - 0 1';
    expect(trappedPieces(fen).map((t) => t.piece)).toEqual(['b']);
  });

  it('explains removing the defender', () => {
    // The c6 knight (protected by b7) guards the e5 rook: Rxc6 bxc6 Rxe5 wins material.
    const fen = '4k3/1p6/2n5/4r3/8/8/8/2R1R1K1 w - - 0 1';
    const before = line(fen, ['c1c6', 'b7c6', 'e1e5'], 400);
    const after = line('4k3/1p6/2n5/4r3/8/8/8/2R1R2K b - - 1 1', ['e5e1']);
    const c = explainMove({ fenBefore: fen, uci: 'g1h1', before, after, classification: 'mistake' });
    expect(c.ruleIds).toContain('missed-defender');
    expect(c.text.join(' ')).toMatch(/knight.*only guard of their rook/);
  });

  it('praises trading when ahead', () => {
    // White is a rook up and trades knights.
    const fen = '4k3/1p6/2n5/8/3N4/8/8/R3K2R w - - 0 1';
    const c = explainMove({ fenBefore: fen, uci: 'd4c6', before: line(fen, ['d4c6'], 900), after: line('4k3/1p6/2N5/8/8/8/8/R3K2R b - - 0 1', ['b7c6'], 900), classification: 'good' });
    expect(c.ruleIds).toContain('praise-trade-ahead');
  });
});

import { recurringPattern } from '../lib/report';
import type { PlyRecord } from '../lib/store/types';
describe('recurring patterns', () => {
  const ply = (theme: string): PlyRecord => ({ uci: '', san: '', color: 'w', fenBefore: '', fenAfter: '', isUser: true, classification: 'blunder', comment: { text: [], themes: [theme as never], ruleIds: [], arrows: [], highlights: [] } });
  it('needs the same mistake in 3 games', () => {
    expect(recurringPattern([[ply('fork')], [ply('fork')], [ply('pin')]])).toBeUndefined();
    expect(recurringPattern([[ply('hangingPiece')], [ply('hangingPiece'), ply('hangingPiece')], [ply('fork')], [ply('hangingPiece')]])).toEqual({ theme: 'hangingPiece', count: 3, of: 4 });
  });
});

import { botMoveNote, describeThreat, nullMoveFen } from '../lib/coach/threats';
describe('threats', () => {
  it('notes when the bot attacks an undefended piece', () => {
    const fenBefore = 'rnbqkbnr/ppp1pppp/8/3p3Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2';
    const fenAfter = 'rnbqkb1r/ppp1pppp/5n2/3p3Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3';
    const n = botMoveNote(fenBefore, fenAfter, 'g8f6', 'w');
    expect(n?.text).toMatch(/knight now attacks your queen on h5/);
  });
  it('describes a mate threat from the null-move line', () => {
    // White to move; black threatens Ra1#.
    const nf = nullMoveFen('6k1/5ppp/8/8/r7/8/5PPP/6K1 w - - 0 1')!;
    const t = describeThreat('6k1/5ppp/8/8/r7/8/5PPP/6K1 w - - 0 1', { fen: nf, depth: 8, bestMove: 'a4a1', lines: [{ multipv: 1, depth: 8, score: { type: 'mate', value: -1 }, pv: ['a4a1'] }] });
    expect(t.text).toMatch(/rook to a1.*checkmate/);
  });
});

import { explainPosition } from '../lib/coach/position';
describe('explain position', () => {
  it('mentions material, king safety and development', () => {
    // White is a knight up, black king uncastled in the center after move 10.
    const fen = 'r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P3/2NP1N2/PPP2PPP/R2QK2R w KQkq - 0 10'.replace('2n5', '8');
    const t = explainPosition(fen, { fen, depth: 10, bestMove: null, lines: [{ multipv: 1, depth: 10, score: { type: 'cp', value: 320 }, pv: ['e1g1'] }] }, 'w').join(' ');
    expect(t).toMatch(/winning/);
    expect(t).toMatch(/up a knight/);
    expect(t).toMatch(/Your king is still in the middle/);
  });
});
