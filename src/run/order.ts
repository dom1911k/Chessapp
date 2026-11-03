// The Order: between runs you build on an 8×8 board. Buildings reach like chess pieces;
// a building reached by others is Empowered. Materials come only from rooms you cleared
// (moves you played) — never from time. Pure: no React, no storage.
import { TUNING as T } from './tuning';
import type { EventKind, RoomKind } from './types';

export type Material = 'ink' | 'stone' | 'iron' | 'pages' | 'seals';
export const MATERIALS: Material[] = ['ink', 'stone', 'iron', 'pages', 'seals'];
export const COMMON: Material[] = ['ink', 'stone', 'iron', 'pages'];
export type Materials = Partial<Record<Material, number>>;

export const MATERIAL_INFO: Record<Material, { name: string; color: string; sprite: string }> = {
  ink: { name: 'Ink', color: '#7f8cff', sprite: 'scroll' },
  stone: { name: 'Stone', color: '#b8b0a2', sprite: 'tower' },
  iron: { name: 'Iron', color: '#8fd0e0', sprite: 'axe' },
  pages: { name: 'Pages', color: '#f2e3b3', sprite: 'book' },
  seals: { name: 'Seals', color: '#ff6bd5', sprite: 'crown' },
};

export type BuildingId = 'scriptorium' | 'watchtower' | 'forge' | 'archive' | 'mint' | 'gallery';
export const BUILDING_IDS: BuildingId[] = ['scriptorium', 'watchtower', 'forge', 'archive', 'mint', 'gallery'];
export type PieceKind = 'b' | 'r' | 'n' | 'p';

export interface Building {
  name: string;
  piece: PieceKind;
  sprite: string;
  /** What each level does (index 0 = level 1). */
  effect: [string, string];
  /** Sanctum perks it carries from level 1. */
  perks?: string[];
}

const O = T.order;
export const BUILDINGS: Record<BuildingId, Building> = {
  scriptorium: { name: 'Scriptorium', piece: 'b', sprite: 'scroll', perks: ['notes'], effect: [`+${O.effects.inkPerPuzzle[0]} Ink per puzzle solved`, `+${O.effects.inkPerPuzzle[1]} Ink per puzzle solved`] },
  watchtower: { name: 'Watchtower', piece: 'r', sprite: 'tower', perks: ['cartographer', 'nerves'], effect: [`+${pct(O.effects.stonePct[0])} Stone from Siege, Ward, Mirror`, `+${pct(O.effects.stonePct[1])} Stone from Siege, Ward, Mirror`] },
  forge: { name: 'Forge', piece: 'n', sprite: 'axe', effect: [`+${O.effects.ironPerCleanVault[0]} Iron per clean Vault; Lucena, Philidor, Queen vs Pawn`, `+${O.effects.ironPerCleanVault[1]} Iron per clean Vault`] },
  archive: { name: 'Archive', piece: 'r', sprite: 'book', perks: ['keeneye'], effect: [`+${O.effects.pagesPerBook[0]} Pages per book move in Duels`, `+${O.effects.pagesPerBook[1]} Pages per book move in Duels`] },
  mint: { name: 'Mint', piece: 'p', sprite: 'coin', perks: ['reroll'], effect: [`+${pct(O.effects.goldPct[0])} gold from score`, `+${pct(O.effects.goldPct[1])} gold from score`] },
  gallery: { name: 'Gallery', piece: 'p', sprite: 'star', effect: ['Board themes and piece sets', `Cosmetics cost ${pct(1 - O.galleryL2Discount)} less`] },
};
function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

export interface OrderState {
  /** Rank 3–4 squares reclaimed with Stone. */
  reclaimed: string[];
  buildings: Partial<Record<BuildingId, { level: 1 | 2; sq: string }>>;
}
export const EMPTY_ORDER: OrderState = { reclaimed: [], buildings: {} };

// ---------- the board ----------

const FILES = 'abcdefgh';
const at = (f: number, r: number) => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? `${FILES[f]}${r}` : null);
const coords = (sq: string) => [FILES.indexOf(sq[0]), Number(sq[1])] as const;
export const SQUARES = [...Array(8)].flatMap((_, ri) => [...FILES].map((f) => `${f}${8 - ri}`));

