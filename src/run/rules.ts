// Pure rules of a run: map generation, Composure costs, room goals, relic triggers, scoring.
// No engine, no storage, no React — easy to test and to tune.
import { Chess } from 'chess.js';
import { materialBalance, parseFen } from '../lib/chess/pos';
import type { Classification, Score } from '../lib/chess/evaluation';
import { moveMotifs, type Motif } from '../lib/coach/tactics';
import { RELICS, bossGoal } from './content';
import { TUNING as T, type BossMod } from './tuning';
import type { ConsumableId, CurseId, EventKind, Fire, MapNode, ModifierId, Rarity, RelicId, RoomKind, RoomState, Run, UserMove } from './types';

export const ALL_RELICS = Object.keys(RELICS) as RelicId[];
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
  const keys = (Object.keys(w) as X[]).filter((k) => !exclude.includes(k) && w[k] > 0);
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

/** 1-of-n relic offer weighted by rarity, never a relic you already own. */
export function relicOffer(owned: RelicId[], n: number, rand: Rand, rarity: Record<Rarity, number> = T.relics.rarity, only?: Rarity): RelicId[] {
  const w = Object.fromEntries(
    ALL_RELICS.map((id) => {
      const r = RELICS[id].rarity ?? 'common';
      return [id, owned.includes(id) || (only && r !== only) ? 0 : rarity[r] / ALL_RELICS.filter((x) => RELICS[x].rarity === r).length];
    }),
  ) as Record<RelicId, number>;
  return weighted(w, n, rand);
}

export interface Pools {
  convert: number;
  hold: number;
  boss: number;
  ward: number;
  duel: number;
  vault: number;
}

/** One act: an opening room, three forks of two options (one event guaranteed), then the boss. */
export function buildMap(rand: Rand, pools: Pools): MapNode[][] {
  const mod = (): ModifierId => pickOne<ModifierId>(['steady', 'steady', 'gilded', 'focused'], rand);
  const room = (kind: RoomKind, layer: number): MapNode => ({
    kind,
    modifier: mod(),
    goal: kind === 'convert' ? pickOne(['gain', 'keep'] as const, rand) : undefined,
    pos: kind === 'puzzle' ? undefined : Math.floor(rand() * Math.max(1, pools[kind as keyof Pools] ?? 1)),
    elite: layer >= 2 && rand() < T.elite.chance ? true : undefined,
  });
  const event = (): MapNode => ({ kind: 'event', modifier: 'steady', event: pickOne<EventKind>(['shrine', 'gambler', 'merchant', 'altar'], rand) });
  const kinds: RoomKind[] = ['puzzle', 'convert', 'hold', 'ward', 'vault', 'duel'];
  const used = new Set<RoomKind>();
  const fork = (layer: number): MapNode[] => {
    // Prefer kinds not seen yet, so a run shows variety.
    const fresh = kinds.filter((k) => !used.has(k));
    const two = sample(fresh.length >= 2 ? fresh : kinds, 2, rand);
    two.forEach((k) => used.add(k));
    return two.map((k) => room(k, layer));
  };
  const first = room(pickOne<RoomKind>(['puzzle', 'duel'], rand), 0);
  used.add(first.kind as RoomKind);
  const layers = [[first], fork(1), fork(2), fork(3)];
  if (rand() < T.events.chance) layers[1][1] = event();
  const evLayer = 2 + Math.floor(rand() * 2);
  layers[evLayer][Math.floor(rand() * 2)] = event();
  layers.push([{ kind: 'boss', modifier: 'rival', pos: Math.floor(rand() * pools.boss) }]);
  return layers;
}

/** Your-POV centipawns, mates mapped to ±10000. */
export function povCp(s: Score, me: 'w' | 'b'): number {
  const v = me === 'w' ? s.value : -s.value;
  if (s.type === 'mate') return v === 0 ? (me === 'w' ? -10000 : 10000) : Math.sign(v) * 10000;
  return v;
}

export interface CostCtx {
  node: MapNode;
  boss?: BossMod;
  curses?: CurseId[];
}

