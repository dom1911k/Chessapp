import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    },
  };
});
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: {}, Encoding: {}, Filesystem: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));

describe('backup', () => {
  it('round-trips all data', async () => {
    const { db, kvSet } = await import('../lib/db');
    const { buildBackup, parseBackup, restoreBackup } = await import('../lib/backup');
    const { useSettings } = await import('../lib/settings');
    await db.attempts.add({ puzzleId: 'abc', at: 1, success: true, puzzleRating: 900, ratingBefore: 800, ratingAfter: 830, themes: ['fork'], source: 'rated', hintsUsed: 0 });
    await db.cards.put({ id: 'p:abc', kind: 'puzzle', fen: 'x', solution: ['e2e4'], themes: [], label: '', createdAt: 1, due: 2, step: 0, reps: 0, lapses: 0 });
    await kvSet('puzzleRating', { rating: 830, games: 1 });
    useSettings.getState().set({ botElo: 1234 });

    const json = JSON.stringify(await buildBackup());
    await db.attempts.clear();
    await db.cards.clear();
    await db.kv.clear();
    useSettings.getState().set({ botElo: 600 });

    await restoreBackup(parseBackup(json));
    expect(await db.attempts.count()).toBe(1);
    expect((await db.cards.get('p:abc'))?.solution).toEqual(['e2e4']);
    expect((await db.kv.get('puzzleRating'))?.value).toEqual({ rating: 830, games: 1 });
    expect(useSettings.getState().botElo).toBe(1234);
    expect(() => parseBackup('{"foo":1}')).toThrow(/not a Chess Coach backup/);
  });
});
