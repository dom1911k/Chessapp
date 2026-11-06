import { describe, expect, it } from 'vitest';
import { moveSound, premoveTargets, squareAtPoint } from './boardfeel';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('moveSound', () => {
  it('tells your moves from the opponent\'s', () => {
    const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(moveSound(START, after, { from: 'e2', to: 'e4' }, 'w')).toBe('move');
    expect(moveSound(START, after, { from: 'e2', to: 'e4' }, 'b')).toBe('moveOpp');
  });
  it('recognises captures, castling, checks and promotions', () => {
    expect(moveSound('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', '4k3/8/8/3P4/8/8/8/4K3 b - - 0 1', { from: 'e4', to: 'd5' }, 'w')).toBe('capture');
    expect(moveSound('4k3/8/8/8/8/8/8/4K2R w K - 0 1', '4k3/8/8/8/8/8/8/5RK1 b - - 1 1', { from: 'e1', to: 'g1' }, 'w')).toBe('castle');
    expect(moveSound('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'R3k3/8/8/8/8/8/8/4K3 b - - 1 1', { from: 'a1', to: 'a8' }, 'w')).toBe('check');
    expect(moveSound('8/1P2k3/8/8/8/8/8/4K3 w - - 0 1', '1Q6/4k3/8/8/8/8/8/4K3 b - - 0 1', { from: 'b7', to: 'b8' }, 'w')).toBe('promote');
  });
});

describe('premoveTargets', () => {
  it('lists moves for your piece while it is the opponent\'s turn', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(premoveTargets(fen, 'w', 'g1').sort()).toEqual(['e2', 'f3', 'h3']);
    expect(premoveTargets(fen, 'w', 'e7')).toEqual([]);
  });
  it('allows pawn captures onto empty squares, but not onto your own pieces', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(premoveTargets(fen, 'w', 'e4').sort()).toEqual(['d5', 'e5', 'f5']);
    expect(premoveTargets(fen, 'w', 'a2').sort()).toEqual(['a3', 'a4', 'b3']);
  });
});

describe('squareAtPoint', () => {
  const r = { left: 0, top: 0, width: 800, height: 800 };
  it('maps points to squares for both orientations', () => {
    expect(squareAtPoint(r, 50, 750, 'white')).toBe('a1');
    expect(squareAtPoint(r, 50, 750, 'black')).toBe('h8');
    expect(squareAtPoint(r, 750, 50, 'white')).toBe('h8');
    expect(squareAtPoint(r, 900, 50, 'white')).toBeNull();
  });
});
