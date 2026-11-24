import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { plural } from '../lib/plural';

describe('round 5 · 0.4 plurals', () => {
  it('puts the noun in the right number', () => {
    expect(plural(1, 'move')).toBe('1 move');
    expect(plural(0, 'move')).toBe('0 moves');
    expect(plural(2, 'game')).toBe('2 games');
    expect(plural(1204, 'puzzle')).toBe('1,204 puzzles');
    expect(plural(1, 'rated game')).toBe('1 rated game');
  });
});

describe('round 5 · 1.1–1.3 badges: gold, readable, one place on Home', async () => {
  const { BadgeIcon } = await import('../components/BadgeIcon');
  const { BadgeLine, BadgeStrip, BadgeTiles } = await import('../components/Rivalry');
  const rec = { w: 4, l: 0, d: 0, stars: 0, bestAccuracy: 0, badges: ['white', 'clean', 'sharp', 'quick', 'mate'] };
  it('earned badges are a gold disc with a dark icon, not the blunder rose', () => {
    const on = renderToStaticMarkup(createElement(BadgeIcon, { id: 'sharp', on: true }));
    expect(on).toContain('bg-gold-400');
    expect(on).not.toContain('rose');
    const off = renderToStaticMarkup(createElement(BadgeIcon, { id: 'sharp', on: false }));
    expect(off).not.toContain('bg-gold-400');
  });
  it('the opponent card line reads "5/8 · Next: With Black" with 16px icons', () => {
    const html = renderToStaticMarkup(createElement(BadgeLine, { opponentId: 'tom', rec }));
    expect(html.replace(/<!-- -->/g, '')).toContain('5/8</b> · Next: With Black');
    expect(html.match(/width:16px/g)).toHaveLength(8);
    expect(html).toContain('data-testid="badge-line"');
  });
  it('the picker strip draws 18px icons, 3px apart', () => {
    const html = renderToStaticMarkup(createElement(BadgeStrip, { rec, size: 18 }));
    expect(html.match(/width:18px/g)).toHaveLength(8);
    expect(html).toContain('gap-[3px]');
  });
  it('earned tiles are gold-tinted with a gold check', () => {
    const html = renderToStaticMarkup(createElement(BadgeTiles, { rec }));
    expect(html.match(/bg-hue-amber-50 dark:bg-hue-amber-500\/10/g)).toHaveLength(5);
    expect(html).not.toContain('rose');
  });
});