export type SquareState = 'open' | 'reclaimable' | 'fog';
export function squareState(o: OrderState, sq: string): SquareState {
  const r = Number(sq[1]);
  if (r <= 2 || o.reclaimed.includes(sq)) return 'open';
  if (r <= 4) return 'reclaimable';
  return 'fog';
}
export const buildingAt = (o: OrderState, sq: string): BuildingId | undefined => BUILDING_IDS.find((id) => o.buildings[id]?.sq === sq);

/** Squares a building reaches, and the buildings it hits (sliders stop at the first one, like chess). */
export function reach(o: OrderState, id: BuildingId): { squares: string[]; hits: BuildingId[] } {
  const b = o.buildings[id];
  if (!b) return { squares: [], hits: [] };
  const [f, r] = coords(b.sq);
  const squares: string[] = [];
  const hits = new Set<BuildingId>();
  const visit = (sq: string | null) => {
    if (!sq) return false;
    squares.push(sq);
    const other = buildingAt(o, sq);
    if (other && other !== id) hits.add(other);
    return !!other;
  };
  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs)
      for (let k = 1; k < 8; k++) {
        const sq = at(f + df * k, r + dr * k);
        if (!sq) break;
        if (visit(sq)) break;
      }
  };
  const piece = BUILDINGS[id].piece;
  if (piece === 'r') slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  if (piece === 'b') slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  if (piece === 'n') for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) visit(at(f + df, r + dr));
  if (piece === 'p') for (const df of [-1, 1]) visit(at(f + df, r + 1));
  return { squares, hits: [...hits] };
}

/** Buildings reaching `id`, and its Empowerment multiplier (+per each, up to max). */
export function empowerment(o: OrderState, id: BuildingId): { by: BuildingId[]; mult: number } {
  const by = BUILDING_IDS.filter((x) => x !== id && o.buildings[x] && reach(o, x).hits.includes(id));
  return { by, mult: 1 + O.empower.per * Math.min(by.length, O.empower.max) };
}

const level = (o: OrderState | undefined, id: BuildingId) => o?.buildings[id]?.level ?? 0;
/** A building's level effect value (0 when not built), × Empowerment. */
function effect(o: OrderState | undefined, id: BuildingId, table: readonly [number, number]): number {
  const l = level(o, id);
  if (!o || !l) return 0;
  return table[l - 1] * empowerment(o, id).mult;
}

// ---------- materials from rooms ----------

/** The material a cleared room (or event) pays. */
export function roomMaterial(kind: RoomKind | 'event', event?: EventKind): Material | null {
  switch (kind) {
    case 'puzzle':
    case 'echo':
      return 'ink';
    case 'hold':
    case 'ward':
    case 'mirror':
      return 'stone';
    case 'convert':
    case 'vault':
      return 'iron';
    case 'duel':
      return 'pages';
    case 'event':
      return event === 'library' ? 'ink' : event === 'shrine' ? 'pages' : null;
    default:
      return null;
  }
}

export interface RoomYieldCtx {
  kind: RoomKind;
  elite?: boolean;
  beatBlind?: boolean;
  clean?: boolean;
  /** Puzzles solved (Riddle). */
  solved?: number;
  /** Book moves matched (Duel). */
  bookMatched?: number;
}

/** Materials for a cleared room: base + bonuses, then buildings (× Empowerment). Rounded. */
export function roomYield(o: OrderState | undefined, c: RoomYieldCtx): { material: Material | null; amount: number } {
  const material = roomMaterial(c.kind);
  if (!material) return { material: null, amount: 0 };
  const Y = O.roomYield;
  let n = Y.base + (c.elite ? Y.elite : 0) + (c.beatBlind ? Y.blind : 0) + (c.clean ? Y.clean : 0);
  if (c.kind === 'puzzle') n += effect(o, 'scriptorium', O.effects.inkPerPuzzle) * (c.solved ?? 0);
  if (c.kind === 'vault' && c.clean) n += effect(o, 'forge', O.effects.ironPerCleanVault);
  if (c.kind === 'duel') n += effect(o, 'archive', O.effects.pagesPerBook) * (c.bookMatched ?? 0);
  if (material === 'stone') n *= 1 + effect(o, 'watchtower', O.effects.stonePct);
  return { material, amount: Math.round(n) };
}