/** Composure a move costs, before Insurance. */
export function composureCost(cls: Classification, ctx: CostCtx): number {
  const { node, boss, curses = [] } = ctx;
  let c: number = T.composure.cost[cls];
  if (cls === 'inaccuracy' && boss?.inaccuracyCost) c += boss.inaccuracyCost;
  if (cls === 'mistake') {
    if (boss?.mistakeExtra) c += boss.mistakeExtra;
    if (curses.includes('brittle')) c += T.curses.brittleMistakeExtra;
  }
  if (cls === 'blunder') {
    if (node.modifier === 'focused') c += T.modifiers.focused.extraBlunderCost;
    if (boss?.blunderFactor) c *= boss.blunderFactor;
  }
  return c;
}

export const sound = (c: Classification) => c === 'best' || c === 'good';

/** Relics (and the rival's rule) that fire on a single (your) move. */
export function moveFires(relics: RelicId[], room: RoomState, m: UserMove, at: number, boss?: BossMod, motifs?: Motif[]): Fire[] {
  if (!sound(m.cls)) return [];
  motifs ??= moveMotifs(m.fenBefore, m.uci);
  const out: Fire[] = [];
  const has = (r: RelicId) => relics.includes(r);
  const capture = m.san.includes('x');
  const check = m.san.includes('+') || m.san.includes('#');
  if (has('clean') && m.cls === 'best') out.push({ relic: 'clean', mult: T.relics.cleanHandsMult, at });
  if (has('forkmaster') && motifs.some((x) => x.kind === 'fork')) out.push({ relic: 'forkmaster', mult: T.relics.forkMult, at });
  if (has('pins') && motifs.some((x) => x.kind === 'pin')) out.push({ relic: 'pins', mult: T.relics.pinMult, at });
  if (has('bloodhound') && motifs.some((x) => x.kind === 'freeCapture')) out.push({ relic: 'bloodhound', gold: T.relics.bloodhoundGold, at });
  if (has('ironwall') && room.node.kind === 'hold') out.push({ relic: 'ironwall', mult: T.relics.ironWallMult, at });
  if (has('hunter') && capture) out.push({ relic: 'hunter', mult: T.relics.hunterMult, at });
  if (has('patience') && !capture && !check) out.push({ relic: 'patience', mult: T.relics.patienceMult, at });
  if (boss?.captureMult && capture) out.push({ relic: 'rival', mult: boss.captureMult, at });
  return out;
}

/** Relics (and the rival's rule) that fire when a room ends. */
export function endFires(run: Run, room: RoomState, boss?: BossMod): Fire[] {
  const out: Fire[] = [];
  const cleared = run.results.filter((r) => r.won).length;
  const has = (r: RelicId) => run.relics.includes(r);
  if (has('bloomer') && cleared > 0) out.push({ relic: 'bloomer', mult: T.relics.lateBloomerPerRoom * cleared, at: -1 });
  if (has('glass')) out.push({ relic: 'glass', mult: T.relics.glassMult, at: -1 });
  const lastMine = [...room.plies].reverse().find((p) => p.by === 'me');
  if (has('executioner') && room.status === 'won' && lastMine?.san.endsWith('#')) out.push({ relic: 'executioner', mult: T.relics.executionerMult, at: -1 });
  if (has('scholar') && room.puzzle && room.puzzle.solved > 0) out.push({ relic: 'scholar', gold: T.relics.scholarGold * room.puzzle.solved, at: -1 });
  if (boss?.multBonus) out.push({ relic: 'rival', mult: boss.multBonus, at: -1 });
  if (has('calm') && room.moves.length > 0 && room.moves.every((m) => sound(m.cls))) out.push({ relic: 'calm', composure: T.relics.calmComposure, at: -1 });
  return out;
}

export function chipTarget(room: RoomState): number {
  return room.moves.length * (room.node.elite ? T.score.eliteTargetPerMove : T.score.targetPerMove);
}

export function roomScore(room: RoomState) {
  const chips = Math.round(room.moves.reduce((s, m) => s + m.accuracy, 0));
  const modMult = room.node.modifier === 'focused' ? T.modifiers.focused.mult : 0;
  const mult = Math.round((T.score.baseMult + modMult + room.fires.reduce((s, f) => s + (f.mult ?? 0), 0)) * 100) / 100;
  const clean = room.moves.every((m) => m.cls !== 'mistake' && m.cls !== 'blunder');
  const target = chipTarget(room);
  const beatTarget = room.moves.length > 0 && chips >= target;
  let gold = 0;
  if (room.status === 'won' && room.node.kind !== 'event' && !room.gamble) {
    gold = T.gold.perRoom[room.node.kind as RoomKind] + (clean ? T.gold.cleanBonus : 0) + (beatTarget ? T.gold.targetBonus : 0);
    if (room.node.modifier === 'gilded') gold = Math.round(gold * T.modifiers.gilded.goldMult);
  }
  if (room.gamble && room.status === 'won') gold += T.events.gambleWin;
  gold += room.fires.reduce((s, f) => s + (f.gold ?? 0), 0);
  return { chips, mult, score: Math.round(chips * mult), gold, clean, target, beatTarget };
}

