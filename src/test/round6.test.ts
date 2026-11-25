import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { colourLine } from '../lib/coach/startLine';
import { db, kvSet } from '../lib/db';
import { botsLine, getGameRating, lastRestart, rateGame, restartGameRating } from '../lib/rewards/rating';

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    },
  };
});

beforeEach(async () => {
  await db.kv.clear();
});

describe('round 6 · 0.1 nothing found: the target, not a check', async () => {
  const { FixDone } = await import('../screens/review/StepView');
  const F = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 4';
  const g = { plies: [{ san: 'g6', color: 'b', isUser: true, fenBefore: F, comment: { bestSan: 'Nf6' } }, { san: 'Bxd1', color: 'b', isUser: true, fenBefore: F.replace(' 4', ' 5'), comment: { bestSan: 'dxe5' } }] } as never;
  const render = (results: string[]) => renderToStaticMarkup(createElement(FixDone, { g, plies: [0, 1], results: results as never, allFixed: false, onFinish: () => undefined }));
  it('0 of 2 fixed shows the target icon in the grey disc', () => {
    const html = render(['skipped', 'shown']);
    expect(html).toContain('data-testid="fix-done-target"');
    expect(html).toContain('0 of 2 fixed');
  });
  it('1 of 2 fixed keeps the check', () => {
    expect(render(['fixed', 'shown'])).not.toContain('fix-done-target');
  });
});

describe('round 6 · 0.2 the start message', () => {
  it('explains tapping for the first 3 games only', () => {
    expect(colourLine('w', 'Grandpa Tom', 0)).toBe('You have the white pieces, so you move first. Tap a piece, then a square.');
    expect(colourLine('b', 'Grandpa Tom', 2)).toBe('You have the black pieces — Tom moves first. Tap a piece, then a square.');
    expect(colourLine('w', 'Grandpa Tom', 3)).toBe('You have the white pieces.');
    expect(colourLine('b', 'Grandpa Tom', 12)).toBe('You have the black pieces — Tom moves first.');
    expect(colourLine('b', undefined, 12)).toBe('You have the black pieces — your opponent moves first.');
  });
});

describe('round 6 · 0.3 Profile after a restart', () => {
  const day = new Date(2026, 10, 24, 18, 0).getTime();
  it('without a restart: rated games', async () => {
    expect(botsLine({ rating: 284, peak: 300, games: 12, history: Array.from({ length: 12 }, (_, i) => ({ at: i, rating: 284 })) })).toBe('12 rated games');
    expect(botsLine({ rating: 250, peak: 250, games: 0, history: [] })).toBe('0 rated games');
  });
  it('"Started at 512 · 24 Nov" until the next game, then "N games since 24 Nov"', async () => {
    await kvSet('gameRating', { rating: 284, peak: 300, games: 12, history: [] });
    await restartGameRating(512, { keepPeak: true });
    const r = await getGameRating();
    r.history[0].at = day;
    await kvSet('gameRating', r);
    expect(lastRestart(r)).toEqual({ at: day, rating: 512 });
    expect(botsLine(r, day)).toBe('Started at 512 · 24 Nov');
    await rateGame(500, 1, 0);
    expect(botsLine(await getGameRating(), day)).toBe('1 game since 24 Nov');
    await rateGame(500, 0, 0);
    await rateGame(500, 0.5, 0);
    expect(botsLine(await getGameRating(), day)).toBe('3 games since 24 Nov');
  });
});

