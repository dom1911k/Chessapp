// Maia: a chess network trained to play like humans of a given rating
// (https://maiachess.com, GPL-3.0). This is a small, dependency-free
// implementation of its lc0 SE-ResNet: 112 input planes → 6 residual blocks of
// 64 filters with squeeze-excitation → convolutional policy head.
// No search: the policy itself is "what would a human at this level play?".
import { CONV_POLICY_MAP, POLICY_MOVES } from './tables';

const C = 64;
const BLOCKS = 6;
const SE = 8;
const INPUT_PLANES = 112;

interface Conv {
  w: Float32Array; // [out][in][3][3]
  b: Float32Array;
  out: number;
  in: number;
}

interface Block {
  c1: Conv;
  c2: Conv;
  w1: Float32Array; // [SE][C]
  b1: Float32Array;
  w2: Float32Array; // [2C][SE]
  b2: Float32Array;
}

export interface MaiaNet {
  input: Conv;
  blocks: Block[];
  pol1: Conv;
  pol: Conv;
}

function f16ToF32(src: Uint16Array): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const h = src[i];
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    out[i] = e === 0 ? s * 2 ** -14 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + f / 1024);
  }
  return out;
}

/** Reads a file written by scripts/maia/convert.py. */
export function parseNet(buf: ArrayBuffer): MaiaNet {
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (magic !== 'MAIA') throw new Error('Not a Maia network');
  const all = f16ToF32(new Uint16Array(buf.slice(4)));
  let pos = 0;
  const take = (n: number) => {
    const a = all.subarray(pos, pos + n);
    pos += n;
    return a;
  };
  const conv = (out: number, inp: number): Conv => ({ w: take(out * inp * 9), b: take(out), out, in: inp });
  const input = conv(C, INPUT_PLANES);
  const blocks: Block[] = [];
  for (let i = 0; i < BLOCKS; i++) {
    blocks.push({ c1: conv(C, C), c2: conv(C, C), w1: take(SE * C), b1: take(SE), w2: take(2 * C * SE), b2: take(2 * C) });
  }
  const pol1 = conv(C, C);
  const pol = conv(80, C);
  if (pos !== all.length) throw new Error(`Unexpected network size (${pos} of ${all.length})`);
  return { input, blocks, pol1, pol };
}

/** 3x3 convolution on 8x8 boards, padding 1. `x` is [in][64]. */
function conv3(x: Float32Array, c: Conv, relu: boolean): Float32Array {
  const y = new Float32Array(c.out * 64);
  for (let o = 0; o < c.out; o++) {
    const yo = o * 64;
    const bias = c.b[o];
    for (let s = 0; s < 64; s++) y[yo + s] = bias;
    for (let i = 0; i < c.in; i++) {
      const xi = i * 64;
      const wb = (o * c.in + i) * 9;
      for (let ky = 0; ky < 3; ky++) {
        const dy = ky - 1;
        const r0 = dy < 0 ? 1 : 0;
        const r1 = dy > 0 ? 7 : 8;
        for (let kx = 0; kx < 3; kx++) {
          const w = c.w[wb + ky * 3 + kx];
          if (w === 0) continue;
          const dx = kx - 1;
          const f0 = dx < 0 ? 1 : 0;
          const f1 = dx > 0 ? 7 : 8;
          for (let r = r0; r < r1; r++) {
            const yrow = yo + r * 8;
            const xrow = xi + (r + dy) * 8 + dx;
            for (let f = f0; f < f1; f++) y[yrow + f] += w * x[xrow + f];
          }
        }
      }
    }
  }
  if (relu) for (let k = 0; k < y.length; k++) if (y[k] < 0) y[k] = 0;
  return y;
}

/** Network output: 80x64 convolutional policy logits. */
export function forward(net: MaiaNet, planes: Float32Array): Float32Array {
  let x = conv3(planes, net.input, true);
  const pool = new Float32Array(C);
  const hidden = new Float32Array(SE);
  for (const b of net.blocks) {
    const y1 = conv3(x, b.c1, true);
    const y = conv3(y1, b.c2, false);
    for (let c = 0; c < C; c++) {
      let s = 0;
      for (let k = 0; k < 64; k++) s += y[c * 64 + k];
      pool[c] = s / 64;
    }
    for (let h = 0; h < SE; h++) {
      let s = b.b1[h];
      for (let c = 0; c < C; c++) s += b.w1[h * C + c] * pool[c];
      hidden[h] = s > 0 ? s : 0;
    }
    for (let c = 0; c < C; c++) {
      let g = b.b2[c];
      let be = b.b2[C + c];
      for (let h = 0; h < SE; h++) {
        g += b.w2[c * SE + h] * hidden[h];
        be += b.w2[(C + c) * SE + h] * hidden[h];
      }
      const scale = 1 / (1 + Math.exp(-g));
      for (let k = 0; k < 64; k++) {
        const v = y[c * 64 + k] * scale + be + x[c * 64 + k];
        y[c * 64 + k] = v > 0 ? v : 0;
      }
    }
    x = y;
  }
  const p = conv3(x, net.pol1, true);
  return conv3(p, net.pol, false);
}

