// Between-run progression: the Order. Materials from rooms you cleared (and Seals from big
// wins) build and upgrade buildings on the Order's board; buildings unlock content and
// carry the old Sanctum perks. Stored in Run mode's own database; never touches the app.
import { create } from 'zustand';
import { runDb } from './db';
import type { ConsumableId, EventKind, RelicId, RoomKind, Run } from './types';
import { TUNING as T } from './tuning';
import { heatAfterWin, heatAllowed, noteScenario, type Grimoire } from './rules';
import { EMPTY_ORDER, UNLOCK_BUILDING, addMaterials, buildCost, canAfford, cosmeticCost, migrateSanctum, pay, reclaimCost, squareState, buildingAt, perksOf, type BuildingId, type Materials, type OrderState } from './order';
import type { TechId } from './codex';

export type BoostId = 'reroll' | 'notes' | 'nerves' | 'cartographer' | 'keeneye';

/** Boosts removed in Stage C ("breadth, not power"): their Embers are refunded once. */
export const REMOVED_BOOSTS: Record<string, number[]> = {
  purse: [8, 16, 24],
  candle: [20, 40],
  pocket: [30],
  satchel: [12],
  haggler: [16],
  lamp: [20],
};
/** Unlocks removed (now free from the start), refunded once. */
export const REMOVED_UNLOCKS: Record<string, number> = { 'room:vault': 12 };

/** Embers to refund for removed boosts/unlocks a player owned. */
export function refundFor(boosts: Partial<Record<string, number>>, unlocked: string[]): number {
  let n = 0;
  for (const [id, costs] of Object.entries(REMOVED_BOOSTS)) n += costs.slice(0, boosts[id] ?? 0).reduce((a, b) => a + b, 0);
  for (const [id, cost] of Object.entries(REMOVED_UNLOCKS)) if (unlocked.includes(id)) n += cost;
  return n;
}

export interface Unlock {
  id: string;
  kind: 'relic' | 'room' | 'event' | 'board' | 'card' | 'pieces' | 'drill';
  ref: string;
  name: string;
  text: string;
  cost: number;
  sprite: string;
}

/** Everything that starts locked. (All other content is available from the first run.) */
export const UNLOCKS: Unlock[] = [
  { id: 'card:check', kind: 'card', ref: 'check', name: 'Blunder Check', text: 'Card: a cheap warning, only for blunders.', cost: 8, sprite: 'bell' },
  { id: 'relic:scholar', kind: 'relic', ref: 'scholar', name: 'Scholar', text: 'Relic: gold for every puzzle solved.', cost: 8, sprite: 'book' },
  { id: 'relic:lucky', kind: 'relic', ref: 'lucky', name: 'Lucky Coin', text: 'Relic: a bigger, cheaper campfire.', cost: 8, sprite: 'clover' },
  { id: 'relic:castle', kind: 'relic', ref: 'castle', name: 'Castle Keep', text: 'Relic: mult and gold for castling.', cost: 8, sprite: 'tower' },
  { id: 'event:spring', kind: 'event', ref: 'spring', name: 'The Healing Spring', text: 'Event: trade gold for a candle.', cost: 10, sprite: 'fountain' },
  { id: 'event:library', kind: 'event', ref: 'library', name: 'The Library', text: 'Event: solve a tactic, earn a card.', cost: 12, sprite: 'book' },
  { id: 'relic:tempo', kind: 'relic', ref: 'tempo', name: 'Tempo', text: 'Relic: mult for good checks.', cost: 12, sprite: 'bolt' },
  { id: 'relic:rite', kind: 'relic', ref: 'rite', name: 'Promotion Rite', text: 'Relic: big mult for promoting.', cost: 12, sprite: 'crown' },
  { id: 'drill:lucena', kind: 'drill', ref: 'lucena', name: 'Vault: Lucena', text: 'Vault drill: build a bridge and promote.', cost: T.sanctum.drillCost, sprite: 'chest' },
  { id: 'drill:philidor', kind: 'drill', ref: 'philidor', name: 'Vault: Philidor', text: 'Vault drill: hold the rook ending draw.', cost: T.sanctum.drillCost, sprite: 'chest' },
  { id: 'drill:qvp', kind: 'drill', ref: 'qvp', name: 'Vault: Queen vs Pawn', text: 'Vault drill: stop the pawn on the 7th, then win it.', cost: T.sanctum.drillCost, sprite: 'chest' },
  { id: 'event:gambler', kind: 'event', ref: 'gambler', name: 'The Gambler', text: 'Event: stake a candle on one puzzle.', cost: 12, sprite: 'dice' },
  { id: 'relic:executioner', kind: 'relic', ref: 'executioner', name: 'Executioner', text: 'Rare relic: big mult for a checkmate finish.', cost: 16, sprite: 'axe' },
  { id: 'event:altar', kind: 'event', ref: 'altar', name: 'The Cursed Altar', text: 'Event: a rare relic, for a curse.', cost: 16, sprite: 'altar' },
  { id: 'relic:secondwind', kind: 'relic', ref: 'secondwind', name: 'Second Wind', text: 'Rare relic: survive your Composure breaking once.', cost: 20, sprite: 'feather' },
  { id: 'relic:glass', kind: 'relic', ref: 'glass', name: 'Glass Cannon', text: 'Rare relic: +1.5 mult everywhere, at a price.', cost: 20, sprite: 'crystal' },
  { id: 'board:bone', kind: 'board', ref: 'bone', name: 'Bone & Blood', text: 'Board theme: ivory and crimson.', cost: 15, sprite: 'skull' },
  { id: 'board:frost', kind: 'board', ref: 'frost', name: 'Frost Tomb', text: 'Board theme: ice and moonlight.', cost: 15, sprite: 'crystal' },
  { id: 'board:ember', kind: 'board', ref: 'ember', name: 'Ember Forge', text: 'Board theme: lava and brass.', cost: 15, sprite: 'flame' },
  { id: 'pieces:runic', kind: 'pieces', ref: 'runic', name: 'Runic Stone', text: 'Piece set: grey stone with glowing runes.', cost: 15, sprite: 'crystal' },
  { id: 'pieces:gilded', kind: 'pieces', ref: 'gilded', name: 'Gilded & Obsidian', text: 'Piece set: gold against black glass.', cost: 18, sprite: 'crown' },
];

