// Pure rules of a run: map generation, Composure costs, room goals, relic triggers, scoring.
// No engine, no storage, no React — easy to test and to tune.
import { Chess } from 'chess.js';
import { materialBalance, parseFen } from '../lib/chess/pos';
import type { Classification, Score } from '../lib/chess/evaluation';
import { moveMotifs, type Motif } from '../lib/coach/tactics';
import { OPPONENTS, opponentById } from '../lib/people';
import { RELICS, bossGoal } from './content';
import { TUNING as T, type BossMod, type DiffId } from './tuning';
import type { ConsumableId, CurseId, EventKind, Fire, MapNode, ModifierId, Rarity, RelicId, RoomKind, RoomState, Run, UserMove } from './types';

export const ALL_RELICS = Object.keys(RELICS) as RelicId[];
export const ALL_CONSUMABLES: ConsumableId[] = ['eye', 'rewind', 'cards', 'lens', 'opinion', 'insurance', 'check'];

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
export const consumableOffer = (n: number, rand: Rand, locked: ConsumableId[] = []) => weighted<ConsumableId>({ ...T.consumables.weight }, n, rand, locked);

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
  /** Drill id of each vault position (for Grimoire weighting). */
  vaultDrills?: string[];
}

/** What a run may not offer yet (locked in the Sanctum). */
export interface Locks {
  rooms?: RoomKind[];
  events?: EventKind[];
}

/**
 * One act drawn as a map: an opening row, three rows of three, then the rival. Each node leads
 * to one or two nodes of the next row (neighbours), so the choices form real paths. At least
 * two events and a few elites are spread over the middle rows.
 */
export function buildMap(rand: Rand, pools: Pools, locks: Locks = {}, bias: (key: string) => number = () => 1): MapNode[][] {
  const mod = (): ModifierId => pickOne<ModifierId>(['steady', 'steady', 'gilded', 'focused'], rand);
  // Grimoire: scenarios you fail most are a little likelier to show up.
  const drills = pools.vaultDrills ?? [];
  const kindWeight = (k: RoomKind) =>
    k === 'convert' ? Math.max(bias('gain'), bias('keep')) : k === 'puzzle' ? bias('riddle') : k === 'vault' ? (drills.length ? Math.max(...drills.map((d) => bias(`vault:${d}`))) : 1) : bias(k);
  const pickW = <X,>(xs: X[], w: (x: X) => number): X => {
    const ws = xs.map(w);
    let r = rand() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < xs.length; i++) if ((r -= ws[i]) <= 0) return xs[i];
    return xs[xs.length - 1];
  };
  const posFor = (kind: RoomKind): number => {
    if (kind === 'vault' && drills.length) {
      const d = pickW([...new Set(drills)], (x) => bias(`vault:${x}`));
      return pickOne(drills.map((x, i) => (x === d ? i : -1)).filter((i) => i >= 0), rand);
    }
    return Math.floor(rand() * Math.max(1, pools[kind as keyof Omit<Pools, 'vaultDrills'>] ?? 1));
  };
  const kinds = (['puzzle', 'convert', 'hold', 'ward', 'vault', 'duel'] as RoomKind[]).filter((k) => !locks.rooms?.includes(k));
  const events = (['shrine', 'gambler', 'merchant', 'altar', 'library', 'spring'] as EventKind[]).filter((k) => !locks.events?.includes(k));
  const room = (kind: RoomKind, layer: number): MapNode => ({
    kind,
    modifier: mod(),
    goal: kind === 'convert' ? pickW<'gain' | 'keep'>(['gain', 'keep'], (g) => bias(g)) : undefined,
    pos: kind === 'puzzle' ? undefined : posFor(kind),
    elite: layer >= 2 && rand() < T.elite.chance ? true : undefined,
  });
  const event = (): MapNode => ({ kind: 'event', modifier: 'steady', event: pickOne(events, rand) });
  const row = (layer: number, from: RoomKind[]) => {
    const pool = [...(from.length >= 3 ? from : [...from, ...kinds])];
    const out: RoomKind[] = [];
    while (out.length < 3 && pool.length) {
      const k = pickW(pool, kindWeight);
      out.push(k);
      pool.splice(pool.indexOf(k), 1);
    }
    return out.map((k) => room(k, layer));
  };
  const layers: MapNode[][] = [row(0, kinds.filter((k) => k !== 'vault')), row(1, kinds), row(2, kinds), row(3, kinds)];
  // Events: one somewhere in row 1–2, one in row 3 (never two in the same row).
  if (events.length) {
    layers[1 + Math.floor(rand() * 2)][Math.floor(rand() * 3)] = event();
    layers[3][Math.floor(rand() * 3)] = event();
  }
  // Paths (set before the campfire replaces a node, which keeps its paths): straight ahead, sometimes also diagonally; every node is reachable.
  for (let l = 0; l < layers.length - 1; l++) {
    const cur = layers[l];
    const nxt = layers[l + 1];
    cur.forEach((n, i) => {
      const out = new Set<number>([i]);
      if (rand() < 0.55) {
        const j = i + (rand() < 0.5 ? -1 : 1);
        if (j >= 0 && j < nxt.length) out.add(j);
      }
      n.next = [...out].sort();
    });
    nxt.forEach((_, j) => {
      if (!cur.some((n) => n.next!.includes(j))) cur[Math.min(j, cur.length - 1)].next!.push(j);
    });
  }
  // One campfire in row 2 or 3 (never replacing that row's event), and one right before the rival.
  const cr = pickOne(T.map.campRows, rand);
  const free = layers[cr].map((n, i) => (n.kind === 'event' ? -1 : i)).filter((i) => i >= 0);
  const ci = pickOne(free, rand);
  layers[cr][ci] = { kind: 'camp', modifier: 'steady', next: layers[cr][ci].next };
  const boss: MapNode = { kind: 'boss', modifier: 'rival', pos: Math.floor(rand() * pools.boss) };
  layers[3].forEach((n) => (n.next = [0]));
  layers.push([{ kind: 'camp', modifier: 'steady', next: [0] }]);
  layers.push([boss]);
  return layers;
}

