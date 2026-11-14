import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chooseHumanMove, humanParams, maia3SelfElo, setBrain, shiftedTemperature, vetoChance } from '../lib/maia';
import { MAIA3 } from '../lib/maia/maia3tuning';

describe('human-like move choice (Maia-3 tuning)', () => {
  beforeAll(() => setBrain('maia3'));
  afterAll(() => setBrain(null));
  const logits = new Map([['e2e4', 2.0], ['d2d4', 1.2], ['g1f3', 0.3], ['a2a4', -6]]);
  const seq = (n: number) => { let i = 0; return () => ((i++ * 0.6180339887) % 1 + 1 / (2 * n)) % 1; };
  const tally = (cands?: Map<string, number>, elo = 1200) => {
    const r = seq(4000); const c: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) { const m = chooseHumanMove(logits, elo, cands, r)!; c[m] = (c[m] ?? 0) + 1; }
    return c;
  };

  it('samples close to the model itself: temperature 1 at every rating', () => {
    for (const elo of [400, 800, 1200, 1600, 2000]) expect(humanParams(elo).temperature).toBeCloseTo(1, 1);
    const c = tally();
    // Plain softmax: e4 ≈ 0.63, d4 ≈ 0.28, Nf3 ≈ 0.11.
    expect(c.e2e4 / 4000).toBeGreaterThan(0.55);
    expect(c.e2e4 / 4000).toBeLessThan(0.7);
    expect(c.g1f3 / 4000).toBeGreaterThan(0.06);
    expect(c.a2a4 ?? 0).toBe(0);
  });

  it('weak bots keep their howlers; strong bots rarely play them', () => {
    const cands = new Map([['e2e4', 30], ['d2d4', -20], ['g1f3', -700]]);
    const weak = tally(cands, 400).g1f3 ?? 0;
    const strong = tally(cands, 2000).g1f3 ?? 0;
    expect(weak).toBeGreaterThan(tally(undefined, 400).g1f3 * 0.6);
    expect(strong).toBeLessThan(weak * 0.5);
  });

  it('the veto only applies now and then, from 1600', () => {
    expect(vetoChance(1400, 'maia3')).toBe(0);
    expect(vetoChance(1600, 'maia3')).toBeGreaterThan(0);
    expect(vetoChance(2000, 'maia3')).toBeLessThan(1);
  });

  it('the rating map is increasing, so a stronger label is a stronger model', () => {
    let prev = -Infinity;
    for (let elo = 400; elo <= 2000; elo += 100) { expect(maia3SelfElo(elo)).toBeGreaterThan(prev); prev = maia3SelfElo(elo); }
    expect(MAIA3.size).toBe('23m');
  });

  it('quirk temperature offsets keep their relative size on Maia-3', () => {
    const m1 = humanParams(1200, 'maia1').temperature;
    const rel1 = shiftedTemperature(1200, 0.5, 'maia1') / m1;
    const rel3 = shiftedTemperature(1200, 0.5, 'maia3') / humanParams(1200, 'maia3').temperature;
    expect(rel3).toBeCloseTo(rel1, 5);
    expect(shiftedTemperature(1200, -5, 'maia3')).toBeGreaterThan(0);
    expect(shiftedTemperature(1200, 0, 'maia3')).toBeCloseTo(1, 5);
  });
});