export interface Boost {
  id: BoostId;
  name: string;
  text: (lvl: number) => string;
  costs: number[];
  sprite: string;
}

/** The old Sanctum perks; they now come with Order buildings (see order.ts BUILDINGS.perks). */
export const BOOSTS: Boost[] = [
  { id: 'notes', name: "Sam's Notes", text: () => 'Start every run holding a Candidate Cards.', costs: [10], sprite: 'scroll' },
  { id: 'cartographer', name: 'Cartographer', text: () => 'See one more row of the map through the fog.', costs: [10], sprite: 'compass' },
  { id: 'keeneye', name: 'Keen Eye', text: () => 'Your first relic: a 4th choice appears — a rare relic that carries a curse.', costs: [14], sprite: 'eye' },
  { id: 'nerves', name: 'Steady Nerves', text: () => 'Apprentice only: the first blunder of each run costs one candle less.', costs: [15], sprite: 'shield' },
  { id: 'reroll', name: 'Second Look', text: () => 'Reroll the campfire shop once per visit, free.', costs: [15], sprite: 'dice' },
];

/** One-time achievements that pay Seals. */
export interface Milestone {
  id: string;
  name: string;
  text: string;
  /** Old Ember value (kept for reference); they pay `seals` now. */
  embers: number;
  seals?: number;
}
/** Seals a milestone pays (bigger milestones pay more). */
export const milestoneSeals = (x: Milestone) => x.seals ?? (x.embers >= 8 ? 3 : x.embers >= 4 ? 2 : 1);
export const MILESTONES: Milestone[] = [
  { id: 'first-clear', name: 'First Steps', text: 'Clear your first room.', embers: 2 },
  { id: 'clean-room', name: 'Clean Hands', text: 'Clear a room with 5+ moves, all of them good or best.', embers: 3 },
  { id: 'mate', name: 'Checkmate!', text: 'Finish a room with checkmate.', embers: 3 },
  { id: 'perfect-ward', name: 'Unbreakable', text: 'Solve every threat in a Ward.', embers: 3 },
  { id: 'elite', name: 'Elite Slayer', text: 'Clear an elite room.', embers: 4 },
  { id: 'collector', name: 'Collector', text: 'Hold 5 relics at once.', embers: 3 },
  { id: 'first-win', name: 'Rival Down', text: 'Defeat a rival.', embers: 5 },
  { id: 'score-5k', name: 'High Roller', text: 'Score 5,000 in one run.', embers: 4 },
  { id: 'cursed-win', name: "Devil's Due", text: "Beat the rival after taking the Devil's Bargain.", embers: 5 },
  { id: 'untouched', name: 'Untouched', text: 'Win a run without losing a single candle.', embers: 8 },
];

