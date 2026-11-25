// Your week: calendar weeks (Monday 00:00 local to the next Monday), the same weeks as the ring on
// Home. Games (app and chess.com), accuracy, blunders, the game rating and the chess.com rating,
// fixed moments, puzzles, training days, and one thing to work on.
import type { Theme } from './coach/types';
import { db, kvGet, kvSet, today } from './db';
import { nextWeek, weekStart } from './dates';
import { mistakeReport } from './games/mistakes';
import { GOAL_KEY } from './progress/weekly';
import { hasAccuracy } from './report';
import { getGameRating, lastRestart, START_RATING, type GameRating } from './rewards/rating';
import type { AnyGame, ImportedGame } from './store/types';

export interface WeekStats {
  start: number;
  /** The next Monday 00:00 (exclusive). */
  end: number;
  /** App and chess.com games together; `cc` of them on chess.com. */
  games: number;
  w: number;
  d: number;
  l: number;
  cc: number;
  /** Average over the analysed games (null without any). */
  accuracy: number | null;
  blundersPerGame: number | null;
  /** The game rating at the start and end of the week; `rated`: games that moved it. */
  rating: { start: number; end: number; rated: number };
  /** Your chess.com rapid rating (else blitz) over the week, when you played there. */
  ccRating: { cls: 'rapid' | 'blitz'; start: number; end: number } | null;
  /** Moments fixed (attempts from the fix flow and reviews): found of tried. */
  fixes: { found: number; tried: number };
  puzzles: number;
  activeDays: number;
  goal: number;
  /** The top mistake theme of the week's analysed games, when it came up in 2 or more. */
  focus: { theme: Theme; games: number; of: number } | null;
}

/** The rating before and after the week, from the history (a restart within the week starts it). */
export function ratingSpan(r: GameRating, start: number, end: number): WeekStats['rating'] {
  const rs = lastRestart(r);
  const inWeek = r.history.filter((h) => h.at >= start && h.at < end);
  const before = r.history.filter((h) => h.at < start);
  if (rs && rs.at >= start && rs.at < end) {
    const after = inWeek.filter((h) => h.at > rs.at);
    return { start: rs.rating, end: after.length ? after[after.length - 1].rating : rs.rating, rated: after.length };
  }
  // Nothing before the week: you started from the starting rating (or there's no history at all).
  const from = before.length ? before[before.length - 1].rating : r.history.length ? START_RATING : r.rating;
  if (!inWeek.length) return { start: from, end: from, rated: 0 };
  return { start: from, end: inWeek[inWeek.length - 1].rating, rated: inWeek.length };
}

/** chess.com rapid (else blitz) over the week: from your last game of that kind before it (or its first) to its last. */
export function ccSpan(imported: Pick<ImportedGame, 'timeClass' | 'myRating' | 'endedAt'>[], start: number, end: number): WeekStats['ccRating'] {
  for (const cls of ['rapid', 'blitz'] as const) {
    const all = imported.filter((g) => g.timeClass === cls && g.myRating > 0).sort((a, b) => a.endedAt - b.endedAt);
    const week = all.filter((g) => g.endedAt >= start && g.endedAt < end);
    if (!week.length) continue;
    const prev = all.filter((g) => g.endedAt < start).pop();
    return { cls, start: (prev ?? week[0]).myRating, end: week[week.length - 1].myRating };
  }
  return null;
}

/** ccSpan over the week's chess.com games plus, for the start, your last game of that kind before it. */
async function ccRatingOf(week: ImportedGame[], start: number, end: number): Promise<WeekStats['ccRating']> {
  const cls = (['rapid', 'blitz'] as const).find((c) => week.some((g) => g.timeClass === c && g.myRating > 0));
  if (!cls) return null;
  const prev = await db.imported.where('endedAt').below(start).reverse().filter((g) => g.timeClass === cls && g.myRating > 0).first();
  return ccSpan(prev ? [prev, ...week] : week, start, end);
}

