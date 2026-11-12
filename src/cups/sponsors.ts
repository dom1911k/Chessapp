// ===== SPONSORS HOOK (not built yet) =========================================================
// Idea: when you enter a cup, choose one of a few sponsors. A sponsor grants a starting boon and
// adds items to that cup's shop. To build it:
//   1. return real offers from sponsorOffers() (e.g. from TUNING.sponsors),
//   2. show the choice in TierList before useCup.enter() and pass the pick to enter(),
//   3. in useCup.enter(), apply the sponsor (boons: [s.boon], and use s.shopExtra in shopOffer).
// Nothing else needs to change: the cup state already carries boons and shop offers.
import type { BoonId, CharmId } from './boons';
import type { CupTier } from './ladder';

export interface Sponsor {
  id: string;
  name: string;
  /** Boon granted at the start of the cup. */
  boon: BoonId;
  /** Extra charms that may appear in this cup's shop. */
  shopExtra: CharmId[];
}

/** Sponsors offered when entering a cup of this tier (none until the feature is built). */
export function sponsorOffers(_tier: CupTier): Sponsor[] {
  void _tier;
  return [];
}
// ============================================================================================