/** Mint: extra gold from a room's score-gold. */
export const mintGold = (o: OrderState | undefined, gold: number) => Math.round(gold * effect(o, 'mint', O.effects.goldPct));

// ---------- costs ----------

export const buildCost = (id: BuildingId, toLevel: 1 | 2): Materials => O.costs[id][toLevel - 1];
export const cosmeticCost = (o: OrderState): Materials => {
  const k = level(o, 'gallery') >= 2 ? O.galleryL2Discount : 1;
  return Object.fromEntries(Object.entries(O.cosmeticCost).map(([m, n]) => [m, Math.ceil((n as number) * k)])) as Materials;
};
export const reclaimCost = (): Materials => ({ stone: O.reclaimCost });
export const canAfford = (have: Materials, cost: Materials) => (Object.entries(cost) as [Material, number][]).every(([m, n]) => (have[m] ?? 0) >= n);
export function pay(have: Materials, cost: Materials): Materials {
  const out = { ...have };
  for (const [m, n] of Object.entries(cost) as [Material, number][]) out[m] = (out[m] ?? 0) - n;
  return out;
}
export function addMaterials(a: Materials, b: Materials): Materials {
  const out = { ...a };
  for (const [m, n] of Object.entries(b) as [Material, number][]) out[m] = (out[m] ?? 0) + n;
  return out;
}

/** Sanctum perks (boost ids) granted by built buildings. */
export function perksOf(o: OrderState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of BUILDING_IDS) if (level(o, id)) for (const p of BUILDINGS[id].perks ?? []) out[p] = 1;
  return out;
}

// ---------- migration from the Sanctum ----------

/** Which building took over each Sanctum unlock / boost. */
export const UNLOCK_BUILDING: Record<string, { building: BuildingId; level: 1 | 2 }> = {
  'card:check': { building: 'scriptorium', level: 1 },
  'relic:scholar': { building: 'scriptorium', level: 1 },
  'event:library': { building: 'scriptorium', level: 1 },
  'relic:castle': { building: 'watchtower', level: 1 },
  'relic:secondwind': { building: 'watchtower', level: 2 },
  'relic:rite': { building: 'forge', level: 1 },
  'relic:executioner': { building: 'forge', level: 2 },
  'relic:glass': { building: 'forge', level: 2 },
  'drill:lucena': { building: 'forge', level: 1 },
  'drill:philidor': { building: 'forge', level: 1 },
  'drill:qvp': { building: 'forge', level: 1 },
  'relic:tempo': { building: 'archive', level: 1 },
  'event:altar': { building: 'archive', level: 2 },
  'relic:lucky': { building: 'mint', level: 1 },
  'event:spring': { building: 'mint', level: 1 },
  'event:gambler': { building: 'mint', level: 2 },
};
const BOOST_BUILDING: Record<string, BuildingId> = { notes: 'scriptorium', cartographer: 'watchtower', nerves: 'watchtower', keeneye: 'archive', reroll: 'mint' };
/** Default spots for migrated buildings (ranks 1–2). */
export const HOME_SQUARE: Record<BuildingId, string> = { watchtower: 'a1', forge: 'b1', scriptorium: 'c1', mint: 'd2', gallery: 'e2', archive: 'h1' };

/** Embers become a starter pile; owned unlocks/boosts/cosmetics become level-1 buildings. */
export function migrateSanctum(embers: number, unlocked: string[], boosts: Record<string, number | undefined>): { materials: Materials; order: OrderState } {
  const materials: Materials = {};
  for (const m of COMMON) materials[m] = Math.max(0, Math.floor(embers)) * O.emberRate;
  const built = new Set<BuildingId>();
  for (const u of unlocked) {
    if (UNLOCK_BUILDING[u]) built.add(UNLOCK_BUILDING[u].building);
    if (u.startsWith('board:') || u.startsWith('pieces:')) built.add('gallery');
  }
  for (const [b, n] of Object.entries(boosts)) if (n && BOOST_BUILDING[b]) built.add(BOOST_BUILDING[b]);
  const order: OrderState = { reclaimed: [], buildings: {} };
  for (const id of built) order.buildings[id] = { level: 1, sq: HOME_SQUARE[id] };
  return { materials, order };
}
