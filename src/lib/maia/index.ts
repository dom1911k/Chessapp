// Human-like opponents with Maia. The networks predict what a human of a given
// rating would play; we sample from that, with a temperature per opponent level.
import { Chess } from 'chess.js';
import type { PlayStyle } from '../people';
import { useSettings } from '../settings';
import { maia3Logits } from '../maia3';
import { MAIA3 } from './maia3tuning';
import { getPlayerRating } from '../playerRating';

/** Which model plays: Maia-3 (one model, any rating) or the classic Maia-1 nets (fallback). */
export type Brain = 'maia1' | 'maia3';
let brainOverride: Brain | null = null;
/** Scripts (calibration) choose the brain explicitly; the app follows the setting. */
export const setBrain = (b: Brain | null) => void (brainOverride = b);
export function currentBrain(): Brain {
  if (brainOverride) return brainOverride;
  try {
    return useSettings.getState().maiaVersion ?? 'maia3';
  } catch {
    return 'maia3';
  }
}

export { getPlayerRating, setPlayerRating } from '../playerRating';

/** Maia-3's SelfElo for an opponent label. */
export const maia3SelfElo = (elo: number) => lerp(MAIA3.selfElo, elo);

/** Bundled Maia networks (public/maia). */
export const MAIA_RATINGS = [1100, 1200, 1400, 1600, 1800, 1900] as const;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (m: Map<string, number>) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./maia.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; logits?: [string, number][]; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(new Map(e.data.logits));
    };
  }
  return worker;
}

function lerp(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

/**
 * Which network and temperature play at a given strength. Below 1100 the 1100
 * net plays "looser" (higher temperature = more human slips); above it, lower
 * temperatures spread the networks further apart. Tuned with
 * scripts/maia/calibrate.mts so neighbouring opponents are ~200 points apart.
 */
export function maiaParams(elo: number): { rating: number; temperature: number } {
  const temperature = lerp([[400, 2.6], [600, 1.9], [800, 1.45], [1000, 1.12], [1100, 1.0], [1200, 1.0], [1400, 0.8], [1600, 0.7], [1800, 0.6], [2000, 0.5]], elo);
  if (elo < 1100) return { rating: 1100, temperature };
  const rating = MAIA_RATINGS.reduce((a, b) => (Math.abs(b - elo) < Math.abs(a - elo) ? b : a));
  return { rating, temperature };
}

/** Samples a move from a temperature-scaled softmax over logits. */
export function sampleMove(logits: Map<string, number>, temperature: number, rand: () => number = Math.random): string | null {
  const entries = [...logits].filter(([, v]) => v > -1e8);
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v));
  const weights = entries.map(([, v]) => Math.exp((v - max) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i][0];
  }
  return entries[entries.length - 1][0];
}

/**
 * From 1500 up, Stockfish vetoes Maia's blunders: only moves that lose at most
 * this many centipawns compared with the best move may be played.
 */
export function vetoLimit(elo: number, brain: Brain = currentBrain()): number | null {
  if (brain === 'maia3') return elo < MAIA3.vetoFrom ? null : lerp(MAIA3.vetoLimit, elo);
  return elo < 1500 ? null : lerp([[1500, 500], [1600, 400], [1800, 200], [2000, 120]], elo);
}

/** How often the veto is used: even "only big blunders" is worth hundreds of rating points. */
export function vetoChance(elo: number, brain: Brain = currentBrain()): number {
  if (brain === 'maia3') return elo < MAIA3.vetoFrom ? 0 : lerp(MAIA3.vetoChance, elo);
  return lerp([[1400, 0], [1600, 0.2], [1800, 0.5], [2000, 0.8]], elo);
}

/**
 * Picks a move from Maia's logits. `candidates` (from a Stockfish MultiPV search)
 * maps moves to their centipawn score for the mover; with a veto limit, only
 * candidates close enough to the best are allowed.
 */
export function chooseMaiaMove(logits: Map<string, number>, temperature: number, elo: number, candidates?: Map<string, number>, rand: () => number = Math.random): string | null {
  const limit = vetoLimit(elo);
  if (limit === null || !candidates?.size || rand() >= vetoChance(elo)) return sampleMove(logits, temperature, rand);
  const best = Math.max(...candidates.values());
  const ok = new Map([...logits].filter(([m]) => candidates.has(m) && best - candidates.get(m)! <= limit));
  return sampleMove(ok.size ? ok : logits, temperature, rand);
}

/**
 * How a human-like opponent of a given strength chooses among Maia's moves.
 * - topP / minP cut off the long tail: moves almost no human plays are never sampled.
 * - Moves that lose more than `free` centipawns are made rarer, smoothly (scale `lossScale`):
 *   small inaccuracies stay common, outright howlers become rare instead of random.
 * - To keep the overall strength the same, the temperature is a little higher, so the bot
 *   more often plays its second or third choice — slightly worse moves, not blunders.
 */
