// Think time and clock use per game, collected the same way for people and bots (pure, round 7):
// seconds per move by phase, the share of quick moves (≤ 2 s), the clock left at the end as a
// share of the starting time (both players), and the share of games lost on time.
import type { Phase } from './profile';

export interface TimeAcc {
  games: number;
  timeouts: number;
  think: Record<Phase, number[]>;
  quick: number;
  moves: number;
  left: number[];
}

export interface TimeSummary {
  games: number;
  moves: number;
  /** Seconds per move by phase. */
  opening: number;
  middlegame: number;
  endgame: number;
  /** Share of moves played in 2 s or less, %. */
  quick: number;
  /** Clock left at the end, % of the starting time (average over both players). */
  left: number;
  /** Games lost on time, %. */
  timeouts: number;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
const pct = (x: number, of: number) => Math.round((x / Math.max(1, of)) * 1000) / 10;

export const timeStats = {
  empty: (): TimeAcc => ({ games: 0, timeouts: 0, think: { opening: [], middlegame: [], endgame: [] }, quick: 0, moves: 0, left: [] }),
  /**
   * One game: the phase of each ply, the seconds spent on each ply (may be empty when the clocks
   * are missing), the clock after each ply (seconds), and whether someone lost on time.
   */
  addGame(a: TimeAcc, g: { tc: string; phases: Phase[]; spent: number[]; clocks: number[]; lostOnTime: boolean }): void {
    a.games++;
    if (g.lostOnTime) a.timeouts++;
    g.spent.forEach((s, i) => {
      if (!(s >= 0) || !Number.isFinite(s)) return;
      a.think[g.phases[i] ?? 'middlegame'].push(s);
      a.moves++;
      if (s <= 2) a.quick++;
    });
    const base = Number(g.tc.split('+')[0]);
    if (!(base > 0)) return;
    // White's and Black's last clocks; whoever was to move after the last ply flagged (if anyone did).
    const last = [g.clocks.filter((_, i) => i % 2 === 0).pop(), g.clocks.filter((_, i) => i % 2 === 1).pop()];
    const flagged = g.lostOnTime ? g.clocks.length % 2 : -1;
    last.forEach((c, side) => {
      if (side === flagged) a.left.push(0);
      else if (c !== undefined) a.left.push(Math.max(0, Math.min(1, c / base)));
    });
  },
  summary(a: TimeAcc): TimeSummary {
    return { games: a.games, moves: a.moves, opening: avg(a.think.opening), middlegame: avg(a.think.middlegame), endgame: avg(a.think.endgame), quick: pct(a.quick, a.moves), left: Math.round(avg(a.left.map((x) => x * 100))), timeouts: pct(a.timeouts, a.games) };
  },
};
