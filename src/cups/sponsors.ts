// Sponsors: before a cup you may sign one of three contracts. Signing pays a little starting gold;
// fulfilling the contract by the end of the cup pays bonus Laurels.
import { counted, type CupState } from './cup';
import { rng, shuffle, tierIndex, type CupTier } from './ladder';
import { TUNING } from './tuning';

const S = TUNING.sponsors;

export interface Sponsor {
  id: string;
  /** The (fictional) sponsor. */
  name: string;
  glyph: string;
  /** The contract, in a sentence. */
  text: string;
  /** Laurels for fulfilling it (before the high-tier bonus). */
  reward: number;
  /** Fulfilled by this cup (checked when it ends; also used for live progress). */
  done(c: CupState): boolean;
}

const wins = (c: CupState) => counted(c).filter((r) => r.result === 'win');

export const SPONSORS: Sponsor[] = [
  { id: 'noCharms', name: 'Castle Coffee', glyph: 'shield', text: 'Win the cup without using a charm.', reward: 3, done: (c) => c.place === 'winner' && c.charmsUsed === 0 },
  { id: 'finalist', name: 'Rook Hill Tea', glyph: 'tower', text: 'Reach the final.', reward: 2, done: (c) => c.place === 'final' || c.place === 'winner' },
  { id: 'blackWin', name: 'Knight Owl Lamps', glyph: 'moon', text: 'Win a game with Black (a draw doesn’t count).', reward: 2, done: (c) => wins(c).some((r) => r.color === 'b') },
  { id: 'timeLeft', name: 'Hourglass Bakery', glyph: 'hourglass', text: 'Win a game with at least 7:00 left on your clock.', reward: 2, done: (c) => wins(c).some((r) => (r.clockLeft ?? 0) >= 420) },
  { id: 'quick', name: 'Gambit Gazette', glyph: 'bolt', text: 'Win a game in 30 moves or fewer.', reward: 2, done: (c) => wins(c).some((r) => r.moves <= 30) },
  { id: 'accurate', name: 'Fianchetto Optics', glyph: 'lens', text: 'Play at least two games averaging 80% accuracy or more.', reward: 3, done: (c) => { const g = counted(c).filter((r) => r.accuracy !== undefined); return g.length >= 2 && g.reduce((n, r) => n + (r.accuracy ?? 0), 0) / g.length >= 80; } },
  { id: 'tactician', name: 'Pin & Fork Diner', glyph: 'fork', text: 'Play 3 great or brilliant moves in this cup.', reward: 3, done: (c) => counted(c).reduce((n, r) => n + (r.greats ?? 0), 0) >= 3 },
  { id: 'giantKiller', name: 'Zugzwang Gym', glyph: 'swords', text: 'Beat the top seed.', reward: 3, done: (c) => wins(c).some((r) => r.opponentId === c.field[c.field.length - 1]) },
  { id: 'flawless', name: 'Endgame Insurance', glyph: 'crown', text: 'Win the cup winning every game (no draws, no Second Chance).', reward: 4, done: (c) => c.place === 'winner' && counted(c).every((r) => r.result === 'win') && !c.secondChanceUsed },
];

export const sponsorById = (id: string | undefined) => SPONSORS.find((s) => s.id === id);

/** Laurels a contract pays in this tier. */
export const sponsorReward = (s: Sponsor, tier: CupTier) => s.reward + (tierIndex(tier) >= S.bonusFromTier ? 1 : 0);

/** Three different contracts for a cup (deterministic from the seed). */
export function sponsorOffers(tier: CupTier, seed: number): Sponsor[] {
  void tier;
  return shuffle(SPONSORS, rng(seed + 991)).slice(0, S.offer);
}
