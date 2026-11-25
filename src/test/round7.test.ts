import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: {}, Encoding: {}, Filesystem: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));
vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    },
  };
});

describe('round 7 · 0.2 toasts come one at a time, and wait for sheets and done cards', async () => {
  const { useCelebrate } = await import('../lib/celebrate');
  beforeEach(() => {
    vi.useFakeTimers();
    useCelebrate.setState({ toasts: [], hold: false, muted: false, sheets: 0 });
  });
  afterEach(() => {
    // Drain what's left between tests (the queue lives in the module).
    useCelebrate.setState({ sheets: 0, hold: false });
    vi.advanceTimersByTime(30000);
    vi.useRealTimers();
  });
  it('one at a time, the next after the first goes', () => {
    const c = useCelebrate.getState();
    c.toast({ icon: 'a', title: 'Achievement: Puzzler' });
    c.toast({ icon: 'b', title: 'Achievement: Daily trainer' });
    expect(useCelebrate.getState().toasts.map((t) => t.title)).toEqual(['Achievement: Puzzler']);
    vi.advanceTimersByTime(3500 + 300);
    expect(useCelebrate.getState().toasts.map((t) => t.title)).toEqual(['Achievement: Daily trainer']);
    vi.advanceTimersByTime(3800);
    expect(useCelebrate.getState().toasts).toEqual([]);
  });
  it('a done card holds them until it has settled', () => {
    const c = useCelebrate.getState();
    c.setHold(true, { queue: true });
    c.toast({ icon: 'a', title: 'Achievement: Puzzler' });
    c.toast({ icon: 'b', title: 'Achievement: Daily trainer' });
    expect(useCelebrate.getState().toasts).toEqual([]);
    c.setHold(false);
    vi.advanceTimersByTime(350);
    expect(useCelebrate.getState().toasts).toHaveLength(1);
  });
  it('an open sheet holds them until it closes', () => {
    const c = useCelebrate.getState();
    c.sheetOpen(true);
    c.toast({ icon: 'a', title: 'Weekly goal reached!' });
    vi.advanceTimersByTime(1000);
    expect(useCelebrate.getState().toasts).toEqual([]);
    c.sheetOpen(false);
    vi.advanceTimersByTime(400);
    expect(useCelebrate.getState().toasts.map((t) => t.title)).toEqual(['Weekly goal reached!']);
  });
});

