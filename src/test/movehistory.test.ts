import { describe, expect, it } from 'vitest';
import { figurine } from '../components/MoveHistory';

describe('figurine notation', () => {
  it('swaps piece letters for symbols', () => {
    expect(figurine('Nf3')).toBe('♘f3');
    expect(figurine('Qxh7#')).toBe('♕xh7#');
    expect(figurine('exd5')).toBe('exd5');
    expect(figurine('O-O')).toBe('O-O');
    expect(figurine('e8=Q+')).toBe('e8=♕+');
  });
});
