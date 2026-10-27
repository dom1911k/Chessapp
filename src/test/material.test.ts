import { describe, expect, it } from 'vitest';
import { material } from '../lib/chess/material';
import { START_FEN } from '../lib/chess/game';

describe('material', () => {
  it('is level at the start', () => {
    expect(material(START_FEN, START_FEN)).toEqual({ lost: { w: [], b: [] }, diff: 0 });
  });

  it('lists captured pieces and the balance', () => {
    // White has taken a black knight and pawn; black has taken a white pawn back.
    const fen = 'r1bqkb1r/ppp2ppp/5n2/4p3/4P3/8/PPP2PPP/RNBQKBNR w KQkq - 0 5';
    const m = material(fen, START_FEN);
    expect(m.lost.b).toEqual(['p', 'n']);
    expect(m.lost.w).toEqual(['p']);
    expect(m.diff).toBe(3);
  });

  it('counts a promotion as a lost pawn, not a captured queen', () => {
    const start = '8/4P3/8/8/8/8/8/k6K w - - 0 1';
    const m = material('4Q3/8/8/8/8/8/8/k6K b - - 0 1', start);
    expect(m.lost.w).toEqual([]);
    expect(m.diff).toBe(9);
  });
});
