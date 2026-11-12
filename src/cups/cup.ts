// One cup from start to finish (pure state transitions; the store saves them).
import { ROUND_NAMES, YOU, advances, defaultColor, pickField, roundRating, seedBracket, simulateRound, type CupTier, type Place, type SimMatch } from './ladder';

/** How one of your games went. */
export interface RoundRecord {
  round: number;
  opponentId: string;
  elo: number;
  color: 'w' | 'b';
  result: 'win' | 'loss' | 'draw';
  reason: string;
  advanced: boolean;
  /** Your moves in the game. */
  moves: number;
  opening?: string;
  accuracy?: number;
  /** Seconds left on your clock at the end. */
  clockLeft?: number;
  /** The game in the app's history (Past games, rivalry). */
  gameId?: number;
}

export interface CupState {
  v: 2;
  id: string;
  tier: CupTier;
  seed: number;
  startedAt: number;
  /** The seven characters, weakest seed first. */
  field: string[];
  /** Seed ratings inside the band (simulated matches). */
  ratings: Record<string, number>;
  /** Players still in, per round: 8, then 4, 2, 1. */
  rounds: string[][];
  /** The bots' matches of each round played so far. */
  sims: SimMatch[][];
  yours: RoundRecord[];
  /** Set when you are out or have won. */
  place?: Place;
  endedAt?: number;
}

export function newCup(tier: CupTier, seed: number, now = Date.now()): CupState {
  const { field, ratings } = pickField(tier, seed);
  return { v: 2, id: `${tier}-${now}`, tier, seed, startedAt: now, field, ratings, rounds: [seedBracket(field)], sims: [], yours: [] };
}

export const currentRound = (c: CupState) => c.rounds.length - 1;
export const roundName = (c: CupState) => ROUND_NAMES[Math.min(2, currentRound(c))];

/** Who you play next (null once the cup is over). */
export function yourOpponent(c: CupState): string | null {
  if (c.place) return null;
  const alive = c.rounds[currentRound(c)];
  const i = alive.indexOf(YOU);
  return i < 0 ? null : alive[i % 2 === 0 ? i + 1 : i - 1];
}

export const yourColor = (c: CupState): 'w' | 'b' => defaultColor(currentRound(c), c.seed);
export const opponentRating = (c: CupState) => roundRating(c.tier, currentRound(c));

/** Your result is in: play the round (your match plus the simulated ones) and move the bracket on. */
export function applyResult(c: CupState, rec: Omit<RoundRecord, 'round' | 'advanced'>, opts: { drawOdds?: boolean; now?: number } = {}): CupState {
  const round = currentRound(c);
  const alive = c.rounds[round];
  const through = advances(rec.result, rec.color, opts.drawOdds);
  const sims = simulateRound(alive, c.ratings, c.seed, round);
  const next: string[] = [];
  for (let i = 0; i < alive.length; i += 2) {
    const [a, b] = [alive[i], alive[i + 1]];
    if (a === YOU || b === YOU) next.push(through ? YOU : rec.opponentId);
    else next.push(sims.find((m) => m.a === a && m.b === b)!.winner);
  }
  const out: CupState = { ...c, rounds: [...c.rounds, next], sims: [...c.sims, sims], yours: [...c.yours, { ...rec, round, advanced: through }] };
  if (!through) return finishOff({ ...out, place: round === 0 ? 'quarter' : round === 1 ? 'semi' : 'final', endedAt: opts.now ?? Date.now() });
  return next.length === 1 ? { ...out, place: 'winner', endedAt: opts.now ?? Date.now() } : out;
}

/** After you are out, the bots play the bracket to the end, so it shows a champion. */
function finishOff(c: CupState): CupState {
  let cur = c;
  while (cur.rounds[cur.rounds.length - 1].length > 1) {
    const round = cur.rounds.length - 1;
    const alive = cur.rounds[round];
    const sims = simulateRound(alive, c.ratings, c.seed + 100, round);
    cur = { ...cur, rounds: [...cur.rounds, sims.map((m) => m.winner)], sims: [...cur.sims, sims] };
  }
  return cur;
}

export const champion = (c: CupState): string | null => {
  const last = c.rounds[c.rounds.length - 1];
  return last.length === 1 ? last[0] : null;
};

/** Total moves you played in a cup (fastest-win record). */
export const cupMoves = (c: CupState) => c.yours.reduce((n, r) => n + r.moves, 0);
