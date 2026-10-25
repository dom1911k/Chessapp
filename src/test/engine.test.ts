import { describe, expect, it } from 'vitest';
import { createNodeEngine } from '../lib/engine/node';

// The Node build of Stockfish can only be instantiated once per process.
const e = createNodeEngine();

describe('node engine', () => {
  it('finds mate in 1', async () => {
    const r = await e.analyze('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { depth: 10, multipv: 2 });
    expect(r.bestMove).toBe('a1a8');
    expect(r.lines[0].score).toEqual({ type: 'mate', value: 1 });
    expect(r.lines.length).toBe(2);
  }, 30000);
});

describe('owner-scoped cancellation', () => {
  it('cancelling one owner leaves the other owner\'s jobs alone', async () => {
    const a = e.analyze('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', { depth: 8, owner: 'play' });
    const b = e.analyze('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 8, owner: 'explore' });
    e.cancelAll('explore');
    await expect(b).rejects.toThrow('cancelled');
    expect((await a).bestMove).toBe('a1a8');
  }, 30000);
});
