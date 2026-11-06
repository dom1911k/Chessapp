// Profile & Insights (pure): your record, accuracy over time and best wins, then where your
// games are won and lost — by phase, opening, colour, time of day and playing speed.
import { phaseOf, PHASES, type Phase } from './mistakes';
import type { AnyGame, ImportedGame } from '../store/types';

export interface Score {
  w: number;
  d: number;
  l: number;
}
export const games = (s: Score) => s.w + s.d + s.l;
/** Points per game, 0..100 (a draw is half a point). */
export const scorePct = (s: Score) => (games(s) ? Math.round(((s.w + s.d / 2) / games(s)) * 100) : 0);

const tally = (list: AnyGame[]): Score => ({
  w: list.filter((g) => g.userResult === 'win').length,
  d: list.filter((g) => g.userResult === 'draw').length,
  l: list.filter((g) => g.userResult === 'loss').length,
});

const analysed = (g: AnyGame) => g.source !== 'chess.com' || (g as ImportedGame).analyzed;
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export interface BestWin {
  gameId: number | string;
  opponent: string;
  rating: number;
  endedAt: number;
  source: 'app' | 'chess.com';
  accuracy: number | null;
}

export interface Profile {
  score: Score;
  /** Average accuracy per week (oldest first), analysed games only. */
  accuracyByWeek: { week: number; accuracy: number; games: number }[];
  /** Average accuracy over all analysed games. */
  accuracy: number | null;
  bestWins: BestWin[];
}

const WEEK = 7 * 864e5;

/** `name` resolves an app opponent id to a display name. */
export function profileStats(all: AnyGame[], name: (g: AnyGame) => string, weeks = 12, now = Date.now()): Profile {
  const done = all.filter(analysed);
  const byWeek = new Map<number, number[]>();
  for (const g of done) {
    if (!g.summary.accuracy) continue;
    const w = Math.floor((now - g.endedAt) / WEEK);
    if (w < 0 || w >= weeks) continue;
    byWeek.set(w, [...(byWeek.get(w) ?? []), g.summary.accuracy]);
  }
  const accuracyByWeek = [...byWeek.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([w, xs]) => ({ week: w, accuracy: mean(xs)!, games: xs.length }));
  const bestWins = all
    .filter((g) => g.userResult === 'win' && g.elo > 0)
    .sort((a, b) => b.elo - a.elo || b.endedAt - a.endedAt)
    .slice(0, 5)
    .map((g) => ({
      gameId: g.id!,
      opponent: name(g),
      rating: g.elo,
      endedAt: g.endedAt,
      source: g.source === 'chess.com' ? ('chess.com' as const) : ('app' as const),
      accuracy: analysed(g) && g.summary.accuracy ? g.summary.accuracy : null,
    }));
  return { score: tally(all), accuracyByWeek, accuracy: mean(done.map((g) => g.summary.accuracy).filter((a) => a > 0)), bestWins };
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
export const DAY_PARTS: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];
export const dayPartOf = (t: number): DayPart => {
  const h = new Date(t).getHours();
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night';
};

export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily' | 'untimed';
export const SPEEDS: Speed[] = ['bullet', 'blitz', 'rapid', 'classical', 'daily', 'untimed'];
/** chess.com's buckets: estimated minutes = base + 40 × increment. */
export function speedOf(g: AnyGame): Speed {
  const tc = (g as ImportedGame).timeClass;
  if (tc === 'daily') return 'daily';
  if (!g.timeControl) return tc === 'bullet' || tc === 'blitz' || tc === 'rapid' ? tc : 'untimed';
  if (g.timeControl.includes('/')) return 'daily';
  const [base, inc] = g.timeControl.split('+').map(Number);
  if (!Number.isFinite(base)) return 'untimed';
  const total = base + 40 * (inc || 0);
  return total < 180 ? 'bullet' : total < 600 ? 'blitz' : total < 3600 ? 'rapid' : 'classical';
}

export interface Row<K extends string = string> {
  key: K;
  score: Score;
  pct: number;
}
const rows = <K extends string>(groups: Map<K, AnyGame[]>, order?: K[]): Row<K>[] => {
  const out = [...groups.entries()].map(([key, list]) => {
    const score = tally(list);
    return { key, score, pct: scorePct(score) };
  });
  return order ? out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : out.sort((a, b) => games(b.score) - games(a.score) || b.pct - a.pct);
};
function group<K extends string>(list: AnyGame[], key: (g: AnyGame) => K | null): Map<K, AnyGame[]> {
  const m = new Map<K, AnyGame[]>();
  for (const g of list) {
    const k = key(g);
    if (k !== null) m.set(k, [...(m.get(k) ?? []), g]);
  }
  return m;
}

/** The opening's family: "Sicilian Defense: Najdorf Variation" → "Sicilian Defense". */
export const openingFamily = (name: string | undefined) => (name ? name.split(/[:,]/)[0].trim() || null : null);

export interface Insights {
  games: number;
  /** Your average move accuracy in each phase, and the moves it's based on. */
  phases: { phase: Phase; accuracy: number | null; moves: number }[];
  /** The phase you play worst, when the gap is clear. */
  weakestPhase: Phase | null;
  colors: Row<'w' | 'b'>[];
  openings: { white: Row[]; black: Row[] };
  dayParts: Row<DayPart>[];
  speeds: Row<Speed>[];
}

export function insights(all: AnyGame[], minOpening = 2): Insights {
  const acc: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };
  for (const g of all.filter(analysed))
    g.plies.forEach((p, i) => {
      if (p.isUser && typeof p.accuracy === 'number') acc[phaseOf(p.fenBefore, i)].push(p.accuracy);
    });
  const phases = PHASES.map((phase) => ({ phase, accuracy: acc[phase].length >= 5 ? mean(acc[phase]) : null, moves: acc[phase].length }));
  const rated = phases.filter((p) => p.accuracy !== null);
  const worst = [...rated].sort((a, b) => a.accuracy! - b.accuracy!)[0];
  const best = [...rated].sort((a, b) => b.accuracy! - a.accuracy!)[0];
  const weakestPhase = rated.length >= 2 && best.accuracy! - worst.accuracy! >= 4 ? worst.phase : null;
  const opening = (c: 'w' | 'b') => rows(group(all.filter((g) => g.userColor === c), (g) => openingFamily(g.opening))).filter((r) => games(r.score) >= minOpening).slice(0, 6);
  return {
    games: all.length,
    phases,
    weakestPhase,
    colors: rows(group(all, (g) => g.userColor), ['w', 'b']),
    openings: { white: opening('w'), black: opening('b') },
    dayParts: rows(group(all, (g) => dayPartOf(g.endedAt)), DAY_PARTS),
    speeds: rows(group(all, speedOf), SPEEDS),
  };
}