// ---- Input encoding (lc0 "classical 112 planes") ----

const PIECES = 'pnbrqk';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** `fens`: the game so far, oldest first; the last one is the position to move from. */
export function encode(fens: string[]): Float32Array {
  const planes = new Float32Array(INPUT_PLANES * 64);
  const cur = fens[fens.length - 1].split(' ');
  const black = cur[1] === 'b';
  const key = (f: string) => f.split(' ').slice(0, 3).join(' ');
  // Up to 8 positions, newest first. Missing history is filled with the
  // earliest position, unless the game began from the normal start.
  const hist: string[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = fens.length - 1 - i;
    if (idx >= 0) hist.push(fens[idx]);
    else if (key(fens[0]) === key(START)) break;
    else hist.push(fens[0]);
  }
  hist.forEach((fen, i) => {
    const base = i * 13;
    const rows = fen.split(' ')[0].split('/');
    rows.forEach((row, r) => {
      let file = 0;
      for (const ch of row) {
        if (ch >= '1' && ch <= '8') {
          file += Number(ch);
          continue;
        }
        const white = ch === ch.toUpperCase();
        const ours = white !== black;
        const t = PIECES.indexOf(ch.toLowerCase());
        const rank = 7 - r;
        const sq = (black ? 7 - rank : rank) * 8 + file;
        planes[(base + (ours ? 0 : 6) + t) * 64 + sq] = 1;
        file++;
      }
    });
    // Repetition: the same position earlier in the game.
    const idx = fens.length - 1 - i;
    const k = key(fen);
    if (idx > 0 && fens.slice(0, idx).some((f) => key(f) === k)) planes.fill(1, (base + 12) * 64, (base + 13) * 64);
  });
  const cast = cur[2];
  const [usK, usQ, thK, thQ] = black ? ['k', 'q', 'K', 'Q'] : ['K', 'Q', 'k', 'q'];
  const set = (p: number, v = 1) => planes.fill(v, p * 64, (p + 1) * 64);
  if (cast.includes(usQ)) set(104);
  if (cast.includes(usK)) set(105);
  if (cast.includes(thQ)) set(106);
  if (cast.includes(thK)) set(107);
  if (black) set(108);
  set(109, Number(cur[4]) || 0);
  set(111);
  return planes;
}

const MOVE_INDEX = new Map(POLICY_MOVES.map((m, i) => [m, i]));

/** lc0's name for a move (from the mover's side, castling as king-takes-rook, knight promotion unsuffixed). */
function lc0Move(uci: string, black: boolean, castling: boolean): string {
  let m = uci;
  if (castling) m = m.slice(0, 2) + (m[2] === 'g' ? 'h' : 'a') + m[3];
  if (black) m = m[0] + (9 - Number(m[1])) + m[2] + (9 - Number(m[3])) + m.slice(4);
  if (m.length === 5 && m[4] === 'n') m = m.slice(0, 4);
  return m;
}

/**
 * Logits for the given legal moves (UCI, castling written as e1g1 and listed in
 * `castling`). The caller turns them into probabilities with any temperature.
 */
export function moveLogits(net: MaiaNet, fens: string[], legal: string[], castling: Set<string> = new Set()): Map<string, number> {
  const out = forward(net, encode(fens));
  const logits = new Float32Array(POLICY_MOVES.length).fill(-1e9);
  for (let i = 0; i < CONV_POLICY_MAP.length; i++) {
    const j = CONV_POLICY_MAP[i];
    if (j >= 0) logits[j] = out[i];
  }
  const black = fens[fens.length - 1].split(' ')[1] === 'b';
  const res = new Map<string, number>();
  for (const u of legal) {
    const idx = MOVE_INDEX.get(lc0Move(u, black, castling.has(u)));
    res.set(u, idx === undefined ? -1e9 : logits[idx]);
  }
  return res;
}
