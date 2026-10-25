import { describe, expect, it } from 'vitest';
import { createNodeEngine } from '../lib/engine/node';

describe('node engine', () => {
  it('finds mate in 1', async () => {
    const e = createNodeEngine();
    const r = await e.analyze('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { depth: 10, multipv: 2 });
    expect(r.bestMove).toBe('a1a8');
    expect(r.lines[0].score).toEqual({ type: 'mate', value: 1 });
    expect(r.lines.length).toBe(2);
  }, 30000);
});
