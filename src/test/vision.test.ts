import { describe, expect, it } from 'vitest';
import { ALL_SQUARES, cellOf, nameOptions, nextSquare, squareAt } from '../lib/vision';

describe('vision trainer', () => {
  it('maps grid cells to squares for both sides and back', () => {
    expect(squareAt(0, 0, 'white')).toBe('a8');
    expect(squareAt(7, 7, 'white')).toBe('h1');
    expect(squareAt(0, 0, 'black')).toBe('h1');
    expect(squareAt(7, 0, 'black')).toBe('h8');
    for (const s of ALL_SQUARES) for (const side of ['white', 'black'] as const) {
      const { row, col } = cellOf(s, side);
      expect(squareAt(row, col, side)).toBe(s);
    }
  });
  it('never repeats a square twice in a row', () => {
    let r = 0;
    const rng = () => [0.01, 0.01, 0.5][r++ % 3];
    expect(nextSquare(rng, 'a1')).not.toBe('a1');
  });
  it('offers the answer and three distinct near-misses', () => {
    const rng = (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (const sq of ['a1', 'e4', 'h8', 'd5']) {
      const o = nameOptions(sq, rng);
      expect(o).toHaveLength(4);
      expect(new Set(o).size).toBe(4);
      expect(o).toContain(sq);
    }
  });
});