export interface Meta {
  /** Old currency: only read once to migrate into materials. */
  embers: number;
  milestones?: string[];
  earned: number;
  unlocked: string[];
  boosts: Partial<Record<BoostId, number>>;
  runs: number;
  wins: number;
  best: number;
  /** Run-mode wins per rival id. */
  rivalWins?: Record<string, number>;
  /** Highest Heat you may choose (beat the rival at Heat N to unlock N+1). */
  heatUnlocked?: number;
  /** Highest Heat at which you beat the rival. */
  heatBest?: number;
  /** One-line note shown once (refunds, migration). */
  refundNote?: string;
  /** Scenario records (met / cleared / failed / clears in a row). */
  grimoire?: Grimoire;
  /** The Codex: learned techniques and how often each was executed. */
  codex?: Partial<Record<TechId, { learned: boolean; uses: number }>>;
  /** Techniques equipped for the next run (up to codexSlots). */
  equipped?: TechId[];
  /** The Order. */
  materials?: Materials;
  order?: OrderState;
  /** The Sanctum was migrated into the Order. */
  orderMigrated?: boolean;
  /** The drip rate you last saw per material (to show old → new after an upgrade). */
  rateSeen?: Partial<Record<string, number>>;
}

const EMPTY: Meta = { embers: 0, earned: 0, unlocked: [], boosts: {}, runs: 0, wins: 0, best: 0, milestones: [], rivalWins: {}, grimoire: {}, heatUnlocked: 0, heatBest: 0, codex: {}, equipped: [], materials: {}, order: EMPTY_ORDER, orderMigrated: false };

/** Seals for a finished run: a rival win, more per Heat level. */
export function runSeals(r: Pick<Run, 'ended' | 'heat'>): number {
  const S = T.order.seals;
  return r.ended === 'won' ? S.rivalWin + (r.heat ?? 0) * S.perHeat : 0;
}

/** Unlocked: bought before (legacy), or granted by an Order building's level. */
export function isUnlocked(m: Pick<Meta, 'unlocked' | 'order'>, id: string): boolean {
  if (!UNLOCKS.some((u) => u.id === id) || m.unlocked.includes(id)) return true;
  const b = UNLOCK_BUILDING[id];
  return !!b && (m.order?.buildings[b.building]?.level ?? 0) >= b.level;
}
const lockedOf = (m: Meta, kind: Unlock['kind']) => UNLOCKS.filter((u) => u.kind === kind && !isUnlocked(m, u.id)).map((u) => u.ref);
export const lockedRelics = (m: Meta): RelicId[] => lockedOf(m, 'relic') as RelicId[];
export const lockedRooms = (m: Meta): RoomKind[] => lockedOf(m, 'room') as RoomKind[];
export const lockedEvents = (m: Meta): EventKind[] => lockedOf(m, 'event') as EventKind[];
export const lockedDrills = (m: Meta): string[] => lockedOf(m, 'drill');
export const lockedCards = (m: Meta): ConsumableId[] => lockedOf(m, 'card') as ConsumableId[];
export const boardUnlocked = (m: Meta, id: string) => id === 'crypt' || m.unlocked.includes(`board:${id}`);
export const piecesUnlocked = (m: Meta, id: string) => id === 'board' || m.unlocked.includes(`pieces:${id}`);
/** The Sanctum perks your buildings carry (same shape as the old boosts). */
export const perks = (m: Meta) => perksOf(m.order ?? EMPTY_ORDER);

interface MetaStore extends Meta {
  loaded: boolean;
  load(): Promise<Meta>;
  /** Record a finished run (materials, Seals, stats). */
  finish(r: Run): void;
  /** Award the milestones not yet earned (they pay Seals); returns the newly earned ones. */
  award(ids: string[]): Milestone[];
  /** Record scenario outcomes in the Grimoire. */
  noteGrimoire(entries: { key: string; won: boolean }[]): void;
  clearRefundNote(): void;
  /** Codex: a technique passed its learning check. */
  learnTechnique(id: TechId): void;
  /** Codex: equip / unequip for the next run (max codexSlots). */
  toggleEquip(id: TechId): boolean;
  /** Codex: executions count toward mastery (Adept/Master pay Seals). */
  useTechnique(id: TechId, n?: number): void;
  /** The Order: build (level 1) on a square, or upgrade to level 2. */
  build(id: BuildingId, sq?: string): boolean;
  upgrade(id: BuildingId): boolean;
  /** Move a building to an empty open square (free). */
  moveBuilding(id: BuildingId, sq: string): boolean;
  /** Reclaim a rank-3/4 square with Stone. */
  reclaim(sq: string): boolean;
  /** Remember the drip rate seen for a material. */
  seeRate(m: string, rate: number): void;
  /** Gallery: buy a board theme or piece set. */
  buyCosmetic(id: string): boolean;
  dev(n: number): void;
}

