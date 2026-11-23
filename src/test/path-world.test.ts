import { describe, expect, it } from 'vitest';
import { ISO } from '../lib/puzzles/world';

/** Every id a markup string defines (id="…"). */
const ids = (svg: string) => new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
/** Every url(#…) a markup string references. */
const refs = (svg: string) => new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));
/** Every <use href="#…"> a markup string references. */
const uses = (svg: string) => new Set([...svg.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]));

describe('the path world', () => {
  const shared = ids(ISO.defs() as string);
  it('has the shared gradients the app mounts once', () => {
    for (const id of ['cldB', 'shG', 'hedgeTop', 'hedgeSide', 'pwB', 'pwC', 'pwH']) expect(shared.has(id)).toBe(true);
  });
  it.each([
    ['Wood 1', { b: 0, lvl: 0 }],
    ['Wood 12, Stone ahead', { b: 0, lvl: 11, w0: 0, w1: 2 }],
    ['Silver 6', { b: 3, lvl: 5, w0: 2, w1: 5 }],
    ['Legend 20', { b: 7, lvl: 19, w0: 6, w1: 7 }],
  ])('every url(#id) and <use> in the markup resolves (%s)', (_, opt) => {
    const r = ISO.build(390, { ...opt, mt: 120, uid: 't' }) as { svg: string };
    const own = ids(r.svg);
    const missing = [...refs(r.svg), ...uses(r.svg)].filter((id) => !own.has(id) && !shared.has(id));
    expect(missing).toEqual([]);
  });
});