describe('round 5 · 3 start your rating from chess.com', async () => {
  const { db, kvGet, kvSet } = await import('../lib/db');
  const { CC_HIDE_KEY, ccOffer, hideCcOffer, latestCcRating, offerShows, startFromChessCom } = await import('../lib/chesscom/startRating');
  const { getGameRating, restartGameRating, KEPT_PEAK_KEY } = await import('../lib/rewards/rating');
  const { COSMETICS, isUnlocked, unlockContext } = await import('../lib/rewards/cosmetics');
  const cc = (timeClass: string, myRating: number, endedAt: number) => ({ id: `cc:${timeClass}${endedAt}`, timeClass, myRating, endedAt }) as never;
  const ratingLooks = (from: number, to: number) => COSMETICS.filter((c) => c.unlock.kind === 'rating' && c.unlock.n > from && c.unlock.n <= to).map((c) => c.id);
  beforeEach(async () => {
    await db.kv.clear();
    await db.imported.clear();
  });

  it('reads your latest rapid rating, else blitz', () => {
    expect(latestCcRating([cc('rapid', 480, 1), cc('rapid', 512, 3), cc('blitz', 700, 9)])).toEqual({ cls: 'rapid', rating: 512 });
    expect(latestCcRating([cc('bullet', 300, 1), cc('blitz', 610, 2), cc('blitz', 590, 1)])).toEqual({ cls: 'blitz', rating: 610 });
    expect(latestCcRating([cc('bullet', 300, 1), cc('daily', 900, 2)])).toBeNull();
  });

  it('the card shows only with a chess.com rating and a gap of more than 150', () => {
    const r = { cls: 'rapid' as const, rating: 512 };
    expect(offerShows({ user: 'MyName', cc: r, rating: 284, hiddenAt: null })).toBe(true);
    expect(offerShows({ user: 'MyName', cc: r, rating: 740, hiddenAt: null })).toBe(true);
    expect(offerShows({ user: 'MyName', cc: r, rating: 362, hiddenAt: null })).toBe(false);
    expect(offerShows({ user: 'MyName', cc: r, rating: 361, hiddenAt: null })).toBe(true);
    expect(offerShows({ user: 'MyName', cc: null, rating: 284, hiddenAt: null })).toBe(false);
    expect(offerShows({ user: ' ', cc: r, rating: 284, hiddenAt: null })).toBe(false);
  });

  it('"Not now" hides it until the chess.com rating moves by another 150', async () => {
    await db.imported.bulkPut([cc('rapid', 512, 1)]);
    await kvSet('gameRating', { rating: 284, peak: 300, games: 12, history: [] });
    expect((await ccOffer('MyName')).show).toBe(true);
    await hideCcOffer(512);
    expect(await ccOffer('MyName')).toMatchObject({ show: false, cc: { cls: 'rapid', rating: 512 }, rating: 284 });
    await db.imported.bulkPut([cc('rapid', 640, 2)]);
    expect((await ccOffer('MyName')).show).toBe(false);
    await db.imported.bulkPut([cc('rapid', 662, 3)]);
    expect((await ccOffer('MyName')).show).toBe(true);
  });

  it('the start sets rating and peak, unlocks the looks below it and counts them right', async () => {
    await kvSet('gameRating', { rating: 284, peak: 300, games: 12, history: [{ at: 1, rating: 284 }] });
    await kvSet(CC_HIDE_KEY, 300);
    const fresh = ratingLooks(300, 512);
    expect(fresh.length).toBeGreaterThan(0);
    const before = await unlockContext();
    expect(fresh.every((id) => !isUnlocked(COSMETICS.find((c) => c.id === id)!, before))).toBe(true);
    const { newLooks } = await startFromChessCom(512);
    expect(await getGameRating()).toMatchObject({ rating: 512, peak: 512, games: 0 });
    const after = await unlockContext();
    expect(fresh.every((id) => isUnlocked(COSMETICS.find((c) => c.id === id)!, after))).toBe(true);
    expect(newLooks).toBe(fresh.length);
    // Told by the confirmation, so the next results sheet doesn't announce them; nothing rolls.
    expect(await kvGet<string[]>('cosmeticsSeen', [])).toEqual(expect.arrayContaining(fresh));
    expect(await kvGet('lastSeen:home.rating', null)).toBe(512);
    expect(await kvGet(CC_HIDE_KEY, 0)).toBeNull();
    // Already there: no new looks.
    expect((await startFromChessCom(512)).newLooks).toBe(0);
  });

  it('a start below your best keeps the Journey and every look it unlocked', async () => {
    await kvSet('gameRating', { rating: 700, peak: 900, games: 40, history: [] });
    const { newLooks } = await startFromChessCom(512);
    expect(newLooks).toBe(0);
    expect(await getGameRating()).toMatchObject({ rating: 512, peak: 900, games: 0 });
    // The fresh start against the bots restarts the Journey, but what it unlocked stays.
    await restartGameRating(200);
    expect(await getGameRating()).toMatchObject({ rating: 200, peak: 200 });
    expect(await kvGet(KEPT_PEAK_KEY, 0)).toBe(900);
    const ctx = await unlockContext();
    expect(ratingLooks(0, 900).every((id) => isUnlocked(COSMETICS.find((c) => c.id === id)!, ctx))).toBe(true);
  });
});
