import { describe, expect, it } from 'vitest';
import { hadProgress, legacyLaurels } from '../cups/legacy';
import { momentCard } from '../cups/bridge';
import { TUNING } from '../cups/tuning';

describe('cups: old Run mode migration', () => {
  it('turns any old progress into a flat Laurel balance', () => {
    expect(legacyLaurels(undefined, 0)).toBe(0);
    expect(legacyLaurels({ embers: 0, unlocked: [], materials: { stone: 0 } }, 0)).toBe(0);
    expect(legacyLaurels({ embers: 120 }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels({ materials: { stone: 3 } }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels({ unlocked: ['board:ash'] }, 0)).toBe(TUNING.legacyLaurels);
    expect(legacyLaurels(undefined, 4)).toBe(TUNING.legacyLaurels);
    expect(hadProgress({ runs: 2 }, 0)).toBe(true);
    expect(TUNING.legacyLaurels).toBe(3);
  });
});

describe('cups: reviews bridge', () => {
  const m = { fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', playedUci: 'f2f3', playedSan: 'f3', bestUci: 'e2e4', themes: ['kingSafety'], explanation: ['Weakens the king.'] };
  it('makes a review card for a move with a better alternative', () => {
    const c = momentCard('c1', 0, m, 1000)!;
    expect(c).toMatchObject({ id: 'm:cup-c1:0', kind: 'mistake', solution: ['e2e4'], playedUci: 'f2f3', label: 'From a cup', themes: ['kingSafety'] });
    expect(momentCard('c1', 0, { ...m, bestUci: 'f2f3' })).toBeNull();
    expect(momentCard('c1', 0, { ...m, bestUci: undefined })).toBeNull();
  });
});
