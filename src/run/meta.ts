// Between-run progression: Embers earned every run (win or lose), spent in the Sanctum on
// unlocks (new relics, rooms, events, board themes) and a few small permanent boosts.
// Stored in Run mode's own database; never touches the app's XP or rewards.
import { create } from 'zustand';
import { runDb } from './db';
import type { ConsumableId, EventKind, RelicId, RoomKind, Run } from './types';
import { TUNING as T } from './tuning';
import { heatAfterWin, heatAllowed, noteScenario, type Grimoire } from './rules';

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

/** Breadth, not power: what's left are conveniences and sidegrades. */
export const BOOSTS: Boost[] = [
  { id: 'notes', name: "Sam's Notes", text: () => 'Start every run holding a Candidate Cards.', costs: [10], sprite: 'scroll' },
  { id: 'cartographer', name: 'Cartographer', text: () => 'See one more row of the map through the fog.', costs: [10], sprite: 'compass' },
  { id: 'keeneye', name: 'Keen Eye', text: () => 'Your first relic: a 4th choice appears — a rare relic that carries a curse.', costs: [14], sprite: 'eye' },
  { id: 'nerves', name: 'Steady Nerves', text: () => 'Apprentice only: the first blunder of each run costs one candle less.', costs: [15], sprite: 'shield' },
  { id: 'reroll', name: 'Second Look', text: () => 'Reroll the campfire shop once per visit, free.', costs: [15], sprite: 'dice' },
];

/** One-time achievements that pay Embers. */
export interface Milestone {
  id: string;
  name: string;
  text: string;
  embers: number;
}
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
  /** One-line note about refunded Embers (shown once in the Sanctum). */
  refundNote?: string;
  /** Scenario records (met / cleared / failed / clears in a row). */
  grimoire?: Grimoire;
}

const EMPTY: Meta = { embers: 0, earned: 0, unlocked: [], boosts: {}, runs: 0, wins: 0, best: 0, milestones: [], rivalWins: {}, grimoire: {}, heatUnlocked: 0, heatBest: 0 };

/** Embers for a finished run: something every time, more for progress and a win. */
export function embersFor(r: Run): number {
  const E = T.embers;
  const won = r.results.filter((x) => x.won).length;
  const beatBoss = r.ended === 'won';
  const diff = won > 0 && r.difficulty ? T.difficulty[r.difficulty].embers : 0;
  const heat = beatBoss ? (r.heat ?? 0) * T.heat.embersPerLevel : 0;
  // Base Embers only once a room was cleared (abandoning at once isn't farmable).
  return diff + Math.floor(Math.max(0, r.gold ?? 0) / E.goldPer) + (won > 0 ? E.base : 0) + won * E.perRoom + Math.floor((r.finalScore ?? 0) / E.scoreStep) + (beatBoss ? E.bossWin : 0) + (beatBoss && r.cursed ? E.cursedWin : 0) + heat;
}

export const isUnlocked = (m: Meta, id: string) => !UNLOCKS.some((u) => u.id === id) || m.unlocked.includes(id);
export const lockedRelics = (m: Meta): RelicId[] => UNLOCKS.filter((u) => u.kind === 'relic' && !m.unlocked.includes(u.id)).map((u) => u.ref as RelicId);
export const lockedRooms = (m: Meta): RoomKind[] => UNLOCKS.filter((u) => u.kind === 'room' && !m.unlocked.includes(u.id)).map((u) => u.ref as RoomKind);
export const lockedEvents = (m: Meta): EventKind[] => UNLOCKS.filter((u) => u.kind === 'event' && !m.unlocked.includes(u.id)).map((u) => u.ref as EventKind);
export const lockedDrills = (m: Meta): string[] => UNLOCKS.filter((u) => u.kind === 'drill' && !m.unlocked.includes(u.id)).map((u) => u.ref);
export const lockedCards = (m: Meta): ConsumableId[] => UNLOCKS.filter((u) => u.kind === 'card' && !m.unlocked.includes(u.id)).map((u) => u.ref as ConsumableId);
export const boardUnlocked = (m: Meta, id: string) => id === 'crypt' || m.unlocked.includes(`board:${id}`);
export const piecesUnlocked = (m: Meta, id: string) => id === 'board' || m.unlocked.includes(`pieces:${id}`);