const analysed = (g: AnyGame) => g.source !== 'chess.com' || (g as ImportedGame).analyzed;

/** Everything for the calendar week starting at `start` (a Monday 00:00 from weekStart()). */
export async function weekStats(start: number): Promise<WeekStats> {
  const end = nextWeek(start);
  // Only the week's games (by the endedAt index), not every import with all its moves.
  const [app, ccWeek, attempts, rating, goal] = await Promise.all([
    db.games.where('endedAt').between(start, end, true, false).toArray(),
    db.imported.where('endedAt').between(start, end, true, false).toArray(),
    db.attempts.where('at').between(start, end, true, false).toArray(),
    getGameRating(),
    kvGet<number>(GOAL_KEY, 4),
  ]);
  // Play Coach games are practice: out of the games, results, accuracy and blunders (still a training day).
  const games: AnyGame[] = [...app.filter((g) => !g.coach), ...ccWeek];
  const done = games.filter(analysed);
  const withAcc = done.filter((g) => hasAccuracy(g.summary));
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    keys.push(today(d));
  }
  const rows = await db.activity.bulkGet(keys);
  const activeDays = rows.filter((r) => r && r.puzzles + r.games + r.reviews + (r.other ?? 0) + (r.xp ?? 0) > 0).length;
  const report = mistakeReport(done);
  const top = report.themes[0];
  const fixes = attempts.filter((a) => a.source === 'review');
  return {
    start,
    end,
    games: games.length,
    w: games.filter((g) => g.userResult === 'win').length,
    d: games.filter((g) => g.userResult === 'draw').length,
    l: games.filter((g) => g.userResult === 'loss').length,
    cc: ccWeek.length,
    accuracy: withAcc.length ? Math.round(withAcc.reduce((a, g) => a + g.summary.accuracy, 0) / withAcc.length) : null,
    blundersPerGame: done.length ? Math.round((done.reduce((a, g) => a + g.summary.counts.blunder, 0) / done.length) * 10) / 10 : null,
    rating: ratingSpan(rating, start, end),
    ccRating: await ccRatingOf(ccWeek, start, end),
    fixes: { found: fixes.filter((a) => a.success).length, tried: fixes.length },
    puzzles: attempts.filter((a) => a.success && a.source !== 'review').length,
    activeDays,
    goal,
    focus: top && top.games >= 2 ? { theme: top.theme, games: top.games, of: report.games } : null,
  };
}

/** Anything played: a game or a puzzle. */
export const weekHasActivity = (w: Pick<WeekStats, 'games' | 'puzzles' | 'fixes'>) => w.games > 0 || w.puzzles > 0 || w.fixes.tried > 0;

/** "+42", "−8", "±0". */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

// ---- Home's "last week" state ----

const RECAP_KEY = 'weekRecap';
interface Recap {
  /** This week's Monday. */
  week: number;
  /** The day of the first Home visit this week. */
  day: string;
  seen: boolean;
}

/**
 * On the first Home visit of a new week, and for the rest of that day, the card shows last week
 * (when it had a game or a puzzle) until it's opened. Records the first visit.
 */
export async function showLastWeek(now = Date.now()): Promise<boolean> {
  const week = weekStart(now);
  const day = today(new Date(now));
  let r = await kvGet<Recap | null>(RECAP_KEY, null);
  if (!r || r.week !== week) {
    r = { week, day, seen: false };
    await kvSet(RECAP_KEY, r);
  }
  if (r.seen || r.day !== day) return false;
  return weekHasActivity(await weekStats(nextWeek(week, -1)));
}

/** Opening the sheet from the card: last week has been seen. */
export async function markLastWeekSeen(now = Date.now()): Promise<void> {
  const week = weekStart(now);
  const r = await kvGet<Recap | null>(RECAP_KEY, null);
  await kvSet(RECAP_KEY, { week, day: r && r.week === week ? r.day : today(new Date(now)), seen: true });
}