/** The campfire right before the rival (where the Devil's Bargain waits). */
export const isFinalCamp = (r: Pick<Run, 'layers' | 'layer'>) => r.layers[r.layer]?.[0]?.kind === 'camp' && r.layer === r.layers.length - 2;

/** Which nodes of the current row can be chosen (those the last choice leads to). */
export function reachable(r: Pick<Run, 'layers' | 'path' | 'layer'>): number[] {
  const row = r.layers[r.layer] ?? [];
  if (r.layer === 0) return row.map((_, i) => i);
  const prev = r.layers[r.layer - 1][r.path[r.layer - 1] ?? 0];
  return prev?.next ?? row.map((_, i) => i);
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
  diff?: DiffId;
}

export const diffOf = (id?: DiffId) => T.difficulty[id ?? 'adept'];

/** The room's goal numbers after the difficulty's margin (for text and judging). */
export function limits(node: Pick<MapNode, 'kind' | 'elite'>, diff?: DiffId, boss?: BossMod) {
  const d = diffOf(diff);
  const e = node.elite;
  const r = T.rooms;
  const g = bossGoal(boss ?? T.bossMods.default);
  return {
    grace: d.grace,
    keepCp: (e ? T.elite.keepCp : r.convert.keepCp) - d.margin,
    holdDrop: (e ? T.elite.holdMaxDropCp : r.hold.maxDropCp) + d.margin,
    duelDrop: (e ? T.elite.duelMaxDropCp : r.duel.maxDropCp) + d.margin,
    winCp: g.winCp,
    endCp: g.endCp - d.margin,
    moves: g.moves,
    noEarlyWin: g.noEarlyWin,
  };
}

/** A red line you must stay above during play (Hold, Keep-ahead), your POV cp. */
export function floorLine(room: Pick<RoomState, 'node' | 'startEval' | 'diff'>): number | undefined {
  const L = limits(room.node, room.diff);
  if (room.node.kind === 'hold') return room.startEval - L.holdDrop;
  if (room.node.kind === 'convert' && room.node.goal === 'keep') return L.keepCp;
  return undefined;
}

