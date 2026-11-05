// Finished games from both places: the app's own (numeric ids) and chess.com imports ('cc:…').
import { db } from '../db';
import type { AnyGame } from '../store/types';

export async function loadAnyGame(id: number | string): Promise<AnyGame | null> {
  if (typeof id === 'string') return (await db.imported.get(id)) ?? null;
  return (await db.games.get(id)) ?? null;
}

/** Every finished game, newest first (imports only once analysed, unless `all`). */
export async function allGames(opts: { includeUnanalyzed?: boolean } = {}): Promise<AnyGame[]> {
  const [app, imp] = await Promise.all([db.games.toArray(), db.imported.toArray()]);
  const imports = opts.includeUnanalyzed ? imp : imp.filter((g) => g.analyzed);
  return [...app, ...imports].sort((a, b) => b.endedAt - a.endedAt);
}

/** The opponent's name for display. */
export const opponentLabel = (g: AnyGame, characterName?: string) => g.opponentName ?? characterName ?? 'Bot';