const save = (m: Meta) => void runDb.state.put({ key: 'meta', value: m }).catch(() => {});
const pick = (s: Meta): Meta => ({
  embers: s.embers, earned: s.earned, unlocked: s.unlocked, boosts: s.boosts, runs: s.runs, wins: s.wins, best: s.best, milestones: s.milestones ?? [], rivalWins: s.rivalWins ?? {},
  grimoire: s.grimoire ?? {}, heatUnlocked: s.heatUnlocked ?? 0, heatBest: s.heatBest ?? 0, refundNote: s.refundNote, codex: s.codex ?? {}, equipped: s.equipped ?? [],
  materials: s.materials ?? {}, order: s.order ?? EMPTY_ORDER, orderMigrated: s.orderMigrated ?? false, rateSeen: s.rateSeen ?? {},
});

/** Migrate a Sanctum-era save into the Order (once): Embers → starter pile, unlocks/perks → buildings. */
export function migrateMeta(m: Meta): Meta {
  if (m.orderMigrated) return m;
  const refund = refundFor(m.boosts as Record<string, number>, m.unlocked);
  const embers = m.embers + refund;
  const unlocked = m.unlocked.filter((u) => !(u in REMOVED_UNLOCKS));
  const { materials, order } = migrateSanctum(embers, unlocked, m.boosts as Record<string, number>);
  const had = embers > 0 || unlocked.length > 0 || Object.keys(m.boosts).length > 0;
  return {
    ...m,
    unlocked,
    boosts: {},
    embers: 0,
    materials: addMaterials(m.materials ?? {}, materials),
    order,
    orderMigrated: true,
    refundNote: had ? `The Sanctum became the Order: your ${embers} Embers became ${embers * T.order.emberRate} of each material, and your unlocks became buildings.` : m.refundNote,
  };
}

