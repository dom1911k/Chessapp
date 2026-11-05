// chess.com public API data → imported games (pure: no network, no storage).
import { Chess } from 'chess.js';
import { START_FEN, type GameResult } from '../chess/game';
import type { Color } from '../chess/pos';
import { detectOpening } from '../openings';
import type { ImportedGame, PlyRecord } from '../store/types';

/** One player in a chess.com game object. */
export interface CcPlayer {
  username: string;
  rating: number;
  result: string;
}
/** A game as the monthly archive returns it (only the fields we use). */
export interface CcGame {
  url: string;
  pgn?: string;
  time_control: string;
  time_class?: string;
  end_time: number;
  rules?: string;
  uuid?: string;
  initial_setup?: string;
  white: CcPlayer;
  black: CcPlayer;
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);
const REASON: Record<string, string> = {
  checkmated: 'checkmate',
  resigned: 'resignation',
  timeout: 'time',
  abandoned: 'abandoned',
  agreed: 'agreement',
  repetition: 'repetition',
  stalemate: 'stalemate',
  insufficient: 'insufficient material',
  '50move': '50-move rule',
  timevsinsufficient: 'time vs insufficient material',
  lose: 'loss',
  kingofthehill: 'king of the hill',
  threecheck: 'three checks',
  bughousepartnerlose: 'partner lost',
};

/** chess.com's "600" / "180+2" / "1/86400" → "600+0" / "180+2" / "daily". */
export function normalizeTimeControl(tc: string): string {
  if (!tc || tc.includes('/')) return 'daily';
  const [base, inc] = tc.split('+');
  return `${Number(base) || 0}+${Number(inc) || 0}`;
}

/** "600+0" → "10+0" (minutes + increment seconds, as players say it). */
export function timeControlLabel(tc: string): string {
  if (tc === 'daily') return 'Daily';
  const [base, inc] = tc.split('+').map(Number);
  const min = base / 60;
  return `${Number.isInteger(min) ? min : min.toFixed(1)}+${inc || 0}`;
}

/** Seconds on the clock after each move, from the PGN's {[%clk h:mm:ss(.s)]} comments. */
export function parseClocks(pgn: string): number[] {
  const out: number[] = [];
  for (const m of pgn.matchAll(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g)) out.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  return out;
}

/** The game's moves as plies (fen before/after, SAN, UCI); null if the PGN doesn't parse. */
export function pliesFromPgn(pgn: string, me: Color): { plies: PlyRecord[]; startFen: string } | null {
  const c = new Chess();
  try {
    c.loadPgn(pgn);
  } catch {
    return null;
  }
  const moves = c.history({ verbose: true });
  const startFen = moves[0]?.before ?? c.fen();
  const plies: PlyRecord[] = moves.map((m) => ({ uci: m.lan, san: m.san, color: m.color as Color, fenBefore: m.before, fenAfter: m.after, isUser: m.color === me }));
  return { plies, startFen };
}

/** Converts a chess.com game into an imported game for `username`; null for variants or games without moves. */
export function parseCcGame(g: CcGame, username: string): ImportedGame | null {
  if (g.rules && g.rules !== 'chess') return null;
  if (!g.pgn) return null;
  const u = username.trim().toLowerCase();
  const me: Color | null = g.white.username.toLowerCase() === u ? 'w' : g.black.username.toLowerCase() === u ? 'b' : null;
  if (!me) return null;
  const mine = me === 'w' ? g.white : g.black;
  const theirs = me === 'w' ? g.black : g.white;
  const parsed = pliesFromPgn(g.pgn, me);
  if (!parsed || parsed.plies.length === 0) return null;
  const draw = DRAWS.has(mine.result) || DRAWS.has(theirs.result);
  const result: GameResult = draw ? '1/2-1/2' : g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '1/2-1/2';
  const userResult = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (me === 'w') ? 'win' : 'loss';
  const loser = result === '1-0' ? g.black : result === '0-1' ? g.white : mine;
  const reason = REASON[loser.result] ?? loser.result;
  const clocks = parseClocks(g.pgn);
  const id = `cc:${g.uuid ?? g.url.split('/').pop()}`;
  return {
    id,
    source: 'chess.com',
    url: g.url,
    pgn: g.pgn,
    timeControl: normalizeTimeControl(g.time_control),
    timeClass: g.time_class ?? '',
    myRating: mine.rating,
    opponentName: theirs.username,
    userColor: me,
    elo: theirs.rating,
    startFen: parsed.startFen,
    startedAt: g.end_time * 1000,
    endedAt: g.end_time * 1000,
    plies: parsed.plies,
    takebacks: 0,
    hintsUsed: 0,
    told: [],
    result,
    reason,
    userResult,
    summary: { accuracy: 0, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null },
    opening: parsed.startFen === START_FEN ? detectOpening(parsed.plies.map((p) => p.san))?.name : undefined,
    clocks: clocks.length === parsed.plies.length ? clocks : undefined,
    analyzed: false,
  };
}

/** Archive month key from its URL: ".../games/2026/09" → "2026/09". */
export const monthOf = (archiveUrl: string) => archiveUrl.split('/').slice(-2).join('/');

/**
 * The archive months still to fetch, newest first: every month not yet fully synced. A month
 * counts as full once it was fetched after it ended; the current month is always fetched again.
 */
export function monthsToFetch(archives: string[], full: string[], now = new Date()): string[] {
  const current = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return [...archives].sort((a, b) => monthOf(b).localeCompare(monthOf(a))).filter((u) => monthOf(u) >= current || !full.includes(monthOf(u)));
}

/** A month is complete once fetched after it ended (UTC). */
export function monthComplete(month: string, fetchedAt = new Date()): boolean {
  const current = `${fetchedAt.getUTCFullYear()}/${String(fetchedAt.getUTCMonth() + 1).padStart(2, '0')}`;
  return month < current;
}

/** chess.com usernames: 3–25 letters, digits, "_" or "-". */
export const validUsername = (u: string) => /^[A-Za-z0-9_-]{3,25}$/.test(u.trim());