export function maxConsumables(relics: RelicId[]) {
  return T.consumables.maxHeld - (relics.includes('spendthrift') ? T.relics.spendthriftCarryPenalty : 0);
}
export function price(id: ConsumableId, relics: RelicId[]) {
  const p = T.consumables.price[id];
  return relics.includes('spendthrift') ? Math.max(1, Math.round(p * T.relics.spendthriftPriceFactor)) : p;
}
export function relicPrice(id: RelicId, relics: RelicId[]) {
  const p = T.events.relicPrice[RELICS[id].rarity ?? 'common'];
  return relics.includes('spendthrift') ? Math.max(1, Math.round(p * T.relics.spendthriftPriceFactor)) : p;
}
export function restPrice(relics: RelicId[]) {
  let p: number = T.shop.restPrice;
  if (relics.includes('lucky')) p -= T.relics.luckyRestDiscount;
  if (relics.includes('spendthrift')) p = Math.round(p * T.relics.spendthriftPriceFactor);
  return Math.max(1, p);
}
export const shopOffers = (relics: RelicId[]) => T.shop.offers + (relics.includes('lucky') ? T.relics.luckyExtraOffer : 0);

const mat = (fen: string, me: 'w' | 'b') => materialBalance(parseFen(fen).board, me);
const count = (fen: string, color: 'w' | 'b', type: string) => parseFen(fen).board.filter((p) => p && p.color === color && p.type === type).length;

/**
 * Has the room been decided? Called after your move (`stage: 'mine'`, the eval in the move is
 * the position after it) and after the opponent's reply (`'reply'`).
 */
export function judge(room: RoomState, stage: 'mine' | 'reply', boss?: BossMod): { status: 'won' | 'failed'; reason: string } | null {
  const k = room.node.kind;
  if (room.puzzle) return null;
  const c = new Chess(room.fen);
  const last = room.moves[room.moves.length - 1];
  const n = room.moves.length;
  const e = room.node.elite;
  if (c.isCheckmate()) {
    const iMated = c.turn() !== room.me;
    return iMated ? { status: 'won', reason: 'Checkmate!' } : { status: 'failed', reason: 'You were checkmated.' };
  }
  if (c.isDraw() || c.isStalemate()) {
    return k === 'hold' ? { status: 'won', reason: 'A draw — you held!' } : { status: 'failed', reason: 'The game ended in a draw.' };
  }
  const r = T.rooms;
  if (k === 'convert' && room.node.goal === 'keep') {
    const keep = e ? T.elite.keepCp : r.convert.keepCp;
    if (stage === 'mine' && last) {
      if (last.evalAfter < keep) return { status: 'failed', reason: `Dropped below +${keep / 100}.` };
      if (n >= r.convert.keepMoves) return { status: 'won', reason: `Stayed above +${keep / 100} for ${n} moves.` };
    }
    return null;
  }
  if (k === 'convert') {
    const moves = e ? T.elite.gainMoves : r.convert.gainMoves;
    if (stage === 'reply') {
      const gain = mat(room.fen, room.me) - mat(room.startFen, room.me);
      if (gain >= r.convert.gainMaterial) return { status: 'won', reason: `Won ${gain} points of material.` };
      if (n >= moves) return { status: 'failed', reason: `No material won in ${n} moves.` };
    }
    return null;
  }
  if (k === 'hold') {
    const drop = e ? T.elite.holdMaxDropCp : r.hold.maxDropCp;
    if (stage === 'mine' && last) {
      if (last.evalAfter < room.startEval - drop) return { status: 'failed', reason: 'The position slipped too far.' };
      if (n >= r.hold.moves) return { status: 'won', reason: `Held for ${n} moves.` };
    }
    return null;
  }
  if (k === 'duel') {
    const min = e ? T.elite.duelMinCp : r.duel.minCp;
    if (stage === 'mine' && last && n >= r.duel.moves)
      return last.evalAfter >= min ? { status: 'won', reason: `Out of the opening at ${fmtCp(last.evalAfter)}.` } : { status: 'failed', reason: `Out of the opening at only ${fmtCp(last.evalAfter)}.` };
    return null;
  }
  if (k === 'vault' && room.vault) {
    const v = room.vault;
    if (stage === 'reply') {
      const opp = room.me === 'w' ? 'b' : 'w';
      if (v.goal === 'promote' && count(room.fen, room.me, 'q') > count(room.startFen, room.me, 'q')) return { status: 'won', reason: 'Promoted, safely!' };
      if (v.goal === 'capture' && count(room.fen, opp, 'p') === 0 && count(room.fen, room.me, 'q') > 0) return { status: 'won', reason: 'The last pawn falls.' };
      if (n >= v.maxMoves) return { status: 'failed', reason: `Not finished in ${v.maxMoves} moves.` };
    }
    return null;
  }
  // boss
  const g = bossGoal(boss ?? T.bossMods.default);
  if (stage === 'mine' && last) {
    if (boss?.blunderEnds && last.cls === 'blunder') return { status: 'failed', reason: 'One blunder was all it took.' };
    if (!g.noEarlyWin && last.evalAfter >= g.winCp) return { status: 'won', reason: `Reached ${fmtCp(last.evalAfter)}!` };
    if (n >= g.moves)
      return last.evalAfter >= g.endCp ? { status: 'won', reason: `Ahead (${fmtCp(last.evalAfter)}) when time ran out.` } : { status: 'failed', reason: `Only ${fmtCp(last.evalAfter)} after ${n} moves.` };
  }
  return null;
}