/** How many of your latest moves in a row ended below `line`. */
export function below(room: Pick<RoomState, 'moves'>, line: number): number {
  let k = 0;
  for (let i = room.moves.length - 1; i >= 0 && room.moves[i].evalAfter < line; i--) k++;
  return k;
}

/**
 * The recovery window: you're below a red line (or past the move limit short of the goal) and
 * have `left` more moves to fix it. Null when all is well.
 */
export function recovery(room: RoomState, boss?: BossMod): { left: number; overtime: boolean } | null {
  if (room.status !== 'playing' || room.puzzle || !room.moves.length) return null;
  const L = limits(room.node, room.diff, boss);
  const last = room.moves[room.moves.length - 1];
  const n = room.moves.length;
  const floor = floorLine(room);
  if (floor !== undefined) {
    const k = below(room, floor);
    return k > 0 ? { left: L.grace - k + 1, overtime: false } : null;
  }
  if (room.node.kind === 'duel' && n >= T.rooms.duel.moves && last.evalAfter < room.startEval - L.duelDrop) return { left: T.rooms.duel.moves + L.grace - n, overtime: true };
  if (room.node.kind === 'boss' && n >= L.moves && last.evalAfter < L.endCp) return { left: L.moves + L.grace - n, overtime: true };
  return null;
}

/** Composure a move costs, before Insurance. */
export function composureCost(cls: Classification, ctx: CostCtx): number {
  const { node, boss, curses = [] } = ctx;
  let c: number = diffOf(ctx.diff).cost[cls];
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

const colorOf = (fen: string): 'w' | 'b' => (fen.split(' ')[1] === 'b' ? 'b' : 'w');
function boardAt(fen: string) {
  // FEN lists rank 8 first; returns [file][rank] (0-based) → piece letter or ''.
  const rows = fen.split(' ')[0].split('/');
  const g: string[][] = Array.from({ length: 8 }, () => Array(8).fill(''));
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else g[f++][7 - i] = ch;
    }
  });
  return g;
}

/** Castle Keep: your king is castled (g/h or a/b/c file on its home rank) or has 2+ own pawns right in front. */
export function kingSheltered(fen: string, me: 'w' | 'b'): boolean {
  if (!fen) return false;
  const g = boardAt(fen);
  const K = me === 'w' ? 'K' : 'k';
  const P = me === 'w' ? 'P' : 'p';
  for (let f = 0; f < 8; f++)
    for (let r = 0; r < 8; r++) {
      if (g[f][r] !== K) continue;
      const home = me === 'w' ? 0 : 7;
      if (r === home && (f >= 6 || f <= 2)) return true;
      const front = r + (me === 'w' ? 1 : -1);
      if (front < 0 || front > 7) return false;
      let n = 0;
      for (const df of [-1, 0, 1]) if (f + df >= 0 && f + df < 8 && g[f + df][front] === P) n++;
      // Also count the second rank in front (pawn pushed one square).
      const front2 = front + (me === 'w' ? 1 : -1);
      if (n < 2 && front2 >= 0 && front2 < 8) for (const df of [-1, 0, 1]) if (f + df >= 0 && f + df < 8 && g[f + df][front2] === P) n++;
      return n >= 2;
    }
  return false;
}

