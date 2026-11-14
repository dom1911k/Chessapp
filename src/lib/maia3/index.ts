// Maia-3: one transformer for every rating. Given the game so far and both players' ratings it
// predicts the move a human would play, how the game stands (win/draw/loss) and how long a human
// would think. Runs in a worker (onnxruntime-web, WebAssembly with SIMD). WebGPU was measured on a
// phone and was no faster, so only the wasm build ships.
import { Chess } from 'chess.js';
import { encodeHistory, moveIndex } from './encode';
import type { Maia3Request, Maia3Response, Maia3Size } from './runner';

export type { Maia3Size } from './runner';
export type Maia3Backend = 'wasm';

export interface Maia3Result {
  /** Logits for the legal moves (UCI, castling as e1g1). */
  logits: Map<string, number>;
  wdl: [number, number, number];
  ponder: number;
  ms: number;
  loadMs?: number;
  backend: string;
}

const workers = new Map<Maia3Backend, Worker>();
const pending = new Map<number, { resolve: (r: Maia3Response) => void; reject: (e: Error) => void }>();
let nextId = 1;

function worker(backend: Maia3Backend): Worker {
  let w = workers.get(backend);
  if (!w) {
    w = new Worker(new URL('./maia3.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<Maia3Response>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data);
    };
    workers.set(backend, w);
  }
  return w;
}

/** Maia-3 for the last position in `fens` (the game so far, oldest first). */
export async function maia3Eval(fens: string[], selfElo: number, oppoElo: number, opts: { size?: Maia3Size; backend?: Maia3Backend } = {}): Promise<Maia3Result> {
  const fen = fens[fens.length - 1];
  const moves = new Chess(fen).moves({ verbose: true });
  const black = fen.split(' ')[1] === 'b';
  const legal = moves.map((m) => m.lan);
  const req: Maia3Request = {
    id: nextId++,
    size: opts.size ?? '23m',
    base: document.baseURI,
    tokens: encodeHistory(fens),
    selfElo,
    oppoElo,
    idx: legal.map((u) => moveIndex(u, black)),
  };
  const r = await new Promise<Maia3Response>((resolve, reject) => {
    pending.set(req.id, { resolve, reject });
    worker(opts.backend ?? 'wasm').postMessage(req, [req.tokens.buffer]);
  });
  return { logits: new Map(legal.map((u, i) => [u, r.logits![i]])), wdl: r.wdl!, ponder: r.ponder!, ms: r.ms!, loadMs: r.loadMs, backend: r.backend! };
}

/** Logits only, in the shape the bots use (Map of UCI → logit). */
export async function maia3Logits(fens: string[], selfElo: number, oppoElo: number, size: Maia3Size = '23m'): Promise<Map<string, number>> {
  if (!new Chess(fens[fens.length - 1]).moves().length) return new Map();
  return (await maia3Eval(fens, selfElo, oppoElo, { size })).logits;
}

// ---- Benchmark (Settings → Developer) ------------------------------------------------------

export interface BenchResult {
  size: Maia3Size;
  backend: string;
  positions: number;
  loadMs: number;
  avgMs: number;
  p95Ms: number;
  worstMs: number;
}

/** 50 positions with history from seeded games (latency doesn't depend on the position itself). */
export function benchPositions(n = 50, seed = 7): string[][] {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out: string[][] = [];
  while (out.length < n) {
    const c = new Chess();
    const fens = [c.fen()];
    const plies = 4 + Math.floor(rand() * 50);
    for (let i = 0; i < plies; i++) {
      const ms = c.moves();
      if (!ms.length) break;
      c.move(ms[Math.floor(rand() * ms.length)]);
      fens.push(c.fen());
    }
    if (c.moves().length) out.push(fens);
  }
  return out;
}

export async function benchmark(size: Maia3Size, backend: Maia3Backend, onProgress?: (done: number) => void): Promise<BenchResult> {
  const positions = benchPositions();
  // First call loads the model (reported separately); one warm-up run is not counted.
  const first = await maia3Eval(positions[0], 1200, 1200, { size, backend });
  const times: number[] = [];
  for (let i = 0; i < positions.length; i++) {
    const r = await maia3Eval(positions[i], 600 + (i % 8) * 200, 1200, { size, backend });
    times.push(r.ms);
    onProgress?.(i + 1);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return {
    size,
    backend: first.backend,
    positions: times.length,
    loadMs: first.loadMs ?? 0,
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    p95Ms: sorted[Math.floor(sorted.length * 0.95) - 1] ?? sorted[sorted.length - 1],
    worstMs: sorted[sorted.length - 1],
  };
}
