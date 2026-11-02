import type { AnalysisResult } from '../lib/engine/types';
import type { Classification } from '../lib/chess/evaluation';
import type { PuzzleSpec } from '../lib/puzzles/spec';
import type { DiffId } from './tuning';
import type { TechId } from './codex';

export type RoomKind = 'puzzle' | 'convert' | 'hold' | 'ward' | 'vault' | 'duel' | 'echo' | 'mirror' | 'boss';
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
  | 'perfectionist' | 'coldread' | 'watchman' | 'bookbinder' | 'siege'
  | 'combination' | 'bulwark' | 'endgamesense' | 'ascetic' | 'patron';
export type Archetype = 'tactician' | 'fortress' | 'technician' | 'purist' | 'trader';
export type ConsumableId = 'eye' | 'rewind' | 'cards' | 'lens' | 'opinion' | 'insurance' | 'check' | 'shadow';

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
  relic: RelicId | 'rival' | 'tech';
  /** A Codex technique fired (relic = 'tech'). */
  tech?: TechId;
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
  /** Your-POV eval of the best line before the move (The Echo). */
  evalBefore?: number;
  /** The Mirror: you misread the opponent's idea before this move (chips halved). */
  misread?: boolean;
  composureLost: number;
  insured?: boolean;
  eye?: boolean;
  /** Puzzle-like rooms: was this the solution move? */
  correct?: boolean;
  /** Win% this move gave away (0..100), for the debrief ranking. */
  wpLoss?: number;
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
  /** Outcome of each finished puzzle (Grimoire). */
  outcomes?: boolean[];
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
  vault?: { goal: 'mate' | 'promote' | 'capture' | 'hold'; maxMoves: number; title: string; drill?: string };
  /** Difficulty of the run (old saves: Adept). */
  diff?: DiffId;
  /** Heat level of the run (0/undefined = none). */
  heat?: number;
  /** Free take-backs used in this room. */
  takebacks?: number;
  /** Cards used in this room (Cold Read). */
  cardsUsed?: number;
  /** A card was used on the current puzzle (Bookbinder). */
  puzzleCard?: boolean;
  /** The Mirror: the question before your current move. */
  mirror?: { fen: string; choices: string[]; answer: string; picked?: string };
  /** The Echo: where the position came from. */
  echo?: { when: number; played: string; best?: string };
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
  /** Rival fight: the battlefield choice, revealed in the tally. */
  battlefield?: BattlefieldResult;
  /** Eval (your POV, cp) after your last move — shown in the tally when Heat hides numbers. */
  evalEnd?: number;
}

export interface Moment {
  layer: number;
  kind: RoomKind;
  move: UserMove;
  /** Composure it cost (or would have, if insured); 0 for a free slip. */
  cost: number;
  /** The better move (engine's best, or the puzzle's answer). */
  best?: string;
}

export type Offer =
  | { type: 'relic'; ids: RelicId[]; free: boolean; title: string; /** Keen Eye: this one carries a curse. */ cursed?: RelicId }
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
  | 'battlefield' // choose where to fight the rival
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
  /** Heat level (Adept/Master; 0 or missing = none). */
  heat?: number;
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
  /** Patron: a second stall relic at a discount (null once bought). */
  stallExtra?: RelicId | null;
  /** The Echo: positions from your own games where you slipped (you to move). */
  echoes?: EchoPos[];
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
  meta?: { boosts: Partial<Record<string, number>>; lockedRelics: RelicId[]; lockedCards?: ConsumableId[]; lockedDrills?: string[] };
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
  /** The rival's battlefield options (boss pool indices) while choosing. */
  battlefield?: number[];
  /** Codex techniques equipped for this run. */
  techniques?: TechId[];
  /** Failed-room positions where an equipped technique was there to find (sent to reviews). */
  techMissed?: Moment[];
  /** Nemesis rule (a coach theme id) from your recurring mistakes in the main app. */
  nemesis?: string;
  /** Debrief moments written into the app's reviews (set when the run ends). */
  reviewsAdded?: number;
  /** Measurement for playtests. */
  roomMs?: number;
  roomStartedAt?: number;
  goldEarned?: number;
  goldSpent?: number;
}

export interface BattlefieldResult {
  fens: string[];
  /** Your-POV evals of the options (cp). */
  evals: number[];
  picked: number;
  /** 1 = the best for you. */
  rank: number;
  /** How much worse than the best option (cp). */
  lossCp: number;
  gold: number;
}

export interface EchoPos {
  fen: string;
  /** Opponent rating in that game. */
  elo: number;
  /** The move you played (SAN) and the better one (UCI). */
  played: string;
  best?: string;
  when: number;
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
  heat?: number;
  /** Battlefield judgement (rank 1 = best of the three, and cp behind the best). */
  battlefield?: { rank: number; lossCp: number };
  /** Minutes spent inside rooms (the rest is map, shop, menus). */
  roomMinutes?: number;
  goldEarned?: number;
  goldSpent?: number;
}
