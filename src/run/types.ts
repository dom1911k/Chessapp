import type { AnalysisResult } from '../lib/engine/types';
import type { Classification } from '../lib/chess/evaluation';
import type { PuzzleSpec } from '../lib/puzzles/spec';
import type { DiffId } from './tuning';

export type RoomKind = 'puzzle' | 'convert' | 'hold' | 'ward' | 'vault' | 'duel' | 'boss';
export type NodeKind = RoomKind | 'event' | 'camp';
export type EventKind = 'shrine' | 'gambler' | 'merchant' | 'altar' | 'library' | 'spring';
export type ModifierId = 'gilded' | 'focused' | 'steady' | 'rival';
export type ConvertGoal = 'gain' | 'keep';
export type Rarity = 'common' | 'uncommon' | 'rare';
export type CurseId = 'brittle';

export type RelicId =
  | 'calm' | 'bloodhound' | 'forkmaster' | 'ironwall' | 'pins' | 'clean' | 'spendthrift' | 'bloomer'
  | 'hunter' | 'patience' | 'executioner' | 'secondwind' | 'scholar' | 'glass' | 'lucky'
  | 'castle' | 'rite' | 'tempo'
  | 'perfectionist' | 'coldread' | 'watchman' | 'bookbinder' | 'siege';
export type ConsumableId = 'eye' | 'rewind' | 'cards' | 'lens' | 'opinion' | 'insurance' | 'check';

export interface MapNode {
  kind: NodeKind;
  modifier: ModifierId;
  goal?: ConvertGoal;
  /** Index into the position pool (convert/hold/ward/boss/duel/vault). */
  pos?: number;
  /** Endgame drill id (vault). */
  drill?: string;
  elite?: boolean;
  event?: EventKind;
  /** Indices of the nodes in the next layer this one leads to (all, if missing). */
  next?: number[];
}

/** A relic (or the rival's rule) firing during a room; shown in the tally. */
export interface Fire {
  relic: RelicId | 'rival';
  /** Added to the mult (+0.5). */
  mult?: number;
  /** Multiplies the mult at the end (×2). */
  xmult?: number;
  /** Extra chips. */
  chips?: number;
  gold?: number;
  composure?: number;
  /** User move index in the room that fired it; -1 = room end. */
  at: number;
}

export interface UserMove {
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
  cls: Classification;
  accuracy: number;
  /** Your-POV eval (cp, mate mapped to ±10000) after the move (and before the reply). */
  evalAfter: number;
  composureLost: number;
  insured?: boolean;
  eye?: boolean;
  /** Puzzle-like rooms: was this the solution move? */
  correct?: boolean;
  /** Kept for the debrief (only for moves that cost Composure). */
  before?: AnalysisResult | null;
  after?: AnalysisResult | null;
}

export interface Ply {
  uci: string;
  san: string;
  fen: string; // after
  by: 'me' | 'opp';
}

export interface PuzzleProgress {
  list: (PuzzleSpec & { accept?: string[] })[];
  index: number;
  /** Next solution index the user must play. */
  step: number;
  solved: number;
  failed: number;
  /** The current puzzle is lost (showing the answer). */
  lost: boolean;
  count: number;
  need: number;
}

export interface RoomState {
  layer: number;
  node: MapNode;
  me: 'w' | 'b';
  startFen: string;
  fen: string;
  plies: Ply[];
  moves: UserMove[];
  fires: Fire[];
  startEval: number;
  elo: number;
  oppId?: string;
  /** Who plays the other side. */
  opp: 'maia' | 'engine';
  puzzle?: PuzzleProgress;
  /** Gambler event: a single puzzle with Composure at stake. */
  gamble?: boolean;
  /** Duel: the book line played so far (SAN), for the opening hint. */
  book?: string[];
  /** Vault: the endgame goal and move limit. */
  vault?: { goal: 'mate' | 'promote' | 'capture'; maxMoves: number; title: string };
  /** Difficulty of the run (old saves: Adept). */
  diff?: DiffId;
  /** Free take-backs used in this room. */
  takebacks?: number;
  /** Cards used in this room (Cold Read). */
  cardsUsed?: number;
  /** A card was used on the current puzzle (Bookbinder). */
  puzzleCard?: boolean;
  /** Watchman: Threat Lens used at this move count with this material balance. */
  lensAt?: { moves: number; mat: number };
  status: 'playing' | 'won' | 'failed';
  /** Why the room ended (shown in the tally). */
  reason?: string;
}

