import { describe, expect, it } from 'vitest';
import { encodeHistory, moveIndex, MOVE_COUNT, TOKEN_DIM } from '../lib/maia3/encode';
import { benchPositions } from '../lib/maia3';
import cases from './fixtures/maia3-encode.json';

// Reference values from scripts/maia3/convert.py (which matches the Maia-3 repo's encoding).
describe('Maia-3 encoding', () => {
  it('builds the same 8-position token input as the Python reference', () => {
    for (const c of cases) {
      const t = encodeHistory(c.fens);
      expect(t.length).toBe(64 * TOKEN_DIM);
      const nz: number[] = [];
      t.forEach((v, i) => v && nz.push(i));
      expect(nz).toEqual(c.nonzero);
    }
  });
  it('maps legal moves (castling, promotions, Black mirrored) to the same output indices', () => {
    for (const c of cases) {
      const black = c.fens[c.fens.length - 1].split(' ')[1] === 'b';
      const ours = c.legal.map((u: string) => moveIndex(u, black));
      expect(ours).toEqual(c.idx);
      for (const i of ours) expect(i).toBeLessThan(MOVE_COUNT);
    }
  });
  it('makes 50 benchmark positions with history', () => {
    const p = benchPositions();
    expect(p).toHaveLength(50);
    expect(p.every((f) => f.length >= 5)).toBe(true);
    expect(benchPositions()).toEqual(p);
  });
});
