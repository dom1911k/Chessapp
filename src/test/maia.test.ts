import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { moveLogits, parseNet, type MaiaNet } from '../lib/maia/net';

const load = (r: number): MaiaNet => {
  const b = readFileSync(`public/maia/maia-${r}.bin`);
  return parseNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

function probs(net: MaiaNet, sans: string[], startFen?: string) {
  const c = new Chess(startFen);
  const fens = [c.fen()];
  for (const m of sans) {
    c.move(m);
    fens.push(c.fen());
  }
  const moves = c.moves({ verbose: true });
  const castling = new Set(moves.filter((m) => m.isKingsideCastle() || m.isQueensideCastle()).map((m) => m.lan));
  const logits = moveLogits(net, fens, moves.map((m) => m.lan), castling);
  const max = Math.max(...logits.values());
  const sum = [...logits.values()].reduce((s, v) => s + Math.exp(v - max), 0);
  return new Map([...logits].map(([k, v]) => [k, Math.exp(v - max) / sum]));
}

describe('Maia network', () => {
  const m1100 = load(1100);
  it('matches the reference implementation in the opening', () => {
    const p = probs(m1100, []);
    expect(p.get('e2e4')!).toBeCloseTo(0.66, 1);
    expect(p.get('d2d4')!).toBeCloseTo(0.21, 1);
  });
  it('uses the move history and knows castling', () => {
    const p = probs(m1100, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6']);
    expect(p.get('f3g5')!).toBeCloseTo(0.53, 1);
    expect(p.get('e1g1')!).toBeCloseTo(0.13, 1);
  });
  it('plays black moves from black side', () => {
    const p = probs(m1100, ['e4']);
    expect(p.get('e7e5')!).toBeCloseTo(0.59, 1);
  });
  it('grabs a hanging queen', () => {
    const p = probs(load(1900), ['e4', 'e5', 'Nf3', 'Qh4']);
    expect(p.get('f3h4')!).toBeGreaterThan(0.6);
  });
  it('is fast enough', () => {
    const t = performance.now();
    for (let i = 0; i < 5; i++) probs(m1100, ['e4', 'e5']);
    expect((performance.now() - t) / 5).toBeLessThan(400);
  });
});

describe('Maia opponent settings', () => {
  it('weaker opponents play looser, stronger ones use stronger networks', async () => {
    const { maiaParams } = await import('../lib/maia');
    const levels = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000].map(maiaParams);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].temperature).toBeLessThanOrEqual(levels[i - 1].temperature);
      expect(levels[i].rating).toBeGreaterThanOrEqual(levels[i - 1].rating);
    }
  });
  it('Stockfish vetoes blunders only for strong opponents', async () => {
    const { chooseMaiaMove } = await import('../lib/maia');
    const logits = new Map([['a', 5], ['b', 0]]); // Maia loves "a"
    const cands = new Map([['a', -400], ['b', 50]]); // …but "a" loses a lot
    expect(chooseMaiaMove(logits, 0.01, 2000, cands, () => 0.5)).toBe('b');
    expect(chooseMaiaMove(logits, 0.01, 800, cands, () => 0.5)).toBe('a');
  });
});