describe('round 6 · 1 colours like chess.com', async () => {
  const { COLOUR_NEWS_KEY, colourAfterGame, colourChip, getLastColour, migrateColour, nextColour } = await import('../lib/colour');
  const { useSettings, DEFAULT_SETTINGS } = await import('../lib/settings');
  const { kvGet } = await import('../lib/db');
  it('Alternate is the default and gives the opposite of the last game; the first game is White', () => {
    expect(DEFAULT_SETTINGS.colorPref).toBe('alternate');
    expect(nextColour('alternate', null)).toBe('w');
    expect(nextColour('alternate', 'w')).toBe('b');
    expect(nextColour('alternate', 'b')).toBe('w');
    expect(nextColour('w', 'w')).toBe('w');
    expect(nextColour('b', 'b')).toBe('b');
    expect(nextColour('random', 'w', () => 0.2)).toBe('w');
    expect(nextColour('random', 'w', () => 0.8)).toBe('b');
  });
  it('the chip shows the next colour, with the two-tone dot for Alternate', () => {
    expect(colourChip('alternate', 'w')).toEqual({ label: 'Black', dot: 'half' });
    expect(colourChip('alternate', null)).toEqual({ label: 'White', dot: 'half' });
    expect(colourChip('b', 'b')).toEqual({ label: 'Black', dot: 'b' });
    expect(colourChip('w', 'w')).toEqual({ label: 'White', dot: 'w' });
    expect(colourChip('random', 'w')).toEqual({ label: 'Random', dot: 'random' });
  });
  it('a finished game sets the last colour and ends the one-time line', async () => {
    await colourAfterGame('b');
    expect(await getLastColour()).toBe('b');
    expect(await kvGet(COLOUR_NEWS_KEY, true)).toBe(false);
    expect(nextColour('alternate', await getLastColour())).toBe('w');
  });
  it('Rematch swaps colours and updates the last colour', async () => {
    const { rematch } = await import('../screens/play/GameActions');
    const newGame = vi.fn();
    const s = { game: { userColor: 'w', elo: 400, opponentId: 'tom', match: true, timeControl: '600+0' }, newGame } as never;
    rematch(s);
    expect(newGame).toHaveBeenCalledWith('b', 400, undefined, 'tom', { match: true, timeControl: '600+0' });
    await vi.waitFor(async () => expect(await getLastColour()).toBe('b'));
    const s2 = { game: { userColor: 'b', elo: 600, opponentId: 'maya', match: false, timeControl: '' }, newGame } as never;
    rematch(s2);
    expect(newGame).toHaveBeenLastCalledWith('w', 600, undefined, 'maya', { timeControl: '' });
    await vi.waitFor(async () => expect(await getLastColour()).toBe('w'));
  });
  it('the migration moves White to Alternate once and never again', async () => {
    useSettings.setState({ colorPref: 'w' });
    expect(await migrateColour()).toBe(true);
    expect(useSettings.getState().colorPref).toBe('alternate');
    expect(await kvGet(COLOUR_NEWS_KEY, false)).toBe(true);
    // Choosing White afterwards sticks.
    useSettings.setState({ colorPref: 'w' });
    expect(await migrateColour()).toBe(false);
    expect(useSettings.getState().colorPref).toBe('w');
  });
  it('the migration leaves Black and Random alone', async () => {
    for (const pref of ['b', 'random'] as const) {
      await db.kv.clear();
      useSettings.setState({ colorPref: pref });
      expect(await migrateColour()).toBe(false);
      expect(useSettings.getState().colorPref).toBe(pref);
      expect(await kvGet(COLOUR_NEWS_KEY, false)).toBe(false);
    }
  });
});

