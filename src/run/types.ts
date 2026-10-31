import type { AnalysisResult } from '../lib/engine/types';
import type { Classification } from '../lib/chess/evaluation';
import type { PuzzleSpec } from '../lib/puzzles/spec';

export type RoomKind = 'puzzle' | 'convert' | 'hold' | 'boss';
export type ModifierId = 'gilded' | 'focused' | 'steady' | 'pickpocket';
export type ConvertGoal = 'gain' | 'keep';

export type RelicId = 'calm' | 'bloodhound' | 'forkmaster' | 'ironwall' | 'pins' | 'clean' | 'spendthrift' | 'bloomer';
export type ConsumableId = 'eye' | 'rewind' | 'cards' | 'lens' | 'opinion' | 'insurance';

export interface MapNode {
  kind: RoomKind;
  modifier: ModifierId;
  goal?: ConvertGoal;
  /** Index into the position pool (convert/hold/boss). */
  pos?: number;
}

/** A relic (or modifier) firing during a room; shown in the tally. */
export interface Fire {
  relic: RelicId;
  mult?: number;
  gold?: number;
  composure?: number;
  /** Ply index (user move number in the room) that fired it; -1 = room end. */
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
  /** Puzzle rooms: was this the solution move? */
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
  list: PuzzleSpec[];
  index: number;
  /** Next solution index the user must play. */
  step: number;
  solved: number;
  failed: number;
  /** The current puzzle is lost (showing the answer). */
  lost: boolean;
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
  puzzle?: PuzzleProgress;
  status: 'playing' | 'won' | 'failed';
  /** Why the room ended (shown in the tally). */
  reason?: string;
}

export interface RoomResult {
  layer: number;
  kind: RoomKind;
  modifier: ModifierId;
  won: boolean;
  chips: number;
  mult: number;
  score: number;
  gold: number;
  fires: Fire[];
  composureLost: number;
  reason: string;
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

export type Phase =
  | 'start' // choose a starting relic
  | 'map' // choose the next room
  | 'intro' // objective + modifier before entering
  | 'room'
  | 'tally'
  | 'reward' // free 1-of-3 pick after a cleared room
  | 'curse' // optional deal before the boss
  | 'camp' // campfire / shop
  | 'debrief';

export interface Run {
  version: 1;
  id: string;
  startedAt: number;
  /** Puzzle rating snapshot when the run started (read-only use). */
  rating: number;
  bossId: string;
  phase: Phase;
  /** layers[0] = [room1]; layers[1..2] = two options each; layers[3] = [boss]. */
  layers: MapNode[][];
  /** Chosen node per layer. */
  path: number[];
  /** Next layer to play. */
  layer: number;
  composure: number;
  gold: number;
  relics: RelicId[];
  consumables: ConsumableId[];
  room: RoomState | null;
  results: RoomResult[];
  moments: Moment[];
  offer: Offer | null;
  shopStock: ConsumableId[];
  restBought: boolean;
  cursed: boolean;
  curseDecided: boolean;
  ended: null | 'won' | 'lost';
  endedAt?: number;
  finalScore?: number;
  /** Puzzles already used this run (avoid repeats). */
  usedPuzzles: string[];
  /** Moves played with Engine's Eye showing ("Room: Nf3"), for the debrief. */
  eyeMoves?: string[];
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
}
