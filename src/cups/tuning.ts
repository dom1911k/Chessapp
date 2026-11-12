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
    goldWin: 6,
    goldDraw: 3,
    /** Accuracy above this floor pays goldPerAccPoint per point (rounded down). */
    goldAccFloor: 60,
    goldPerAccPoint: 0.25,
    /** Per great or brilliant move. */
    goldGreat: 2,
  },
  /** Boons last the whole cup; after each won round you pick one of `offer`. */
  boons: {
    maxPerCup: 3,
    offer: 3,
    /** Chance a rare boon may appear in an offer (when unlocked). */
    rareChance: 0.35,
    extraMinuteMs: 60_000,
    steadyHandIncMs: 2_000,
    openingPrepMoves: 8,
    secondWindBelowMs: 30_000,
    secondWindAddMs: 30_000,
    /** Rattled: after you win material, the opponent's Maia temperature rises by this for `rattledMoves` of its moves. */
    rattledTemp: 0.5,
    rattledMoves: 4,
    /** Long Night: the final opponent plays this many rating points weaker. */
    longNightElo: 50,
  },
  /** Charms: single use, bought with gold between rounds. */
  charms: {
    slots: 2,
    shopOffer: 3,
    prices: { rewind: 6, threatBell: 4, candidates: 5, colour: 3, battlefield: 4 } as Record<string, number>,
    /** Battlefield positions come from the opening book, this many half-moves in. */
    battlefieldPlies: [4, 8] as [number, number],
  },
  /** Old Run mode progress (Embers, materials, unlocks) becomes this many Laurels, once. */
  legacyLaurels: 3,
};

export type Tuning = typeof TUNING;
