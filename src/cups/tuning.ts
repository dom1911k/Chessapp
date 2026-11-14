// Every balance number for Cups lives here. Change a number, not the code.
// Sections: juice (animation feel), ladder (stage 2), gold/boons/charms (stage 3),
// quirks (stage 4), story (stage 5), laurels/shop (stage 6).

export const TUNING = {
  /** Animation feel shared by every cup screen (tally, slams, coin streams). */
  juice: {
    /** Tap during an animation: this many times faster. Hold this long: finish at once. */
    tapSpeed: 3,
    holdMs: 350,
    /** Game-speed choices for animations. */
    speeds: [1, 1.5, 2, 3] as number[],
    /** Coins flying into the gold counter: at most this many, this far apart. */
    coinMax: 14,
    coinStaggerMs: 70,
    /** Particles in a slam burst. */
    particles: 14,
    /** Haptics (ms). */
    haptic: { tick: 8, slam: 30, boon: 18 },
  },
  /** The cup ladder: tight rating bands, one tier opens the next. */
  ladder: {
    tiers: [
      { id: 'bronze', name: 'Bronze Cup', band: [400, 600] },
      { id: 'silver', name: 'Silver Cup', band: [600, 800] },
      { id: 'gold', name: 'Gold Cup', band: [800, 1000] },
      { id: 'platinum', name: 'Platinum Cup', band: [1000, 1200] },
      { id: 'diamond', name: 'Diamond Cup', band: [1200, 1400] },
    ] as { id: string; name: string; band: [number, number] }[],
    /** Where in the band your opponent plays in each round (0 = bottom, 1 = top): the final is the strongest. */
    roundShare: [0, 0.5, 1],
    /** Characters in a cup besides you. */
    fieldSize: 7,
    /** Default clock for cup games. */
    timeControl: '600+0',
    /** XP for where you finish (per tier: + tierXpStep × tier index). */
    xp: { winner: 80, final: 40, semi: 20, tierXpStep: 20 },
    /** Simulated matches: typical game length (moves) for the bracket chatter. */
    simMoves: [22, 58],
  },
  /** Gold: earned per game, spent on charms in the shop between rounds. */
  gold: {
    /** Gold you start a cup with. */
    start: 0,
    /** A win pays this; a draw that sends you through pays goldDraw. */
    goldWin: 4,
    goldDraw: 3,
    /** Accuracy above this floor pays goldPerAccPoint per point (rounded down). */
    goldAccFloor: 60,
    goldPerAccPoint: 0.25,
    /** Per great or brilliant move. */
    goldGreat: 2,
  },
  /**
   * Boons last the whole cup: a free pick before the quarter-final, then one after each won round
   * (1 of `offer`). Numbers in [I, II, III] lists are per upgrade level: II is the original
   * strength, I a little weaker, III stronger (see `levels` for the Laurel cost).
   */
  boons: {
    maxPerCup: 3,
    offer: 3,
    /** Chance a rare boon may appear in an offer (when unlocked). */
    rareChance: 0.35,
    extraMinuteMs: [40_000, 60_000, 90_000],
    steadyHandIncMs: [1_000, 2_000, 3_000],
    openingPrepMoves: [5, 8, 12],
    secondWindBelowMs: 30_000,
    secondWindAddMs: [20_000, 30_000, 45_000],
    /** Rattled: after you win material, the opponent's Maia temperature rises by this for `rattledMoves` of its moves. */
    rattledTemp: [0.35, 0.5, 0.6],
    rattledMoves: [3, 4, 5],
    /** Long Night: the final opponent plays this many rating points weaker. */
    longNightElo: [30, 50, 80],
    /** Draw Odds works up to this round (0 quarter … 2 final); at III such a draw pays the win gold. */
    drawOddsMaxRound: [1, 2, 2],
    drawOddsWinGold: [false, false, true],
    /** Second Chance can save a lost final from II; at III the replay gives you extra time. */
    secondChanceFinal: [false, true, true],
    secondChanceExtraMs: [0, 0, 60_000],
    /** Home Prep works with Black from II; at III your next moves after the line are free. */
    homePrepBlack: [false, true, true],
    homePrepFreeMoves: [0, 0, 5],
    /** Scout Report: I quirks only, II also favourite openings, III also a 4th card in boon picks. */
    scoutOpenings: [false, true, true],
    scoutOffer: [3, 3, 4],
  },
  /** Charms: single use, bought with gold between rounds. Lists are per upgrade level [I, II, III]. */
  charms: {
    slots: 2,
    shopOffer: 3,
    prices: { rewind: [10, 8, 6], threatBell: [4, 4, 4], candidates: [5, 5, 5], colour: [4, 3, 2], battlefield: [4, 4, 4] } as Record<string, number[]>,
    /** At most this many of a charm in your slots at once. */
    maxHeld: { rewind: 1 } as Record<string, number>,
    /** Battlefield positions come from the opening book, this many half-moves in. */
    battlefieldPlies: [4, 8] as [number, number],
    battlefieldOptions: [2, 3, 4],
    /** Threat Bell: the cheapest piece it guards (I: rook or queen only), and how many of your moves. */
    threatBellMinValue: [5, 3, 3],
    threatBellMoves: [1, 1, 2],
    /** Candidate Cards: cards shown (one is the engine's best). Fewer is easier. */
    candidateCards: [4, 3, 2],
  },
  /** Upgrades: every boon and charm starts at level I; Laurels raise it to II, then III. */
  levels: {
    max: 3,
    /** Laurels for level II and level III. */
    cost: [2, 4],
  },
  /** Heat: optional challenges chosen when entering a cup you have won before. */
  heat: {
    mods: {
      sharper: { heat: 1, elo: 50 },
      shortClock: { heat: 1, ms: 480_000 },
      noShop: { heat: 1 },
      stingy: { heat: 1, goldFactor: 0.5 },
      fewerBoons: { heat: 1, maxBoons: 2 },
      doubleQuirk: { heat: 2 },
      noDrawOdds: { heat: 2 },
    } as Record<string, { heat: number; elo?: number; ms?: number; goldFactor?: number; maxBoons?: number }>,
    /** Bonus Laurels per heat point, by finish (rounded down). */
    laurelsPerHeat: { winner: 1, final: 0.5, semi: 0.25, quarter: 0 } as Record<'quarter' | 'semi' | 'final' | 'winner', number>,
  },
  /** Sponsors: one contract per cup; fulfil it for bonus Laurels. */
  sponsors: {
    offer: 3,
    /** Gold you start the cup with when you sign. */
    signingGold: 2,
    /** Extra Laurels per contract from this tier index up (platinum, diamond). */
    bonusFromTier: 3,
  },
  /** Mastery: three stars per tier; the codex of quirks; your nemesis. */
  mastery: {
    /** Laurels for each new star. */
    starLaurels: 2,
    /** Heat needed for the third star. */
    starHeat: 3,
    /** Laurels the first time you beat an opponent with a quirk. */
    codexLaurels: 1,
    /** Your nemesis plays this much stronger per grudge (times they knocked you out), up to maxGrudge. */
    grudgeElo: 25,
    maxGrudge: 3,
    /** Laurels for beating your nemesis. */
    nemesisLaurels: 2,
  },
  /**
   * Opponent quirks: only Maia/engine behaviour (opening choice, temperature, think time,
   * re-weighting Maia's move probabilities). Temperatures are added to the opponent's Maia
   * temperature (about 2.6 at 400, 2.25 at 1200, 1.8 at 1400).
   */
  quirks: {
    /** Quirks you faced most recently are avoided when picking a cup's quirks. */
    recentMemory: 6,
    /** A quirk's icon pulses at most once per this many plies. */
    pulseEvery: 6,
    speedster: { think: 0.45, temp: 0.15 },
    timeTrouble: { openingMoves: 12, think: 2.6, lowMs: 60_000, lowTemp: 0.6 },
    gambiteer: { offerMaxMove: 6 },
    earlyQueen: { untilMove: 10, weight: 5 },
    turtle: { tradeWeight: 2.2, checkWeight: 0.6, temp: -0.15 },
    tilter: { moves: 6, temp: 0.5 },
    comebackKid: { belowCp: -150, temp: -0.35 },
    slowStarter: { moves: 12, temp: 0.5 },
    endgameGrinder: { evenCp: 80, tradeWeight: 2.5, queenTradeWeight: 4, queensOffTemp: -0.4 },
    pawnStormer: { fromMove: 6, weight: 3 },
    pawnGrabber: { weight: 4 },
    copycat: { untilMove: 6, weight: 100 },
    uncastled: { untilMove: 25, castleWeight: 0.03, noticeAtMove: 12 },
  },
  /** Laurels: earned when a cup ends, spent in the Laurel shop between cups. */
  laurels: {
    earn: { quarter: 0, semi: 1, final: 2, winner: 3 } as Record<'quarter' | 'semi' | 'final' | 'winner', number>,
    /** Laurel shop prices. */
    prices: {
      drawOdds: 4,
      secondChance: 6,
      homePrep: 2,
      longNight: 4,
      battlefield: 3,
      'board:bone': 2,
      'board:frost': 3,
      'board:ember': 4,
      'pieces:runic': 4,
      'pieces:gilded': 5,
      'frame:bronze': 2,
      'frame:silver': 3,
      'frame:gold': 4,
      'frame:platinum': 5,
      'frame:diamond': 6,
    } as Record<string, number>,
  },
  /** Old Run mode progress (Embers, materials, unlocks) becomes this many Laurels, once. */
  legacyLaurels: 3,
};

export type Tuning = typeof TUNING;
