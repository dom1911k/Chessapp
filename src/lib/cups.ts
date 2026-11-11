// Bot cups: an eight-player knockout — you and seven bots. You play your own matches as real
// games (match conditions); the other matches are decided by rating odds. Small rewards: XP, a
// trophy count, and a frame and title for your avatar.
import { kvGet, kvSet } from './db';
import { OPPONENTS } from './people';

export type CupTier = 'bronze' | 'silver' | 'gold';
export const TIERS: CupTier[] = ['bronze', 'silver', 'gold'];

const byElo = [...OPPONENTS].sort((a, b) => a.elo - b.elo).map((o) => o.id);

export const CUPS: Record<CupTier, { name: string; blurb: string; bots: string[]; xp: { winner: number; final: number; semi: number }; needs?: CupTier; timeControl: string }> = {
  bronze: { name: 'Bronze Cup', blurb: 'Seven opponents from 400 to 1600.', bots: byElo.slice(0, 7), xp: { winner: 80, final: 40, semi: 20 }, timeControl: '600+0' },
  silver: { name: 'Silver Cup', blurb: 'Tougher field, up to 1800.', bots: byElo.slice(1, 8), xp: { winner: 120, final: 60, semi: 30 }, needs: 'bronze', timeControl: '600+0' },
  gold: { name: 'Gold Cup', blurb: 'The seven strongest, up to 2000.', bots: byElo.slice(2, 9), xp: { winner: 180, final: 90, semi: 45 }, needs: 'silver', timeControl: '600+0' },
};

export const YOU = 'you';
export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];
export type Place = 'winner' | 'final' | 'semi' | 'quarter';

export interface CupState {
  tier: CupTier;
  seed: number;
  /** Players still in, in bracket order, for each round played so far: rounds[0] has 8, then 4, 2, 1. */
  rounds: string[][];
  /** Your match in progress. */
  awaiting?: { opponentId: string; since: number; color: 'w' | 'b' };
  /** Set when you are out or have won. */
  place?: Place;
  /** How your matches went, one entry per round you played. */
  yours: { opponentId: string; result: 'win' | 'loss' | 'draw'; color: 'w' | 'b'; advanced: boolean }[];
}

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

const elo = (id: string) => OPPONENTS.find((o) => o.id === id)?.elo ?? 1000;
/** Chance that `a` beats `b` (ratings only). */
export const winChance = (a: string, b: string) => 1 / (1 + Math.pow(10, (elo(b) - elo(a)) / 400));

/** A new cup. You are seeded so the road gets harder: weakest bot first, the strong half meets you in the final. */
export function newCup(tier: CupTier, seed: number): CupState {
  const b = CUPS[tier].bots; // weakest → strongest
  return { tier, seed, rounds: [[YOU, b[0], b[1], b[2], b[3], b[6], b[4], b[5]]], yours: [] };
}

export const currentRound = (c: CupState) => c.rounds.length - 1;
export const yourOpponent = (c: CupState): string | null => {
  if (c.place) return null;
  const alive = c.rounds[currentRound(c)];
  const i = alive.indexOf(YOU);
  return i < 0 ? null : alive[i % 2 === 0 ? i + 1 : i - 1];
};
/** White in the quarter-final, Black in the semi-final, and the seed decides the final. */
export const yourColor = (c: CupState): 'w' | 'b' => (currentRound(c) === 0 ? 'w' : currentRound(c) === 1 ? 'b' : c.seed % 2 ? 'w' : 'b');

/** You go through with a win — or with a draw when you had Black (draw odds). */
export const advances = (result: 'win' | 'loss' | 'draw', color: 'w' | 'b') => result === 'win' || (result === 'draw' && color === 'b');

/** Plays the round: your result plus the simulated other matches. Returns the next state. */
export function playRound(c: CupState, result: 'win' | 'loss' | 'draw'): CupState {
  const round = currentRound(c);
  const alive = c.rounds[round];
  const color = yourColor(c);
  const opp = yourOpponent(c)!;
  const through = advances(result, color);
  const r = rng(c.seed * 31 + round);
  const next: string[] = [];
  for (let i = 0; i < alive.length; i += 2) {
    const [a, b] = [alive[i], alive[i + 1]];
    if (a === YOU || b === YOU) next.push(through ? YOU : opp);
    else next.push(r() < winChance(a, b) ? a : b);
  }
  const yours = [...c.yours, { opponentId: opp, result, color, advanced: through }];
  const out: CupState = { ...c, rounds: [...c.rounds, next], yours, awaiting: undefined };
  if (!through) return finishOff({ ...out, place: round === 0 ? 'quarter' : round === 1 ? 'semi' : 'final' });
  return next.length === 1 ? { ...out, place: 'winner' } : out;
}

/** After you are out, the bots play it to the end so the bracket shows a champion. */
function finishOff(c: CupState): CupState {
  let cur = c;
  while (cur.rounds[cur.rounds.length - 1].length > 1) {
    const round = cur.rounds.length - 1;
    const alive = cur.rounds[round];
    const r = rng(c.seed * 31 + round + 100);
    const next: string[] = [];
    for (let i = 0; i < alive.length; i += 2) next.push(r() < winChance(alive[i], alive[i + 1]) ? alive[i] : alive[i + 1]);
    cur = { ...cur, rounds: [...cur.rounds, next] };
  }
  return cur;
}

export const champion = (c: CupState): string | null => (c.rounds[c.rounds.length - 1].length === 1 ? c.rounds[c.rounds.length - 1][0] : null);

/** XP for where you finished. */
export function cupXp(tier: CupTier, place: Place): number {
  const x = CUPS[tier].xp;
  return place === 'winner' ? x.winner : place === 'final' ? x.final : place === 'semi' ? x.semi : 0;
}

export type Trophies = Partial<Record<CupTier, number>>;
export const tierOpen = (tier: CupTier, t: Trophies) => !CUPS[tier].needs || (t[CUPS[tier].needs!] ?? 0) > 0;

const STATE_KEY = 'cupState';
export const TROPHY_KEY = 'cupTrophies';
export const getCup = () => kvGet<CupState | null>(STATE_KEY, null);
export const saveCup = (c: CupState | null) => kvSet(STATE_KEY, c);
export const getTrophies = () => kvGet<Trophies>(TROPHY_KEY, {});
export async function addTrophy(tier: CupTier): Promise<Trophies> {
  const t = await getTrophies();
  const next = { ...t, [tier]: (t[tier] ?? 0) + 1 };
  await kvSet(TROPHY_KEY, next);
  return next;
}
