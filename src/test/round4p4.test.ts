import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameRecord } from '../lib/store/types';

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

/** A short win against Tom: White, no help, 90% accuracy → With White, On your own, Sharp, Quick work. */
const win = (o: Partial<GameRecord> = {}) =>
  ({
    id: 1,
    opponentId: 'tom',
    userResult: 'win',
    userColor: 'w',
    hintsUsed: 0,
    takebacks: 0,
    reason: 'resignation',
    match: false,
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    summary: { accuracy: 90, counts: { best: 10, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 } },
    plies: Array.from({ length: 20 }, (_, i) => ({ isUser: i % 2 === 0, san: 'e4', uci: 'e2e4', fenBefore: '', fenAfter: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', color: i % 2 ? 'b' : 'w' })),
    ...o,
  }) as unknown as GameRecord;

describe('4.1 · badges are the one track per opponent', () => {
  it('one clean mate win earns five badges, and the challenge stays closed', async () => {
    const { kvSet } = await import('../lib/db');
    const { recordOpponentGame } = await import('../lib/people/record');
    await kvSet('opponentStats', {});
    const a = await recordOpponentGame(win({ reason: 'checkmate' }));
    expect(a!.rivalry.newBadges).toEqual(['white', 'clean', 'sharp', 'quick', 'mate']);
    expect(a!.challengeOpened).toBe(false);
  });

  it('opens the special challenge at the seventh badge, then counts it from the next game', async () => {
    const { kvSet } = await import('../lib/db');
    const { getOpponentRecords, recordOpponentGame } = await import('../lib/people/record');
    await kvSet('opponentStats', { tom: { w: 3, l: 1, d: 0, stars: 3, bestAccuracy: 90, badges: ['white', 'clean', 'sharp', 'quick', 'mate'], streak: 0 } });
    // A win with Black: the sixth badge, still closed.
    const a = await recordOpponentGame(win({ userColor: 'b' }));
    expect(a!.rivalry).toMatchObject({ newBadges: ['black'], badges: 6 });
    expect(a!.challengeOpened).toBe(false);
    // A win under match conditions: the seventh opens Tom's challenge (win without hints or take-backs).
    const b = await recordOpponentGame(win({ match: true }));
    expect(b!.rivalry).toMatchObject({ newBadges: ['match'], badges: 7 });
    expect(b!.challengeOpened).toBe(true);
    expect(b!.challengeDone).toBe(false);
    expect((await getOpponentRecords()).tom.challengeOpen).toBe(true);
    // The next clean win completes it (and, as the third win in a row, earns the Hat-trick).
    const c = await recordOpponentGame(win());
    expect(c!.challengeDone).toBe(true);
    expect(c!.rivalry.newBadges).toEqual(['streak']);
  });

  it('writes no rivalry points and no XP', async () => {
    const { kvGet, kvSet } = await import('../lib/db');
    const { getOpponentRecords, recordOpponentGame } = await import('../lib/people/record');
    await kvSet('opponentStats', { tom: { w: 1, l: 0, d: 0, stars: 1, bestAccuracy: 50, rp: 7 } });
    const r = await recordOpponentGame(win());
    expect(r).not.toHaveProperty('xp');
    expect(r!.rivalry).not.toHaveProperty('xp');
    const rec = (await getOpponentRecords()).tom;
    expect(rec.rp).toBe(7); // kept, not written
    expect(rec.stars).toBe(1);
    expect(await kvGet<number>('xp', 0)).toBe(0);
  });

  it('keeps challenges opened by five wins ("five stars") open, once per data set', async () => {
    const { kvGet, kvSet } = await import('../lib/db');
    const { challengeOpen, getOpponentRecords, migrateBadges } = await import('../lib/people/record');
    await kvSet('badgeModel', false);
    await kvSet('opponentStats', { maya: { w: 5, l: 1, d: 0, stars: 5, bestAccuracy: 70, badges: ['white'] }, lily: { w: 2, l: 0, d: 0, stars: 2, bestAccuracy: 70 } });
    expect(await migrateBadges()).toBe(true);
    const recs = await getOpponentRecords();
    expect(challengeOpen(recs.maya)).toBe(true);
    expect(challengeOpen(recs.lily)).toBe(false);
    expect(await kvGet('badgeModel', 0)).toBe(2);
    expect(await migrateBadges()).toBe(false);
  });

  it('round 5: a challenge open at five badges stays open now that seven are needed', async () => {
    const { kvGet, kvSet } = await import('../lib/db');
    const { challengeOpen, getOpponentRecords, migrateBadges } = await import('../lib/people/record');
    // Step 1 (five wins) already ran in round 4; only the five-badge step runs now.
    await kvSet('badgeModel', true);
    const five = ['white', 'clean', 'sharp', 'quick', 'mate'];
    await kvSet('opponentStats', { tom: { w: 3, l: 0, d: 0, stars: 3, bestAccuracy: 90, badges: five }, jonas: { w: 4, l: 0, d: 0, stars: 4, bestAccuracy: 90, badges: five.slice(0, 4) }, lily: { w: 6, l: 0, d: 0, stars: 5, bestAccuracy: 90, badges: ['white'] } });
    expect(await migrateBadges()).toBe(true);
    const recs = await getOpponentRecords();
    expect(recs.tom.challengeOpen).toBe(true);
    expect(challengeOpen(recs.tom)).toBe(true);
    expect(challengeOpen(recs.jonas)).toBe(false);
    expect(challengeOpen(recs.lily)).toBe(false);
    expect(await kvGet('badgeModel', 0)).toBe(2);
  });

  it('"Best friends" (stars-3) is all eight badges with one opponent', async () => {
    const { ACHIEVEMENTS } = await import('../lib/progress/achievements');
    const a = ACHIEVEMENTS.find((x) => x.id === 'stars-3')!;
    expect(a.title).toBe('Best friends');
    expect(a.description).toBe('Collect all 8 badges with one opponent.');
    expect(a.check({ maxBadges: 7 } as never)).toBe(false);
    expect(a.check({ maxBadges: 8 } as never)).toBe(true);
  });

  it('the opponent card shows the eight badge icons and "3/8 badges"', async () => {
    const { BadgeStrip } = await import('../components/Rivalry');
    const html = renderToStaticMarkup(createElement(BadgeStrip, { rec: { w: 3, l: 0, d: 0, stars: 0, bestAccuracy: 0, badges: ['white', 'clean', 'mate'] } }));
    expect(html.match(/data-badge="/g)).toHaveLength(8);
    expect(html.match(/data-on=""/g)).toHaveLength(3);
    expect(html).toContain('3/8<span class="max-[380px]:hidden"> badges</span>');
    expect(html).not.toMatch(/star/i);
  });
});

describe('4.2 · no account XP', () => {
  it('a puzzle and an achievement write no XP', async () => {
    const { kvGet, kvSet } = await import('../lib/db');
    const { recordAttempt } = await import('../lib/puzzles/record');
    const { checkAchievements } = await import('../lib/progress/achievements');
    await kvSet('xp', 0);
    await recordAttempt({ id: 'x1', kind: 'lichess', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', solution: ['a1a2'], themes: ['mateIn1'], rating: 800 }, true, 0, 'learn');
    await checkAchievements({}, { quiet: true });
    expect(await kvGet<number>('xp', 0)).toBe(0);
  });

  it('a lesson-only day still counts for the weekly goal', async () => {
    const { db, today } = await import('../lib/db');
    const { progress } = await import('../lib/progress');
    await db.activity.delete(today());
    await progress({ kind: 'lesson', first: true });
    const row = await db.activity.get(today());
    expect(row?.other).toBe(1);
    expect(row?.xp).toBeUndefined();
  });

  it('re-gates the level looks to Journey ratings, without locking anything already earned', async () => {
    const { cosmeticById, JOURNEY_LOOKS, meets, unlockText } = await import('../lib/rewards/cosmetics');
    const table: [string, number][] = [['hl-sky', 300], ['board-cherry', 350], ['fx-hearts', 400], ['board-forest', 450], ['pieces-shadow', 550], ['hl-lavender', 650], ['board-sandstone', 750], ['fx-snow', 1050]];
    for (const [id, n] of table) expect(cosmeticById(id)!.unlock).toMatchObject({ kind: 'rating', n });
    expect(JOURNEY_LOOKS.map((l) => l.rating)).toEqual(table.map(([, n]) => n));
    const ctx = { level: 1, peak: 250, achievements: {}, challenges: new Set<string>(), gold: 0 };
    const sky = cosmeticById('hl-sky')!.unlock;
    expect(meets(sky, ctx)).toBe(false);
    expect(meets(sky, { ...ctx, peak: 300 })).toBe(true);
    // Someone who reached level 2 before XP went away keeps it.
    expect(meets(sky, { ...ctx, level: 2 })).toBe(true);
    expect(unlockText(sky)).toBe('Reach 300 on your journey');
  });

  it('frames come from the Journey; titles are your milestones, old level titles stay for those who had them', async () => {
    const { FRAMES, TITLES } = await import('../lib/avatars');
    const { meets } = await import('../lib/rewards/cosmetics');
    expect(FRAMES.find((f) => f.id === 'bronze')!.unlock).toMatchObject({ kind: 'rating', n: 500 });
    expect(FRAMES.find((f) => f.id === 'silver')!.unlock).toMatchObject({ kind: 'rating', n: 1000 });
    expect(FRAMES.find((f) => f.id === 'gold')!.unlock).toMatchObject({ kind: 'rating', n: 1500 });
    const ctx = { level: 6, peak: 250, achievements: {}, challenges: new Set<string>(), gold: 0 };
    expect(meets(FRAMES.find((f) => f.id === 'silver')!.unlock, ctx)).toBe(true);
    expect(TITLES[0]).toMatchObject({ label: 'Newcomer', unlock: { kind: 'free' } });
    expect(TITLES.find((t) => t.label === 'Park Rookie')!.unlock).toMatchObject({ kind: 'rating', n: 500 });
    expect(TITLES.find((t) => t.label === 'Café Regular')).toBeTruthy();
    expect(new Set(TITLES.map((t) => t.label)).size).toBe(TITLES.length);
    expect(TITLES.find((t) => t.id === 'lvl6')).toMatchObject({ legacy: true, unlock: { kind: 'level', n: 6 } });
  });

  it('"Level 5" and "Level 10" keep their ids and become Journey milestones', async () => {
    const { ACHIEVEMENTS } = await import('../lib/progress/achievements');
    const l5 = ACHIEVEMENTS.find((a) => a.id === 'level-5')!;
    const l10 = ACHIEVEMENTS.find((a) => a.id === 'level-10')!;
    expect([l5.title, l5.description]).toEqual(['Park Rookie', 'Reach 500 on your journey.']);
    expect([l10.title, l10.description]).toEqual(['Club Member', 'Reach 1000 on your journey.']);
    expect(l5.check({ peak: 499 } as never)).toBe(false);
    expect(l5.check({ peak: 500 } as never)).toBe(true);
  });

  it('the results sheet shows Rating, Accuracy and Game rating, and no level or XP', async () => {
    const { RewardsOverlay } = await import('../components/RewardsOverlay');
    const rewards = { userResult: 'win', reason: 'checkmate', opponentId: 'tom', accuracy: 84.2, challengeOpened: false, challengeDone: false, ratingBefore: 250, ratingAfter: 284, gameRating: 650, milestones: [], achievements: [], unlocks: [], tactics: {}, skillsUp: [], skillsGained: [], rivalry: { newBadges: ['white', 'mate'], badges: 3, held: ['white', 'clean', 'mate'] } } as never;
    const html = renderToStaticMarkup(createElement(RewardsOverlay, { r: rewards, onClose: () => {} }));
    expect(html).toContain('Game rating');
    expect(html).toContain('Accuracy');
    expect(html.replace(/<!-- -->/g, '')).toContain('Grandpa Tom · 2 new badges');
    expect(html).not.toMatch(/\bXP\b|Level up|Level \d|row-level/);
    // Without a game rating (a short game), just the first two tiles.
    const short = renderToStaticMarkup(createElement(RewardsOverlay, { r: { ...(rewards as object), gameRating: undefined } as never, onClose: () => {} }));
    expect(short).not.toContain('Game rating');
    expect(short).toContain('grid-cols-2');
  });

  it('Home’s header shows your rating, not a level', async () => {
    const { HomeHero } = await import('../components/HomeHero');
    const html = renderToStaticMarkup(createElement(HomeHero, {}));
    expect(html).toContain('data-testid="home-rating"');
    expect(html).toContain('Rating');
    expect(html).not.toMatch(/Level|XP/);
  });
});

describe('4.4 · a smaller Laurel shop', () => {
  it('raising one of the four spends Laurels and is saved (the rest: see cups.test.ts)', async () => {
    const { useCupsMeta } = await import('../cups/meta');
    useCupsMeta.setState({ laurels: 20, levels: {} });
    expect(await useCupsMeta.getState().upgrade('steadyHand')).toBe(false);
    expect(useCupsMeta.getState().laurels).toBe(20);
    expect(await useCupsMeta.getState().upgrade('rewind')).toBe(true);
    expect(useCupsMeta.getState().levels.rewind).toBe(2);
  });

});
