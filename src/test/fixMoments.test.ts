import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { GameRecord, PlyRecord } from '../lib/store/types';

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

// Legal's mate: you (Black) take the queen with 5…Bxd1?? and get mated; 5…dxe5 was the move.
async function legalGame() {
  const { tryMove, START_FEN } = await import('../lib/chess/game');
  const LEGAL = ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'f1c4', 'c8g4', 'b1c3', 'g7g6', 'f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'];
  const CP = [30, 30, 30, 40, 40, 80, 80, 160, 210, 900, 900, 900, null];
  let fen = START_FEN;
  const plies = LEGAL.map((u, i) => {
    const r = tryMove(fen, u)!;
    const ply = {
      san: r.move.san,
      uci: u,
      fenBefore: fen,
      fenAfter: r.fen,
      color: (i % 2 ? 'b' : 'w') as 'w' | 'b',
      isUser: i % 2 === 1,
      evalAfter: CP[i] === null ? undefined : { type: 'cp' as const, value: CP[i]! },
      classification: i % 2 === 1 ? (i === 9 ? ('blunder' as const) : ('best' as const)) : undefined,
      comment: i === 9 ? { text: [], themes: ['mate' as const], ruleIds: [], arrows: [], highlights: [], bestUci: 'd6e5', bestSan: 'dxe5', replyLine: ['c4f7', 'e8e7', 'c3d5'] } : undefined,
    };
    fen = r.fen;
    return ply;
  });
  return ({ id: 41, source: undefined, userColor: 'b' as const, elo: 400, opponentId: 'tom', startFen: START_FEN, startedAt: 1, endedAt: 2, plies, takebacks: 0, hintsUsed: 0, told: [], result: '1-0', reason: 'checkmate', userResult: 'loss' as const, summary: { accuracy: 60, counts: { best: 5, good: 0, inaccuracy: 0, mistake: 0, blunder: 1 } } } as unknown) as GameRecord;
}

describe('Fix your key moments', () => {
  it('picks your key mistakes with a known better move, at most 3, in move order', async () => {
    const { fixMoments } = await import('../lib/upNext');
    const g = await legalGame();
    const plies: PlyRecord[] = g.plies.map((p) => ({ ...p, comment: { text: [], themes: [], ruleIds: [], arrows: [], highlights: [], bestUci: 'a2a3' } }));
    const moments = [
      { ply: 1, by: 'you' as const, swing: -20, text: '' },
      { ply: 2, by: 'them' as const, swing: -20, text: '' },
      { ply: 3, by: 'you' as const, swing: -20, text: '' },
      { ply: 5, by: 'you' as const, swing: -20, text: '' },
      { ply: 7, by: 'you' as const, swing: -20, text: '' },
    ];
    expect(fixMoments({ plies }, { moments }).map((m) => m.ply)).toEqual([1, 3, 5]);
    // No better move known → nothing to retry.
    const bare = g.plies.map((p) => ({ ...p, comment: undefined }));
    expect(fixMoments({ plies: bare }, { moments })).toEqual([]);
  });

  it('finds the real game’s one moment through the review', async () => {
    const { fixMoments } = await import('../lib/upNext');
    const { reviewGame } = await import('../lib/review');
    const g = await legalGame();
    expect(fixMoments(g, reviewGame(g)).map((m) => m.ply)).toEqual([9]);
  });

  it('plays once per game: "fixed" is remembered in the database', async () => {
    const { isFixed, markFixed } = await import('../lib/upNext');
    const g = await legalGame();
    expect(await isFixed(g)).toBe(false);
    await markFixed(g);
    await markFixed(g);
    expect(await isFixed(g)).toBe(true);
    const { kvGet } = await import('../lib/db');
    expect(await kvGet<string[]>('momentsFixed', [])).toEqual(['app:41']);
  });

  it('counts as practice: an attempt for its theme, and the mistake card is reviewed', async () => {
    const { db } = await import('../lib/db');
    const { practiseMoment, momentSpec } = await import('../lib/upNext');
    const g = await legalGame();
    const card = { id: 'm:41:9', kind: 'mistake' as const, fen: g.plies[9].fenBefore, solution: ['d6e5'], themes: ['mate'], label: 'x', createdAt: 0, due: 0, step: 0, reps: 0, lapses: 0 };
    await db.cards.put(card);
    expect(momentSpec(g, 9, card)).toMatchObject({ cardId: 'm:41:9', solution: ['d6e5'], themes: ['mate'], kind: 'mistake' });
    const before = await db.attempts.count();
    await practiseMoment(g, 9, true, 0);
    const a = (await db.attempts.toArray()).slice(before);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ success: true, source: 'review', themes: ['mate'] });
    const after = await db.cards.get('m:41:9');
    expect(after!.reps).toBe(1);
    expect(after!.due).toBeGreaterThan(Date.now());
    // Shown, not found: still practice, but not a clean solve.
    await practiseMoment(g, 9, false, 1);
    expect((await db.attempts.toArray()).at(-1)).toMatchObject({ success: false });
  });

  it('a moment without a card still counts (an attempt, no new card)', async () => {
    const { db } = await import('../lib/db');
    const { practiseMoment } = await import('../lib/upNext');
    const g = { ...(await legalGame()), id: 42 };
    const cards = await db.cards.count();
    await practiseMoment(g, 9, true, 0);
    expect((await db.attempts.toArray()).at(-1)).toMatchObject({ success: true, themes: ['mate'] });
    expect(await db.cards.count()).toBe(cards);
  });
});