describe('round 7 · 1 real games and Play Coach', async () => {
  const { aidsFor, coachElo, NO_AIDS } = await import('../lib/coach/level');
  const { db, kvGet, kvSet } = await import('../lib/db');
  const { REPERTOIRES, bookMove } = await import('../lib/people/openings');
  const { Chess } = await import('chess.js');
  const base = { checkBeforeMove: true, botNotes: true, safetyOverlay: true, showEvalBar: true, coachStyle: 'detailed' as const, coachLevel: 'full' as const };

  it('no aids in any real game, clock or not', () => {
    expect(aidsFor(base, { coachLevel: 'full' })).toEqual(NO_AIDS);
    expect(aidsFor(base, {})).toEqual(NO_AIDS);
    expect(aidsFor(base)).toEqual(NO_AIDS);
  });
  it('Play Coach keeps the aids and follows Sam talks', () => {
    expect(aidsFor(base, { coach: 'your', coachLevel: 'full' })).toMatchObject({ comments: true, precheck: true, botNotes: true, evalBar: true, openings: true, requests: true });
    expect(aidsFor(base, { coach: 'harder', coachLevel: 'warnings' })).toMatchObject({ comments: false, precheck: true, botNotes: false, evalBar: false, requests: true });
  });
  it('Sam plays at your rating, 150 below or above', () => {
    expect(coachElo(512, 'your')).toBe(512);
    expect(coachElo(512, 'easier')).toBe(362);
    expect(coachElo(512, 'harder')).toBe(662);
    expect(coachElo(200, 'easier')).toBe(100);
  });
  it("Sam's teaching book is legal, classical, and followed to full depth", () => {
    for (const line of REPERTOIRES.coach.lines) {
      const c = new Chess();
      for (const m of line.split(' ')) expect(() => c.move(m)).not.toThrow();
    }
    // As White he opens 1.e4 or 1.d4; against 1.e4 he answers e5 or c6; deep in the Ruy Lopez he still knows the line.
    expect(['e2e4', 'd2d4']).toContain(bookMove('coach', []));
    expect(['e7e5', 'c7c6']).toContain(bookMove('coach', ['e4']));
    expect(bookMove('coach', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6'.split(' '))).toBe('c2c3');
  });

  it('a coach game is practice: no rating change, no badges or ladder, out of Your week', async () => {
    const { finishGame } = await import('../lib/store/finish');
    const { getGameRating } = await import('../lib/rewards/rating');
    const { getOpponentRecords } = await import('../lib/people/record');
    const { weekStats } = await import('../lib/weekly');
    const { weekStart } = await import('../lib/dates');
    await db.games.clear();
    await kvSet('opponentStats', {});
    await kvSet('gameRating', { rating: 512, peak: 512, games: 4, history: [1, 2, 3, 4].map((i) => ({ at: i, rating: 512 })) });
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const after = 'R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1';
    const g = { id: 'play' as const, userColor: 'w' as const, elo: 512, opponentId: 'coach', coach: 'your' as const, coachLevel: 'full' as const, startFen: fen, startedAt: Date.now() - 6e5, takebacks: 2, hintsUsed: 1, told: [],
      plies: [{ uci: 'a1a8', san: 'Ra8#', color: 'w' as const, fenBefore: fen, fenAfter: after, isUser: true, classification: 'best' as const }] };
    const out = await finishGame(g, '1-0', 'checkmate');
    expect(out!.rewards.practice).toBe(true);
    expect(out!.rewards.ratingAfter).toBe(out!.rewards.ratingBefore);
    expect((await getGameRating()).rating).toBe(512);
    expect(await getOpponentRecords()).toEqual({});
    expect(out!.rewards.rivalry).toBeUndefined();
    // Still in Game history (and a training day), but not in Your week's games, accuracy or blunders.
    expect(await db.games.count()).toBe(1);
    const w = await weekStats(weekStart(Date.now()));
    expect([w.games, w.w, w.accuracy, w.blundersPerGame]).toEqual([0, 0, null, null]);
    expect(await kvGet('opponentStats', null)).toEqual({});
  });
});

describe('round 7 · 1.5 / 1.6 badges and challenges for games without help', async () => {
  const { badgesEarned, wasLosing, BADGES } = await import('../lib/people/rivalry');
  const { badgeCount } = await import('../lib/people/record');
  const { challengeFor } = await import('../lib/people/challenges');
  const F = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const plies = (evals: (number | null)[], fenAfter = F) => evals.map((v, i) => ({ isUser: i % 2 === 0, san: 'e4', uci: 'e2e4', fenBefore: F, fenAfter, color: i % 2 ? 'b' : 'w', evalAfter: v === null ? undefined : { type: 'cp', value: v } }));
  const win = (o: Record<string, unknown> = {}) => ({ userResult: 'win', userColor: 'w', hintsUsed: 0, takebacks: 0, reason: 'resignation', match: true, summary: { accuracy: 60 }, plies: plies(Array(40).fill(50)), ...o }) as never;

  it('Comeback (id clean): you were at −3 or worse after move 10, and won', () => {
    expect(BADGES.find((b) => b.id === 'clean')).toMatchObject({ label: 'Comeback', hint: 'Win a game you were losing' });
    const losing = Array(40).fill(50);
    losing[24] = -350;
    expect(wasLosing({ userColor: 'w', plies: plies(losing) } as never)).toBe(true);
    expect(badgesEarned(win({ plies: plies(losing) }), 1)).toContain('clean');
    // Before move 10 doesn't count; −2.9 isn't losing.
    const early = Array(40).fill(50);
    early[12] = -500;
    expect(badgesEarned(win({ plies: plies(early) }), 1)).not.toContain('clean');
    const close = Array(40).fill(50);
    close[30] = -290;
    expect(badgesEarned(win({ plies: plies(close) }), 1)).not.toContain('clean');
    // Black reads the scores the other way round.
    const forBlack = Array(40).fill(-50);
    forBlack[31] = 400;
    expect(wasLosing({ userColor: 'b', plies: plies(forBlack) } as never)).toBe(true);
  });
  it('With a clock (id match): a timed game', () => {
    expect(BADGES.find((b) => b.id === 'match')).toMatchObject({ label: 'With a clock', hint: 'Win a timed game' });
    expect(badgesEarned(win({ timeControl: '600+0' }), 1)).toContain('match');
    expect(badgesEarned(win(), 1)).not.toContain('match');
  });
  it('badges earned under the old meanings stay earned', () => {
    expect(badgeCount({ w: 5, l: 0, d: 0, stars: 0, bestAccuracy: 0, badges: ['white', 'clean', 'match'] })).toBe(3);
  });
  it("Tom's challenge: a won game that reached an endgame (queens off); Mei's: draw or win", () => {
    const tom = challengeFor('tom')!;
    expect(tom).toMatchObject({ title: 'Out-grind the grinder', rewards: ['board-park'] });
    expect(tom.check(win())).toBe(false);
    expect(tom.check(win({ plies: plies(Array(40).fill(50), '6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1') }))).toBe(true);
    expect(tom.check(win({ userResult: 'loss', plies: plies(Array(40).fill(50), '6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1') }))).toBe(false);
    const mei = challengeFor('mei')!;
    expect(mei.description).toBe('Draw or win against Mei.');
    expect(mei.check(win({ userResult: 'draw', hintsUsed: 3 }))).toBe(true);
    expect(mei.check(win({ userResult: 'loss' }))).toBe(false);
  });
});

describe('round 7 · Coach Sam as the opponent', async () => {
  const { COACH_SAM, opponentById, OPPONENTS, pickLine } = await import('../lib/people');
  it('Sam is found by id but stays off the ladder, and quiet mid-game', () => {
    expect(opponentById('coach')).toBe(COACH_SAM);
    expect(OPPONENTS.some((o) => o.id === 'coach')).toBe(false);
    expect(pickLine(COACH_SAM, 'botCapture')).toBe('');
    expect(pickLine(COACH_SAM, 'greet')).toMatch(/hint/);
  });
});
