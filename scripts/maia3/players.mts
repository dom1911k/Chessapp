// Players for Maia-3 calibration (run from the repo root with npx tsx). Uses the app's own code:
// the ONNX model through onnxruntime-web (as in the app), the same move picker and Stockfish.
//   raw    Maia-3 sampled as is (temperature 1): the reference "human of rating L"
//   bot    the app's Maia-3 opponent (selfElo mapping + chooseHumanMove)
//   m1     the old Maia-1 opponent (for before/after comparisons)
import * as ort from 'onnxruntime-web';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { encodeHistory, moveIndex, TOKEN_DIM } from '../../src/lib/maia3/encode.ts';
import { moveLogits, parseNet, type MaiaNet } from '../../src/lib/maia/net.ts';
import { botParams } from '../../src/lib/bot.ts';
import { chooseHumanMove, humanParams, maia3SelfElo, maiaParams, sampleMove, setBrain } from '../../src/lib/maia/index.ts';
import { createNodeEngine } from '../../src/lib/engine/node.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';

ort.env.wasm.numThreads = 1;
export const engine = createNodeEngine();

const sessions = new Map<string, Promise<ort.InferenceSession>>();
const session = (size: string) => {
  if (!sessions.has(size)) sessions.set(size, ort.InferenceSession.create(readFileSync(`public/maia3/maia3-${size}.onnx`)));
  return sessions.get(size)!;
};

export interface Maia3Out {
  logits: Map<string, number>;
  wdl: [number, number, number];
  ponder: number;
}

/** Maia-3 on the last position of `fens`. */
export async function maia3(fens: string[], selfElo: number, oppoElo: number, size = '23m'): Promise<Maia3Out> {
  const fen = fens[fens.length - 1];
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.lan);
  const black = fen.split(' ')[1] === 'b';
  const s = await session(size);
  const out = await s.run({
    tokens: new ort.Tensor('float32', encodeHistory(fens), [1, 64, TOKEN_DIM]),
    self_elo: new ort.Tensor('float32', new Float32Array([selfElo]), [1]),
    oppo_elo: new ort.Tensor('float32', new Float32Array([oppoElo]), [1]),
  });
  const mv = out.move.data as Float32Array;
  const v = out.value.data as Float32Array;
  const mx = Math.max(...v);
  const e = [...v].map((x) => Math.exp(x - mx));
  const z = e[0] + e[1] + e[2];
  return { logits: new Map(legal.map((u) => [u, mv[moveIndex(u, black)]])), wdl: [e[0] / z, e[1] / z, e[2] / z], ponder: (out.ponder.data as Float32Array)[0] };
}

const nets = new Map<number, MaiaNet>();
const net = (r: number) => {
  if (!nets.has(r)) { const b = readFileSync(`public/maia/maia-${r}.bin`); nets.set(r, parseNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); }
  return nets.get(r)!;
};
export function maia1(fens: string[], elo: number): Map<string, number> {
  const c = new Chess(fens[fens.length - 1]);
  const moves = c.moves({ verbose: true });
  return moveLogits(net(maiaParams(elo).rating), fens.slice(-9), moves.map((m) => m.lan), new Set(moves.filter((m) => m.isKingsideCastle() || m.isQueensideCastle()).map((m) => m.lan)));
}

/** Stockfish MultiPV: move → cp for the side to move. */
export async function candidates(fen: string, depth: number, multipv = 8): Promise<Map<string, number>> {
  const turn = fen.split(' ')[1] as 'w' | 'b';
  const a = await engine.analyze(fen, { depth, multipv });
  return new Map(a.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, turn))]));
}

export interface PlayerSpec {
  kind: 'raw' | 'bot' | 'm1';
  elo: number;
  /** Maia-3 OppoElo (default: the other player's elo). */
  oppo?: number;
  params?: Record<string, number>;
  size?: string;
}

export interface Pick {
  uci: string;
  /** Model probability of the chosen move, and the candidates (if the engine was asked). */
  prob: number;
  cand?: Map<string, number>;
  logits: Map<string, number>;
}

const prob = (lg: Map<string, number>, u: string) => {
  const vals = [...lg.values()];
  const mx = Math.max(...vals);
  const z = vals.reduce((s, v) => s + Math.exp(v - mx), 0);
  return Math.exp((lg.get(u) ?? -1e9) - mx) / z;
};

export async function pick(p: PlayerSpec, fens: string[], oppoElo: number, extra?: Record<string, number>): Promise<Pick> {
  const fen = fens[fens.length - 1];
  if (p.kind === 'raw') {
    const { logits } = await maia3(fens, p.elo, p.oppo ?? oppoElo, p.size);
    const uci = sampleMove(logits, 1)!;
    return { uci, prob: prob(logits, uci), logits };
  }
  const brain = p.kind === 'bot' ? 'maia3' : 'maia1';
  setBrain(brain);
  const logits = p.kind === 'bot' ? (await maia3(fens, maia3SelfElo(p.elo), maia3SelfElo(p.oppo ?? oppoElo), p.size)).logits : maia1(fens, p.elo);
  const cand = await candidates(fen, botParams(p.elo).depth);
  const uci = chooseHumanMove(logits, p.elo, cand, Math.random, { brain, params: { ...(p.params as Partial<ReturnType<typeof humanParams>>), ...extra } })!;
  return { uci, prob: prob(logits, uci), cand, logits };
}
