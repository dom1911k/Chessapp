// Adapts analysis depth/time to the phone: a quick benchmark once a month.
import { kvGet, kvSet } from '../db';
import { getEngine } from './index';

export interface Limits {
  depth: number;
  movetime: number;
}

const KEY = 'engineSpeed';
const BENCH_FEN = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/2PP4/2N1PN2/PP1BBPPP/R2QK2R w KQ - 4 8';
let limits: Limits = { depth: 12, movetime: 3000 };

export const analysisLimits = (): Limits => limits;

export function limitsFor(ms: number): Limits {
  if (ms <= 700) return { depth: 12, movetime: 3000 };
  if (ms <= 1600) return { depth: 11, movetime: 2200 };
  if (ms <= 3500) return { depth: 10, movetime: 1500 };
  return { depth: 9, movetime: 1000 };
}

export async function calibrate(): Promise<Limits> {
  const saved = await kvGet<{ ms: number; at: number } | null>(KEY, null);
  if (saved && Date.now() - saved.at < 30 * 864e5) {
    limits = limitsFor(saved.ms);
    return limits;
  }
  try {
    const t0 = performance.now();
    await getEngine().analyze(BENCH_FEN, { depth: 10, fresh: true, owner: 'calibrate' });
    const ms = performance.now() - t0;
    await kvSet(KEY, { ms: Math.round(ms), at: Date.now() });
    limits = limitsFor(ms);
  } catch {
    /* keep defaults */
  }
  return limits;
}
