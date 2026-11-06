// More puzzle sources: positions from your own games (blunders you could have punished) and
// the Daily Puzzle (one per day, the same all day), plus its streak.
import { kvGet, kvSet, today } from '../db';
import { reviewGame, isBad } from '../review';
import type { AnyGame } from '../store/types';
import type { PuzzleSpec } from './spec';
import type { Puzzle } from './types';

/**
 * "Punish the blunder": every analysed game where the opponent made a mistake or blunder and
 * you didn't find the best reply. The puzzle starts after their slip; any move the engine rates
 * as good counts.
 */
export function gamePuzzles(games: AnyGame[]): PuzzleSpec[] {
  const out: PuzzleSpec[] = [];
  for (const g of games) {
    if (g.source === 'chess.com' && !(g as { analyzed?: boolean }).analyzed) continue;
    const r = reviewGame(g);
    g.plies.forEach((p, i) => {
      const mine = g.plies[i + 1];
      if (p.isUser || !mine?.isUser) return;
      const theirs = r.plies[i].cls;
      if (theirs !== 'mistake' && theirs !== 'blunder') return;
      const best = mine.comment?.bestUci;
      if (!best || best === mine.uci || !isBad(r.plies[i + 1].cls)) return;
      out.push({
        id: `g:${String(g.id)}:${i + 1}`,
        kind: 'mistake',
        fen: p.fenBefore,
        setup: p.uci,
        solution: [best],
        themes: mine.comment?.themes ?? [],
        label: `Punish it · ${g.source === 'chess.com' ? 'chess.com ' : ''}vs ${g.opponentName ?? 'the bot'}`,
        acceptGoodAlternatives: true,
        playedSan: mine.san,
        explanation: mine.comment?.text,
      });
    });
  }
  return out;
}

/** Day number since 1970 (local), for picking the daily puzzle. */
export const dayNumber = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);

/** The daily puzzle: a stable pick from a pool for a given day. */
export function dailyPick(pool: Puzzle[], day = dayNumber()): Puzzle | null {
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1));
  // A simple integer hash so neighbouring days land far apart.
  const h = Math.imul(day ^ 0x9e3779b9, 2654435761) >>> 0;
  return sorted[h % sorted.length];
}

const DAILY_KEY = 'dailyPuzzle';
export interface DailyState {
  /** Days (YYYY-MM-DD) the daily puzzle was solved. */
  solved: string[];
}
export async function dailyState(): Promise<DailyState> {
  return kvGet<DailyState>(DAILY_KEY, { solved: [] });
}
export async function markDailySolved(day = today()): Promise<DailyState> {
  const s = await dailyState();
  if (!s.solved.includes(day)) s.solved = [...s.solved, day].slice(-400);
  await kvSet(DAILY_KEY, s);
  return s;
}

/** Days in a row the daily puzzle was solved, ending today (or yesterday if today isn't done yet). */
export function dailyStreak(solved: string[], now = new Date()): number {
  const set = new Set(solved);
  const d = new Date(now);
  if (!set.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