/** Promotion Rite: this move brings a passed pawn to your 6th rank. */
export function passedToSixth(fen: string, uci: string): boolean {
  const g = boardAt(fen);
  const f = uci.charCodeAt(0) - 97;
  const r0 = Number(uci[1]) - 1;
  const p = g[f]?.[r0];
  if (p !== 'P' && p !== 'p') return false;
  const white = p === 'P';
  const tf = uci.charCodeAt(2) - 97;
  const tr = Number(uci[3]) - 1;
  if (tr !== (white ? 5 : 2)) return false;
  const enemy = white ? 'p' : 'P';
  for (let df = -1; df <= 1; df++) {
    const ff = tf + df;
    if (ff < 0 || ff > 7) continue;
    for (let r = white ? tr + 1 : tr - 1; white ? r < 8 : r >= 0; r += white ? 1 : -1) if (g[ff][r] === enemy) return false;
  }
  return true;
}

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
  if (has('castle') && kingSheltered(m.fenAfter || m.fenBefore, colorOf(m.fenBefore))) out.push({ relic: 'castle', mult: T.relics.castleMult, at });
  if (has('rite') && m.san.includes('=')) out.push({ relic: 'rite', mult: T.relics.riteMult, at });
  else if (has('rite') && passedToSixth(m.fenBefore, m.uci)) out.push({ relic: 'rite', mult: T.relics.riteRankMult, at });
  if (has('siege') && room.node.kind === 'hold') {
    const line = floorLine(room);
    if (line !== undefined && m.evalAfter >= line) {
      const survived = room.moves.filter((x) => x.evalAfter >= line).length + 1;
      out.push({ relic: 'siege', chips: T.relics.siegeChips * survived, at });
    }
  }
  if (has('tempo') && check) out.push({ relic: 'tempo', mult: T.relics.tempoMult, at });
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
  if (has('executioner') && room.status === 'won' && lastMine?.san.endsWith('#')) out.push({ relic: 'executioner', xmult: T.relics.executionerMult, at: -1 });
  if (has('perfectionist') && room.moves.length > 0 && room.moves.every((m) => sound(m.cls))) out.push({ relic: 'perfectionist', xmult: T.relics.perfectionistX, at: -1 });
  if (has('coldread') && room.moves.length > 0 && !(room.cardsUsed ?? 0)) out.push({ relic: 'coldread', xmult: T.relics.coldReadX, at: -1 });
  if (has('scholar') && room.puzzle && room.puzzle.solved > 0) out.push({ relic: 'scholar', gold: T.relics.scholarGold * room.puzzle.solved, at: -1 });
  if (boss?.multBonus) out.push({ relic: 'rival', mult: boss.multBonus, at: -1 });
  if (has('calm') && room.moves.length > 0 && room.moves.every((m) => sound(m.cls))) out.push({ relic: 'calm', composure: T.relics.calmComposure, at: -1 });
  return out;
}

export function chipTarget(room: RoomState): number {
  return room.moves.length * (room.node.elite ? T.score.eliteTargetPerMove : T.score.targetPerMove);
}

/** The additive mult before any ×mult (base + modifier + relic adds). */
export function addMult(room: Pick<RoomState, 'node' | 'fires'>): number {
  const modMult = room.node.modifier === 'focused' ? T.modifiers.focused.mult : 0;
  return Math.round((T.score.baseMult + modMult + room.fires.reduce((s, f) => s + (f.mult ?? 0), 0)) * 100) / 100;
}

/** Gold for a cleared room's score: score / rate, ×blind, + clean bonus, soft-capped. */
export function goldParts(score: number, beatBlind: boolean, clean: boolean) {
  const G = T.gold;
  const base = score / G.goldRate;
  let g = beatBlind ? base * G.blindGoldMult : base;
  if (clean) g += G.cleanBonus;
  const capped = g > G.softCap;
  if (capped) g = G.softCap + (g - G.softCap) * G.overCapRate;
  return { base: Math.round(base), capped, total: Math.round(g) };
}
export const scoreGold = (score: number, beatBlind: boolean, clean: boolean) => goldParts(score, beatBlind, clean).total;

