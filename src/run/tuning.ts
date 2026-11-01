// Run mode (experimental demo): EVERY tunable number lives here.
// Change values, reload, playtest. Nothing else in src/run should hard-code balance numbers.
import type { ConsumableId } from './types';

export type DiffId = 'apprentice' | 'adept' | 'master';
type Costs = { best: number; good: number; inaccuracy: number; mistake: number; blunder: number };

/** A difficulty, chosen before each run. */
export interface Difficulty {
  name: string;
  blurb: string;
  /** Added to the opponents' rating (rooms and rival). */
  eloOffset: number;
  /** Free take-backs per room (after a mistake or blunder). */
  takebacks: number;
  /** Candles per classified move. */
  cost: Costs;
  /** Room red lines move this many centipawns in your favour (negative = stricter). */
  margin: number;
  /** Moves you get to climb back above a red line (or overtime moves at the end). */
  grace: number;
  /** Extra Embers for a run with at least one cleared room. */
  embers: number;
}


/** A rival's boss rule. Only scoring, Composure, goals or card access — never chess rules. */
export interface BossMod {
  name: string;
  /** Extra Composure for an inaccuracy (normally free). */
  inaccuracyCost?: number;
  /** Extra Composure for a mistake. */
  mistakeExtra?: number;
  /** Blunders cost this many times the Composure. */
  blunderFactor?: number;
  /** A blunder ends the duel at once (lost). */
  blunderEnds?: boolean;
  /** Override the win line (cp) and/or move limit and/or end requirement. */
  winCp?: number;
  endCp?: number;
  moves?: number;
  /** No early win: only the position after the last move counts. */
  noEarlyWin?: boolean;
  /** Cards that can't be used in this fight. */
  sealed?: ConsumableId[];
  /** Flat mult for the fight. */
  multBonus?: number;
  /** Mult for each of your (sound) captures. */
  captureMult?: number;
}

