import { describe, expect, it } from 'vitest';
import { aidsFor, nextLevel, stepDownSuggestion, STEP_DOWN_WINS } from '../lib/coach/level';
import { gapReport, gapSentence } from '../lib/games/gap';
import { defaultMatchTc, mostCommonTimeControl, offeredTimeControls, TIME_CONTROLS } from '../lib/clock';
import type { AnyGame } from '../lib/store/types';

const base = { checkBeforeMove: true, botNotes: true, safetyOverlay: true, showEvalBar: true, coachStyle: 'gentle' as const };

describe('Match conditions and coach levels', () => {
  it('a real game (anything but Play Coach) has every aid off, clock or not', () => {
    for (const g of [undefined, {}, { coachLevel: 'full' as const }]) expect(Object.values(aidsFor({ ...base, coachLevel: 'full' }, g)).every((v) => v === false)).toBe(true);
  });
  it('Play Coach follows Sam talks: All keeps the settings, Only when it matters keeps the blunder check', () => {
    expect(aidsFor({ ...base, coachLevel: 'full' }, { coach: 'your' })).toMatchObject({ comments: true, precheck: true, botNotes: true, safetyOverlay: true, requests: true });
    expect(aidsFor({ ...base, coachLevel: 'warnings' }, { coach: 'your' })).toMatchObject({ comments: false, precheck: true, botNotes: false, safetyOverlay: false, evalBar: false, requests: true });
    // The level a game started with wins over a later change in Settings.
    expect(aidsFor({ ...base, coachLevel: 'full' }, { coach: 'easier', coachLevel: 'warnings' }).comments).toBe(false);
  });
  it('suggests one step down after 5 wins at the current level (since it was chosen)', () => {
    const win = (lvl: 'full' | 'warnings', t: number, over = {}) => ({ coachLevel: lvl, userResult: 'win', endedAt: t, ...over });
    const games = [1, 2, 3, 4].map((t) => win('full', 100 + t));
    expect(stepDownSuggestion(games, 'full', 0)).toBeNull();
    games.push(win('full', 200));
    expect(stepDownSuggestion(games, 'full', 0)).toEqual({ wins: STEP_DOWN_WINS, to: 'warnings' });
    // Wins before the level was chosen, match games, other levels and chess.com games don't count.
    expect(stepDownSuggestion(games, 'full', 150)).toBeNull();
    expect(stepDownSuggestion([...games.slice(0, 4), win('full', 300, { match: true })], 'full', 0)).toBeNull();
    expect(stepDownSuggestion([...games.slice(0, 4), win('full', 300, { source: 'chess.com' })], 'full', 0)).toBeNull();
    expect(nextLevel('warnings')).toBe('silent');
    expect(nextLevel('silent')).toBe('match');
  });
  it('time controls: my usual chess.com one is the default, and is offered if missing', () => {
    const cc = (tc: string) => ({ source: 'chess.com', timeControl: tc });
    expect(mostCommonTimeControl([cc('600+0'), cc('180+0'), cc('180+0'), cc('daily'), cc('daily'), cc('daily'), { timeControl: '300+0' }])).toBe('180+0');
    expect(mostCommonTimeControl([])).toBeNull();
    expect(defaultMatchTc('', '180+0')).toBe('180+0');
    expect(defaultMatchTc('', null)).toBe('600+0');
    expect(defaultMatchTc('300+0', '180+0')).toBe('300+0');
    expect(offeredTimeControls('600+0')).toEqual(TIME_CONTROLS);
    const more = offeredTimeControls('180+0');
    expect(more).toContain('180+0');
    expect(more.length).toBe(TIME_CONTROLS.length + 1);
    expect(more[0]).toBe('180+0');
  });
});

const g = (over: Partial<AnyGame>): AnyGame =>
  ({ userColor: 'w', elo: 700, startFen: '', startedAt: 0, plies: [], takebacks: 0, hintsUsed: 0, told: [], endedAt: 1000, result: '1-0', reason: '', userResult: 'win', summary: { accuracy: 0, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null }, ...over }) as AnyGame;

describe('gap tracker', () => {
  it('compares coached and Match-conditions scores against the same opponents', () => {
    const now = 100 * 864e5;
    const games = [
      ...['win', 'win', 'win', 'loss', 'draw'].map((r) => g({ userResult: r as 'win', elo: 650, endedAt: now - 864e5 })),
      ...['win', 'loss', 'loss', 'loss'].map((r) => g({ userResult: r as 'win', elo: 700, match: true, endedAt: now - 864e5 })),
      g({ userResult: 'win', elo: 1500, endedAt: now - 864e5 }),
      // Too old for the period.
      g({ userResult: 'loss', elo: 650, match: true, endedAt: now - 90 * 864e5 }),
      ...['loss', 'loss', 'win'].map((r) => g({ source: 'chess.com', userResult: r as 'win', elo: 620, endedAt: now - 2 * 864e5 })),
    ];
    const r = gapReport(games, now);
    const band = r.bands.find((b) => b.min === 600)!;
    expect(band.coached).toEqual({ n: 5, pct: 70 });
    expect(band.match).toEqual({ n: 4, pct: 25 });
    expect(r.chessCom).toEqual({ n: 3, pct: 33, avgOpp: 620 });
    expect(r.sentence).toBe('You score 70% with help but 25% in real games vs the same opponents (and 33% on chess.com) — the safety net is doing a lot of work. Play more real games.');
  });
  it('plain sentences for the other cases', () => {
    expect(gapSentence([], { n: 5, pct: 60 }, { n: 0, pct: 0 }, { n: 0, pct: 0 })).toMatch(/^Play a few real games/);
    expect(gapSentence([], { n: 5, pct: 60 }, { n: 1, pct: 100 }, { n: 0, pct: 0 })).toMatch(/^1 real game so far/);
    expect(gapSentence([], { n: 5, pct: 50 }, { n: 5, pct: 70 }, { n: 0, pct: 0 })).toMatch(/don't need the safety net/);
    expect(gapSentence([], { n: 5, pct: 55 }, { n: 5, pct: 50 }, { n: 0, pct: 0 })).toMatch(/holds up without help/);
  });
});
