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

describe('round 7 · 2.2 human openings below 1000', async () => {
  const { bookDepth, bookMove } = await import('../lib/people/openings');
  it('book depth by rating: 1 move at 200 and 400, then 2, 3, 4, and the whole line from 1200', () => {
    expect([200, 400, 600, 800, 1000, 1200, 1800].map(bookDepth)).toEqual([1, 1, 2, 3, 4, Infinity, Infinity]);
  });
  it("Tom: 1.e4 most of the time, 1.d4 now and then; mostly 1...e5 against 1.e4", () => {
    // A small seeded generator (mulberry32), so the shares are repeatable.
    const rng = (seed: number) => () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const r = rng(7);
    const seq = (_n: number) => r;
    const whites = Array.from({ length: 200 }, (_, i) => bookMove('tom', [], seq(i + 1)));
    const e4 = whites.filter((m) => m === 'e2e4').length / whites.length;
    expect(e4).toBeGreaterThan(0.65);
    expect(whites).toContain('d2d4');
    const replies = Array.from({ length: 200 }, (_, i) => bookMove('tom', ['e4'], seq(i + 3)));
    expect(replies.filter((m) => m === 'e7e5').length / replies.length).toBeGreaterThan(0.7);
  });
  it('Maya plays the Scandinavian with Black, Jonas the King’s Gambit with White', () => {
    expect(bookMove('maya', ['e4'], () => 0)).toBe('d7d5');
    expect(bookMove('maya', ['e4', 'd5', 'exd5'], () => 0)).toBe('d8d5');
    expect(bookMove('jonas', ['e4', 'e5'], () => 0)).toBe('f2f4');
  });
});

