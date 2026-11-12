// The one place Cups writes into the main app: the biggest mistake of a cup game becomes a review
// card ("From a cup"), in the same format as mistakes from normal games.
import { db } from '../lib/db';
import { newCardDue, type Card } from '../lib/srs';

/** A move worth reviewing: the position, what you played, and the better move. */
export interface ReviewMoment {
  fenBefore: string;
  playedUci: string;
  playedSan: string;
  bestUci?: string;
  themes?: string[];
  explanation?: string[];
}

/** A review card for one moment (null when there is no better move to learn). */
export function momentCard(source: string, i: number, m: ReviewMoment, now = Date.now()): Card | null {
  if (!m.bestUci || m.bestUci === m.playedUci) return null;
  return {
    id: `m:cup-${source}:${i}`,
    kind: 'mistake',
    fen: m.fenBefore,
    solution: [m.bestUci],
    playedUci: m.playedUci,
    playedSan: m.playedSan,
    themes: m.themes ?? [],
    label: 'From a cup',
    explanation: m.explanation,
    createdAt: now,
    due: newCardDue(now),
    step: 0,
    reps: 0,
    lapses: 0,
  };
}

/** Write moments into the app's reviews (skipping positions already there); returns how many were added. */
export async function addCupReviews(source: string, moments: ReviewMoment[]): Promise<number> {
  const seen = new Set<string>();
  const cards = moments
    .map((m, i) => momentCard(source, i, m))
    .filter((c): c is Card => {
      if (!c || seen.has(c.fen)) return false;
      seen.add(c.fen);
      return true;
    });
  if (!cards.length) return 0;
  try {
    const existing = new Set((await db.cards.where('kind').equals('mistake').toArray()).map((c) => `${c.fen}|${c.playedUci}`));
    const fresh = cards.filter((c) => !existing.has(`${c.fen}|${c.playedUci}`));
    await db.cards.bulkPut(fresh);
    return fresh.length;
  } catch {
    return 0;
  }
}
