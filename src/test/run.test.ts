import { describe, expect, it } from 'vitest';
import { embersFor } from '../run/meta';
import { canTakeBack, playStrength, reachable, recovery, roomCap, roomLoss, buildMap, composureCost, judge, moveFires, roomScore, price, maxConsumables, relicOffer } from '../run/rules';
import { RELICS } from '../run/content';
import positions from '../run/data/positions.json';
import { TUNING as T } from '../run/tuning';
import type { RoomState, Run, UserMove } from '../run/types';
import { OPPONENTS } from '../lib/people';
import { Chess } from 'chess.js';

const room = (over: Partial<RoomState>): RoomState => ({
  layer: 1, node: { kind: 'hold', modifier: 'steady' }, me: 'w', startFen: '', fen: '', plies: [], moves: [], fires: [], startEval: -80, elo: 1000, opp: 'maia', status: 'playing', ...over,
});
const mv = (over: Partial<UserMove>): UserMove => ({
  uci: 'e2e4', san: 'e4', fenBefore: '', fenAfter: '', cls: 'good', accuracy: 90, evalAfter: 0, composureLost: 0, ...over,
});
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('run rules', () => {
  it('builds one act as a map: rows of three with branching paths, events, the rival', () => {
    for (let i = 0; i < 40; i++) {
      const m = buildMap(Math.random, { convert: 10, hold: 10, boss: 10, ward: 10, duel: 10, vault: 10 }, { rooms: ['vault'] });
      expect(m.map((l) => l.length)).toEqual([3, 3, 3, 3, 1]);
      expect(m[4][0].kind).toBe('boss');
      expect(m.flat().filter((n) => n.kind === 'event').length).toBe(2);
      expect(m.flat().some((n) => n.kind === 'vault')).toBe(false);
      // Every node has a way forward and every node after the first row can be reached.
      for (let l = 0; l < 4; l++) {
        for (const n of m[l]) expect(n.next!.length).toBeGreaterThan(0);
        for (let j = 0; j < m[l + 1].length; j++) expect(m[l].some((n) => n.next!.includes(j))).toBe(true);
      }
      const r = { layers: m, path: [1], layer: 1 };
      expect(reachable(r)).toEqual(m[0][1].next);
    }
  });

  it('Embers: something for every run, more for progress and a win', () => {
    const base = { results: [], finalScore: 0, ended: 'lost', cursed: false } as unknown as Parameters<typeof embersFor>[0];
    expect(embersFor(base)).toBe(3);
    const good = { ...base, results: [{ won: true }, { won: true }, { won: true }], finalScore: 3000, ended: 'won' } as unknown as Parameters<typeof embersFor>[0];
    expect(embersFor(good)).toBe(3 + 6 + 5 + 6);
    expect(embersFor({ ...good, difficulty: 'master' } as typeof good)).toBe(3 + 6 + 5 + 6 + T.difficulty.master.embers);
  });

  it('charges Composure by class and modifier', () => {
    const hold = { node: { kind: 'hold' as const, modifier: 'steady' as const } };
    expect(composureCost('inaccuracy', hold)).toBe(0);
    expect(composureCost('mistake', hold)).toBe(1);
    expect(composureCost('blunder', hold)).toBe(2);
    expect(composureCost('blunder', { node: { kind: 'boss', modifier: 'rival' }, boss: T.bossMods.maya })).toBe(4);
    expect(composureCost('inaccuracy', { node: { kind: 'boss', modifier: 'rival' }, boss: T.bossMods.lily })).toBe(1);
    expect(composureCost('blunder', { node: { kind: 'hold', modifier: 'focused' } })).toBe(3);
    expect(composureCost('mistake', { ...hold, curses: ['brittle'] })).toBe(2);
  });

  it('hold room: a drop below the line starts a recovery window; staying below fails', () => {
    const fen = START;
    const g = T.difficulty.adept.grace;
    const low = (n: number) => Array.from({ length: n }, () => mv({ evalAfter: -300 }));
    expect(judge(room({ fen, moves: low(1) }), 'mine')).toBeNull();
    expect(recovery(room({ fen, moves: low(1) }))?.left).toBe(g);
    expect(judge(room({ fen, moves: low(g) }), 'mine')).toBeNull();
    expect(judge(room({ fen, moves: low(g + 1) }), 'mine')?.status).toBe('failed');
    // Climbing back resets it.
    expect(judge(room({ fen, moves: [...low(g), mv({ evalAfter: -100 }), ...low(g)] }), 'mine')).toBeNull();
    expect(judge(room({ fen, moves: [mv({ evalAfter: -100 })] }), 'mine')).toBeNull();
    const eight = Array.from({ length: T.rooms.hold.moves }, () => mv({ evalAfter: -90 }));
    expect(judge(room({ fen, moves: eight }), 'mine')?.status).toBe('won');
    // At the move limit but below the line: play on until back above it.
    expect(judge(room({ fen, moves: [...eight.slice(1), mv({ evalAfter: -300 })] }), 'mine')).toBeNull();
    // Apprentice: wider line and longer window; Master: one move.
    expect(judge(room({ fen, diff: 'apprentice', moves: [mv({ evalAfter: -80 - T.rooms.hold.maxDropCp - 90 })] }), 'mine')).toBeNull();
    expect(recovery(room({ fen, diff: 'apprentice', moves: [mv({ evalAfter: -80 - T.rooms.hold.maxDropCp - 90 })] }))).toBeNull();
    expect(judge(room({ fen, diff: 'master', moves: low(2) }), 'mine')?.status).toBe('failed');
  });

  it('difficulty sets candle costs; strength blends puzzles with real results', () => {
    const hold = { node: { kind: 'hold' as const, modifier: 'steady' as const } };
    expect(composureCost('mistake', { ...hold, diff: 'apprentice' })).toBe(0);
    expect(composureCost('blunder', { ...hold, diff: 'apprentice' })).toBe(1);
    expect(composureCost('blunder', { ...hold, diff: 'master' })).toBe(2);
    expect(playStrength(1500, {})).toBe(1500 + T.strength.noGamesOffset);
    // Beat the 800 opponent: well below a 1500 puzzle rating.
    const s = playStrength(1500, { [OPPONENTS.find((o) => o.elo === 800)!.id]: { w: 1, l: 0, d: 0 } });
    expect(s).toBeLessThan(1300);
    expect(s).toBeGreaterThan(900);
    // Never above the puzzle rating.
    expect(playStrength(700, { [OPPONENTS[OPPONENTS.length - 1].id]: { w: 1, l: 0, d: 0 } })).toBe(700);
  });

  it('free take-back: only after a slip, once per room on Apprentice', () => {
    const slip = mv({ cls: 'blunder', fenAfter: 'x' });
    const base = room({ moves: [slip], plies: [{ uci: 'e2e4', san: 'e4', fen: 'x', by: 'me' }] });
    const run = (rm: RoomState, difficulty?: 'apprentice' | 'adept') => ({ room: rm, difficulty }) as unknown as Run;
    expect(canTakeBack(run(base, 'apprentice'))).toBe(true);
    expect(canTakeBack(run(base, 'adept'))).toBe(false);
    expect(canTakeBack(run({ ...base, takebacks: 1 }, 'apprentice'))).toBe(false);
    expect(canTakeBack(run({ ...base, moves: [mv({ cls: 'good', fenAfter: 'x' })] }, 'apprentice'))).toBe(false);
  });

  it('convert (gain) is won by material after the reply', () => {
    // White is a knight up compared with the start.
    const start = '4k3/8/8/8/8/8/3n4/4K2R w - - 0 1';
    const now = '4k3/8/8/8/8/8/8/4K2R b - - 0 1';
    const r = room({ node: { kind: 'convert', modifier: 'steady', goal: 'gain' }, startFen: start, fen: now, moves: [mv({})] });
    expect(judge(r, 'reply')?.status).toBe('won');
  });

  it('boss: reaching the win eval resolves at once; checkmate wins', () => {
    const r = room({ node: { kind: 'boss', modifier: 'rival' }, fen: START, moves: [mv({ evalAfter: T.rooms.boss.winCp })] });
    expect(judge(r, 'mine', T.bossMods.maya)?.status).toBe('won');
    // Patient Grandpa: no early win.
    expect(judge(r, 'mine', T.bossMods.tom)).toBeNull();
    const mate = new Chess();
    for (const m of ['f3', 'e5', 'g4', 'Qh4#']) mate.move(m);
    expect(judge(room({ node: { kind: 'boss', modifier: 'rival' }, fen: mate.fen(), me: 'w', moves: [mv({})] }), 'reply')?.status).toBe('failed');
  });

  it('relics fire only on sound moves; a blunder scores ~0 chips whatever the mult', () => {
    const r = room({});
    const fork = mv({ fenBefore: '4k3/8/8/8/8/8/8/R3K2q w - - 0 1', uci: 'a1a8', cls: 'best' });
    expect(moveFires(['clean'], r, fork, 0).map((f) => f.relic)).toEqual(['clean']);
    expect(moveFires(['clean', 'ironwall'], r, { ...fork, cls: 'blunder' }, 0)).toEqual([]);
    const s = roomScore(room({ status: 'won', moves: [mv({ cls: 'blunder', accuracy: 2 })], fires: [{ relic: 'clean', mult: 5, at: 0 }] }));
    expect(s.chips).toBe(2);
    expect(s.score).toBeLessThan(20);
  });

  it('relic offers respect rarity filters and ownership', () => {
    for (let i = 0; i < 20; i++) {
      const rare = relicOffer([], 3, Math.random, T.relics.rarity, 'rare');
      expect(rare.every((id) => RELICS[id].rarity === 'rare')).toBe(true);
      expect(relicOffer(['calm', 'clean'], 3, Math.random)).not.toContain('calm');
    }
  });

  it('chip target scales with moves played; beating it pays gold', () => {
    const moves = [mv({ accuracy: 95 }), mv({ accuracy: 92 })];
    const s = roomScore(room({ status: 'won', moves }));
    expect(s.target).toBe(2 * T.score.targetPerMove);
    expect(s.beatTarget).toBe(true);
    expect(s.gold).toBe(T.gold.perRoom.hold + T.gold.cleanBonus + T.gold.targetBonus);
  });

  it('a room takes at most a few candles; the duel goal is relative to the start', () => {
    const hold = room({ moves: [mv({ composureLost: 2 })] });
    expect(roomCap(hold)).toBe(T.composure.roomCap);
    expect(roomLoss(hold)).toBe(2);
    expect(roomCap(room({ node: { kind: 'boss', modifier: 'rival' } }))).toBe(T.composure.bossCap);
    const duel = (evalAfter: number) =>
      judge(room({ node: { kind: 'duel', modifier: 'steady' }, fen: START, startEval: 40, moves: Array.from({ length: T.rooms.duel.moves }, () => mv({ evalAfter })) }), 'mine');
    expect(duel(40 - T.rooms.duel.maxDropCp)?.status).toBe('won');
    // Below at the end: extra moves to fix it, then it fails.
    expect(duel(40 - T.rooms.duel.maxDropCp - 1)).toBeNull();
    const late = Array.from({ length: T.rooms.duel.moves + T.difficulty.adept.grace }, () => mv({ evalAfter: -200 }));
    expect(judge(room({ node: { kind: 'duel', modifier: 'steady' }, fen: START, startEval: 40, moves: late }), 'mine')?.status).toBe('failed');
  });

  it('new relics: Castle Keep, Promotion Rite, Tempo fire on sound moves', () => {
    const r = room({});
    const at = 0;
    expect(moveFires(['castle'], r, mv({ san: 'O-O', uci: 'e1g1', fenBefore: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', cls: 'good' }), at).map((f) => f.relic)).toEqual(['castle']);
    expect(moveFires(['rite'], r, mv({ san: 'a8=Q', uci: 'a7a8q', fenBefore: '7k/P7/8/8/8/8/8/7K w - - 0 1', cls: 'best' }), at).map((f) => f.relic)).toEqual(['rite']);
    expect(moveFires(['tempo'], r, mv({ san: 'Ra8+', uci: 'a1a8', fenBefore: '7k/8/8/8/8/8/8/R6K w - - 0 1', cls: 'best' }), at).map((f) => f.relic)).toContain('tempo');
    expect(moveFires(['tempo'], r, mv({ san: 'Ra8+', uci: 'a1a8', fenBefore: '7k/8/8/8/8/8/8/R6K w - - 0 1', cls: 'mistake' }), at)).toEqual([]);
  });

  it('Spendthrift halves prices and carries one fewer', () => {
    expect(price('eye', ['spendthrift'])).toBe(Math.round(T.consumables.price.eye / 2));
    expect(maxConsumables(['spendthrift'])).toBe(T.consumables.maxHeld - 1);
  });

  it('ships positions for every room type', () => {
    for (const k of ['convert', 'hold', 'boss', 'ward'] as const) {
      const list = (positions as unknown as Record<string, [string, number][]>)[k];
      expect(list.length).toBeGreaterThan(20);
      for (const [fen] of list.slice(0, 5)) expect(() => new Chess(fen)).not.toThrow();
    }
  });
});
