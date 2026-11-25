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
