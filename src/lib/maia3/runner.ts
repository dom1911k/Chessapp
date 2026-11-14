// Shared by the Maia-3 workers: load a model once, run one position per request.
import type * as Ort from 'onnxruntime-web';
import { TOKEN_DIM } from './encode';

export type Maia3Size = '5m' | '23m';

export interface Maia3Request {
  id: number;
  size: Maia3Size;
  base: string;
  tokens: Float32Array;
  selfElo: number;
  oppoElo: number;
  /** Output indices to return (the legal moves). */
  idx: number[];
}

export interface Maia3Response {
  id: number;
  logits?: number[];
  /** Loss/draw/win probabilities for the side to move. */
  wdl?: [number, number, number];
  ponder?: number;
  /** Inference time (ms), and model load time on the first request. */
  ms?: number;
  loadMs?: number;
  backend?: string;
  error?: string;
}

const sessions = new Map<string, Promise<{ s: Ort.InferenceSession; loadMs: number; backend: string }>>();

function session(ort: typeof Ort, size: Maia3Size, base: string, want: 'wasm' | 'webgpu') {
  const key = `${size}:${want}`;
  let p = sessions.get(key);
  if (!p) {
    p = (async () => {
      const t = performance.now();
      // Single thread: the app is not cross-origin isolated (no SharedArrayBuffer in the WebView).
      ort.env.wasm.numThreads = 1;
      const buf = await fetch(new URL(`maia3/maia3-${size}.onnx`, base)).then((r) => {
        if (!r.ok) throw new Error(`Maia-3 ${size}: HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      const gpu = want === 'webgpu' && 'gpu' in navigator && !!(await (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter().catch(() => null));
      const s = await ort.InferenceSession.create(buf, { executionProviders: gpu ? ['webgpu', 'wasm'] : ['wasm'], graphOptimizationLevel: 'all' });
      return { s, loadMs: performance.now() - t, backend: gpu ? 'webgpu' : 'wasm' };
    })();
    p.catch(() => sessions.delete(key));
    sessions.set(key, p);
  }
  return p;
}

export async function handle(ort: typeof Ort, req: Maia3Request, want: 'wasm' | 'webgpu') {
  const post = (r: Maia3Response) => (self as unknown as Worker).postMessage(r);
  try {
    const fresh = !sessions.has(`${req.size}:${want}`);
    const { s, loadMs, backend } = await session(ort, req.size, req.base, want);
    const t = performance.now();
    const out = await s.run({
      tokens: new ort.Tensor('float32', req.tokens, [1, 64, TOKEN_DIM]),
      self_elo: new ort.Tensor('float32', new Float32Array([req.selfElo]), [1]),
      oppo_elo: new ort.Tensor('float32', new Float32Array([req.oppoElo]), [1]),
    });
    const ms = performance.now() - t;
    const move = out.move.data as Float32Array;
    const v = out.value.data as Float32Array;
    const mx = Math.max(v[0], v[1], v[2]);
    const e = [Math.exp(v[0] - mx), Math.exp(v[1] - mx), Math.exp(v[2] - mx)];
    const sum = e[0] + e[1] + e[2];
    post({ id: req.id, logits: req.idx.map((i) => move[i]), wdl: [e[0] / sum, e[1] / sum, e[2] / sum], ponder: (out.ponder.data as Float32Array)[0], ms, loadMs: fresh ? loadMs : undefined, backend });
  } catch (err) {
    post({ id: req.id, error: String(err) });
  }
}
