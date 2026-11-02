// The only places Run mode touches the main app's data:
// - read-only: recent games (for the nemesis rule);
// - the one allowed write: the run's top debrief moments become review cards ("From a run"),
//   in the same format as mistakes from normal games.
import { db } from '../lib/db';
import { newCardDue, type Card } from '../lib/srs';
import { gameMistakeThemes } from '../lib/report';
import { explainMove } from '../lib/coach';
import { TUNING as T } from './tuning';
import { nemesisFor, topMoments } from './rules';
import type { EchoPos, Moment, Run } from './types';

/** Main mistake theme(s) of your most recent games, newest first. */
export async function recentMistakeThemes(n: number = T.nemesis.games): Promise<string[][]> {
  try {
    const games = await db.games.orderBy('endedAt').reverse().limit(n).toArray();
    return games.map((g) => [...gameMistakeThemes(g.plies)]);
  } catch {
    return [];
  }
}

/** The Echo: positions from your own recent games where you played a mistake or blunder (you to move). */
export async function readEchoes(): Promise<EchoPos[]> {
  try {
    const games = await db.games.orderBy('endedAt').reverse().limit(T.rooms.echo.games).toArray();
    const out: EchoPos[] = [];
    for (const g of games)
      for (const p of g.plies)
        if (p.isUser && (p.classification === 'mistake' || p.classification === 'blunder') && p.fenBefore)
          out.push({ fen: p.fenBefore, elo: g.elo, played: p.san, best: p.comment?.bestUci, when: g.endedAt ?? g.startedAt });
    return out;
  } catch {
    return [];
  }
}

/** The nemesis theme for a new run, if your recent games share a dominant mistake. */
export async function readNemesis(): Promise<string | undefined> {
  return nemesisFor(await recentMistakeThemes());
}

/** A review card for one debrief moment (null when there's no better move to learn). */
export function momentCard(runId: string, i: number, m: Moment, now = Date.now()): Card | null {
  const best = m.best ?? m.move.before?.bestMove;
  if (!best || best === m.move.uci) return null;
  let comment: ReturnType<typeof explainMove> | null = null;
  try {
    comment = explainMove({ fenBefore: m.move.fenBefore, uci: m.move.uci, before: m.move.before ?? null, after: m.move.after ?? null, classification: m.move.cls });
  } catch {
    /* no explanation */
  }
  return {
    id: `m:run-${runId}:${i}`,
    kind: 'mistake',
    fen: m.move.fenBefore,
    solution: [best],
    playedUci: m.move.uci,
    playedSan: m.move.san,
    themes: comment?.themes ?? [],
    label: 'From a run',
    explanation: comment?.text,
    createdAt: now,
    due: newCardDue(now),
    step: 0,
    reps: 0,
    lapses: 0,
  };
}

/** Write the run's top moments into the app's reviews; returns how many were added. */
export async function addRunReviews(r: Pick<Run, 'id' | 'moments'>, extra: Moment[] = []): Promise<number> {
  const picked = [...topMoments(r.moments, T.debrief.reviews), ...extra];
  const seen = new Set<string>();
  const cards = picked
    .map((m, i) => momentCard(r.id, i, m))
    .filter((c): c is Card => {
      if (!c || seen.has(c.fen)) return false;
      seen.add(c.fen);
      return true;
    });
  if (!cards.length) return 0;
  try {
    // Don't stack a second card on a position already in your reviews.
    const existing = new Set((await db.cards.where('kind').equals('mistake').toArray()).map((c) => `${c.fen}|${c.playedUci}`));
    const fresh = cards.filter((c) => !existing.has(`${c.fen}|${c.playedUci}`));
    await db.cards.bulkPut(fresh);
    return fresh.length;
  } catch {
    return 0;
  }
}