export const useMeta = create<MetaStore>((set, get) => {
  const commit = (p: Partial<Meta>) => {
    set(p);
    save(pick(get()));
  };
  return {
    ...EMPTY,
    loaded: false,
    async load() {
      if (get().loaded) return pick(get());
      let m = EMPTY;
      try {
        m = { ...EMPTY, ...((await runDb.state.get('meta'))?.value as Meta | undefined) };
      } catch {
        /* first time */
      }
      if (!m.orderMigrated) {
        m = migrateMeta(m);
        save(pick(m));
      }
      set({ ...m, loaded: true });
      return m;
    },
    finish(r) {
      const s = get();
      const rivalWins = { ...(s.rivalWins ?? {}) };
      if (r.ended === 'won') rivalWins[r.bossId] = (rivalWins[r.bossId] ?? 0) + 1;
      const heatWin = r.ended === 'won' && heatAllowed(r.difficulty);
      const heatUnlocked = heatWin ? heatAfterWin(r.heat ?? 0, s.heatUnlocked ?? 0) : (s.heatUnlocked ?? 0);
      const heatBest = heatWin ? Math.max(s.heatBest ?? 0, r.heat ?? 0) : (s.heatBest ?? 0);
      const gained = addMaterials(r.materials ?? {}, { seals: runSeals(r) });
      commit({ heatUnlocked, heatBest, materials: addMaterials(s.materials ?? {}, gained), runs: s.runs + 1, wins: s.wins + (r.ended === 'won' ? 1 : 0), best: Math.max(s.best, r.finalScore ?? 0), rivalWins });
    },
    award(ids) {
      const s = get();
      const have = s.milestones ?? [];
      const fresh = MILESTONES.filter((x) => ids.includes(x.id) && !have.includes(x.id));
      if (!fresh.length) return [];
      const n = fresh.reduce((a, x) => a + milestoneSeals(x), 0);
      commit({ milestones: [...have, ...fresh.map((x) => x.id)], materials: addMaterials(s.materials ?? {}, { seals: n }) });
      return fresh;
    },
    noteGrimoire(entries) {
      if (!entries.length) return;
      let g = get().grimoire ?? {};
      for (const e of entries) g = noteScenario(g, e.key, e.won);
      commit({ grimoire: g });
    },
    clearRefundNote() {
      commit({ refundNote: undefined });
    },
    learnTechnique(id) {
      const c = { ...(get().codex ?? {}) };
      c[id] = { learned: true, uses: c[id]?.uses ?? 0 };
      const eq = get().equipped ?? [];
      commit({ codex: c, equipped: eq.length < T.codex.slots && !eq.includes(id) ? [...eq, id] : eq });
    },
    toggleEquip(id) {
      const eq = get().equipped ?? [];
      if (eq.includes(id)) commit({ equipped: eq.filter((x) => x !== id) });
      else if (eq.length < T.codex.slots && get().codex?.[id]?.learned) commit({ equipped: [...eq, id] });
      else return false;
      return true;
    },
    useTechnique(id, n = 1) {
      const c = { ...(get().codex ?? {}) };
      if (!c[id]) return;
      const before = c[id]!.uses;
      const after = before + n;
      c[id] = { ...c[id]!, uses: after };
      // Seals when a technique reaches Adept or Master.
      const S = T.order.seals;
      const seals = (before < T.codex.adeptUses && after >= T.codex.adeptUses ? S.techAdept : 0) + (before < T.codex.masterUses && after >= T.codex.masterUses ? S.techMaster : 0);
      commit({ codex: c, ...(seals ? { materials: addMaterials(get().materials ?? {}, { seals }) } : {}) });
    },
    build(id, sq) {
      const s = get();
      const o = s.order ?? EMPTY_ORDER;
      if (o.buildings[id]) return false;
      const spot = sq ?? ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2', ...o.reclaimed].find((x) => squareState(o, x) === 'open' && !buildingAt(o, x));
      if (!spot || squareState(o, spot) !== 'open' || buildingAt(o, spot)) return false;
      const cost = buildCost(id, 1);
      if (!canAfford(s.materials ?? {}, cost)) return false;
      commit({ materials: pay(s.materials ?? {}, cost), order: { ...o, buildings: { ...o.buildings, [id]: { level: 1, sq: spot } } } });
      return true;
    },
    upgrade(id) {
      const s = get();
      const o = s.order ?? EMPTY_ORDER;
      const b = o.buildings[id];
      if (!b || b.level >= 2) return false;
      const cost = buildCost(id, 2);
      if (!canAfford(s.materials ?? {}, cost)) return false;
      commit({ materials: pay(s.materials ?? {}, cost), order: { ...o, buildings: { ...o.buildings, [id]: { ...b, level: 2 } } } });
      return true;
    },
    moveBuilding(id, sq) {
      const o = get().order ?? EMPTY_ORDER;
      const b = o.buildings[id];
      if (!b || squareState(o, sq) !== 'open' || buildingAt(o, sq)) return false;
      commit({ order: { ...o, buildings: { ...o.buildings, [id]: { ...b, sq } } } });
      return true;
    },
    reclaim(sq) {
      const s = get();
      const o = s.order ?? EMPTY_ORDER;
      if (squareState(o, sq) !== 'reclaimable' || !canAfford(s.materials ?? {}, reclaimCost())) return false;
      commit({ materials: pay(s.materials ?? {}, reclaimCost()), order: { ...o, reclaimed: [...o.reclaimed, sq] } });
      return true;
    },
    seeRate(m, rate) {
      if (get().rateSeen?.[m] === rate) return;
      commit({ rateSeen: { ...(get().rateSeen ?? {}), [m]: rate } });
    },
    buyCosmetic(id) {
      const s = get();
      const o = s.order ?? EMPTY_ORDER;
      if (!o.buildings.gallery || s.unlocked.includes(id) || !UNLOCKS.some((u) => u.id === id && (u.kind === 'board' || u.kind === 'pieces'))) return false;
      const cost = cosmeticCost(o);
      if (!canAfford(s.materials ?? {}, cost)) return false;
      commit({ materials: pay(s.materials ?? {}, cost), unlocked: [...s.unlocked, id] });
      return true;
    },
    dev(n) {
      commit({ materials: addMaterials(get().materials ?? {}, { ink: n, stone: n, iron: n, pages: n, seals: Math.ceil(n / 10) }) });
    },
  };
});
