// Pure rules of a run: map generation, Composure costs, room goals, relic triggers, scoring.
// No engine, no storage, no React — easy to test and to tune.
import { Chess } from 'chess.js';
import { materialBalance, parseFen } from '../lib/chess/pos';
import type { Classification, Score } from '../lib/chess/evaluation';
import { moveMotifs, type Motif } from '../lib/coach/tactics';
import { TUNING as T } from './tuning';
import type { ConsumableId, Fire, MapNode, ModifierId, RelicId, RoomKind, RoomState, Run, UserMove } from './types';

export const ALL_RELICS: RelicId[] = ['calm', 'bloodhound', 'forkmaster', 'ironwall', 'pins', 'clean', 'spendthrift', 'bloomer'];
export const ALL_CONSUMABLES: ConsumableId[] = ['eye', 'rewind', 'cards', 'lens', 'opinion', 'insurance'];

export type Rand = () => number;
export const pickOne = <X,>(a: readonly X[], rand: Rand): X => a[Math.floor(rand() * a.length)];
export function sample<X>(a: readonly X[], n: number, rand: Rand): X[] {
  const pool = [...a];
  const out: X[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
function weighted<X extends string>(w: Record<X, number>, n: number, rand: Rand, exclude: X[] = []): X[] {
  const out: X[] = [];
  const keys = (Object.keys(w) as X[]).filter((k) => !exclude.includes(k));
  while (out.length < n && keys.length) {
    const total = keys.reduce((s, k) => s + w[k], 0);
    let r = rand() * total;
    let i = 0;
    for (; i < keys.length - 1; i++) {
      r -= w[keys[i]];
      if (r <= 0) break;
    }
    out.push(keys.splice(i, 1)[0]);
  }
  return out;
}
export const consumableOffer = (n: number, rand: Rand) => weighted<ConsumableId>({ ...T.consumables.weight }, n, rand);

/** One act: a puzzle room, two forks of two options, then the boss. */
export function buildMap(rand: Rand, pools: { convert: number; hold: number; boss: number }): MapNode[][] {
  const mod = (): ModifierId => pickOne<ModifierId>(['steady', 'gilded', 'focused'], rand);
  const node = (kind: RoomKind): MapNode => ({
    kind,
    modifier: mod(),
    goal: kind === 'convert' ? pickOne(['gain', 'keep'] as const, rand) : undefined,
    pos: kind === 'puzzle' ? undefined : Math.floor(rand() * pools[kind as 'convert' | 'hold']),
  });
  const fork = (): MapNode[] => {
    const kinds = sample<RoomKind>(['puzzle', 'convert', 'hold'], 2, rand);
    return kinds.map(node);
  };
  return [[{ kind: 'puzzle', modifier: 'steady' }], fork(), fork(), [{ kind: 'boss', modifier: 'pickpocket', pos: Math.floor(rand() * pools.boss) }]];
}

/** Your-POV centipawns, mates mapped to ±10000. */
export function povCp(s: Score, me: 'w' | 'b'): number {
  const v = me === 'w' ? s.value : -s.value;
  if (s.type === 'mate') return v === 0 ? (me === 'w' ? -10000 : 10000) : Math.sign(v) * 10000;
  return v;
}

/** Composure a move costs, before Insurance. */
export function composureCost(cls: Classification, node: MapNode): number {
  let c: number = T.composure.cost[cls];
  if (cls === 'blunder') {
    if (node.modifier === 'focused') c += T.modifiers.focused.extraBlunderCost;
    if (node.modifier === 'pickpocket') c *= T.boss.pickpocketBlunderFactor;
  }
  return c;
}

export const sound = (c: Classification) => c === 'best' || c === 'good';

/** Relics that fire on a single (your) move. */
export function moveFires(relics: RelicId[], room: RoomState, m: UserMove, at: number, motifs: Motif[] = moveMotifs(m.fenBefore, m.uci)): Fire[] {
  if (!sound(m.cls)) return [];
  const out: Fire[] = [];
  const has = (r: RelicId) => relics.includes(r);
  if (has('clean') && m.cls === 'best') out.push({ relic: 'clean', mult: T.relics.cleanHandsMult, at });
  if (has('forkmaster') && motifs.some((x) => x.kind === 'fork')) out.push({ relic: 'forkmaster', mult: T.relics.forkMult, at });
  if (has('pins') && motifs.some((x) => x.kind === 'pin')) out.push({ relic: 'pins', mult: T.relics.pinMult, at });
  if (has('bloodhound') && motifs.some((x) => x.kind === 'freeCapture')) out.push({ relic: 'bloodhound', gold: T.relics.bloodhoundGold, at });
  if (has('ironwall') && room.node.kind === 'hold') out.push({ relic: 'ironwall', mult: T.relics.ironWallMult, at });
  return out;
}

/** Relics that fire when a room ends. */
export function endFires(run: Run, room: RoomState): Fire[] {
  const out: Fire[] = [];
  const cleared = run.results.filter((r) => r.won).length;
  if (run.relics.includes('bloomer') && cleared > 0) out.push({ relic: 'bloomer', mult: T.relics.lateBloomerPerRoom * cleared, at: -1 });
  if (run.relics.includes('calm') && room.moves.length > 0 && room.moves.every((m) => sound(m.cls)))
    out.push({ relic: 'calm', composure: T.relics.calmComposure, at: -1 });
  return out;
}

export function roomScore(room: RoomState, run: Run) {
  const chips = Math.round(room.moves.reduce((s, m) => s + m.accuracy, 0));
  const modMult = room.node.modifier === 'focused' ? T.modifiers.focused.mult : 0;
  const mult = Math.round((T.score.baseMult + modMult + room.fires.reduce((s, f) => s + (f.mult ?? 0), 0)) * 100) / 100;
  const clean = room.moves.every((m) => m.cls !== 'mistake' && m.cls !== 'blunder');
  let gold = 0;
  if (room.status === 'won') {
    gold = T.gold.perRoom[room.node.kind] + (clean ? T.gold.cleanBonus : 0);
    if (room.node.modifier === 'gilded') gold = Math.round(gold * T.modifiers.gilded.goldMult);
  }
  gold += room.fires.reduce((s, f) => s + (f.gold ?? 0), 0);
  void run;
  return { chips, mult, score: Math.round(chips * mult), gold, clean };
}

export function maxConsumables(relics: RelicId[]) {
  return T.consumables.maxHeld - (relics.includes('spendthrift') ? T.relics.spendthriftCarryPenalty : 0);
}
export function price(id: ConsumableId, relics: RelicId[]) {
  const p = T.consumables.price[id];
  return relics.includes('spendthrift') ? Math.max(1, Math.round(p * T.relics.spendthriftPriceFactor)) : p;
}
export function restPrice(relics: RelicId[]) {
  return relics.includes('spendthrift') ? Math.max(1, Math.round(T.shop.restPrice * T.relics.spendthriftPriceFactor)) : T.shop.restPrice;
}

const mat = (fen: string, me: 'w' | 'b') => materialBalance(parseFen(fen).board, me);

/**
 * Has the room been decided? Called after your move (`stage: 'mine'`, the eval in the move is
 * the position after it) and after the opponent's reply (`'reply'`).
 */
export function judge(room: RoomState, stage: 'mine' | 'reply'): { status: 'won' | 'failed'; reason: string } | null {
  const k = room.node.kind;
  if (k === 'puzzle') return null;
  const c = new Chess(room.fen);
  const last = room.moves[room.moves.length - 1];
  const n = room.moves.length;
  if (c.isCheckmate()) {
    const iMated = c.turn() !== room.me;
    return iMated ? { status: 'won', reason: 'Checkmate!' } : { status: 'failed', reason: 'You were checkmated.' };
  }
  if (c.isDraw() || c.isStalemate()) {
    return k === 'hold' ? { status: 'won', reason: 'A draw — you held!' } : { status: 'failed', reason: 'The game ended in a draw.' };
  }
  const r = T.rooms;
  if (k === 'convert' && room.node.goal === 'keep') {
    if (stage === 'mine' && last) {
      if (last.evalAfter < r.convert.keepCp) return { status: 'failed', reason: `Dropped below +${r.convert.keepCp / 100}.` };
      if (n >= r.convert.keepMoves) return { status: 'won', reason: `Stayed above +${r.convert.keepCp / 100} for ${n} moves.` };
    }
    return null;
  }
  if (k === 'convert') {
    if (stage === 'reply') {
      const gain = mat(room.fen, room.me) - mat(room.startFen, room.me);
      if (gain >= r.convert.gainMaterial) return { status: 'won', reason: `Won ${gain} points of material.` };
      if (n >= r.convert.gainMoves) return { status: 'failed', reason: `No material won in ${n} moves.` };
    }
    return null;
  }
  if (k === 'hold') {
    if (stage === 'mine' && last) {
      if (last.evalAfter < room.startEval - r.hold.maxDropCp) return { status: 'failed', reason: 'The position slipped too far.' };
      if (n >= r.hold.moves) return { status: 'won', reason: `Held for ${n} moves.` };
    }
    return null;
  }
  // boss
  if (stage === 'mine' && last) {
    if (last.evalAfter >= r.boss.winCp) return { status: 'won', reason: `Reached ${fmtCp(last.evalAfter)}!` };
    if (n >= r.boss.moves)
      return last.evalAfter >= r.boss.endCp ? { status: 'won', reason: `Ahead (${fmtCp(last.evalAfter)}) when time ran out.` } : { status: 'failed', reason: `Only ${fmtCp(last.evalAfter)} after ${n} moves.` };
  }
  return null;
}

export const fmtCp = (cp: number) => (Math.abs(cp) >= 9000 ? (cp > 0 ? 'mate' : '-mate') : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`);

/** Goal progress line under the board. */
export function progress(room: RoomState): string {
  const n = room.moves.length;
  const r = T.rooms;
  switch (room.node.kind) {
    case 'puzzle': {
      const p = room.puzzle!;
      return `Puzzle ${Math.min(p.index + 1, r.puzzle.count)}/${r.puzzle.count} · solved ${p.solved}/${r.puzzle.needSolved}`;
    }
    case 'convert':
      return room.node.goal === 'keep'
        ? `Move ${n}/${r.convert.keepMoves} · stay ≥ +${r.convert.keepCp / 100}`
        : `Move ${n}/${r.convert.gainMoves} · material ${signed(mat(room.fen, room.me) - mat(room.startFen, room.me))}/+${r.convert.gainMaterial}`;
    case 'hold':
      return `Move ${n}/${r.hold.moves} · floor ${fmtCp(room.startEval - r.hold.maxDropCp)}`;
    case 'boss':
      return `Move ${n}/${r.boss.moves} · reach +${r.boss.winCp / 100}`;
  }
}
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