describe('round 7 · 2.1 player types for the characters', async () => {
  const { OPPONENTS, opponentById, typesFor } = await import('../lib/people');
  const { quirkById, quirkEffects, TYPE_TUNING } = await import('../lib/playerTypes');
  const { QUIRKS } = await import('../cups/quirks');
  it('each character has its two types (Mei one of four per game); all types exist', () => {
    const table: Record<string, string[]> = {
      lily: ['earlyQueen', 'speedster'], tom: ['turtle', 'endgameGrinder'], maya: ['pawnGrabber', 'timeTrouble'], jonas: ['gambiteer', 'tilter'],
      priya: ['endgameGrinder', 'comebackKid'], marcus: ['pawnStormer', 'trapper'], sofia: ['fastStarter', 'comebackKid'], viktor: ['turtle', 'endgameGrinder'],
    };
    for (const [id, types] of Object.entries(table)) expect(typesFor(opponentById(id))).toEqual(types);
    const mei = opponentById('mei')!;
    const seen = new Set(Array.from({ length: 200 }, (_, i) => typesFor(mei, () => (i % 4) / 4 + 0.01)[0]));
    expect([...seen].sort()).toEqual(['endgameGrinder', 'gambiteer', 'pawnStormer', 'trapper']);
    for (const o of OPPONENTS) for (const t of [...(o.types ?? []), ...(o.typePool ?? [])]) expect(quirkById(t)).toBeTruthy();
    // Viktor is a Turtle and a Grinder (both play on) but resigns proudly.
    expect(opponentById('viktor')!.resign).toBe('proud');
    // Cups use the same types.
    expect(QUIRKS.map((q) => q.id)).toContain('endgameGrinder');
  });
  it('types change how it plays, through the shared hooks', () => {
    const ctx = { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', sans: [], moveNo: 1, bot: 'w' as const, me: 'b' as const, botLeftMs: 600_000, state: {}, fromStart: true };
    expect(quirkEffects(['speedster'], ctx).think).toBe(TYPE_TUNING.speedster.think);
    expect(quirkEffects(['earlyQueen'], ctx).oppo).toBe(TYPE_TUNING.earlyQueen.oppo);
    expect(quirkEffects(['fastStarter'], ctx).elo).toBe(TYPE_TUNING.fastStarter.openingElo);
    expect(quirkEffects(['fastStarter'], { ...ctx, moveNo: 20 }).elo).toBe(TYPE_TUNING.fastStarter.laterElo);
    expect(quirkEffects(['comebackKid'], { ...ctx, botEval: -300 }).elo).toBe(TYPE_TUNING.comebackKid.elo);
    expect(quirkEffects(['turtle', 'endgameGrinder'], ctx).resign).toBe('stubborn');
    expect(quirkEffects(['timeTrouble'], ctx).pressure).toBeGreaterThan(1);
  });
});

describe('round 7 · 2.3 good days and bad days', async () => {
  const { drawForm, formFor, FORM } = await import('../lib/form');
  it('normal around 0, sd about 50, never beyond ±100, whole points', () => {
    let seed = 7;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const xs = Array.from({ length: 4000 }, () => drawForm(rand));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(3);
    expect(sd).toBeGreaterThan(42);
    expect(sd).toBeLessThan(FORM.sd);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(FORM.max);
    expect(xs.every(Number.isInteger)).toBe(true);
  });
  it('only real games: not Play Coach, not a special challenge', () => {
    expect(formFor({}, () => 0.3)).toEqual(expect.any(Number));
    expect(formFor({ coach: 'your' })).toBeUndefined();
    expect(formFor({ challenge: true })).toBeUndefined();
  });
});

describe('round 7 · 2.6 draw offers both ways', async () => {
  const { botAcceptsDraw, botOffersDraw, canOfferDraw, repeatedTwice, DRAWS } = await import('../lib/draws');
  const plies = (n: number) => Array.from({ length: n }, () => ({}));
  it('you can offer from move 10, then again ten moves later; not in Play Coach or Cups', () => {
    expect(canOfferDraw({ plies: plies(17) })).toBe(false);
    expect(canOfferDraw({ plies: plies(18) })).toBe(true);
    expect(canOfferDraw({ plies: plies(18), coach: 'your' })).toBe(false);
    expect(canOfferDraw({ plies: plies(18), cup: {} })).toBe(false);
    expect(canOfferDraw({ plies: plies(30), draws: { userAt: 18 } })).toBe(false);
    expect(canOfferDraw({ plies: plies(38), draws: { userAt: 18 } })).toBe(true);
    expect(canOfferDraw({ plies: plies(38), draws: { pending: 'bot' } })).toBe(false);
  });
  it('the bot accepts when level late or in an endgame, or when worse; below 800 it plays on unless worse', () => {
    const o = { elo: 1200, moveNo: 35, endgame: false, types: [] as string[] };
    expect(botAcceptsDraw({ ...o, evalCp: 40 })).toBe(true);
    expect(botAcceptsDraw({ ...o, evalCp: 80 })).toBe(false);
    expect(botAcceptsDraw({ ...o, evalCp: 40, moveNo: 15 })).toBe(false);
    expect(botAcceptsDraw({ ...o, evalCp: 40, moveNo: 15, endgame: true })).toBe(true);
    expect(botAcceptsDraw({ ...o, evalCp: -200, moveNo: 12 })).toBe(true);
    expect(botAcceptsDraw({ ...o, elo: 600, evalCp: 0 })).toBe(false);
    expect(botAcceptsDraw({ ...o, elo: 600, evalCp: DRAWS.worseCp })).toBe(true);
    expect(botAcceptsDraw({ ...o, evalCp: undefined })).toBe(false);
  });
  it('Turtle and Endgame Grinder accept sooner; Gambiteer, Comeback Kid and Tilter play on', () => {
    const o = { elo: 1600, moveNo: 22, endgame: false, evalCp: 90 };
    expect(botAcceptsDraw({ ...o, types: [] })).toBe(false);
    expect(botAcceptsDraw({ ...o, types: ['turtle'] })).toBe(true);
    expect(botAcceptsDraw({ ...o, types: ['endgameGrinder'] })).toBe(true);
    for (const t of ['gambiteer', 'comebackKid', 'tilter']) expect(botAcceptsDraw({ ...o, evalCp: -400, types: [t] })).toBe(false);
  });
  it('the bot offers from 800: a quiet level endgame or a repetition; at most twice, ten moves apart', () => {
    const quiet = [10, -20, 0, 25, -5, 15];
    const o = { elo: 1000, plies: 60, evals: quiet, endgame: true, repeated: false, types: [] as string[] };
    expect(botOffersDraw(o)).toBe(true);
    expect(botOffersDraw({ ...o, elo: 700 })).toBe(false);
    expect(botOffersDraw({ ...o, endgame: false })).toBe(false);
    expect(botOffersDraw({ ...o, evals: [...quiet.slice(1), 90] })).toBe(false);
    expect(botOffersDraw({ ...o, endgame: false, repeated: true })).toBe(true);
    expect(botOffersDraw({ ...o, draws: { botCount: 2 } })).toBe(false);
    expect(botOffersDraw({ ...o, draws: { botCount: 1, botAt: 50 } })).toBe(false);
    expect(botOffersDraw({ ...o, draws: { botCount: 1, botAt: 40 } })).toBe(true);
    expect(botOffersDraw({ ...o, draws: { pending: 'user' } })).toBe(false);
    expect(botOffersDraw({ ...o, types: ['gambiteer'] })).toBe(false);
  });
  it('a position on the board for the third time counts as repeated', () => {
    const a = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const b = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKBR1 b Qkq - 3 3';
    expect(repeatedTwice([a, b, a])).toBe(false);
    expect(repeatedTwice([a, b, a, b, a.replace('2 3', '6 5')])).toBe(true);
  });
});

describe('round 7 · 2.7 quiet with a clock', async () => {
  const { keepsQuiet, timedQuiet } = await import('../lib/people/quiet');
  it('a clocked real game keeps to the greeting and the end-of-game line; untimed games and Play Coach talk', () => {
    const timed = { timeControl: '600+0' };
    expect(timedQuiet(timed)).toBe(true);
    for (const e of ['greet', 'botWins', 'botLoses', 'draw', 'userResigned'] as const) expect(keepsQuiet(timed, e)).toBe(false);
    for (const e of ['botCheck', 'botCapture', 'botWinning', 'botLosing'] as const) expect(keepsQuiet(timed, e)).toBe(true);
    expect(keepsQuiet({}, 'botCheck')).toBe(false);
    expect(keepsQuiet({ timeControl: '600+0', coach: 'your' }, 'botCheck')).toBe(false);
  });
});
