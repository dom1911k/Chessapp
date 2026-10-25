import { UciEngine } from './uci';
import type { Engine } from './types';

let engine: Engine | null = null;

/** Shared Stockfish (WASM, lite, single-threaded) running in a Web Worker. */
export function getEngine(): Engine {
  if (engine) return engine;
  const url = new URL('engine/stockfish-19-lite-single.js', document.baseURI).href;
  const worker = new Worker(url);
  engine = new UciEngine({
    send: (cmd) => worker.postMessage(cmd),
    onLine: (cb) => {
      worker.onmessage = (e) => cb(String(e.data));
    },
  });
  return engine;
}

export type { Engine, AnalysisResult, AnalysisLine, AnalyzeOptions } from './types';
export { CancelledError } from './uci';