export function roomScore(room: RoomState) {
  const chips = Math.round(room.moves.reduce((s, m) => s + m.accuracy, 0) + room.fires.reduce((s, f) => s + (f.chips ?? 0), 0));
  const xmult = room.fires.reduce((s, f) => s * (f.xmult ?? 1), 1);
  const mult = Math.round(addMult(room) * xmult * 100) / 100;
  const clean = room.moves.every((m) => m.cls !== 'mistake' && m.cls !== 'blunder');
  const target = chipTarget(room);
  const beatTarget = room.moves.length > 0 && chips >= target;
  const score = Math.round(chips * mult);
  let gold = 0;
  if (room.status === 'won' && room.node.kind !== 'event' && !room.gamble) {
    gold = scoreGold(score, beatTarget, clean);
    if (room.node.modifier === 'gilded') gold = Math.round(gold * T.modifiers.gilded.goldMult);
  }
  if (room.gamble && room.status === 'won') gold += T.events.gambleWin;
  gold += room.fires.reduce((s, f) => s + (f.gold ?? 0), 0);
  return { chips, mult, score, gold, clean, target, beatTarget };
}

export function maxConsumables(relics: RelicId[], pocket = 0) {
  return T.consumables.maxHeld + pocket - (relics.includes('spendthrift') ? T.relics.spendthriftCarryPenalty : 0);
}
/** Card slots for a run (relics and the Deep Pockets boost). */
export const cardSlots = (r: Pick<Run, 'relics' | 'meta'> & { pouch?: number }) => maxConsumables(r.relics, (r.meta?.boosts.pocket ?? 0) + (r.pouch ?? 0));
/** Most candles one room can take (moves + failing it). */
export const roomCap = (room: Pick<RoomState, 'node'>) => (room.node.kind === 'boss' ? T.composure.bossCap : T.composure.roomCap);
/** Candles already lost in this room. */
export const roomLoss = (room: Pick<RoomState, 'moves'>) => room.moves.reduce((s, m) => s + m.composureLost, 0);
/** Max Composure for a run (Spare Candle boost). */
export const maxComposure = (r: Pick<Run, 'meta'>) => T.composure.max + (r.meta?.boosts.candle ?? 0);
/** Relics a run can't be offered: owned ones and those still locked. */
export const unofferable = (r: Pick<Run, 'relics' | 'meta'>) => [...r.relics, ...(r.meta?.lockedRelics ?? [])];
export function price(id: ConsumableId, relics: RelicId[]) {
  const p = T.consumables.price[id];
  return relics.includes('spendthrift') ? Math.max(1, Math.round(p * T.relics.spendthriftPriceFactor)) : p;
}
export function restPrice(relics: RelicId[]) {
  let p: number = T.shop.restPrice;
  if (relics.includes('lucky')) p -= T.relics.luckyRestDiscount;
  if (relics.includes('spendthrift')) p = Math.round(p * T.relics.spendthriftPriceFactor);
  return Math.max(1, p);
}
/** Campfire prices for a run (Spendthrift, Haggler). */
export const shopPrice = (r: Pick<Run, 'relics' | 'meta'>, id: ConsumableId) => Math.max(1, price(id, r.relics) - (r.meta?.boosts.haggler ? 1 : 0));
export const restCost = (r: Pick<Run, 'relics' | 'meta'>) => Math.max(1, restPrice(r.relics) - (r.meta?.boosts.haggler ? 1 : 0));
type Shopper = Pick<Run, 'relics' | 'meta'> & { rests?: number; rerolls?: number };
const deal = (r: Shopper, p: number) => Math.max(1, (r.relics.includes('spendthrift') ? Math.round(p * T.relics.spendthriftPriceFactor) : p) - (r.meta?.boosts.haggler ? 1 : 0));
/** The next rest at this campfire (gets dearer each time). */
export const nextRestCost = (r: Shopper) => restCost(r) + (r.rests ?? 0) * T.shop.restStep;
export const stallPrice = (r: Shopper, id: RelicId) => deal(r, T.shop.stallPrice[RELICS[id].rarity ?? 'common']);
export const pouchPrice = (r: Shopper) => deal(r, T.shop.pouchPrice);
export const cleansePrice = (r: Shopper) => deal(r, T.shop.cleansePrice);
export const rerollPrice = (r: Shopper) => T.shop.rerollPrice + (r.rerolls ?? 0) * T.shop.rerollStep;
/** Embers that leftover gold turns into at the end of a run. */
export const goldToEmbers = (gold: number) => Math.floor(Math.max(0, gold) / T.embers.goldPer);
export const shopOffers = (relics: RelicId[]) => T.shop.offers + (relics.includes('lucky') ? T.relics.luckyExtraOffer : 0);

