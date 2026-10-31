import { describe, expect, it } from 'vitest';
import { buildMap, composureCost, judge, moveFires, roomScore, price, maxConsumables } from '../run/rules';
import positions from '../run/data/positions.json';
import { TUNING as T } from '../run/tuning';
import type { RoomState, Run, UserMove } from '../run/types';
import { Chess } from 'chess.js';

const room = (over: Partial<RoomState>): RoomState => ({
  layer: 1, node: { kind: 'hold', modifier: 'steady' }, me: 'w', startFen: '', fen: '', plies: [], moves: [], fires: [], startEval: -80, elo: 1000, status: 'playing', ...over,
});
const mv = (over: Partial<UserMove>): UserMove => ({
  uci: 'e2e4', san: 'e4', fenBefore: '', fenAfter: '', cls: 'good', accuracy: 90, evalAfter: 0, composureLost: 0, ...over,
});
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('run rules', () => {
  it('builds one act: puzzle, two forks of two, boss', () => {
    const m = buildMap(Math.random, { convert: 10, hold: 10, boss: 10 });
    expect(m.map((l) => l.length)).toEqual([1, 2, 2, 1]);
    expect(m[0][0].kind).toBe('puzzle');
    expect(m[3][0].kind).toBe('boss');
    expect(new Set(m[1].map((n) => n.kind)).size).toBe(2);
  });

  it('charges Composure by class and modifier', () => {
    expect(composureCost('inaccuracy', { kind: 'hold', modifier: 'steady' })).toBe(0);
    expect(composureCost('mistake', { kind: 'hold', modifier: 'steady' })).toBe(1);
    expect(composureCost('blunder', { kind: 'hold', modifier: 'steady' })).toBe(2);
    expect(composureCost('blunder', { kind: 'boss', modifier: 'pickpocket' })).toBe(4);
    expect(composureCost('blunder', { kind: 'hold', modifier: 'focused' })).toBe(3);
  });

  it('hold room: fails on a big drop, wins after enough moves', () => {
    const fen = START;
    expect(judge(room({ fen, moves: [mv({ evalAfter: -300 })] }), 'mine')?.status).toBe('failed');
    expect(judge(room({ fen, moves: [mv({ evalAfter: -100 })] }), 'mine')).toBeNull();
    const eight = Array.from({ length: T.rooms.hold.moves }, () => mv({ evalAfter: -90 }));
    expect(judge(room({ fen, moves: eight }), 'mine')?.status).toBe('won');
  });

  it('convert (gain) is won by material after the reply', () => {
    // White is a knight up compared with the start.
    const start = '4k3/8/8/8/8/8/3n4/4K2R w - - 0 1';
    const now = '4k3/8/8/8/8/8/8/4K2R b - - 0 1';
    const r = room({ node: { kind: 'convert', modifier: 'steady', goal: 'gain' }, startFen: start, fen: now, moves: [mv({})] });
    expect(judge(r, 'reply')?.status).toBe('won');
  });

  it('boss: reaching the win eval resolves at once; checkmate wins', () => {
    const r = room({ node: { kind: 'boss', modifier: 'pickpocket' }, fen: START, moves: [mv({ evalAfter: T.rooms.boss.winCp })] });
    expect(judge(r, 'mine')?.status).toBe('won');
    const mate = new Chess();
    for (const m of ['f3', 'e5', 'g4', 'Qh4#']) mate.move(m);
    expect(judge(room({ node: { kind: 'boss', modifier: 'pickpocket' }, fen: mate.fen(), me: 'w', moves: [mv({})] }), 'reply')?.status).toBe('failed');
  });

  it('relics fire only on sound moves; a blunder scores ~0 chips whatever the mult', () => {
    const r = room({});
    const fork = mv({ fenBefore: '4k3/8/8/8/8/8/8/R3K2q w - - 0 1', uci: 'a1a8', cls: 'best' });
    expect(moveFires(['clean'], r, fork, 0).map((f) => f.relic)).toEqual(['clean']);
    expect(moveFires(['clean', 'ironwall'], r, { ...fork, cls: 'blunder' }, 0)).toEqual([]);
    const run = { results: [] } as unknown as Run;
    const s = roomScore(room({ status: 'won', moves: [mv({ cls: 'blunder', accuracy: 2 })], fires: [{ relic: 'clean', mult: 5, at: 0 }] }), run);
    expect(s.chips).toBe(2);
    expect(s.score).toBeLessThan(20);
  });

  it('Spendthrift halves prices and carries one fewer', () => {
    expect(price('eye', ['spendthrift'])).toBe(Math.round(T.consumables.price.eye / 2));
    expect(maxConsumables(['spendthrift'])).toBe(T.consumables.maxHeld - 1);
  });

  it('ships positions for every room type', () => {
    for (const k of ['convert', 'hold', 'boss'] as const) {
      const list = (positions as unknown as Record<string, [string, number][]>)[k];
      expect(list.length).toBeGreaterThan(20);
      for (const [fen] of list.slice(0, 5)) expect(() => new Chess(fen)).not.toThrow();
    }
  });
});
