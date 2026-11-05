// What your real games say: recurring mistake themes and the tactics you actually play,
// over app games, chess.com games or both (pure).
import type { Theme } from '../coach/types';
import { gameMistakeThemes } from '../report';
import { TACTIC_KEYS, type TacticKey } from '../rewards/career';
import { bySource, type GameSource } from '../chesscom/analysis';
import type { AnyGame } from '../store/types';

export interface GameInsights {
  /** Games looked at (newest first, analysed only). */
  games: number;
  /** Mistake themes by the number of games they appeared in. */
  mistakes: { theme: Theme; games: number }[];
  /** Tactics you played, most first. */
  strengths: { key: TacticKey; count: number }[];
  /** Wins, draws, losses. */
  score: { w: number; d: number; l: number };
}

export function gameInsights(all: AnyGame[], src: GameSource, n = 20): GameInsights {
  const games = bySource(all, src)
    .filter((g) => g.source !== 'chess.com' || (g as { analyzed?: boolean }).analyzed)
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, n);
  const tally = new Map<Theme, number>();
  for (const g of games) for (const t of gameMistakeThemes(g.plies)) tally.set(t, (tally.get(t) ?? 0) + 1);
  const tactics = new Map<TacticKey, number>();
  for (const g of games) for (const k of TACTIC_KEYS) if (g.tactics?.[k]) tactics.set(k, (tactics.get(k) ?? 0) + g.tactics[k]!);
  return {
    games: games.length,
    mistakes: [...tally.entries()].map(([theme, c]) => ({ theme, games: c })).sort((a, b) => b.games - a.games),
    strengths: [...tactics.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    score: { w: games.filter((g) => g.userResult === 'win').length, d: games.filter((g) => g.userResult === 'draw').length, l: games.filter((g) => g.userResult === 'loss').length },
  };
}

/** The biggest mistake of a game (ply index), if any. */
export const biggestMistake = (g: AnyGame) => (g.summary.biggestMistakePly !== null ? { ply: g.summary.biggestMistakePly, move: g.plies[g.summary.biggestMistakePly] } : null);