const mat = (fen: string, me: 'w' | 'b') => materialBalance(parseFen(fen).board, me);
/** Material balance (pawn = 1) from `me`'s side. */
export const materialOf = mat;
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
  const L = limits(room.node, room.diff, boss);
  if (k === 'convert' && room.node.goal === 'keep') {
    const keep = L.keepCp;
    if (stage === 'mine' && last) {
      const k = below(room, keep);
      if (k > L.grace) return { status: 'failed', reason: `Stayed below ${fmtCp(keep)} too long.` };
      if (n >= r.convert.keepMoves && k === 0) return { status: 'won', reason: `Stayed above ${fmtCp(keep)} for ${n} moves.` };
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
    if (stage === 'mine' && last) {
      const k = below(room, room.startEval - L.holdDrop);
      if (k > L.grace) return { status: 'failed', reason: 'The position stayed below the line too long.' };
      if (n >= r.hold.moves && k === 0) return { status: 'won', reason: `Held for ${n} moves.` };
    }
    return null;
  }
  if (k === 'duel') {
    const min = room.startEval - L.duelDrop;
    if (stage === 'mine' && last && n >= r.duel.moves) {
      if (last.evalAfter >= min) return { status: 'won', reason: `Out of the opening at ${fmtCp(last.evalAfter)}.` };
      if (n >= r.duel.moves + L.grace) return { status: 'failed', reason: `Out of the opening at only ${fmtCp(last.evalAfter)}.` };
    }
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
  const g = limits(room.node, room.diff, boss);
  if (stage === 'mine' && last) {
    if (boss?.blunderEnds && last.cls === 'blunder') return { status: 'failed', reason: 'One blunder was all it took.' };
    if (!g.noEarlyWin && last.evalAfter >= g.winCp) return { status: 'won', reason: `Reached ${fmtCp(last.evalAfter)}!` };
    if (n >= g.moves) {
      if (last.evalAfter >= g.endCp) return { status: 'won', reason: `Ahead (${fmtCp(last.evalAfter)}) when time ran out.` };
      if (n >= g.moves + g.grace) return { status: 'failed', reason: `Only ${fmtCp(last.evalAfter)} after ${n} moves.` };
    }
  }
  return null;
}

export const fmtCp = (cp: number) => (Math.abs(cp) >= 9000 ? (cp > 0 ? 'mate' : '-mate') : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`);

/** Eval lines for the gauge: the room's floor and/or goal (your POV, cp). */
export function gaugeLines(room: RoomState, boss?: BossMod): { floor?: number; goal?: number } {
  const L = limits(room.node, room.diff, boss);
  switch (room.node.kind) {
    case 'convert':
      return room.node.goal === 'keep' ? { floor: L.keepCp } : {};
    case 'hold':
      return { floor: room.startEval - L.holdDrop };
    case 'duel':
      return { floor: room.startEval - L.duelDrop };
    case 'boss':
      return L.noEarlyWin ? { goal: L.endCp } : { goal: L.winCp, floor: undefined };
    default:
      return {};
  }
}

/** Goal progress line under the board. */
export function progress(room: RoomState, boss?: BossMod): string {
  const n = room.moves.length;
  const r = T.rooms;
  const e = room.node.elite;
  const L = limits(room.node, room.diff, boss);
  if (room.puzzle) {
    const p = room.puzzle;
    return `${room.node.kind === 'ward' ? 'Threat' : 'Puzzle'} ${Math.min(p.index + 1, p.count)}/${p.count} · solved ${p.solved}/${p.need}`;
  }
  switch (room.node.kind) {
    case 'convert':
      return room.node.goal === 'keep'
        ? `Move ${n}/${r.convert.keepMoves} · stay ≥ ${fmtCp(L.keepCp)}`
        : `Move ${n}/${e ? T.elite.gainMoves : r.convert.gainMoves} · material ${signed(mat(room.fen, room.me) - mat(room.startFen, room.me))}/+${r.convert.gainMaterial}`;
    case 'hold':
      return `Move ${n}/${r.hold.moves} · line ${fmtCp(room.startEval - L.holdDrop)}`;
    case 'duel':
      return `Move ${n}/${r.duel.moves} · end ≥ ${fmtCp(room.startEval - L.duelDrop)}`;
    case 'vault':
      return `Move ${n}/${room.vault?.maxMoves ?? 0} · ${room.vault?.goal === 'mate' ? 'checkmate' : room.vault?.goal === 'promote' ? 'promote' : 'win the pawn'}`;
    case 'boss':
      return `Move ${n}/${L.moves} · ${L.noEarlyWin ? `end ≥ ${fmtCp(L.endCp)}` : `reach +${L.winCp / 100}`}`;
    default:
      return '';
  }
}
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Opponent strength: puzzle rating blended with real results against the app's opponents. */
export function playStrength(puzzle: number, records: Record<string, { w: number; l: number; d: number }>): number {
  const S = T.strength;
  const beaten = OPPONENTS.filter((o) => (records[o.id]?.w ?? 0) > 0).map((o) => o.elo + S.beatBonus);
  const played = OPPONENTS.some((o) => { const x = records[o.id]; return !!x && x.w + x.l + x.d > 0; });
  if (!played) return Math.round(puzzle + S.noGamesOffset);
  const play = beaten.length ? Math.max(...beaten) : S.onlyLosses;
  return Math.round(Math.min(puzzle, S.puzzleWeight * puzzle + (1 - S.puzzleWeight) * play));
}

/** The rival's rating this run: never far above your strength, then difficulty and curse. */
export function rivalElo(r: Run): number {
  const boss = opponentById(r.bossId);
  const base = Math.min(boss?.elo ?? 1000, (r.strength ?? r.rating) + T.strength.rivalOver);
  return Math.max(T.roomElo.min, Math.round(base + diffOf(r.difficulty).eloOffset + (r.cursed ? T.curse.ratingBoost : 0)));
}

/** Take-backs left in this room (difficulty). */
export function takebacksLeft(r: Run): number {
  const rm = r.room;
  if (!rm) return 0;
  return Math.max(0, diffOf(r.difficulty).takebacks - (rm.takebacks ?? 0));
}

/** A free take-back is possible: right after a mistake/blunder (or a wrong puzzle move). */
export function canTakeBack(r: Run): boolean {
  const rm = r.room;
  if (!rm || rm.gamble || takebacksLeft(r) <= 0) return false;
  const last = rm.moves[rm.moves.length - 1];
  if (!last || !rm.plies.some((p) => p.by === 'me' && p.fen === last.fenAfter)) return false;
  if (rm.puzzle) return rm.puzzle.lost;
  // Only the latest move (not one from before an earlier take-back point).
  return last.cls === 'mistake' || last.cls === 'blunder' || (rm.status === 'failed' && last.composureLost > 0);
}

/** The rival for a new run: random among unlocked opponents, likelier if not yet beaten in Run mode. */
export function pickRival<O extends { id: string }>(unlocked: O[], wins: Record<string, number>, rand: () => number): O {
  const w = unlocked.map((o) => ((wins[o.id] ?? 0) > 0 ? 1 : T.rival.unbeatenWeight));
  let x = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < unlocked.length; i++) {
    x -= w[i];
    if (x <= 0) return unlocked[i];
  }
  return unlocked[unlocked.length - 1];
}

// ---------------------------------------------------------------------------------------------
// Stage B: plausible wrong options, debrief ranking, nemesis, Grimoire.

/** Moves within `closeCp` of the best line (your POV), from a multi-PV analysis. Never "wrong". */
export function closeMoves(lines: { pv: string[]; score: Score }[], me: 'w' | 'b', closeCp: number = T.engine.cardsCloseCp): Set<string> {
  const out = new Set<string>();
  if (!lines.length) return out;
  const top = povCp(lines[0].score, me);
  for (const l of lines) if (l.pv[0] && top - povCp(l.score, me) < closeCp) out.add(l.pv[0]);
  return out;
}

/**
 * Wrong options for a multiple choice: the moves Maia finds most likely (a real player's
 * temptations), never one of `exclude` (the answer and near-best moves). Random legal moves
 * fill in only when Maia gives too few.
 */
export function plausibleWrong(legal: string[], exclude: Iterable<string>, logits: Map<string, number> | null, n: number, rand: Rand): string[] {
  const ex = new Set(exclude);
  const pool = legal.filter((u) => !ex.has(u));
  const ranked = logits ? pool.filter((u) => logits.has(u)).sort((a, b) => logits.get(b)! - logits.get(a)!) : [];
  const out = ranked.slice(0, n);
  if (out.length < n) out.push(...sample(pool.filter((u) => !out.includes(u)), n - out.length, rand));
  return out;
}

/** Win% a move gave away (old saves without it: estimated from accuracy). */
export const momentLoss = (m: { move: { wpLoss?: number; accuracy: number } }) => m.move.wpLoss ?? (100 - m.move.accuracy) / 2;

/** The debrief's moments: every mistake and blunder, biggest win% loss first. */
export function topMoments<M extends { move: { wpLoss?: number; accuracy: number } }>(moments: M[], n: number = T.debrief.keep): M[] {
  return [...moments].sort((a, b) => momentLoss(b) - momentLoss(a)).slice(0, n);
}

/**
 * Nemesis: the dominant recurring mistake across your recent games (main themes per game,
 * newest first). Only themes that have a nemesis rule count; anything else keeps the rival's rule.
 */
export function nemesisFor(gameThemes: string[][]): string | undefined {
  const N = T.nemesis;
  const games = gameThemes.slice(0, N.games);
  if (games.length < N.minCount) return undefined;
  const tally = new Map<string, number>();
  for (const g of games) for (const t of new Set(g)) tally.set(t, (tally.get(t) ?? 0) + 1);
  const [theme, count] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!theme || (count ?? 0) < N.minCount) return undefined;
  return theme in N.rules ? theme : undefined;
}

export interface ScenarioStat {
  met: number;
  cleared: number;
  failed: number;
  /** Clears in a row (reset by a fail). */
  streak: number;
}
export type Grimoire = Record<string, ScenarioStat>;

/** The Grimoire scenario a room belongs to (riddles are counted per puzzle theme instead). */
export function scenarioOf(node: Pick<MapNode, 'kind' | 'goal'>, drill?: string): string | null {
  switch (node.kind) {
    case 'hold':
    case 'ward':
    case 'duel':
      return node.kind;
    case 'convert':
      return node.goal ?? 'keep';
    case 'vault':
      return drill ? `vault:${drill}` : null;
    default:
      return null;
  }
}

/** Record one outcome (returns a new Grimoire). */
export function noteScenario(g: Grimoire, key: string, won: boolean): Grimoire {
  const s = g[key] ?? { met: 0, cleared: 0, failed: 0, streak: 0 };
  return { ...g, [key]: { met: s.met + 1, cleared: s.cleared + (won ? 1 : 0), failed: s.failed + (won ? 0 : 1), streak: won ? s.streak + 1 : 0 } };
}

export const isMastered = (s?: ScenarioStat) => !!s && s.streak >= T.grimoire.masteredStreak;

/**
 * How strongly the map favours a scenario: 1 + grimoireWeight × fail rate (unseen or mastered
 * = 1). A prefix key ('riddle', 'vault') takes the worst of its entries.
 */
export function scenarioWeight(g: Grimoire, key: string): number {
  const one = (s?: ScenarioStat) => (!s || !s.met || isMastered(s) ? 1 : 1 + T.grimoire.grimoireWeight * (s.failed / s.met));
  if (key === 'riddle' || key === 'vault') {
    const ws = Object.entries(g)
      .filter(([k]) => k.startsWith(`${key}:`))
      .map(([, s]) => one(s));
    return ws.length ? Math.max(...ws) : 1;
  }
  return one(g[key]);
}
