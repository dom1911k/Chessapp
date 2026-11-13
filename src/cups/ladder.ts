// The cup ladder and the knockout bracket (pure, testable). Eight players: you and seven
// characters, who play at the cup's band rating (not their usual ladder rating). Your games are
// real; the other matches are decided by rating odds.
import { kvGet, kvSet } from '../lib/db';
import { OPPONENTS } from '../lib/people';
import { TUNING } from './tuning';

const L = TUNING.ladder;

export type CupTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export const TIERS = L.tiers.map((t) => t.id) as CupTier[];
export const tierInfo = (t: CupTier) => L.tiers.find((x) => x.id === t)!;
export const tierIndex = (t: CupTier) => TIERS.indexOf(t);

export const YOU = 'you';
export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];
export type Place = 'winner' | 'final' | 'semi' | 'quarter';

/** Small deterministic generator, so a cup replays the same way from its seed. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The rating your opponent plays at in a round of a tier (rising through the band). */
export function roundRating(tier: CupTier, round: number): number {
  const [lo, hi] = tierInfo(tier).band;
  return Math.round(lo + (hi - lo) * L.roundShare[Math.min(round, L.roundShare.length - 1)]);
}

/**
 * Seven different characters, weakest seed first, each with a seed rating inside the band
 * (used for the simulated matches).
 */
export function pickField(tier: CupTier, seed: number): { field: string[]; ratings: Record<string, number> } {
  const r = rng(seed);
  const chosen = shuffle(OPPONENTS.map((o) => o.id), r).slice(0, L.fieldSize);
  // Seed by their usual strength, so the bracket keeps its character (Lily early, Mei late).
  const byElo = [...chosen].sort((a, b) => (OPPONENTS.find((o) => o.id === a)!.elo - OPPONENTS.find((o) => o.id === b)!.elo));
  const [lo, hi] = tierInfo(tier).band;
  const ratings: Record<string, number> = {};
  byElo.forEach((id, i) => (ratings[id] = Math.round(lo + ((hi - lo) * i) / (byElo.length - 1))));
  return { field: byElo, ratings };
}

/**
 * The bracket: you meet the weakest seed in the quarter-final, and the strongest three are in
 * the other half, so the final is the hardest match.
 */
export const seedBracket = (field: string[]) => [YOU, field[0], field[1], field[2], field[3], field[6], field[4], field[5]];

/** Chance that `a` beats `b` from their ratings. */
export const winChance = (ra: number, rb: number) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

/** You go through with a win — or with a draw when you had Black (draw odds), or with Draw Odds. */
export const advances = (result: 'win' | 'loss' | 'draw', color: 'w' | 'b', drawOdds = false) => result === 'win' || (result === 'draw' && (color === 'b' || drawOdds));

/** White in the quarter-final, Black in the semi-final, and the seed decides the final. */
export const defaultColor = (round: number, seed: number): 'w' | 'b' => (round === 0 ? 'w' : round === 1 ? 'b' : seed % 2 ? 'w' : 'b');

export interface SimMatch {
  a: string;
  b: string;
  winner: string;
  /** Length of the game, for the chatter. */
  moves: number;
}

/** Plays the bots' matches of a round (everything except yours). */
export function simulateRound(alive: string[], ratings: Record<string, number>, seed: number, round: number, nemesis?: string): SimMatch[] {
  const r = rng(seed * 31 + round);
  const out: SimMatch[] = [];
  for (let i = 0; i < alive.length; i += 2) {
    const [a, b] = [alive[i], alive[i + 1]];
    if (a === YOU || b === YOU) continue;
    const roll = r();
    // Your nemesis is on a mission: they win their other matches.
    const winner = nemesis === a ? a : nemesis === b ? b : roll < winChance(ratings[a] ?? 800, ratings[b] ?? 800) ? a : b;
    out.push({ a, b, winner, moves: Math.round(L.simMoves[0] + r() * (L.simMoves[1] - L.simMoves[0])) });
  }
  return out;
}

/** XP for where you finish. */
export function cupXp(tier: CupTier, place: Place): number {
  const bonus = L.xp.tierXpStep * tierIndex(tier);
  return place === 'winner' ? L.xp.winner + bonus : place === 'final' ? L.xp.final + bonus : place === 'semi' ? L.xp.semi + bonus : 0;
}

// ---- Trophies (kept under the old key, so Bronze/Silver/Gold wins carry over) ------------

export type Trophies = Partial<Record<CupTier, number>>;
export const TROPHY_KEY = 'cupTrophies';
export const getTrophies = () => kvGet<Trophies>(TROPHY_KEY, {});
export async function addTrophy(tier: CupTier): Promise<Trophies> {
  const t = await getTrophies();
  const next = { ...t, [tier]: (t[tier] ?? 0) + 1 };
  await kvSet(TROPHY_KEY, next);
  return next;
}

/** The first tier is always open; each next one opens when you have won the one before (or any higher). */
export const tierOpen = (tier: CupTier, t: Trophies) => {
  const i = tierIndex(tier);
  return i === 0 || TIERS.slice(i - 1).some((x) => (t[x] ?? 0) > 0);
};