export interface RoomResult {
  layer: number;
  kind: RoomKind;
  modifier: ModifierId;
  elite?: boolean;
  gamble?: boolean;
  won: boolean;
  chips: number;
  target: number;
  mult: number;
  score: number;
  gold: number;
  fires: Fire[];
  composureLost: number;
  reason: string;
  /** No mistake or blunder (clean bonus). */
  clean?: boolean;
}

export interface Moment {
  layer: number;
  kind: RoomKind;
  move: UserMove;
  /** Composure it cost (or would have, if insured). */
  cost: number;
}

export type Offer =
  | { type: 'relic'; ids: RelicId[]; free: boolean; title: string }
  | { type: 'consumable'; ids: ConsumableId[]; free: boolean; title: string };

export type EventState =
  | { kind: 'shrine'; fen: string; choices: string[]; answer: string[]; picked?: string }
  | { kind: 'gambler'; done?: boolean }
  | { kind: 'merchant'; stock: { id: RelicId; price: number }[] }
  | { kind: 'altar'; ids: RelicId[] }
  | { kind: 'library'; fen: string; choices: string[]; answer: string[]; picked?: string; themes: string[] }
  | { kind: 'spring'; used?: boolean };

export type Phase =
  | 'start' // choose a starting relic
  | 'map' // choose the next room
  | 'room'
  | 'event'
  | 'tally' // score, gold and (sometimes) a free 1-of-3 pick underneath
  | 'reward' // free 1-of-3 pick after an event
  | 'curse' // optional deal before the boss
  | 'camp' // campfire / shop
  | 'debrief';

export interface Run {
  version: 3;
  id: string;
  startedAt: number;
  /** Puzzle rating snapshot when the run started (read-only use). */
  rating: number;
  /** Opponent strength (puzzle rating blended with playing results). */
  strength?: number;
  difficulty?: DiffId;
  bossId: string;
  phase: Phase;
  /** layers[0] = [room1]; middle layers = two options each; last = [boss]. */
  layers: MapNode[][];
  /** Chosen node per layer. */
  path: number[];
  /** Next layer to play. */
  layer: number;
  composure: number;
  gold: number;
  relics: RelicId[];
  consumables: ConsumableId[];
  curses: CurseId[];
  room: RoomState | null;
  event: EventState | null;
  results: RoomResult[];
  moments: Moment[];
  offer: Offer | null;
  shopStock: ConsumableId[];
  restBought: boolean;
  /** Rests bought at the current campfire. */
  rests?: number;
  /** Paid rerolls at the current campfire. */
  rerolls?: number;
  /** The campfire's relic for sale (null once bought). */
  stall?: RelicId | null;
  /** Bigger Pouch bought (extra card slots). */
  pouch?: number;
  /** Embers that leftover gold turned into (set when the run ends). */
  goldEmbers?: number;
  cursed: boolean;
  curseDecided: boolean;
  secondWindUsed?: boolean;
  ended: null | 'won' | 'lost';
  endedAt?: number;
  finalScore?: number;
  /** Puzzles already used this run (avoid repeats). */
  usedPuzzles: string[];
  /** Meta snapshot taken when the run started (boosts and what is still locked). */
  meta?: { boosts: Partial<Record<string, number>>; lockedRelics: RelicId[]; lockedCards?: ConsumableId[] };
  /** Steady Nerves boost used (first blunder of the run costs one less). */
  nervesUsed?: boolean;
  /** Milestones earned during this run (ids), for the debrief. */
  milestones?: string[];
  /** The free shop reroll (Second Look) has been used at this campfire. */
  rerollUsed?: boolean;
  /** Embers earned (set when the run ends). */
  embers?: number;
  abandoned?: boolean;
  /** Moves played with Engine's Eye showing ("Room: Nf3"), for the debrief. */
  eyeMoves?: string[];
  /** Healing Spring: the next room gets Razor Focus. */
  springDebt?: boolean;
  /** Bookbinder: puzzles solved without a card (counts toward the next free Blunder Check). */
  bookbinder?: number;
  /** Measurement for playtests. */
  roomMs?: number;
  roomStartedAt?: number;
  goldEarned?: number;
  goldSpent?: number;
}

export interface Playtest {
  id?: number;
  at: number;
  runId: string;
  fun: number;
  note: string;
  result: 'won' | 'lost';
  score: number;
  minutes: number;
  relics: RelicId[];
  rooms: { kind: RoomKind; won: boolean; score: number }[];
  composureLeft: number;
  cursed: boolean;
  difficulty?: DiffId;
  /** Minutes spent inside rooms (the rest is map, shop, menus). */
  roomMinutes?: number;
  goldEarned?: number;
  goldSpent?: number;
}
