// "My mistakes": every analysed game (app and chess.com) → the mistake types that come up most,
// when they happen (phase, colour), whether they're getting rarer, and example positions (pure).
import type { Color } from '../chess/pos';
import type { Theme } from '../coach/types';
import { bySource, type GameSource } from '../chesscom/analysis';
import type { AnyGame, ImportedGame } from '../store/types';

export type Phase = 'opening' | 'middlegame' | 'endgame';
export const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];
/** Moves 1–10 are the opening. */
export const OPENING_PLIES = 20;
/** Trend: the latest games against the ones before. */
export const TREND_WINDOW = 20;

export interface MistakeExample {
  gameId: number | string;
  ply: number;
  fenBefore: string;
  san: string;
  better?: string;
  cls: 'mistake' | 'blunder';
  phase: Phase;
  color: Color;
  source: 'app' | 'chess.com';
  endedAt: number;
  opponent?: string;
}
export interface MistakeTheme {
  theme: Theme;
  /** Games it showed up in, and how many times in all. */
  games: number;
  count: number;
  /** Share of analysed games it showed up in (0..1). */
  share: number;
  phases: Record<Phase, number>;
  colors: Record<Color, number>;
  /** Share of games with it: the latest TREND_WINDOW games vs the window before (null without enough games). */
  trend: { recent: number; before: number } | null;
  /** Newest first. */
  examples: MistakeExample[];
}
export interface MistakeReport {
  games: number;
  mistakes: number;
  themes: MistakeTheme[];
  phases: Record<Phase, number>;
}

/** Opening by move number; endgame once few pieces (besides kings and pawns) are left. */
export function phaseOf(fen: string, ply: number): Phase {
  const pieces = [...fen.split(' ')[0]].filter((c) => /[nbrqNBRQ]/.test(c)).length;
  if (pieces <= 6) return 'endgame';
  return ply < OPENING_PLIES ? 'opening' : 'middlegame';
}

const analysed = (g: AnyGame) => g.source !== 'chess.com' || (g as ImportedGame).analyzed;

/** The main mistake type of a move (its first theme that isn't plain "material"). */
const mainTheme = (themes: Theme[] | undefined) => themes?.find((t) => t !== 'material') ?? themes?.[0];

export function mistakeReport(all: AnyGame[], opts: { src?: GameSource; sinceDays?: number; now?: number } = {}): MistakeReport {
  const now = opts.now ?? Date.now();
  const since = opts.sinceDays ? now - opts.sinceDays * 864e5 : 0;
  const games = bySource(all, opts.src ?? 'all')
    .filter((g) => analysed(g) && g.endedAt >= since)
    .sort((a, b) => b.endedAt - a.endedAt);
  const map = new Map<Theme, MistakeTheme & { gameSet: Set<number> }>();
  const phases: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 };
  let mistakes = 0;
  games.forEach((g, gi) => {
    g.plies.forEach((p, i) => {
      if (!p.isUser || (p.classification !== 'mistake' && p.classification !== 'blunder')) return;
      const theme = mainTheme(p.comment?.themes);
      if (!theme) return;
      mistakes++;
      const phase = phaseOf(p.fenBefore, i);
      phases[phase]++;
      let t = map.get(theme);
      if (!t) {
        t = { theme, games: 0, count: 0, share: 0, phases: { opening: 0, middlegame: 0, endgame: 0 }, colors: { w: 0, b: 0 }, trend: null, examples: [], gameSet: new Set() };
        map.set(theme, t);
      }
      t.count++;
      t.phases[phase]++;
      t.colors[g.userColor]++;
      t.gameSet.add(gi);
      t.examples.push({
        gameId: g.id!,
        ply: i,
        fenBefore: p.fenBefore,
        san: p.san,
        better: p.comment?.bestSan,
        cls: p.classification,
        phase,
        color: g.userColor,
        source: g.source === 'chess.com' ? 'chess.com' : 'app',
        endedAt: g.endedAt,
        opponent: g.opponentName,
      });
    });
  });
  const W = TREND_WINDOW;
  const themes = [...map.values()].map(({ gameSet, ...t }) => {
    const inRange = (lo: number, hi: number) => [...gameSet].filter((i) => i >= lo && i < hi).length;
    return {
      ...t,
      games: gameSet.size,
      share: games.length ? gameSet.size / games.length : 0,
      trend: games.length >= W * 2 ? { recent: inRange(0, W) / W, before: inRange(W, 2 * W) / W } : null,
    };
  });
  themes.sort((a, b) => b.games - a.games || b.count - a.count);
  return { games: games.length, mistakes, themes, phases };
}

/** "getting rarer" / "more often" / "about the same" (a change of at least 10 points counts). */
export function trendWord(t: MistakeTheme['trend']): 'better' | 'worse' | 'same' | null {
  if (!t) return null;
  const d = t.recent - t.before;
  return d <= -0.1 ? 'better' : d >= 0.1 ? 'worse' : 'same';
}
