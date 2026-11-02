import { describe, expect, it } from 'vitest';
import { embersFor } from '../run/meta';
import { pickRival, endFires, isFinalCamp, kingSheltered, passedToSixth, scoreGold, canTakeBack, goldToEmbers, nextRestCost, stallPrice, cardSlots, playStrength, reachable, recovery, roomCap, roomLoss, buildMap, composureCost, judge, moveFires, roomScore, price, maxConsumables, relicOffer } from '../run/rules';
import { RELICS } from '../run/content';
import positions from '../run/data/positions.json';
import { TUNING as T } from '../run/tuning';
import type { RelicId, RoomState, Run, UserMove } from '../run/types';
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
      expect(m.map((l) => l.length)).toEqual([3, 3, 3, 3, 1, 1]);
      expect(m[5][0].kind).toBe('boss');
      // Campfires are nodes: one in row 2 or 3, one right before the rival.
      expect(m[4][0].kind).toBe('camp');
      expect(m.slice(0, 4).flat().filter((n) => n.kind === 'camp').length).toBe(1);
      expect([1, 2].some((l) => m[l].some((n) => n.kind === 'camp'))).toBe(true);
      expect(isFinalCamp({ layers: m, layer: 4 })).toBe(true);
      expect(isFinalCamp({ layers: m, layer: 3 })).toBe(false);
      expect(m.flat().filter((n) => n.kind === 'event').length).toBe(2);
      expect(m.flat().some((n) => n.kind === 'vault')).toBe(false);
      // Every node has a way forward and every node after the first row can be reached.
      for (let l = 0; l < 5; l++) {
        for (const n of m[l]) expect(n.next!.length).toBeGreaterThan(0);
        for (let j = 0; j < m[l + 1].length; j++) expect(m[l].some((n) => n.next!.includes(j))).toBe(true);
      }
      const r = { layers: m, path: [1], layer: 1 };
      expect(reachable(r)).toEqual(m[0][1].next);
    }
  });

  it('Embers: something for every run, more for progress and a win', () => {
    const base = { results: [], finalScore: 0, ended: 'lost', cursed: false } as unknown as Parameters<typeof embersFor>[0];
    // Base Embers only once a room was cleared (abandoning at once pays nothing).
    expect(embersFor(base)).toBe(0);
    const good = { ...base, results: [{ won: true }, { won: true }, { won: true }], finalScore: 3000, ended: 'won' } as unknown as Parameters<typeof embersFor>[0];
    expect(embersFor(good)).toBe(3 + 6 + 5 + 6);
    expect(embersFor({ ...good, difficulty: 'master' } as typeof good)).toBe(3 + 6 + 5 + 6 + T.difficulty.master.embers);
    // Leftover gold: 1 Ember per goldPer.
    expect(embersFor({ ...base, gold: T.embers.goldPer * 2 + 5 } as typeof base)).toBe(2);
    expect(goldToEmbers(T.embers.goldPer - 1)).toBe(0);
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

  it('campfire: rests get dearer, the stall prices by rarity, the pouch adds a slot', () => {
    const r = { relics: [], meta: { boosts: {}, lockedRelics: [] } } as unknown as Run;
    expect(nextRestCost({ ...r, rests: 2 })).toBe(T.shop.restPrice + 2 * T.shop.restStep);
    expect(stallPrice(r, 'calm')).toBe(T.shop.stallPrice.common);
    expect(stallPrice({ ...r, relics: ['spendthrift'] }, 'calm')).toBe(Math.round(T.shop.stallPrice.common * T.relics.spendthriftPriceFactor));
    expect(cardSlots({ ...r, pouch: 1 })).toBe(cardSlots(r) + 1);
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

  it('score pays the gold: score / rate, ×blind when the chip target is beaten, + clean, soft-capped', () => {
    const moves = [mv({ accuracy: 95 }), mv({ accuracy: 92 })];
    const s = roomScore(room({ status: 'won', moves }));
    expect(s.target).toBe(2 * T.score.targetPerMove);
    expect(s.beatTarget).toBe(true);
    expect(s.gold).toBe(Math.round((187 / T.gold.goldRate) * T.gold.blindGoldMult + T.gold.cleanBonus));
    // Failed rooms pay nothing.
    expect(roomScore(room({ status: 'failed', moves })).gold).toBe(0);
    // Average clean room ≈ 7–10 gold, an excellent one about double, a huge one soft-capped.
    const avg = scoreGold(8 * 85 * 1.2, true, true);
    expect(avg).toBeGreaterThanOrEqual(7);
    expect(avg).toBeLessThanOrEqual(10);
    const great = scoreGold(8 * 95 * 2.5, true, true);
    expect(great).toBeGreaterThanOrEqual(avg * 1.6);
    expect(great).toBeLessThanOrEqual(avg * 2.4);
    expect(scoreGold(20000, true, true)).toBeLessThan(T.gold.softCap + (20000 / T.gold.goldRate) * T.gold.blindGoldMult * T.gold.overCapRate + 1);
    // Missing the blind pays less.
    expect(scoreGold(1000, false, true)).toBeLessThan(scoreGold(1000, true, true));
  });

  it('×mult relics multiply after the adds; Siege Engine adds chips', () => {
    const moves = Array.from({ length: 4 }, () => mv({ accuracy: 90, cls: 'best' }));
    const r = room({ status: 'won', moves, fires: [{ relic: 'hunter', mult: 0.5, at: 0 }, { relic: 'perfectionist', xmult: 2, at: -1 }, { relic: 'siege', chips: 20, at: 1 }] });
    const sc = roomScore(r);
    expect(sc.mult).toBe(3); // (1 + 0.5) × 2
    expect(sc.chips).toBe(380);
  });

  it('new end relics: Perfectionist, Cold Read, Executioner are ×mult', () => {
    const base = { relics: ['perfectionist', 'coldread', 'executioner'], results: [] } as unknown as Run;
    const clean = room({ status: 'won', moves: [mv({ cls: 'best' }), mv({ cls: 'good' })], plies: [{ uci: 'e2e4', san: 'Qh7#', fen: '', by: 'me' }] });
    const f = endFires(base, clean);
    expect(f.find((x) => x.relic === 'perfectionist')?.xmult).toBe(T.relics.perfectionistX);
    expect(f.find((x) => x.relic === 'coldread')?.xmult).toBe(T.relics.coldReadX);
    expect(f.find((x) => x.relic === 'executioner')?.xmult).toBe(T.relics.executionerMult);
    const messy = room({ status: 'won', cardsUsed: 1, moves: [mv({ cls: 'inaccuracy' })] });
    expect(endFires(base, messy).map((x) => x.relic)).toEqual([]);
  });

  it('Castle Keep: king castled or sheltered; Promotion Rite: passed pawn to the 6th', () => {
    expect(kingSheltered('r3k2r/8/8/8/8/8/5PPP/R4RK1 b - - 0 1', 'w')).toBe(true);
    expect(kingSheltered('8/8/8/8/4K3/8/8/7k w - - 0 1', 'w')).toBe(false);
    expect(kingSheltered('8/8/8/8/8/3PPP2/4K3/7k w - - 0 1', 'w')).toBe(true);
    expect(passedToSixth('4k3/8/8/3P4/8/8/8/4K3 w - - 0 1', 'd5d6')).toBe(true);
    expect(passedToSixth('4k3/2p5/8/3P4/8/8/8/4K3 w - - 0 1', 'd5d6')).toBe(false);
    expect(passedToSixth('4k3/8/8/8/3p4/8/8/4K3 b - - 0 1', 'd4d3')).toBe(true);
    const r = room({});
    // Castle Keep no longer fires per move (it's a room-end check now).
    expect(moveFires(['castle'], r, mv({ cls: 'good', fenBefore: 'r3k2r/8/8/8/8/8/5PPP/R4RK1 w - - 0 1', fenAfter: 'r3k2r/8/8/8/8/8/5PPP/R4RK1 b - - 0 1' }), 0)).toEqual([]);
    expect(moveFires(['rite'], r, mv({ cls: 'good', uci: 'd5d6', san: 'd6', fenBefore: '4k3/8/8/3P4/8/8/8/4K3 w - - 0 1' }), 0)[0]?.mult).toBe(T.relics.riteRankMult);
  });

  it('Siege Engine: chips for each move kept above the red line, growing', () => {
    const r = room({ startEval: 0, moves: [mv({ evalAfter: 0 }), mv({ evalAfter: 0 })] });
    const f = moveFires(['siege'], r, mv({ cls: 'good', evalAfter: 0, fenBefore: START }), 2);
    expect(f[0].chips).toBe(T.relics.siegeChips * 3);
    expect(moveFires(['siege'], r, mv({ cls: 'good', evalAfter: -10000, fenBefore: START }), 2)).toEqual([]);
  });

  it('rival rotation favours rivals not yet beaten in Run mode', () => {
    const opps = [{ id: 'a' }, { id: 'b' }];
    let a = 0;
    let x = 0;
    const rand = () => ((x = (x * 9301 + 49297) % 233280), x / 233280);
    for (let i = 0; i < 2000; i++) if (pickRival(opps, { b: 2 }, rand).id === 'a') a++;
    expect(a / 2000).toBeGreaterThan(0.65);
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

  it('relics: Castle Keep, Promotion Rite, Tempo fire on sound moves', () => {
    const r = room({});
    const at = 0;
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

// ---------------------------------------------------------------- Stage B
import { closeMoves, plausibleWrong, topMoments, momentLoss, nemesisFor, noteScenario, isMastered, scenarioWeight, scenarioOf, type Grimoire } from '../run/rules';
import { momentCard } from '../run/bridge';
import type { Moment } from '../run/types';

describe('stage B: plausible wrong options', () => {
  const legal = ['e2e4', 'd2d4', 'g1f3', 'a2a3', 'h2h3', 'b1c3'];
  it('takes Maia’s likeliest moves, never the answer or a near-best move', () => {
    const logits = new Map([['e2e4', 5], ['d2d4', 4], ['g1f3', 3], ['a2a3', 2.5], ['h2h3', 0.1]]);
    const out = plausibleWrong(legal, ['e2e4', 'd2d4'], logits, 2, () => 0.5);
    expect(out).toEqual(['g1f3', 'a2a3']);
  });
  it('falls back to random legal moves when Maia gives too few', () => {
    const out = plausibleWrong(legal, ['e2e4'], new Map([['h2h3', 1]]), 2, () => 0);
    expect(out[0]).toBe('h2h3');
    expect(out).toHaveLength(2);
    expect(out).not.toContain('e2e4');
    expect(plausibleWrong(legal, ['e2e4'], null, 2, () => 0)).toHaveLength(2);
  });
  it('near-best = within cardsCloseCp of the top line, from your side (scores are White POV)', () => {
    const lines = [
      { pv: ['a7a6'], score: { type: 'cp' as const, value: -100 } },
      { pv: ['b7b6'], score: { type: 'cp' as const, value: -100 + T.engine.cardsCloseCp - 1 } },
      { pv: ['c7c6'], score: { type: 'cp' as const, value: -100 + T.engine.cardsCloseCp + 1 } },
    ];
    expect([...closeMoves(lines, 'b')].sort()).toEqual(['a7a6', 'b7b6']);
  });
});

describe('stage B: debrief and reviews', () => {
  const mom = (wpLoss: number | undefined, cost: number, accuracy = 50, uci = 'e2e4'): Moment => ({
    layer: 1, kind: 'hold', cost, best: 'd2d4', move: mv({ uci, san: uci, wpLoss, accuracy, cls: 'mistake', fenBefore: START }),
  });
  it('ranks every mistake by win% lost, not by candles, and keeps the top 3', () => {
    const ms = [mom(8, 2), mom(30, 0), mom(15, 1), mom(4, 0)];
    expect(topMoments(ms).map((m) => m.move.wpLoss)).toEqual([30, 15, 8]);
    expect(T.debrief.keep).toBe(3);
  });
  it('old moments without wpLoss still rank (estimated from accuracy)', () => {
    expect(momentLoss(mom(undefined, 2, 40))).toBe(30);
  });
  it('turns a moment into a review card in the app’s mistake format, tagged “From a run”', () => {
    const c = momentCard('abc', 0, mom(20, 1), 1000)!;
    expect(c).toMatchObject({ id: 'm:run-abc:0', kind: 'mistake', fen: START, solution: ['d2d4'], playedUci: 'e2e4', label: 'From a run', step: 0, reps: 0 });
    expect(c.due).toBeGreaterThan(1000);
    expect(momentCard('abc', 1, { ...mom(20, 1), best: 'e2e4' })).toBeNull();
  });
});

describe('stage B: nemesis', () => {
  it('a dominant mapped theme in ≥ minCount of the recent games becomes the nemesis', () => {
    expect(nemesisFor([['hangingPiece'], ['hangingPiece', 'fork'], ['pin'], ['hangingPiece']])).toBe('hangingPiece');
    expect(nemesisFor([['defense'], ['defense'], ['defense']])).toBe('defense');
  });
  it('no nemesis without a pattern, with too few games, or for an unmapped theme', () => {
    expect(nemesisFor([['fork'], ['pin'], ['hangingPiece'], ['defense']])).toBeUndefined();
    expect(nemesisFor([['fork'], ['fork']])).toBeUndefined();
    expect(nemesisFor([['opening'], ['opening'], ['opening']])).toBeUndefined();
  });
  it('only looks at the most recent games', () => {
    const old = [['fork'], ['fork'], ['fork']];
    expect(nemesisFor([['pin'], ['pin'], ['opening'], ['trade'], ['endgame'], ...old])).toBeUndefined();
  });
  it('nemesis rules only touch scoring, Composure or card access', () => {
    for (const m of Object.values(T.nemesis.rules)) expect(Object.keys(m).every((k) => ['name', 'blunderFactor', 'sealed', 'multBonus', 'mistakeExtra', 'blunderEnds', 'inaccuracyCost'].includes(k))).toBe(true);
    expect(T.nemesis.rules.hangingPiece.blunderFactor).toBe(2);
    expect(T.nemesis.rules.defense.sealed).toEqual(['lens']);
  });
});

describe('stage B: Grimoire', () => {
  it('counts met, cleared, failed; 3 clears in a row = mastered, a fail resets the streak', () => {
    let g: Grimoire = {};
    g = noteScenario(g, 'hold', true);
    g = noteScenario(g, 'hold', true);
    expect(isMastered(g.hold)).toBe(false);
    g = noteScenario(g, 'hold', false);
    expect(g.hold).toEqual({ met: 3, cleared: 2, failed: 1, streak: 0 });
    for (let i = 0; i < 3; i++) g = noteScenario(g, 'hold', true);
    expect(isMastered(g.hold)).toBe(true);
  });
  it('scenario of a room', () => {
    expect(scenarioOf({ kind: 'convert', goal: 'gain' })).toBe('gain');
    expect(scenarioOf({ kind: 'vault' }, 'krk')).toBe('vault:krk');
    expect(scenarioOf({ kind: 'puzzle' })).toBeNull();
    expect(scenarioOf({ kind: 'boss' })).toBeNull();
  });
  it('weight = 1 + grimoireWeight × fail rate; unseen and mastered = 1; prefixes take the worst', () => {
    const g: Grimoire = { hold: { met: 4, cleared: 1, failed: 3, streak: 0 }, duel: { met: 5, cleared: 3, failed: 2, streak: 3 }, 'riddle:fork': { met: 2, cleared: 0, failed: 2, streak: 0 }, 'riddle:pin': { met: 2, cleared: 2, failed: 0, streak: 2 } };
    expect(scenarioWeight(g, 'hold')).toBeCloseTo(1 + T.grimoire.grimoireWeight * 0.75);
    expect(scenarioWeight(g, 'duel')).toBe(1);
    expect(scenarioWeight(g, 'ward')).toBe(1);
    expect(scenarioWeight(g, 'riddle')).toBe(1 + T.grimoire.grimoireWeight);
  });
  it('the map favours scenarios with the worst clear rate', () => {
    const pools = { convert: 10, hold: 10, boss: 10, ward: 10, duel: 10, vault: 4, vaultDrills: ['kqk', 'kqk', 'krk', 'krk'] };
    const count = (bias?: (k: string) => number) => {
      let holds = 0;
      let krk = 0;
      for (let i = 0; i < 300; i++) {
        const m = buildMap(Math.random, pools, {}, bias);
        holds += m.flat().filter((n) => n.kind === 'hold').length;
        krk += m.flat().filter((n) => n.kind === 'vault' && (n.pos ?? 0) >= 2).length / Math.max(1, m.flat().filter((n) => n.kind === 'vault').length);
      }
      return { holds, krk };
    };
    const plain = count();
    const biased = count((k) => (k === 'hold' || k === 'vault:krk' ? 3 : 1));
    expect(biased.holds).toBeGreaterThan(plain.holds * 1.3);
    expect(biased.krk).toBeGreaterThan(plain.krk * 1.2);
  });
});

// ---------------------------------------------------------------- Stage C
import { heatRules, heatFor, heatAfterWin, heatAllowed, limits, rivalElo, maxComposure } from '../run/rules';
import { refundFor, BOOSTS, UNLOCKS } from '../run/meta';

describe('stage C: Heat ladder', () => {
  it('constraints stack: each level adds one', () => {
    expect(heatRules(0)).toEqual({ rivalPlus: 0, rivalInaccuracy: false, evalWordsOnly: false, noEye: false, graceLess: 0, evalHidden: false });
    expect(heatRules(1).rivalPlus).toBe(T.heat.rivalElo);
    expect(heatRules(2).rivalInaccuracy).toBe(true);
    expect(heatRules(3).evalWordsOnly && !heatRules(3).noEye).toBe(true);
    expect(heatRules(4).noEye).toBe(true);
    expect(heatRules(5).graceLess).toBe(T.heat.graceLess);
    expect(heatRules(6)).toEqual({ rivalPlus: T.heat.rivalElo, rivalInaccuracy: true, evalWordsOnly: true, noEye: true, graceLess: T.heat.graceLess, evalHidden: true });
  });
  it('only on Adept and Master, capped by what is unlocked; a win unlocks the next, up to 6', () => {
    expect(heatAllowed('apprentice')).toBe(false);
    expect(heatFor('apprentice', 3, 6)).toBe(0);
    expect(heatFor('adept', 3, 1)).toBe(1);
    expect(heatFor('master', 2, 4)).toBe(2);
    expect(heatAfterWin(0, 0)).toBe(1);
    expect(heatAfterWin(3, 3)).toBe(4);
    expect(heatAfterWin(1, 4)).toBe(4);
    expect(heatAfterWin(6, 6)).toBe(6);
  });
  it('Heat 1: rivals +100; Heat 2: inaccuracies cost a candle against the rival only', () => {
    const r = { bossId: 'tom', strength: 900, rating: 900, difficulty: 'adept', cursed: false } as unknown as Run;
    expect(rivalElo({ ...r, heat: 1 } as Run) - rivalElo(r)).toBe(T.heat.rivalElo);
    const boss = { node: { kind: 'boss' as const, modifier: 'rival' as const } };
    const hold = { node: { kind: 'hold' as const, modifier: 'steady' as const } };
    expect(composureCost('inaccuracy', { ...boss, heat: 1 })).toBe(0);
    expect(composureCost('inaccuracy', { ...boss, heat: 2 })).toBe(T.heat.inaccuracyCost);
    expect(composureCost('inaccuracy', { ...hold, heat: 6 })).toBe(0);
  });
  it('Heat 5: one move less to recover, never below 1', () => {
    const node = { kind: 'hold' as const };
    expect(limits(node, 'adept', undefined, 4).grace).toBe(2);
    expect(limits(node, 'adept', undefined, 5).grace).toBe(1);
    expect(limits(node, 'master', undefined, 6).grace).toBe(1);
  });
  it('a rival win pays Embers per Heat level', () => {
    const won = { results: [{ won: true }], finalScore: 0, ended: 'won', cursed: false, difficulty: 'adept' } as unknown as Run;
    expect(embersFor({ ...won, heat: 3 } as Run) - embersFor(won)).toBe(3 * T.heat.embersPerLevel);
    expect(embersFor({ ...won, ended: 'lost', heat: 3 } as Run)).toBe(embersFor({ ...won, ended: 'lost' } as Run));
  });
});

describe('stage C: Sanctum — breadth, not power', () => {
  it('power boosts are gone and refunded in full; Vault is free from the start', () => {
    expect(BOOSTS.map((b) => b.id).sort()).toEqual(['cartographer', 'keeneye', 'nerves', 'notes', 'reroll']);
    expect(refundFor({ purse: 2, candle: 1, pocket: 1, notes: 1 }, ['room:vault', 'relic:tempo'])).toBe(8 + 16 + 20 + 30 + 12);
    expect(refundFor({ notes: 1, reroll: 1 }, [])).toBe(0);
    expect(UNLOCKS.some((u) => u.id === 'room:vault')).toBe(false);
    expect(UNLOCKS.filter((u) => u.kind === 'drill').map((u) => [u.ref, u.cost])).toEqual(T.sanctum.lockedDrills.map((d) => [d, 12]));
  });
  it('no boost changes candles, card slots or prices any more', () => {
    const r = { relics: [], meta: { boosts: { candle: 2, pocket: 1, haggler: 1 } } } as unknown as Run;
    expect(maxComposure(r)).toBe(T.composure.max);
    expect(cardSlots(r)).toBe(T.consumables.maxHeld);
    expect(stallPrice(r, 'calm')).toBe(T.shop.stallPrice.common);
  });
  it('locked Vault drills never appear on the map', () => {
    const pools = { convert: 10, hold: 10, boss: 10, ward: 10, duel: 10, vault: 4, vaultDrills: ['kqk', 'lucena', 'krk', 'qvp'] };
    for (let i = 0; i < 200; i++) {
      const m = buildMap(Math.random, pools, { drills: ['lucena', 'qvp'] });
      for (const n of m.flat()) if (n.kind === 'vault') expect([0, 2]).toContain(n.pos);
    }
  });
});

describe('stage C: Vault hold-the-draw drills', () => {
  const PHIL = '4k3/7R/r7/4PK2/8/8/8/8 b - - 0 1';
  const vroom = (moves: number, ev: number, fen = PHIL) =>
    room({ node: { kind: 'vault', modifier: 'steady' }, me: 'b', startFen: PHIL, fen, vault: { goal: 'hold', maxMoves: 15, title: 'Philidor' }, moves: Array.from({ length: moves }, () => mv({ evalAfter: ev })) });
  it('holding for the move limit wins; a lost eval or a promotion fails', () => {
    expect(judge(vroom(15, -20), 'reply')?.status).toBe('won');
    expect(judge(vroom(10, -20), 'reply')).toBeNull();
    expect(judge(vroom(5, -T.rooms.vault.holdFailCp - 1), 'mine')?.status).toBe('failed');
    expect(judge(vroom(5, -50, '4k3/8/8/8/8/8/8/K3Q3 b - - 0 1'), 'reply')?.status).toBe('failed');
  });
  it('a drawn game counts as held', () => {
    expect(judge(vroom(3, 0, '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1'), 'reply')?.status).toBe('won');
  });
});

// ---------------------------------------------------------------- Stage D
import { kingUntouched, tacticsIn, fightsLeft, echoDrop, nullMoveFen, stallExtraPrice } from '../run/rules';
import { ARCHETYPE, nodeArchetypes } from '../run/content';

describe('stage D: rewards, Castle Keep, map', () => {
  it('free picks come from skill: beat the blind (elites always pay a relic) — no random chance left', () => {
    expect((T as unknown as Record<string, unknown>).rewardChance).toBeUndefined();
  });
  it('Castle Keep: +1 mult at room end only if the king was never checked nor its zone attacked', () => {
    const safe = 'r5k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1';
    const zoneHit = 'r5k1/5ppp/8/8/8/8/5PPP/r5K1 w - - 0 1'; // rook on the back rank hits f1/h1 (and checks)
    const nearZone = '6k1/5ppp/8/8/8/8/5PPP/3r2K1 w - - 0 1';
    const bishopEyes = '6k1/5ppp/8/8/8/8/2b2PPP/6K1 w - - 0 1'; // bishop c2 eyes ... d1/e4/f5; not the zone
    expect(kingUntouched([safe], 'w')).toBe(true);
    expect(kingUntouched([safe, zoneHit], 'w')).toBe(false);
    expect(kingUntouched([nearZone], 'w')).toBe(false);
    expect(kingUntouched([bishopEyes], 'w')).toBe(true);
    const run = { relics: ['castle'], results: [] } as unknown as Run;
    const rm = room({ me: 'w', startFen: safe, plies: [{ uci: 'a2a3', san: 'a3', fen: safe, by: 'me' }], moves: [mv({ fenBefore: safe })] });
    expect(endFires(run, rm).find((f) => f.relic === 'castle')?.mult).toBe(T.relics.castleMult);
    expect(endFires(run, { ...rm, plies: [...rm.plies, { uci: 'a8a1', san: 'Ra1+', fen: zoneHit, by: 'opp' }] }).find((f) => f.relic === 'castle')).toBeUndefined();
  });
  it('fights left: counts rooms (not events or camps) on the fewest and most expensive route', () => {
    const L = [
      [{ kind: 'hold', modifier: 'steady', next: [0, 1] }],
      [{ kind: 'event', modifier: 'steady', next: [0] }, { kind: 'duel', modifier: 'steady', next: [0] }],
      [{ kind: 'camp', modifier: 'steady', next: [0] }],
      [{ kind: 'boss', modifier: 'rival' }],
    ] as unknown as Parameters<typeof fightsLeft>[0];
    expect(fightsLeft(L, 0, 0)).toEqual([2, 3]);
    expect(fightsLeft(L, 1, 0)).toEqual([1, 1]);
    expect(fightsLeft(L, 1, 1)).toEqual([2, 2]);
  });
  it('real maps include the Echo and the Mirror', () => {
    let echo = 0;
    let mirror = 0;
    for (let i = 0; i < 100; i++) {
      const m = buildMap(Math.random, { convert: 10, hold: 10, boss: 10, ward: 10, duel: 10, vault: 10, echo: 5, mirror: 10 });
      echo += m.flat().filter((n) => n.kind === 'echo').length;
      mirror += m.flat().filter((n) => n.kind === 'mirror').length;
    }
    expect(echo).toBeGreaterThan(20);
    expect(mirror).toBeGreaterThan(20);
  });
});

describe('stage D: the Echo and the Mirror', () => {
  const echoRoom = (moves: UserMove[]) => room({ node: { kind: 'echo', modifier: 'steady' }, fen: START, moves, diff: 'adept' });
  it('Echo: fails when one move gives away more than echoMaxDropCp; wins after its moves', () => {
    const ok = mv({ evalBefore: 200, evalAfter: 200 - T.rooms.echo.echoMaxDropCp });
    const bad = mv({ evalBefore: 200, evalAfter: 200 - T.rooms.echo.echoMaxDropCp - 1 });
    expect(judge(echoRoom([ok]), 'mine')).toBeNull();
    expect(judge(echoRoom([bad]), 'mine')?.status).toBe('failed');
    expect(judge(echoRoom(Array(T.rooms.echo.moves).fill(ok)), 'mine')?.status).toBe('won');
  });
  it('Echo: mate scores are clamped, so a still-winning move from a mate line is fine', () => {
    expect(echoDrop({ evalBefore: 10000, evalAfter: 1400 })).toBe(T.rooms.echo.clampCp - 1400);
    expect(echoDrop({ evalBefore: -300, evalAfter: 100 })).toBe(0);
  });
  it('Mirror: a hold room of mirror.moves; null-move position flips the side, not when in check', () => {
    const mr = (n: number, ev: number) => room({ node: { kind: 'mirror', modifier: 'steady' }, fen: START, startEval: 0, diff: 'adept', moves: Array(n).fill(mv({ evalAfter: ev })) });
    expect(judge(mr(T.rooms.mirror.moves, 0), 'mine')?.status).toBe('won');
    expect(judge(mr(3, -5000), 'mine')?.status).toBe('failed');
    expect(nullMoveFen(START)?.split(' ')[1]).toBe('b');
    expect(nullMoveFen('4k3/8/8/8/8/8/8/4K2r w - - 0 1')).toBeNull();
  });
});

describe('stage D: archetypes and keystones', () => {
  it('every relic has an archetype; nodes suit them', () => {
    for (const id of Object.keys(RELICS)) expect(ARCHETYPE[id as keyof typeof ARCHETYPE]).toBeTruthy();
    expect(nodeArchetypes({ kind: 'puzzle' })).toEqual(['tactician']);
    expect(nodeArchetypes({ kind: 'ward' })).toEqual(['fortress']);
    expect(nodeArchetypes({ kind: 'convert', goal: 'keep' })).toEqual(['technician']);
    expect(nodeArchetypes({ kind: 'convert', goal: 'gain' })).toEqual([]);
    for (const k of ['combination', 'bulwark', 'endgamesense', 'ascetic', 'patron'] as const) expect(RELICS[k].rarity).toBe('rare');
  });
  it('Combination: ×1.5 per tactic after the first', () => {
    const fork = mv({ cls: 'best', uci: 'b5c7', san: 'Nc7+', fenBefore: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1' }); // royal fork: king e8 + rook a8
    const r = { relics: ['combination'], results: [] } as unknown as Run;
    expect(tacticsIn({ moves: [fork] })).toBe(1);
    expect(tacticsIn({ moves: [{ ...fork, cls: 'mistake' }] })).toBe(0);
    const f = endFires(r, room({ moves: [fork, fork, fork] })).find((x) => x.relic === 'combination');
    expect(f?.xmult).toBeCloseTo(T.relics.combinationX ** 2);
    expect(endFires(r, room({ moves: [fork] })).find((x) => x.relic === 'combination')).toBeUndefined();
  });
  it('Bulwark: mistakes free in Siege and Ward, not elsewhere; blunders still cost', () => {
    const ctx = (kind: 'hold' | 'ward' | 'duel') => ({ node: { kind, modifier: 'steady' as const }, relics: ['bulwark'] as RelicId[] });
    expect(composureCost('mistake', ctx('hold'))).toBe(0);
    expect(composureCost('mistake', ctx('ward'))).toBe(0);
    expect(composureCost('mistake', ctx('duel'))).toBe(1);
    expect(composureCost('blunder', ctx('hold'))).toBe(2);
  });
  it('Endgame Sense ×2 in Vaults; Ascetic: no card slots, +2 mult everywhere', () => {
    const r = (id: RelicId) => ({ relics: [id], results: [] }) as unknown as Run;
    expect(endFires(r('endgamesense'), room({ node: { kind: 'vault', modifier: 'steady' } })).find((f) => f.relic === 'endgamesense')?.xmult).toBe(T.relics.endgameSenseX);
    expect(endFires(r('endgamesense'), room({})).find((f) => f.relic === 'endgamesense')).toBeUndefined();
    expect(maxConsumables(['ascetic'], 1)).toBe(0);
    expect(endFires(r('ascetic'), room({})).find((f) => f.relic === 'ascetic')?.mult).toBe(T.relics.asceticMult);
  });
  it('Patron: the second stall relic costs half', () => {
    const r = { relics: ['patron'] } as unknown as Run;
    expect(stallExtraPrice(r, 'perfectionist')).toBe(Math.round(T.shop.stallPrice.rare * T.relics.patronDiscount));
  });
});
