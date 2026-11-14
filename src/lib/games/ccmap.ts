// App rating → chess.com rating (pure). The bots' ratings are on Maia's (Lichess-like) scale;
// chess.com ratings for the same play are usually lower. With imported chess.com games we measure
// your own gap: your chess.com rating against how you perform against the bots without help
// (Match conditions), over the same period. Until there are enough games, a typical gap is used,
// and the measured one takes over as games come in.
import type { AnyGame } from '../store/types';

export const CCMAP = {
  /** Typical chess.com minus app rating, used until your own games say otherwise. */
  priorOffset: -300,
  /** The typical gap counts like this many games. */
  priorWeight: 10,
  /** Fewest games on each side before your own gap counts at all. */
  minGames: 5,
  /** Only games from this many days back. */
  days: 120,
  /** Labels are rounded to this. */
  round: 50,
};

export interface CcMap {
  /** Add to an app rating to get the chess.com estimate. */
  offset: number;
  /** Your measured gap, when there are enough games. */
  measured?: number;
  ccRating?: number;
  appPerformance?: number;
  appGames: number;
  ccGames: number;
}

const score = (g: Pick<AnyGame, 'userResult'>) => (g.userResult === 'win' ? 1 : g.userResult === 'draw' ? 0.5 : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Performance rating: average opponent plus what the score says (capped at ±400). */
export function performance(games: Pick<AnyGame, 'userResult' | 'elo'>[]): number {
  const avgOpp = games.reduce((a, g) => a + g.elo, 0) / games.length;
  const s = Math.min(0.91, Math.max(0.09, games.reduce((a, g) => a + score(g), 0) / games.length));
  return avgOpp + 400 * Math.log10(s / (1 - s));
}

export function ccMap(games: (AnyGame & { myRating?: number })[], now = Date.now()): CcMap {
  const since = now - CCMAP.days * 864e5;
  const recent = games.filter((g) => g.endedAt >= since);
  const cc = recent.filter((g) => g.source === 'chess.com' && typeof g.myRating === 'number' && g.timeControl !== 'daily');
  // Unaided play is the fair comparison; coached games only if there are no match games yet.
  const appAll = recent.filter((g) => g.source !== 'chess.com' && !g.cup);
  const match = appAll.filter((g) => g.match);
  const app = match.length >= CCMAP.minGames ? match : appAll;
  const base: CcMap = { offset: CCMAP.priorOffset, appGames: app.length, ccGames: cc.length };
  if (cc.length < CCMAP.minGames || app.length < CCMAP.minGames) return base;
  // chess.com: your rating over the recent games (median, so one odd day doesn't swing it).
  const ccRating = median(cc.slice(-30).map((g) => g.myRating!));
  const appPerformance = performance(app.slice(-40));
  const measured = ccRating - appPerformance;
  const n = Math.min(cc.length, app.length);
  const offset = (n * measured + CCMAP.priorWeight * CCMAP.priorOffset) / (n + CCMAP.priorWeight);
  return { ...base, offset, measured, ccRating: Math.round(ccRating), appPerformance: Math.round(appPerformance) };
}

/** "≈ 600 chess.com" estimate for an app rating. */
export const toChessCom = (elo: number, m: Pick<CcMap, 'offset'>) => Math.max(100, Math.round((elo + m.offset) / CCMAP.round) * CCMAP.round);

/** One line on where the estimate comes from. */
export function ccMapLine(m: CcMap): string {
  if (m.measured === undefined)
    return `chess.com ratings usually run about ${Math.abs(CCMAP.priorOffset)} lower for the same play. Import your chess.com games and play a few Match-conditions games to measure your own gap.`;
  const gap = Math.round(-m.offset / 10) * 10;
  return `From your games: you're ${m.ccRating} on chess.com and perform like ${m.appPerformance} here, so chess.com runs about ${Math.abs(gap)} ${gap >= 0 ? 'lower' : 'higher'} for you.`;
}