describe('round 6 · 2 Your week', async () => {
  const { weekStart, nextWeek, weekLabel } = await import('../lib/dates');
  const { ratingSpan, ccSpan, weekStats, showLastWeek, markLastWeekSeen } = await import('../lib/weekly');
  const { WeekBody, firstSentence } = await import('../components/YourWeek');
  const { today } = await import('../lib/db');
  const F = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const mon = new Date(2026, 10, 16, 0, 0).getTime(); // Monday 16 Nov
  const game = (endedAt: number, o: Record<string, unknown> = {}) => ({
    userColor: 'w', elo: 400, opponentId: 'tom', startFen: F, startedAt: endedAt - 6e5, endedAt, takebacks: 0, hintsUsed: 0, told: [], result: '1-0', reason: 'checkmate', userResult: 'win',
    plies: [{ san: 'e4', uci: 'e2e4', fenBefore: F, fenAfter: F, color: 'w', isUser: true, classification: 'mistake', comment: { themes: ['defense'], text: [], ruleIds: [], arrows: [], highlights: [] } }],
    summary: { accuracy: 60, counts: { best: 3, good: 0, inaccuracy: 0, mistake: 1, blunder: 1 }, biggestMistakePly: 0 },
    ...o,
  });
  beforeEach(async () => {
    await Promise.all([db.games.clear(), db.imported.clear(), db.attempts.clear(), db.activity.clear()]);
  });

  it('calendar weeks start on Monday 00:00 local', () => {
    const sun2359 = new Date(2026, 10, 22, 23, 59).getTime();
    const mon0001 = new Date(2026, 10, 23, 0, 1).getTime();
    expect(weekStart(sun2359)).toBe(mon);
    expect(weekStart(mon0001)).toBe(new Date(2026, 10, 23).getTime());
    expect(weekStart(mon)).toBe(mon);
    expect(nextWeek(mon)).toBe(new Date(2026, 10, 23).getTime());
    expect(weekLabel(mon)).toBe('16–22 Nov');
    expect(weekLabel(new Date(2026, 9, 26).getTime())).toBe('26 Oct – 1 Nov');
  });

  it('a Sunday 23:59 game counts in its week, a Monday 00:01 game in the next', async () => {
    await db.games.bulkAdd([game(new Date(2026, 10, 22, 23, 59).getTime()), game(new Date(2026, 10, 23, 0, 1).getTime(), { userResult: 'loss', result: '0-1' })] as never);
    const a = await weekStats(mon);
    const b = await weekStats(nextWeek(mon));
    expect([a.games, a.w, a.l]).toEqual([1, 1, 0]);
    expect([b.games, b.w, b.l]).toEqual([1, 0, 1]);
  });

  it('rating start and end come from the history', () => {
    const h = (d: number, rating: number) => ({ at: new Date(2026, 10, d, 12).getTime(), rating });
    const r = { rating: 326, peak: 330, games: 5, history: [h(10, 270), h(14, 284), h(17, 300), h(20, 326), h(24, 330)] };
    expect(ratingSpan(r, mon, nextWeek(mon))).toEqual({ start: 284, end: 326, rated: 2 });
    // No rated games: the rating stays, no arrow.
    expect(ratingSpan(r, nextWeek(mon, -2), nextWeek(mon, -1))).toEqual({ start: 250, end: 250, rated: 0 });
    // A restart within the week starts it.
    const rs = { rating: 530, peak: 530, games: 1, history: [h(18, 512), h(19, 530)] };
    expect(ratingSpan(rs, mon, nextWeek(mon))).toEqual({ start: 512, end: 530, rated: 1 });
  });

  it('chess.com games count, with their rapid rating line', async () => {
    const cc = (d: number, myRating: number, timeClass = 'rapid') => ({ ...game(new Date(2026, 10, d, 20).getTime()), id: `cc:${d}${timeClass}`, source: 'chess.com', analyzed: false, timeClass, myRating, opponentName: 'anna_k', url: '', pgn: '', timeControl: '600' });
    await db.imported.bulkAdd([cc(12, 505), cc(18, 512), cc(20, 530), cc(21, 700, 'blitz')] as never);
    await db.games.add(game(new Date(2026, 10, 19, 10).getTime()) as never);
    const w = await weekStats(mon);
    expect(w.games).toBe(4);
    expect(w.cc).toBe(3);
    expect(w.ccRating).toEqual({ cls: 'rapid', start: 505, end: 530 });
    expect(ccSpan([{ timeClass: 'blitz', myRating: 600, endedAt: mon + 1000 }], mon, nextWeek(mon))).toEqual({ cls: 'blitz', start: 600, end: 600 });
  });

  it('the focus needs the theme in 2 or more games', async () => {
    await db.games.add(game(mon + 3600e3) as never);
    expect((await weekStats(mon)).focus).toBeNull();
    await db.games.add(game(mon + 7200e3) as never);
    expect((await weekStats(mon)).focus).toEqual({ theme: 'defense', games: 2, of: 2 });
    expect(firstSentence('After your opponent moves, ask "What does that move threaten?" before you make your own plan. Then more.')).toBe('After your opponent moves, ask "What does that move threaten?" before you make your own plan.');
  });

  it('the "last week" state shows once per week, on the day of the first visit, and only after an active week', async () => {
    const tue = new Date(2026, 10, 24, 9).getTime();
    expect(await showLastWeek(tue)).toBe(false); // last week was empty
    await db.kv.delete('weekRecap');
    await db.games.add(game(new Date(2026, 10, 18, 10).getTime()) as never);
    expect(await showLastWeek(tue)).toBe(true);
    expect(await showLastWeek(tue + 3600e3)).toBe(true); // the rest of that day
    expect(await showLastWeek(tue + 864e5)).toBe(false); // the next day
    await db.kv.delete('weekRecap');
    expect(await showLastWeek(tue)).toBe(true);
    await markLastWeekSeen(tue);
    expect(await showLastWeek(tue)).toBe(false);
    // Puzzles alone count as activity.
    await db.games.clear();
    await db.kv.delete('weekRecap');
    await db.attempts.add({ puzzleId: 'x', at: new Date(2026, 10, 18).getTime(), success: true, puzzleRating: 800, ratingBefore: 0, ratingAfter: 0, themes: [], source: 'path', hintsUsed: 0 } as never);
    expect(await showLastWeek(tue)).toBe(true);
    expect(today(new Date(tue))).toBe('2026-11-24');
  });

  it('no "was" without a previous value', async () => {
    await db.games.add(game(mon + 3600e3) as never);
    const w = await weekStats(mon);
    const empty = await weekStats(nextWeek(mon, -1));
    const html = renderToStaticMarkup(createElement(WeekBody, { week: w, prev: empty, tab: 'last', onClose: () => undefined }));
    expect(html).not.toContain('was ');
    expect(html).not.toContain('was –');
    await db.games.add(game(nextWeek(mon, -1) + 3600e3, { summary: { accuracy: 54, counts: { best: 2, good: 0, inaccuracy: 0, mistake: 0, blunder: 2 }, biggestMistakePly: null } }) as never);
    const prev = await weekStats(nextWeek(mon, -1));
    const html2 = renderToStaticMarkup(createElement(WeekBody, { week: w, prev, tab: 'last', onClose: () => undefined }));
    expect(html2).toContain('was 54%');
    expect(html2).toContain('was 2.0');
    // Fewer blunders (1 vs 2): the trend icon is green; accuracy up too.
    expect(html2.match(/data-better="true"/g)).toHaveLength(2);
  });

  it('an empty week says so, without tiles', async () => {
    const w = await weekStats(mon);
    const html = renderToStaticMarkup(createElement(WeekBody, { week: w, prev: w, tab: 'this', onClose: () => undefined }));
    expect(html).toContain('Nothing played this week yet. One game or a few puzzles is enough to start.');
    expect(html).not.toContain('week-tiles');
  });
});
