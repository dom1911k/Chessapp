import { bumpActivity, db } from '../db';
import { newCardDue, reviewCard, type Card } from '../srs';
import { applyResult } from './rating';
import type { PuzzleSource } from './types';
import type { PuzzleSpec } from './spec';

export interface AttemptOutcome {
  ratingBefore?: number;
  ratingAfter?: number;
}

/**
 * Records a finished puzzle: rating (first attempt only), attempt history,
 * activity, and spaced repetition (failed puzzles become cards; reviews advance).
 */
export async function recordAttempt(spec: PuzzleSpec, success: boolean, hintsUsed: number, source: PuzzleSource): Promise<AttemptOutcome> {
  const clean = success && hintsUsed === 0;
  let out: AttemptOutcome = {};
  const isNew = spec.kind === 'lichess' && !(await db.attempts.where('puzzleId').equals(spec.id).count());
  if (isNew && spec.rating && source !== 'review') {
    const r = await applyResult(spec.rating, clean);
    out = { ratingBefore: r.before, ratingAfter: r.after };
  }
  await db.attempts.add({
    puzzleId: spec.id,
    at: Date.now(),
    success: clean,
    puzzleRating: spec.rating ?? 0,
    ratingBefore: out.ratingBefore ?? 0,
    ratingAfter: out.ratingAfter ?? 0,
    themes: spec.themes,
    source,
    hintsUsed,
  });
  await bumpActivity(source === 'review' ? 'reviews' : 'puzzles');

  const cardId = spec.cardId ?? `p:${spec.id}`;
  const existing = await db.cards.get(cardId);
  if (existing) {
    await db.cards.put(reviewCard(existing, clean));
  } else if (!clean && spec.kind === 'lichess') {
    const card: Card = {
      id: cardId,
      kind: 'puzzle',
      puzzleId: spec.id,
      fen: spec.fen,
      setup: spec.setup,
      solution: spec.solution,
      themes: spec.themes,
      label: 'A puzzle you missed',
      createdAt: Date.now(),
      due: newCardDue(),
      step: 0,
      reps: 0,
      lapses: 0,
      rating: spec.rating,
    };
    await db.cards.put(card);
  }
  return out;
}
