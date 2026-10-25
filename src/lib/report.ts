import type { Classification } from './chess/evaluation';
import type { Theme } from './coach/types';
import { THEMES } from './lessons';
import type { GameSummary, PlyRecord } from './store/types';

export function emptyCounts(): Record<Classification, number> {
  return { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
}

export function summarize(plies: PlyRecord[]): GameSummary {
  const mine = plies.map((p, i) => ({ p, i })).filter(({ p }) => p.isUser && p.classification);
  const counts = emptyCounts();
  for (const { p } of mine) counts[p.classification!]++;
  // Like Lichess, blend the plain mean with the harmonic mean so one big blunder isn't hidden
  // by many easy moves played in an already decided position.
  const accs = mine.map(({ p }) => Math.max(1, p.accuracy ?? 100));
  const mean = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;
  const harmonic = accs.length ? accs.length / accs.reduce((a, b) => a + 1 / b, 0) : 0;
  const accuracy = (mean + harmonic) / 2;

  let biggest: number | null = null;
  let worst = 0;
  for (const { p, i } of mine) {
    if ((p.classification === 'mistake' || p.classification === 'blunder') && (p.wpLoss ?? 0) > worst) {
      worst = p.wpLoss ?? 0;
      biggest = i;
    }
  }

  // The lesson comes from the most frequent theme among mistakes (blunders count double).
  const tally = new Map<Theme, number>();
  for (const { p } of mine) {
    const w = p.classification === 'blunder' ? 2 : p.classification === 'mistake' ? 1.5 : p.classification === 'inaccuracy' ? 0.5 : 0;
    if (!w) continue;
    const themes = p.comment?.themes ?? [];
    // The first theme is the main problem.
    const main = themes.find((t) => t !== 'material') ?? themes[0];
    if (main) tally.set(main, (tally.get(main) ?? 0) + w);
  }
  const lessonTheme = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    accuracy: Math.round(accuracy),
    counts,
    biggestMistakePly: biggest,
    lessonTheme,
    lessonText: lessonTheme ? THEMES[lessonTheme].lesson : undefined,
  };
}
