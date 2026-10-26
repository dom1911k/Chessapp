// Human-like opponents with Maia. The networks predict what a human of a given
// rating would play; we sample from that, with a temperature per opponent level.
import { Chess } from 'chess.js';
import type { PlayStyle } from '../people';

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
  const temperature = lerp([[400, 2.6], [600, 1.9], [800, 1.45], [1000, 1.12], [1100, 1.0], [1200, 1.0], [1400, 0.8], [1600, 0.7], [1800, 0.6], [2000, 0.45]], elo);
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
export function vetoLimit(elo: number): number | null {
  return elo < 1500 ? null : lerp([[1500, 500], [1600, 400], [1800, 200], [2000, 80]], elo);
}

/** How often the veto is used: even "only big blunders" is worth hundreds of rating points. */
export function vetoChance(elo: number): number {
  return lerp([[1400, 0], [1600, 0.25], [1800, 0.6], [2000, 1]], elo);
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

/** Maia's logits for the last position in `fens` (the game so far, oldest first). */
export async function maiaLogits(fens: string[], elo: number): Promise<Map<string, number>> {
  const fen = fens[fens.length - 1];
  const moves = new Chess(fen).moves({ verbose: true });
  if (!moves.length) return new Map();
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
  const t = maiaParams(elo).temperature;
  return style === 'wild' ? t * 1.1 : t;
}
