import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fromLegacy, LEGACY_TO_CC, toLegacy } from '../lib/scale';
import { migrateRatingScale, LEGACY_PEAK_KEY, SCALE_KEY, SCALE_NEWS_KEY, SCALE_VERSION } from '../lib/migrate';
import { db, kvGet, kvSet } from '../lib/db';
import { OPPONENTS } from '../lib/people';
import { TUNING } from '../cups/tuning';
import { MAIA3 } from '../lib/maia/maia3tuning';
import { botParams } from '../lib/bot';

describe('chess.com rating scale', () => {
  it('converts old app ratings increasingly, never below 100, and back again', () => {
    for (let i = 1; i < LEGACY_TO_CC.length; i++) {
      expect(LEGACY_TO_CC[i][0]).toBeGreaterThan(LEGACY_TO_CC[i - 1][0]);
      expect(LEGACY_TO_CC[i][1]).toBeGreaterThan(LEGACY_TO_CC[i - 1][1]);
    }
    let prev = -1;
    for (let r = 400; r <= 2000; r += 100) { expect(fromLegacy(r)).toBeGreaterThan(prev); prev = fromLegacy(r); }
    expect(fromLegacy(100)).toBe(100);
    for (const cc of [200, 600, 1000, 1600]) expect(Math.abs(fromLegacy(toLegacy(cc)) - cc)).toBeLessThanOrEqual(1);
  });

  it('characters are 200 apart on the chess.com scale; Cups tiers are 200-wide bands', () => {
    expect(OPPONENTS.map((o) => o.elo)).toEqual([200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800]);
    for (const t of TUNING.ladder.tiers) expect(t.band[1] - t.band[0]).toBe(200);
  });

  it('Maia-3 never runs below SelfElo 700; the classic engines keep their old strength per label', () => {
    for (const [, s] of MAIA3.selfElo) expect(s).toBeGreaterThanOrEqual(700);
    // A chess.com 400 bot searches like the old-scale bot that played like 400.
    expect(botParams(400).depth).toBe(botParams(fromLegacy(toLegacy(400))).depth);
  });

  it('moves stored ratings once, keeping what the old peak earned', async () => {
    await kvSet(SCALE_KEY, 1);
    await kvSet('gameRating', { rating: 1100, peak: 1300, games: 12, history: [{ at: 1, rating: 900 }, { at: 2, rating: 1100 }] });
    await db.games.clear();
    await db.games.add({ elo: 1300, startedAt: 5, endedAt: 6, plies: [] } as never);
    await kvSet('sparring', { rating: 1500, games: 3, w: 1, d: 1, l: 1 });
    await kvSet('cupState', { ratings: { tom: 900 }, yours: [{ elo: 1100 }] });
    expect(await migrateRatingScale()).toBe(true);
    const r = await kvGet<{ rating: number; peak: number; history: { rating: number }[] }>('gameRating', null as never);
    expect(r.rating).toBe(fromLegacy(1100));
    expect(r.peak).toBe(fromLegacy(1300));
    expect(r.history.map((h) => h.rating)).toEqual([fromLegacy(900), fromLegacy(1100)]);
    expect((await db.games.toArray())[0].elo).toBe(fromLegacy(1300));
    expect((await kvGet<{ rating: number }>('sparring', null as never)).rating).toBe(fromLegacy(1500));
    expect(await kvGet('cupState', null)).toMatchObject({ ratings: { tom: fromLegacy(900) }, yours: [{ elo: fromLegacy(1100) }] });
    expect(await kvGet(LEGACY_PEAK_KEY, 0)).toBe(1300);
    expect(await kvGet(SCALE_NEWS_KEY, false)).toBe(true);
    expect(await kvGet(SCALE_KEY, 0)).toBe(SCALE_VERSION);
    // Only once.
    expect(await migrateRatingScale()).toBe(false);
    expect((await db.games.toArray())[0].elo).toBe(fromLegacy(1300));
  });
});
