// Run mode (experimental demo): EVERY tunable number lives here.
// Change values, reload, playtest. Nothing else in src/run should hard-code balance numbers.

export const TUNING = {
  /** Composure = lives. */
  composure: {
    start: 5,
    max: 7,
    /** Cost per classified move. Inaccuracy is free. */
    cost: { best: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 2 },
    /** Failing a room's objective (not the boss). */
    failRoom: 1,
  },

  gold: {
    start: 4,
    /** Per cleared room, by room kind. Failed rooms pay nothing. */
    perRoom: { puzzle: 4, convert: 5, hold: 5, boss: 0 },
    /** Extra for a clean room (no mistake or blunder). */
    cleanBonus: 3,
  },

  /** Score = chips × mult. Chips = per-move accuracy (0..100) summed over the room. */
  score: {
    baseMult: 1,
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
  roomElo: { min: 700, max: 1700, offset: 0 },

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
    boss: {
      moves: 15,
      /** Win at once when you reach this (your POV)… */
      winCp: 300,
      /** …or be at least this good after the last move. */
      endCp: 100,
    },
  },

  /** Room modifiers (shown before entering). */
  modifiers: {
    gilded: { goldMult: 1.5 },
    focused: { mult: 1, extraBlunderCost: 1 },
    steady: {},
  },

  boss: {
    /** The Pickpocket: blunders cost this many times the Composure. */
    pickpocketBlunderFactor: 2,
  },

  curse: {
    ratingBoost: 150,
    /** Taking the deal multiplies your gold right away (before the last shop). */
    goldFactor: 2,
  },

  shop: {
    /** Consumables offered per shop visit. */
    offers: 3,
    /** Price of a Rest (+1 Composure). */
    restPrice: 6,
    restComposure: 1,
  },

  consumables: {
    maxHeld: 2,
    price: { eye: 9, rewind: 5, cards: 4, lens: 3, opinion: 4, insurance: 5 },
    /** Relative chance to appear in a 1-of-3 offer. */
    weight: { eye: 1, rewind: 3, cards: 3, lens: 3, opinion: 3, insurance: 2 },
  },

  relics: {
    calmComposure: 1,
    bloodhoundGold: 2,
    forkMult: 0.5,
    pinMult: 0.5,
    ironWallMult: 0.25,
    cleanHandsMult: 0.2,
    spendthriftPriceFactor: 0.5,
    spendthriftCarryPenalty: 1,
    lateBloomerPerRoom: 0.5,
  },

  /** After a cleared room (by map layer): what kind of free 1-of-3 pick you get. */
  rewardAfterLayer: ['consumable', 'relic', 'consumable'] as ('consumable' | 'relic' | null)[],

  /** Timing (ms). */
  timing: {
    oppMoveMinDelay: 250,
    puzzleSetupDelay: 450,
    wrongPuzzlePause: 1100,
  },
} as const;
