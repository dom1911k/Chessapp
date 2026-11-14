// The sparring partner: one opponent whose rating follows you, so your games against it stay
// close to 50%. It gains points when you win and loses them when you lose; the steps shrink once
// it has your measure.
import { MAX_ELO, MIN_ELO } from './bot';
import { kvGet, kvSet } from './db';

export const SPARRING = {
  /** Rating step per game at first, and the smallest step later. */
  step: 25,
  minStep: 10,
  /** Full steps for this many games, then they shrink as 1/sqrt(games). */
  fullStepGames: 10,
  /** Ratings snap to this. */
  round: 5,
};

export interface SparringState {
  rating: number;
  games: number;
  w: number;
  d: number;
  l: number;
}

const KEY = 'sparring';
const clamp = (r: number) => Math.max(MIN_ELO, Math.min(MAX_ELO, r));
const snap = (r: number) => Math.round(r / SPARRING.round) * SPARRING.round;

/** The step after `games` games: 25 for the first ten, then smaller (never below 10). */
export const sparringStep = (games: number) =>
  Math.max(SPARRING.minStep, Math.round(SPARRING.step * Math.sqrt(SPARRING.fullStepGames / Math.max(SPARRING.fullStepGames, games))));

/** A new partner starts at your current rating. */
export const newSparring = (playerRating: number): SparringState => ({ rating: clamp(snap(playerRating)), games: 0, w: 0, d: 0, l: 0 });

/** After a game: you won → it gets stronger; you lost → weaker; a draw leaves it. */
export function afterSparring(s: SparringState, userResult: 'win' | 'loss' | 'draw'): SparringState {
  const step = sparringStep(s.games);
  const delta = userResult === 'win' ? step : userResult === 'loss' ? -step : 0;
  return {
    rating: clamp(s.rating + delta),
    games: s.games + 1,
    w: s.w + (userResult === 'win' ? 1 : 0),
    d: s.d + (userResult === 'draw' ? 1 : 0),
    l: s.l + (userResult === 'loss' ? 1 : 0),
  };
}

export const getSparring = async (playerRating: number): Promise<SparringState> => (await kvGet<SparringState | null>(KEY, null)) ?? newSparring(playerRating);
export const saveSparring = (s: SparringState) => kvSet(KEY, s);
