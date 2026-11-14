import { describe, expect, it } from 'vitest';
import { botThinkMs, critical, difficulty, isRecapture, pressureParams, THINK, timePressure, type ThinkInput } from '../lib/thinktime';

function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const sample = (o: ThinkInput, n = 3000) => {
  const rng = seeded(11);
  return Array.from({ length: n }, () => botThinkMs(o, rng));
};
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))];
const share = (xs: number[], f: (x: number) => boolean) => xs.filter(f).length / xs.length;
const mid: ThinkInput = { elo: 1400, moveNo: 20, leftMs: 400_000, tc: '600+0', topProb: 0.45, sensible: 3, best: 30, second: 0, swing: 20 };

describe('bot think time', () => {
  it('forced moves, book moves and obvious recaptures come at once', () => {
    expect(pct(sample({ ...mid, forced: true }), 1)).toBeLessThan(1300);
    expect(pct(sample({ ...mid, book: true }), 1)).toBeLessThan(1300);
    expect(pct(sample({ ...mid, recapture: true, topProb: 0.7 }), 0.8)).toBeLessThan(1300);
    expect(pct(sample({ ...mid, topProb: 0.95 }), 0.8)).toBeLessThan(1300);
    expect(isRecapture('d4e5', true, 'f6e5')).toBe(true);
    expect(isRecapture('d4e5', false, 'f6e5')).toBe(false);
    expect(isRecapture('d4e5', true, 'f6g4')).toBe(false);
  });

  it('thinks longer on critical moves (only one move holds, or the eval just swung)', () => {
    const calm = pct(sample(mid), 0.5);
    expect(critical({ ...mid, second: -300 })).toBe(true);
    expect(pct(sample({ ...mid, second: -300 }), 0.5)).toBeGreaterThan(calm * 1.3);
    expect(pct(sample({ ...mid, swing: 250 }), 0.5)).toBeGreaterThan(calm * 1.2);
    // Many good options: longer than one clear favourite.
    expect(difficulty({ ...mid, topProb: 0.2 })).toBeGreaterThan(difficulty({ ...mid, topProb: 0.7 }));
    // A long tail of real long thinks at critical moments.
    const crit = sample({ ...mid, second: -300 });
    expect(pct(crit, 0.97)).toBeGreaterThan(2.5 * pct(crit, 0.5));
  });

  it('weaker players play faster; openings are quick', () => {
    expect(pct(sample({ ...mid, elo: 500 }), 0.5)).toBeLessThan(pct(sample({ ...mid, elo: 1800 }), 0.5));
    expect(pct(sample({ ...mid, moveNo: 4 }), 0.5)).toBeLessThan(pct(sample(mid), 0.5) * 0.5);
  });

  it('10+0 averages look human: a few seconds a move in the middlegame, right-skewed', () => {
    const t = sample(mid);
    expect(pct(t, 0.5)).toBeGreaterThan(3000);
    expect(pct(t, 0.5)).toBeLessThan(15000);
    expect(pct(t, 0.9) / pct(t, 0.5)).toBeGreaterThan(1.8);
  });

  it('time pressure starts below a tenth of the start time: faster moves, looser play', () => {
    expect(timePressure(70_000, '600+0')).toBe(0);
    expect(timePressure(30_000, '600+0')).toBeCloseTo(0.5);
    expect(timePressure(0, '600+0')).toBe(1);
    // Short games: pressure from 20 s at least.
    expect(timePressure(19_000, '180+2')).toBeGreaterThan(0);
    const relaxed = pct(sample({ ...mid, leftMs: 70_000 }), 0.5);
    const pressed = sample({ ...mid, leftMs: 15_000 });
    expect(pct(pressed, 0.5)).toBeLessThan(relaxed * 0.5);
    expect(share(pressed, (x) => x < 1300)).toBeGreaterThan(0.3);
    const base = { temperature: 1, minP: 0.01, free: 200 };
    expect(pressureParams(base, 0)).toEqual(base);
    const loose = pressureParams(base, 1);
    expect(loose.temperature).toBeCloseTo(1 + THINK.pressureTemp);
    expect(loose.minP).toBeLessThan(base.minP);
    expect(loose.free).toBeGreaterThan(base.free);
  });

  it('stays within bounds', () => {
    for (const x of sample({ ...mid, second: -400, leftMs: 900_000, tc: '1800+0' })) expect(x).toBeLessThanOrEqual(THINK.maxMs);
    for (const x of sample({ ...mid, leftMs: 5000 })) expect(x).toBeLessThanOrEqual(5000 * THINK.maxShare);
    for (const x of sample({ ...mid, book: true, tc: '180+2', leftMs: 180_000 })) expect(x).toBeGreaterThanOrEqual(THINK.floorMs);
  });
});
