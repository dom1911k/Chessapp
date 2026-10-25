// Simple adaptive Elo for puzzles: large steps while the rating is new, smaller later.
import { db, kvGet, kvSet } from '../db';

export const START_RATING = 800;
const KEY = 'puzzleRating';

export interface RatingState {
  rating: number;
  games: number;
}

export async function getRating(): Promise<RatingState> {
  return kvGet<RatingState>(KEY, { rating: START_RATING, games: 0 });
}

export function expected(rating: number, puzzleRating: number): number {
  return 1 / (1 + Math.pow(10, (puzzleRating - rating) / 400));
}

export function kFactor(games: number): number {
  return games < 10 ? 60 : games < 30 ? 40 : 24;
}

export function newRating(state: RatingState, puzzleRating: number, success: boolean): number {
  const delta = kFactor(state.games) * ((success ? 1 : 0) - expected(state.rating, puzzleRating));
  return Math.round(Math.max(400, Math.min(2800, state.rating + delta)));
}

export async function applyResult(puzzleRating: number, success: boolean): Promise<{ before: number; after: number }> {
  const s = await getRating();
  const after = newRating(s, puzzleRating, success);
  await kvSet(KEY, { rating: after, games: s.games + 1 });
  await db.ratings.add({ at: Date.now(), rating: after });
  return { before: s.rating, after };
}