export const fmtCp = (cp: number) => (Math.abs(cp) >= 9000 ? (cp > 0 ? 'mate' : '-mate') : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`);

/** Eval lines for the gauge: the room's floor and/or goal (your POV, cp). */
export function gaugeLines(room: RoomState, boss?: BossMod): { floor?: number; goal?: number } {
  const r = T.rooms;
  const e = room.node.elite;
  switch (room.node.kind) {
    case 'convert':
      return room.node.goal === 'keep' ? { floor: e ? T.elite.keepCp : r.convert.keepCp } : {};
    case 'hold':
      return { floor: room.startEval - (e ? T.elite.holdMaxDropCp : r.hold.maxDropCp) };
    case 'duel':
      return { floor: e ? T.elite.duelMinCp : r.duel.minCp };
    case 'boss': {
      const g = bossGoal(boss ?? T.bossMods.default);
      return g.noEarlyWin ? { goal: g.endCp } : { goal: g.winCp, floor: undefined };
    }
    default:
      return {};
  }
}

/** Goal progress line under the board. */
export function progress(room: RoomState, boss?: BossMod): string {
  const n = room.moves.length;
  const r = T.rooms;
  const e = room.node.elite;
  if (room.puzzle) {
    const p = room.puzzle;
    return `${room.node.kind === 'ward' ? 'Threat' : 'Puzzle'} ${Math.min(p.index + 1, p.count)}/${p.count} · solved ${p.solved}/${p.need}`;
  }
  switch (room.node.kind) {
    case 'convert':
      return room.node.goal === 'keep'
        ? `Move ${n}/${r.convert.keepMoves} · stay ≥ +${(e ? T.elite.keepCp : r.convert.keepCp) / 100}`
        : `Move ${n}/${e ? T.elite.gainMoves : r.convert.gainMoves} · material ${signed(mat(room.fen, room.me) - mat(room.startFen, room.me))}/+${r.convert.gainMaterial}`;
    case 'hold':
      return `Move ${n}/${r.hold.moves} · floor ${fmtCp(room.startEval - (e ? T.elite.holdMaxDropCp : r.hold.maxDropCp))}`;
    case 'duel':
      return `Move ${n}/${r.duel.moves} · end ≥ ${fmtCp(e ? T.elite.duelMinCp : r.duel.minCp)}`;
    case 'vault':
      return `Move ${n}/${room.vault?.maxMoves ?? 0} · ${room.vault?.goal === 'mate' ? 'checkmate' : room.vault?.goal === 'promote' ? 'promote' : 'win the pawn'}`;
    case 'boss': {
      const g = bossGoal(boss ?? T.bossMods.default);
      return `Move ${n}/${g.moves} · ${g.noEarlyWin ? `end ≥ +${g.endCp / 100}` : `reach +${g.winCp / 100}`}`;
    }
    default:
      return '';
  }
}
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
