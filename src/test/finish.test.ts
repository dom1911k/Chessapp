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

describe('finishing a game', () => {
  it('records and rewards a game only once, and reset clears everything', async () => {
    const { db, kvGet } = await import('../lib/db');
    const { finishGame } = await import('../lib/store/finish');
    const { resetProgress } = await import('../lib/backup');
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const after = 'R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1';
    const g = {
      id: 'play' as const,
      userColor: 'w' as const,
      elo: 400,
      opponentId: 'lily',
      startFen: fen,
      startedAt: 12345,
      plies: [{ uci: 'a1a8', san: 'Ra8#', color: 'w' as const, fenBefore: fen, fenAfter: after, isUser: true, classification: 'best' as const }],
      takebacks: 0,
      hintsUsed: 0,
      told: [],
    };
    const first = await finishGame(g, '1-0', 'checkmate');
    expect(first).not.toBeNull();
    const xp = await kvGet<number>('xp', 0);
    expect(xp).toBeGreaterThan(0);
    // The app closes before the game is cleared and finishes it again on restart.
    const second = await finishGame(g, '1-0', 'checkmate');
    expect(second).toBeNull();
    expect(await db.games.count()).toBe(1);
    expect(await kvGet<number>('xp', 0)).toBe(xp);

    await resetProgress();
    expect(await db.games.count()).toBe(0);
    expect(await kvGet<number>('xp', 0)).toBe(0);
  });
});
