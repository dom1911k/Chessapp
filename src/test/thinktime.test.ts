import { describe, expect, it } from 'vitest';
import { botThinkMs, critical, difficulty, isRecapture, pressureParams, tcStretch, THINK, timePressure, type ThinkInput } from '../lib/thinktime';

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
  it('forced moves and obvious recaptures come at once; known opening moves nearly so', () => {
    expect(pct(sample({ ...mid, forced: true }), 1)).toBeLessThan(1300);
    // A book move takes a second or two, as people play the moves they know (round 7).
    expect(pct(sample({ ...mid, book: true }), 1)).toBeLessThanOrEqual(THINK.bookMs[1] + 1);
    expect(pct(sample({ ...mid, book: true }), 0.5)).toBeLessThan(pct(sample(mid), 0.5) / 2);
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

  it('time pressure starts below a twentieth of the start time (at least 25 s): faster moves, looser play', () => {
    // Fitted to people's games lost on time at 10+0 and 5+0 (round 7).
    expect(timePressure(31_000, '600+0')).toBe(0);
    expect(timePressure(15_000, '600+0')).toBeCloseTo(0.5);
    expect(timePressure(0, '600+0')).toBe(1);
    // Short games: pressure from 25 s at least; an increment eases it (five of them count).
    expect(timePressure(19_000, '180+0')).toBeGreaterThan(0);
    expect(timePressure(19_000, '180+2')).toBe(0);
    expect(timePressure(9_000, '180+2')).toBeGreaterThan(0);
    const relaxed = pct(sample({ ...mid, leftMs: 70_000 }), 0.5);
    const pressed = sample({ ...mid, leftMs: 11_000 });
    expect(pct(pressed, 0.5)).toBeLessThan(relaxed * 0.5);
    expect(share(pressed, (x) => x < 1300)).toBeGreaterThan(0.2);
    const base = { temperature: 1, minP: 0.01, free: 200 };
    expect(pressureParams(base, 0)).toEqual(base);
    const loose = pressureParams(base, 1);
    expect(loose.temperature).toBeCloseTo(1 + THINK.pressureTemp);
    expect(loose.minP).toBeLessThan(base.minP);
    expect(loose.free).toBeGreaterThan(base.free);
  });

  it('stays within bounds', () => {
    for (const x of sample({ ...mid, second: -400, leftMs: 900_000, tc: '1800+0' })) expect(x).toBeLessThanOrEqual(THINK.maxMs);
    // With an increment the cap still holds when the clock is low.
    for (const x of sample({ ...mid, leftMs: 5000, tc: '180+2' })) expect(x).toBeLessThanOrEqual(5000 * THINK.maxShare);
    for (const x of sample({ ...mid, book: true, tc: '180+2', leftMs: 180_000 })) expect(x).toBeGreaterThanOrEqual(THINK.floorMs);
  });
});

import { timeVsBand } from '../lib/timestats';
describe('time use compared with your rating band', () => {
  const bands = [{ band: '300–500', think: { opening: 6.8, middlegame: 9.7, endgame: 5.3 } }, { band: '500–700', think: { opening: 6, middlegame: 10.5, endgame: 5 } }];
  // 20 plies, you are White; every move is "opening" for the phase function below up to ply 9.
  const plies = Array.from({ length: 24 }, (_, i) => ({ color: i % 2 ? 'b' : 'w', isUser: i % 2 === 0, san: 'x', uci: 'e2e4', fenBefore: String(i), fenAfter: '' })) as never[];
  const phase = (fen: string) => (Number(fen) < 12 ? 'opening' : 'middlegame') as 'opening' | 'middlegame';
  const clocksFor = (openSecs: number, midSecs: number) => {
    const left = { w: 600, b: 600 };
    return Array.from({ length: 24 }, (_, i) => { const s = i % 2 ? 'b' : 'w'; left[s] -= s === 'b' ? 5 : i < 12 ? openSecs : midSecs; return left[s]; });
  };
  it('shows a phase only when you differ by more than 50%', () => {
    const line = timeVsBand(plies, clocksFor(14, 10), '600', 'w', 520, bands, phase);
    expect(line).toBe('You spent 14 s per opening move; players at 500 spend about 6.');
    expect(timeVsBand(plies, clocksFor(7, 11), '600', 'w', 520, bands, phase)).toBeNull();
    expect(timeVsBand(plies, clocksFor(7, 3), '600', 'w', 520, bands, phase)).toBe('You spent 3 s per middlegame move; players at 500 spend about 11.');
  });
  it('scales the 10+0 benchmark to other time controls and skips daily games', () => {
    expect(timeVsBand(plies, clocksFor(3, 5), '300', 'w', 520, bands, phase)).toBeNull();
    expect(timeVsBand(plies, clocksFor(14, 10), 'daily', 'w', 520, bands, phase)).toBeNull();
  });

});

