import { START_FEN, type GameResult } from '../chess/game';
import { bumpActivity, db, kvSet } from '../db';
import { detectOpening } from '../openings';
import { recurringPattern, summarize } from '../report';
import { recordOpponentGame } from '../people/record';
import { progress } from '../progress';
import { newCardDue, type Card } from '../srs';
import type { GameRecord, SavedGame } from './types';

export const FOCUS_KEY = 'focusTheme';

export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Store the finished game, turn its mistakes into review cards, and set the lesson focus. */
export interface FinishInfo {
  gameId: number;
  stars: number;
  firstWin: boolean;
  starsImproved: boolean;
}

export async function finishGame(g: SavedGame, result: GameResult, reason: string): Promise<FinishInfo> {
  const userResult =
    result === '1/2-1/2' ? 'draw' : (result === '1-0') === (g.userColor === 'w') ? 'win' : 'loss';
  const summary = summarize(g.plies);
  const recent = await db.games.orderBy('endedAt').reverse().limit(4).toArray();
  summary.pattern = recurringPattern([g.plies, ...recent.map((r) => r.plies)]);
  const { id: _id, ...rest } = g;
  void _id;
  const record: GameRecord = {
    ...rest,
    endedAt: Date.now(),
    result,
    reason,
    userResult,
    summary,
    opening: g.startFen === START_FEN ? detectOpening(g.plies.map((p) => p.san))?.name : undefined,
  };
  const gameId = await db.transaction('rw', [db.games, db.current, db.cards], async () => {
    const id = await db.games.add(record);
    await db.current.delete('play');
    const cards: Card[] = [];
    g.plies.forEach((p, i) => {
      if (!p.isUser || (p.classification !== 'mistake' && p.classification !== 'blunder')) return;
      const best = p.comment?.bestUci;
      if (!best || best === p.uci) return;
      cards.push({
        id: `m:${id}:${i}`,
        kind: 'mistake',
        fen: p.fenBefore,
        solution: [best],
        playedUci: p.uci,
        playedSan: p.san,
        themes: p.comment?.themes ?? [],
        label: `From your game on ${formatDate(g.startedAt)}`,
        explanation: p.comment?.text,
        gameId: id,
        createdAt: Date.now(),
        due: newCardDue(),
        step: 0,
        reps: 0,
        lapses: 0,
      });
    });
    await db.cards.bulkPut(cards);
    return id;
  });
  await bumpActivity('games');
  const rec = await recordOpponentGame({ ...record, id: gameId });
  await progress({ kind: 'game', result: userResult, accuracy: summary.accuracy });
  // A recurring pattern beats a one-game lesson for steering puzzle practice.
  const focus = summary.pattern?.theme ?? summary.lessonTheme;
  if (focus) await kvSet(FOCUS_KEY, { theme: focus, until: Date.now() + 7 * 864e5 });
  return { gameId, stars: rec?.stars ?? 0, firstWin: rec?.firstWin ?? false, starsImproved: rec?.improved ?? false };
}
