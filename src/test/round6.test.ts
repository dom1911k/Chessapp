import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { colourLine } from '../lib/coach/startLine';
import { db, kvSet } from '../lib/db';
import { botsLine, getGameRating, lastRestart, rateGame, restartGameRating } from '../lib/rewards/rating';

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
