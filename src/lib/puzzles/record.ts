import { bumpActivity, db, today } from '../db';
import { newCardDue, reviewCard, type Card } from '../srs';
import { applyResult } from './rating';
import { progress } from '../progress';
import type { PuzzleSource } from './types';
import type { PuzzleSpec } from './spec';
import { awardPath, type PathAward, type PathSource } from './path';
import { useSettings } from '../settings';

export interface AttemptOutcome {
  ratingBefore?: number;
  ratingAfter?: number;
  xp?: number;
  /** A new highest puzzle rating (after the first 10 rated puzzles). */
  newPeak?: boolean;
  /** What the Puzzle Path awarded (saved before anything animates). */
  path?: PathAward;
}

export interface PathAttempt {
  seconds: number;
  correctMoves: number;
  path: PathSource;
}

/**
 * Records a finished puzzle: rating (first attempt only), attempt history,
 * activity, and spaced repetition (failed puzzles become cards; reviews advance).
 */
export async function recordAttempt(spec: PuzzleSpec, success: boolean, hintsUsed: number, source: PuzzleSource, extra?: PathAttempt): Promise<AttemptOutcome> {
  const clean = success && hintsUsed === 0;
  let out: AttemptOutcome = {};
  const isNew = spec.kind === 'lichess' && !(await db.attempts.where('puzzleId').equals(spec.id).count());
  if (isNew && spec.rating && source !== 'review' && source !== 'learn') {
    const r = await applyResult(spec.rating, clean);
    out = { ratingBefore: r.before, ratingAfter: r.after, newPeak: r.newPeak };
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
  // The only place puzzles award path points ('full' scores only when the rating moved).
  if (extra && extra.path !== 'none') {
    out.path = await awardPath({
      source: extra.path,
      success,
      hintsUsed,
      correctMoves: extra.correctMoves,
      seconds: extra.seconds,
      userMoves: Math.ceil(spec.solution.length / 2),
      puzzleRating: spec.rating,
      ratingBefore: out.ratingBefore,
      ratingAfter: out.ratingAfter,
      promptLevel: spec.promptLevel ?? 3,
      today: today(),
      setting: useSettings.getState().puzzleDifficulty ?? 'standard',
    });
  }
  await bumpActivity(source === 'review' ? 'reviews' : 'puzzles');
  out.xp = await progress({ kind: 'puzzle', success, clean, review: source === 'review' });

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