export function humanParams(elo: number, brain: Brain = currentBrain()): { rating: number; temperature: number; topP: number; minP: number; lossScale: number; free: number; soft: number } {
  if (brain === 'maia3')
    return {
      rating: maia3SelfElo(elo),
      temperature: lerp(MAIA3.temperature, elo),
      topP: lerp(MAIA3.topP, elo),
      minP: lerp(MAIA3.minP, elo),
      lossScale: lerp(MAIA3.lossScale, elo),
      free: lerp(MAIA3.free, elo),
      soft: lerp(MAIA3.soft, elo),
    };
  const base = maiaParams(elo);
  // Tuned with scripts/maia/versus.mts (same strength as plain sampling) and
  // scripts/maia/losses.mts (share of blunders). Weak opponents keep most of their blunders.
  return {
    rating: base.rating,
    temperature: base.temperature * lerp([[400, 1.0], [800, 1.3], [1000, 1.8], [1200, 2.25], [1600, 2.25], [2000, 1.2]], elo),
    topP: lerp([[400, 0.995], [800, 0.985], [1200, 0.975], [2000, 0.975]], elo),
    minP: lerp([[400, 0.004], [800, 0.008], [1200, 0.01], [2000, 0.01]], elo),
    lossScale: lerp([[400, 1200], [800, 600], [1000, 285], [1200, 150], [1600, 120], [2000, 90]], elo),
    free: lerp([[400, 400], [800, 350], [1000, 290], [1200, 250], [1600, 170], [2000, 110]], elo),
    soft: lerp([[400, 0], [800, 19], [1000, 19], [1200, 24], [1600, 14], [2000, 2]], elo),
  };
}

/** Maia's move probabilities (plain softmax), most likely first. */
export function moveProbs(logits: Map<string, number>): [string, number][] {
  const entries = [...logits].filter(([, v]) => v > -1e8);
  if (!entries.length) return [];
  const max = Math.max(...entries.map(([, v]) => v));
  const w = entries.map(([, v]) => Math.exp(v - max));
  const total = w.reduce((x, y) => x + y, 0);
  return entries.map(([m], i) => [m, w[i] / total] as [string, number]).sort((x, y) => y[1] - x[1]);
}

/**
 * Picks a human-like move. `candidates` (from a Stockfish MultiPV search) maps moves to their
 * centipawn score for the mover; moves it does not list count as clear errors.
 */
export function chooseHumanMove(logits: Map<string, number>, elo: number, candidates?: Map<string, number>, rand: () => number = Math.random, opts: { style?: PlayStyle; params?: Partial<ReturnType<typeof humanParams>>; brain?: Brain } = {}): string | null {
  const brain = opts.brain ?? currentBrain();
  const p = { ...humanParams(elo, brain), ...opts.params };
  const probs = moveProbs(logits);
  if (!probs.length) return null;
  // The moves people actually play: the top of the distribution, never the stray tail.
  const kept: [string, number][] = [];
  let cum = 0;
  for (const [m, pr] of probs) {
    if (kept.length && (cum >= p.topP || pr < p.minP)) break;
    kept.push([m, pr]);
    cum += pr;
  }
  const t = opts.style === 'wild' ? p.temperature * 1.1 : p.temperature;
  let best = -Infinity;
  let worst = Infinity;
  if (candidates?.size) {
    best = Math.max(...candidates.values());
    worst = Math.min(...candidates.values());
  }
  // Maia-1: the veto always applies from 1500. Maia-3: only now and then, from 1600.
  const limit = brain === 'maia1' || rand() < vetoChance(elo, brain) ? vetoLimit(elo, brain) : null;
  const weights = kept.map(([m, pr]) => {
    let w = Math.pow(pr, 1 / t);
    if (candidates?.size) {
      // A move the engine did not even list is worse than everything it did: treat it as a real error.
      const loss = Math.min(1500, candidates.has(m) ? best - candidates.get(m)! : Math.max(best - worst + 100, 350));
      w *= Math.exp(-Math.max(0, loss - p.free) / p.lossScale);
      // Slightly worse moves get a lift: this is where the strength is given back.
      if (loss >= 30 && loss <= p.free + 60) w *= 1 + p.soft;
      if (limit !== null && loss > limit) w *= 0.02;
    }
    return w;
  });
  const total = weights.reduce((x, y) => x + y, 0);
  if (!(total > 0)) return kept[0][0];
  let r = rand() * total;
  for (let i = 0; i < kept.length; i++) {
    r -= weights[i];
    if (r <= 0) return kept[i][0];
  }
  return kept[kept.length - 1][0];
}

/**
 * The model's logits for the last position in `fens` (the game so far, oldest first) for an
 * opponent rated `elo`. Maia-3 also takes the rating of the player it faces (`oppoElo`, default:
 * your rating); Maia-1 is the fallback.
 */
export async function maiaLogits(fens: string[], elo: number, oppoElo: number = getPlayerRating()): Promise<Map<string, number>> {
  const fen = fens[fens.length - 1];
  const moves = new Chess(fen).moves({ verbose: true });
  if (!moves.length) return new Map();
  if (currentBrain() === 'maia3') {
    try {
      return await maia3Logits(fens, maia3SelfElo(elo), oppoElo, MAIA3.size);
    } catch (e) {
      console.warn('Maia-3 failed, using Maia-1', e);
    }
  }
  const { rating } = maiaParams(elo);
  const id = nextId++;
  return new Promise<Map<string, number>>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({
      id,
      rating,
      base: document.baseURI,
      fens: fens.slice(-9),
      legal: moves.map((m) => m.lan),
      castling: moves.filter((m) => m.isKingsideCastle() || m.isQueensideCastle()).map((m) => m.lan),
    });
  });
}

/** Temperature for an opponent ("wild" players like Lily are a little more unpredictable). */
export function maiaTemperature(elo: number, style?: PlayStyle): number {
  const t = currentBrain() === 'maia3' ? humanParams(elo, 'maia3').temperature : maiaParams(elo).temperature;
  return style === 'wild' ? t * 1.1 : t;
}