describe('think time across time controls (round 7)', () => {
  it('other time controls stretch the think by (budget / 10+0 budget)^k, not in proportion (round 7)', () => {
    expect(tcStretch('600+0', 1000, 20)).toBe(1);
    // 30+0 has three times the budget: the think grows, but by less than three times.
    const long = { ...mid, tc: '1800+0', leftMs: mid.leftMs * 3 };
    const ratio = pct(sample(long), 0.5) / pct(sample(mid), 0.5);
    expect(ratio).toBeGreaterThan(1.05);
    expect(ratio).toBeLessThan(2.9);
    // Stronger players scale their think more with the clock (k grows with rating).
    const k = (elo: number, moveNo = 20) => Math.log(tcStretch('1800+0', elo, moveNo) * 3) / Math.log(3);
    expect(k(2000)).toBeGreaterThan(k(200));
    // The opening's k is k × openingK (fitted: people's opening scales with the clock like the rest).
    expect(k(1400, 5)).toBeCloseTo(k(1400) * THINK.openingK);
    // Blitz: more than a proportional share of the (smaller) budget.
    expect(tcStretch('180+2', 1000, 20)).toBeGreaterThan(1);
  });

  it('below 10 s with no increment only hand speed is left, so a bot can lose on time (round 7)', () => {
    const low = { ...mid, leftMs: 4000, tc: '300+0' };
    const forced = sample({ ...low, forced: true });
    expect(Math.min(...forced)).toBeGreaterThanOrEqual(THINK.handInstantMs[0]);
    expect(Math.max(...forced)).toBeLessThanOrEqual(THINK.handInstantMs[1] + 1);
    const moves = sample(low);
    expect(Math.min(...moves)).toBeGreaterThanOrEqual(THINK.handInstantMs[0]);
    expect(Math.max(...moves)).toBeLessThanOrEqual(THINK.handMaxMs + 1);
    // Weaker players move the pieces slower.
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(sample({ ...low, elo: 400 }))).toBeGreaterThan(avg(sample({ ...low, elo: 2000 })));
    // At 1.5 s left a beginner's normal move can take longer than the clock has: the flag can fall.
    expect(sample({ ...low, elo: 500, leftMs: 1500 }).some((x) => x > 1500)).toBe(true);
    // With an increment the old cap still applies.
    expect(Math.max(...sample({ ...low, tc: '300+2' }))).toBeLessThanOrEqual(4000 * THINK.maxShare);
  });

  it('under pressure, players up to 800 now and then forget the clock (Time Trouble more often)', () => {
    const pressed = { ...mid, elo: 600, leftMs: 15_000, tc: '600+0' };
    // Longer than the time-pressure cap allows: only a player who forgot the clock thinks that long.
    const long = (xs: number[]) => xs.filter((x) => x > 15_000 * THINK.maxShare * 0.75 + 1).length / xs.length;
    expect(long(sample(pressed))).toBeGreaterThan(0);
    expect(long(sample({ ...pressed, forget: 3 }))).toBeGreaterThan(long(sample(pressed)));
    expect(long(sample({ ...pressed, elo: 1400 }))).toBe(0);
  });
});
