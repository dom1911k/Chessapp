// Time stats for the post-game review: time per move, where the time went, obvious moves that
// took long, and one plain sentence of advice (pure).
import type { Color } from './chess/pos';
import { Chess } from 'chess.js';
import { parseTc } from './clock';
import type { PlyRecord } from './store/types';

export interface MoveTime {
  ply: number;
  /** Your move number (1, 2, …). */
  moveNo: number;
  san: string;
  secs: number;
}
export interface TimeStats {
  moves: MoveTime[];
  total: number;
  /** Your three longest thinks. */
  longest: MoveTime[];
  /** Easy moves (a recapture, the only legal move, escaping check with one or two moves) that took a long time. */
  slowObvious: (MoveTime & { why: string })[];
  advice: string;
  /** Did you run out of time? */
  flagged: boolean;
}

/** Seconds you spent on each of your moves, from the clock after each ply. */
export function moveTimes(plies: Pick<PlyRecord, 'isUser' | 'san' | 'color'>[], clocks: number[], tc: string, me: Color): MoveTime[] {
  const { base, inc } = parseTc(tc);
  const out: MoveTime[] = [];
  let prev = base / 1000;
  let n = 0;
  plies.forEach((p, i) => {
    if (p.color !== me) return;
    const after = clocks[i];
    if (after === undefined) return;
    n++;
    // Clock after the move includes the increment.
    const used = Math.max(0, prev - after + inc / 1000);
    prev = after;
    if (p.isUser) out.push({ ply: i, moveNo: n, san: p.san, secs: Math.round(used * 10) / 10 });
  });
  return out;
}

/** Why a move was easy, if it was. */
export function obviousReason(p: Pick<PlyRecord, 'fenBefore' | 'uci'>, prev?: Pick<PlyRecord, 'uci' | 'san'>): string | null {
  const c = new Chess(p.fenBefore);
  const legal = c.moves();
  if (legal.length === 1) return 'the only legal move';
  if (c.inCheck() && legal.length <= 2) return 'one of only two ways out of check';
  if (prev?.san.includes('x') && prev.uci.slice(2, 4) === p.uci.slice(2, 4)) return 'a recapture';
  return null;
}

/** `ranOut`: I lost on time. */
export function timeStats(plies: PlyRecord[], clocks: number[], tc: string, me: Color, ranOut = false): TimeStats | null {
  if (!tc || tc === 'daily' || clocks.length < plies.length * 0.8) return null;
  const moves = moveTimes(plies, clocks, tc, me);
  if (moves.length < 3) return null;
  const total = moves.reduce((a, m) => a + m.secs, 0);
  const longest = [...moves].sort((a, b) => b.secs - a.secs).slice(0, 3);
  const median = [...moves].sort((a, b) => a.secs - b.secs)[Math.floor(moves.length / 2)].secs;
  const slowObvious = moves
    .map((m) => ({ ...m, why: obviousReason(plies[m.ply], plies[m.ply - 1]) }))
    .filter((m): m is MoveTime & { why: string } => !!m.why && m.secs >= Math.max(8, median * 3));
  return { moves, total, longest, slowObvious, advice: timeAdvice(moves, total, parseTc(tc).base / 1000, slowObvious.length, ranOut), flagged: ranOut };
}

/** One plain sentence: where your time went. */
export function timeAdvice(moves: MoveTime[], total: number, baseSecs: number, slowObvious: number, ranOut: boolean): string {
  // The five-move stretch that took the biggest share of your time.
  let best = { from: 0, share: 0 };
  for (let i = 0; i + 5 <= moves.length; i++) {
    const s = moves.slice(i, i + 5).reduce((a, m) => a + m.secs, 0) / Math.max(1, total);
    if (s > best.share) best = { from: i, share: s };
  }
  const range = moves.length >= 5 ? `moves ${moves[best.from].moveNo}–${moves[best.from + 4].moveNo}` : '';
  if (ranOut) return range && best.share >= 0.3 ? `You ran out of time — ${Math.round(best.share * 100)}% of it went on ${range}. Decide faster in the middle of the game.` : 'You ran out of time. Play your easy moves quickly to save time for the hard ones.';
  if (range && best.share >= 0.35 && moves.length >= 10) return `You used ${Math.round(best.share * 100)}% of your time on ${range}.`;
  if (slowObvious > 0) return `You spent a long time on ${slowObvious === 1 ? 'an easy move' : `${slowObvious} easy moves`} — recaptures and forced moves can be played at once.`;
  if (total < baseSecs * 0.15 && moves.length >= 15) return `You used only ${Math.round((100 * total) / baseSecs)}% of your clock — take a few seconds more on the critical moves.`;
  return 'You spread your time well over the game.';
}
