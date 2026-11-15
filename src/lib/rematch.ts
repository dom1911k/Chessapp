// Rematch a chess.com opponent: a bot at their rating, in Match conditions with the same time
// control, that opens the way they opened against you (from your imported games, sampled by how
// often they played each move) until their games usually leave opening theory.
import { Chess } from 'chess.js';
import type { Color } from './chess/pos';
import { isBook } from './review';
import { kvGet, kvSet } from './db';
import { announceChange } from './changes';
import type { AnyGame, ImportedGame } from './store/types';

export interface RematchInfo {
  /** Their chess.com username. */
  name: string;
  /** Their move lists (SAN, from the start) in your imported games where they had this colour. */
  lines: string[][];
  /** How many plies their games usually stay in theory (book). */
  bookPlies: number;
}

/** chess.com time control → the app's format ("600" → "600+0"); daily games have none. */
export const appTc = (tc: string | undefined) => (!tc || tc === 'daily' ? undefined : tc.includes('+') ? tc : `${tc}+0`);

/** First ply of a line that is no longer opening theory. */
export function leavesBook(line: string[]): number {
  let i = 0;
  while (i < line.length && isBook(line, i)) i++;
  return i;
}

/** What the stand-in needs: their lines with `color`, and where they usually leave theory (median). */
export function rematchInfo(imports: Pick<AnyGame, 'opponentName' | 'userColor' | 'plies' | 'startFen' | 'source'>[], name: string, color: Color): RematchInfo {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const lines = imports
    .filter((g) => g.source === 'chess.com' && g.opponentName === name && g.userColor !== color && g.startFen === start)
    .map((g) => g.plies.map((p) => p.san));
  const leave = lines.map(leavesBook).sort((a, b) => a - b);
  const bookPlies = leave.length ? leave[Math.floor((leave.length - 1) / 2)] : 0;
  return { name, lines, bookPlies };
}

/** Their next move (uci) while the game follows their games and is still within their theory. */
export function rematchMove(r: RematchInfo, sans: string[], fen: string, rand: () => number = Math.random): string | null {
  const n = sans.length;
  if (n >= Math.max(r.bookPlies, 2)) return null;
  const counts = new Map<string, number>();
  for (const l of r.lines) if (l.length > n && sans.every((m, i) => l[i] === m)) counts.set(l[n], (counts.get(l[n]) ?? 0) + 1);
  if (!counts.size) return null;
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (const [san, k] of counts) {
    x -= k;
    if (x <= 0) {
      try { return new Chess(fen).move(san).lan; } catch { return null; }
    }
  }
  return null;
}

/** "Rematch: <name> (stand-in)" */
export const rematchLabel = (name: string) => `Rematch: ${name} (stand-in)`;

// ---- Results per opponent (shown with the rivalries) -----------------------------------------
export interface RematchRecord { w: number; d: number; l: number; last?: 'win' | 'loss' | 'draw' }
const KEY = 'rematchRecords';
export const getRematchRecords = () => kvGet<Record<string, RematchRecord>>(KEY, {});
export async function recordRematch(name: string, result: 'win' | 'loss' | 'draw'): Promise<void> {
  const all = await getRematchRecords();
  const r = all[name] ?? { w: 0, d: 0, l: 0 };
  all[name] = { w: r.w + (result === 'win' ? 1 : 0), d: r.d + (result === 'draw' ? 1 : 0), l: r.l + (result === 'loss' ? 1 : 0), last: result };
  await kvSet(KEY, all);
  announceChange('records');
}

/** Can this game be rematched? (a lost chess.com game, not daily) */
export const canRematch = (g: AnyGame) => g.source === 'chess.com' && g.userResult === 'loss' && !!appTc(g.timeControl) && !!(g as ImportedGame).opponentName;
