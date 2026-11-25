// Game history: the filter chips (a result and a source, both optional) and the section headers
// (This week, Last week, then months).
import { MONTH_NAMES, nextWeek, weekStart } from '../dates';
import type { AnyGame } from '../store/types';

export interface HistoryFilter {
  result: 'win' | 'loss' | null;
  source: 'app' | 'chess.com' | null;
}
export const NO_FILTER: HistoryFilter = { result: null, source: null };

export function filterGames<T extends Pick<AnyGame, 'userResult' | 'source'>>(games: T[], f: HistoryFilter): T[] {
  return games.filter((g) => (!f.result || g.userResult === f.result) && (!f.source || (f.source === 'chess.com') === (g.source === 'chess.com')));
}

/** Newest first: "This week", "Last week", then "October" (with the year when it isn't this one). */
export function groupGames<T extends Pick<AnyGame, 'endedAt'>>(games: T[], now = Date.now()): { label: string; games: T[] }[] {
  const thisW = weekStart(now);
  const lastW = nextWeek(thisW, -1);
  const year = new Date(now).getFullYear();
  const out: { label: string; games: T[] }[] = [];
  for (const g of [...games].sort((a, b) => b.endedAt - a.endedAt)) {
    const d = new Date(g.endedAt);
    const label = g.endedAt >= thisW ? 'This week' : g.endedAt >= lastW ? 'Last week' : `${MONTH_NAMES[d.getMonth()]}${d.getFullYear() === year ? '' : ` ${d.getFullYear()}`}`;
    const last = out[out.length - 1];
    if (last?.label === label) last.games.push(g);
    else out.push({ label, games: [g] });
  }
  return out;
}

/** What an empty filter says. */
export function emptyText(f: HistoryFilter, hasImports: boolean): string {
  if (f.source === 'chess.com' && !hasImports) return 'No chess.com games yet. Import them in More → chess.com import.';
  const where = f.source === 'chess.com' ? ' on chess.com' : f.source === 'app' ? ' in the app' : '';
  if (f.result) return `No ${f.result === 'win' ? 'wins' : 'losses'}${where} yet.`;
  return f.source === 'app' ? 'No games in the app yet.' : 'No chess.com games yet.';
}