interface MetaStore extends Meta {
  loaded: boolean;
  load(): Promise<Meta>;
  buyUnlock(id: string): boolean;
  buyBoost(id: BoostId): boolean;
  /** Record a finished run (Embers, stats). */
  finish(r: Run, embers: number): void;
  /** Award the milestones not yet earned; returns the newly earned ones. */
  award(ids: string[]): Milestone[];
  /** Record scenario outcomes in the Grimoire. */
  noteGrimoire(entries: { key: string; won: boolean }[]): void;
  clearRefundNote(): void;
  dev(n: number): void;
}

const save = (m: Meta) => void runDb.state.put({ key: 'meta', value: m }).catch(() => {});
const pick = (s: Meta): Meta => ({ embers: s.embers, earned: s.earned, unlocked: s.unlocked, boosts: s.boosts, runs: s.runs, wins: s.wins, best: s.best, milestones: s.milestones ?? [], rivalWins: s.rivalWins ?? {}, grimoire: s.grimoire ?? {}, heatUnlocked: s.heatUnlocked ?? 0, heatBest: s.heatBest ?? 0, refundNote: s.refundNote });

export const useMeta = create<MetaStore>((set, get) => ({
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
    // Stage C: removed boosts/unlocks give their Embers back, once.
    const refund = refundFor(m.boosts as Record<string, number>, m.unlocked);
    if (refund > 0) {
      const boosts = Object.fromEntries(Object.entries(m.boosts).filter(([k]) => !(k in REMOVED_BOOSTS))) as Meta['boosts'];
      m = { ...m, boosts, unlocked: m.unlocked.filter((u) => !(u in REMOVED_UNLOCKS)), embers: m.embers + refund, refundNote: `The Sanctum changed: ${refund} Embers refunded for removed boosts.` };
      save(pick(m));
    }
    set({ ...m, loaded: true });
    return m;
  },
  buyUnlock(id) {
    const u = UNLOCKS.find((x) => x.id === id);
    const s = get();
    if (!u || s.unlocked.includes(id) || s.embers < u.cost) return false;
    set({ embers: s.embers - u.cost, unlocked: [...s.unlocked, id] });
    save(pick(get()));
    return true;
  },
  buyBoost(id) {
    const b = BOOSTS.find((x) => x.id === id)!;
    const s = get();
    const lvl = s.boosts[id] ?? 0;
    const cost = b.costs[lvl];
    if (cost === undefined || s.embers < cost) return false;
    set({ embers: s.embers - cost, boosts: { ...s.boosts, [id]: lvl + 1 } });
    save(pick(get()));
    return true;
  },
  finish(r, embers) {
    const s = get();
    const rivalWins = { ...(s.rivalWins ?? {}) };
    if (r.ended === 'won') rivalWins[r.bossId] = (rivalWins[r.bossId] ?? 0) + 1;
    const heatWin = r.ended === 'won' && heatAllowed(r.difficulty);
    const heatUnlocked = heatWin ? heatAfterWin(r.heat ?? 0, s.heatUnlocked ?? 0) : (s.heatUnlocked ?? 0);
    const heatBest = heatWin ? Math.max(s.heatBest ?? 0, r.heat ?? 0) : (s.heatBest ?? 0);
    set({ heatUnlocked, heatBest, embers: s.embers + embers, earned: s.earned + embers, runs: s.runs + 1, wins: s.wins + (r.ended === 'won' ? 1 : 0), best: Math.max(s.best, r.finalScore ?? 0), rivalWins });
    save(pick(get()));
  },
  award(ids) {
    const s = get();
    const have = s.milestones ?? [];
    const fresh = MILESTONES.filter((x) => ids.includes(x.id) && !have.includes(x.id));
    if (!fresh.length) return [];
    const n = fresh.reduce((a, x) => a + x.embers, 0);
    set({ milestones: [...have, ...fresh.map((x) => x.id)], embers: s.embers + n, earned: s.earned + n });
    save(pick(get()));
    return fresh;
  },
  clearRefundNote() {
    set({ refundNote: undefined });
    save(pick(get()));
  },
  noteGrimoire(entries) {
    if (!entries.length) return;
    let g = get().grimoire ?? {};
    for (const e of entries) g = noteScenario(g, e.key, e.won);
    set({ grimoire: g });
    save(pick(get()));
  },
  dev(n) {
    set({ embers: get().embers + n });
    save(pick(get()));
  },
}));