export const TUNING = {
  difficulty: {
    apprentice: {
      name: 'Apprentice',
      blurb: 'Gentler opponents, wider red lines, one free take-back per room. Only blunders cost a candle.',
      eloOffset: -200,
      takebacks: 1,
      cost: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 1 },
      margin: 100,
      grace: 3,
      embers: 0,
    },
    adept: {
      name: 'Adept',
      blurb: 'The intended challenge. Mistakes and blunders cost candles. +1 Ember.',
      eloOffset: 0,
      takebacks: 0,
      cost: { best: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 2 },
      margin: 0,
      grace: 2,
      embers: 1,
    },
    master: {
      name: 'Master',
      blurb: 'Stronger opponents, tighter red lines, one move to recover. +3 Embers.',
      eloOffset: 150,
      takebacks: 0,
      cost: { best: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 2 },
      margin: -50,
      grace: 1,
      embers: 3,
    },
  } as Record<DiffId, Difficulty>,

  /**
   * Opponent strength: your puzzle rating blended with how you actually play (the best app
   * opponent you've beaten, + beatBonus). Never above your puzzle rating.
   */
  strength: { puzzleWeight: 0.4, beatBonus: 100, onlyLosses: 500, noGamesOffset: -250, rivalOver: 200 },

  /** Eval bar: how soft the curve is (lower = calmer swings). */
  gauge: { softness: 0.7 },

  /** Composure = lives. */
  composure: {
    start: 5,
    max: 7,
    /** Cost per classified move (Adept; each difficulty has its own). */
    cost: { best: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 2 },
    /** Failing a room's objective (not the boss) — waived when a move in that room already cost candles. */
    failRoom: 1,
    /** Most candles a single room can take (moves + failing it); the rival's room may take a little more. */
    roomCap: 2,
    bossCap: 3,
  },

  gold: {
    start: 4,
    /** Per cleared room, by room kind. Failed rooms pay nothing. */
    perRoom: { puzzle: 4, convert: 5, hold: 5, ward: 4, vault: 5, duel: 4, boss: 0 },
    /** Extra for a clean room (no mistake or blunder). */
    cleanBonus: 3,
    /** Extra for beating the room's chip target. */
    targetBonus: 3,
  },

  /** Score = chips × mult. Chips = per-move accuracy (0..100) summed over the room. */
  score: {
    baseMult: 1,
    /** Chip target = moves played × this (beat it for bonus gold). */
    targetPerMove: 80,
    eliteTargetPerMove: 86,
    /** End-of-run bonus chips per Composure left (only when the boss is beaten). */
    composureLeftChips: 50,
  },

  engine: {
    /** Analysis depth/time per position (capped so rooms stay snappy). */
    depth: 11,
    movetime: 900,
    /** Multi-PV for the position before your move (Candidate Cards need ≥ 3). */
    multipv: 3,
  },

  /** Opponent strength for normal rooms: your puzzle rating, clamped. */
  roomElo: { min: 500, max: 1700, offset: 0 },

  rooms: {
    puzzle: {
      count: 3,
      /** Solve at least this many to clear the room. */
      needSolved: 2,
      /** Puzzles are picked within ± this of your puzzle rating. */
      ratingWindow: 150,
      /** Chips for each correct puzzle move. */
      chipsPerMove: 100,
    },
    convert: {
      /** "Win more material or mate within N moves": material gain needed (pawn = 1). */
      gainMaterial: 2,
      gainMoves: 10,
      /** "Stay at least +X for N moves". */
      keepCp: 200,
      keepMoves: 8,
    },
    hold: {
      moves: 8,
      /** Fails if the eval (your POV) drops more than this below the starting eval. */
      maxDropCp: 150,
    },
    ward: { count: 3, needSolved: 2 },
    vault: {
      /** Endgame drills used (ids from src/lib/endgames.ts) and the move limit per goal. */
      drills: ['kqk', 'krk', 'kpk-front', 'kpk-square', 'lucena', 'qvp'],
      maxMoves: { mate: 18, promote: 14, capture: 16 },
    },
    duel: {
      /** Opening lines with this many half-moves already played. */
      minPlies: 3,
      maxPlies: 8,
      moves: 8,
      /** After the last move you may be at most this much worse than where you started. */
      maxDropCp: 100,
      /** The Duel opponent plays this much below your level (openings are hard). */
      eloOffset: -150,
      /** The book move is shown as a faint arrow for your first N moves. */
      hintMoves: 2,
    },
    boss: {
      moves: 15,
      /** Win at once when you reach this (your POV)… */
      winCp: 300,
      /** …or be at least this good after the last move. */
      endCp: 100,
    },
  },

  /** Elite rooms (skull on the map): harder goals, a guaranteed relic. */
  elite: {
    chance: 0.3,
    puzzleRating: 200,
    elo: 200,
    holdMaxDropCp: 100,
    keepCp: 250,
    gainMoves: 8,
    wardNeed: 3,
    puzzleNeed: 3,
    vaultMovesLess: 4,
    duelMaxDropCp: 40,
  },

  /** Room modifiers (shown before entering). */
  modifiers: {
    gilded: { goldMult: 1.5 },
    focused: { mult: 1, extraBlunderCost: 1 },
    steady: {},
  },

  /** Each rival's boss rule (by opponent id). Unknown ids use `default`. */
  bossMods: {
    lily: { name: 'Chaos Child', inaccuracyCost: 1 },
    tom: { name: 'Patient Grandpa', noEarlyWin: true, endCp: 150, multBonus: 0.5 },
    maya: { name: 'The Pickpocket', blunderFactor: 2 },
    jonas: { name: 'The Wall', winCp: 250, mistakeExtra: 1 },
    priya: { name: 'The Bookworm', sealed: ['eye', 'cards'], multBonus: 1 },
    marcus: { name: 'The Brawler', captureMult: 0.3, blunderEnds: true },
    sofia: { name: 'Clockwork', moves: 12, winCp: 250 },
    viktor: { name: "Grandmaster's Gaze", sealed: ['eye', 'cards', 'opinion'], multBonus: 1.5 },
    mei: { name: 'The Final Boss', winCp: 400, blunderFactor: 2, multBonus: 2 },
    default: { name: 'The Pickpocket', blunderFactor: 2 },
  } as Record<string, BossMod>,

  curse: {
    ratingBoost: 150,
    /** Taking the deal multiplies your gold right away (before the last shop). */
    goldFactor: 2,
  },

  /** Run-long curses (from the altar event). */
  curses: {
    /** Brittle: mistakes cost this much extra Composure. */
    brittleMistakeExtra: 1,
  },

  /** Embers per finished run: base + per cleared room + per score step + rival win (+ cursed win) + 1 per `goldPer` gold left. */
  embers: { base: 3, perRoom: 2, scoreStep: 600, bossWin: 6, cursedWin: 3, lampMinRooms: 3, lamp: 2, goldPer: 20 },

  events: {
    springPrice: 6,
    /** Chance for a fork option (layer 1) to be an event; one event is guaranteed in layers 2–3. */
    chance: 0.35,
    gambleStake: 1,
    gambleWin: 10,
    merchantStock: 2,
    relicPrice: { common: 6, uncommon: 9, rare: 13 },
  },

  shop: {
    /** Consumables offered per shop visit. */
    offers: 3,
    /** Price of a Rest (+1 Composure); each further rest at the same campfire costs restStep more. */
    restPrice: 6,
    restComposure: 1,
    restStep: 3,
    restMax: 3,
    /** Paid shop reroll (each one at the same campfire costs rerollStep more). */
    rerollPrice: 2,
    rerollStep: 1,
    /** One relic for sale at every campfire, by rarity. */
    stallPrice: { common: 9, uncommon: 13, rare: 18 },
    /** Bigger Pouch: +1 card slot for the rest of the run (once). */
    pouchPrice: 12,
    /** Cleanse the altar's curse. */
    cleansePrice: 10,
  },

  consumables: {
    maxHeld: 2,
    price: { eye: 9, rewind: 5, cards: 4, lens: 3, opinion: 4, insurance: 5, check: 2 },
    /** Relative chance to appear in a 1-of-3 offer. */
    weight: { eye: 1, rewind: 3, cards: 3, lens: 3, opinion: 3, insurance: 2, check: 3 },
  },

  relics: {
    /** Offer weights by rarity (elite rewards use `eliteRarity`). */
    rarity: { common: 60, uncommon: 30, rare: 10 },
    eliteRarity: { common: 25, uncommon: 45, rare: 30 },
    calmComposure: 1,
    bloodhoundGold: 2,
    forkMult: 0.5,
    pinMult: 0.5,
    ironWallMult: 0.25,
    cleanHandsMult: 0.2,
    spendthriftPriceFactor: 0.5,
    spendthriftCarryPenalty: 1,
    lateBloomerPerRoom: 0.5,
    hunterMult: 0.4,
    patienceMult: 0.15,
    executionerMult: 2,
    scholarGold: 1,
    glassMult: 1.5,
    glassComposure: 2,
    luckyExtraOffer: 1,
    luckyRestDiscount: 2,
    castleMult: 0.5,
    castleGold: 1,
    riteMult: 1,
    tempoMult: 0.3,
  },

  /** After a cleared room (by map layer): what kind of free 1-of-3 pick you get. Elites always give a relic. */
  rewardAfterLayer: ['consumable', 'relic', 'consumable', 'consumable'] as ('consumable' | 'relic' | null)[],

  /** Timing (ms). */
  timing: {
    oppMoveMinDelay: 250,
    puzzleSetupDelay: 450,
  },
} as const;
