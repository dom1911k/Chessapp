// Time controls and the chess clock (pure).
import type { Color } from './chess/pos';

/** The app's time controls ("seconds+increment"). */
export const TIME_CONTROLS = ['180+2', '300+0', '600+0', '600+5', '900+10', '1800+0'];
export const DEFAULT_MATCH_TC = '600+0';

/** My most common chess.com time control (ignoring daily games), if any. */
export function mostCommonTimeControl(games: { timeControl?: string; source?: string }[]): string | null {
  const tally = new Map<string, number>();
  for (const g of games) if (g.source === 'chess.com' && g.timeControl && g.timeControl !== 'daily') tally.set(g.timeControl, (tally.get(g.timeControl) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Time controls to offer: the app's, plus the one I mostly play on chess.com if it's missing. */
export function offeredTimeControls(mostCommon: string | null): string[] {
  if (!mostCommon || TIME_CONTROLS.includes(mostCommon)) return TIME_CONTROLS;
  const secs = (tc: string) => Number(tc.split('+')[0]) + 40 * Number(tc.split('+')[1] ?? 0);
  return [...TIME_CONTROLS, mostCommon].sort((a, b) => secs(a) - secs(b));
}

/** The Match conditions default: a saved choice, else my most common chess.com one, else 10+0. */
export const defaultMatchTc = (saved: string, mostCommon: string | null) => saved || mostCommon || DEFAULT_MATCH_TC;

export function parseTc(tc: string): { base: number; inc: number } {
  const [b, i] = tc.split('+').map(Number);
  return { base: (b || 0) * 1000, inc: (i || 0) * 1000 };
}

export type Clock = { w: number; b: number; turnStart: number };
export const newClock = (tc: string, now: number): Clock => ({ w: parseTc(tc).base, b: parseTc(tc).base, turnStart: now });

/** Time left for `side` right now (the side to move is running). */
export function timeLeft(c: Clock, side: Color, toMove: Color, now: number): number {
  return Math.max(0, c[side] - (side === toMove ? now - c.turnStart : 0));
}

/** After `mover` completes a move at `now`: their time is charged and the increment added. */
export function pressClock(c: Clock, mover: Color, tc: string, now: number): Clock {
  const left = Math.max(0, c[mover] - (now - c.turnStart));
  return { ...c, [mover]: left + parseTc(tc).inc, turnStart: now };
}

/** Low on time: under 10% of the starting time. */
export const lowTime = (ms: number, tc: string) => ms > 0 && ms < parseTc(tc).base * 0.1;

/** "4:59", "0:09.4" under 10 s. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `0:0${s.toFixed(1)}`;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/**
 * How long a human-like opponent thinks (ms): quick in the opening, longer when there are many
 * sensible moves, faster when its own clock runs low. `sensible` = moves a human would seriously
 * consider (Maia's likely moves); `rand` in 0..1 adds a natural spread.
 */
export function humanThinkMs(o: { moveNo: number; sensible: number; leftMs: number; tc: string; book?: boolean; forced?: boolean }, rand = Math.random()): number {
  const { base, inc } = parseTc(o.tc);
  const left = Math.max(0, o.leftMs);
  // A share of the remaining time, expecting the game to last about 40 moves (at least 10 more).
  const budget = left / Math.max(10, 40 - o.moveNo) + inc * 0.8;
  const phase = o.book ? 0.15 : o.moveNo <= 6 ? 0.3 : o.moveNo <= 12 ? 0.7 : 1;
  const complexity = o.forced ? 0.25 : 0.55 + 0.15 * Math.min(6, Math.max(1, o.sensible));
  const hurry = left < base * 0.1 ? 0.3 : left < base * 0.25 ? 0.6 : 1;
  const spread = 0.6 + 0.8 * rand;
  const ms = budget * phase * complexity * hurry * spread;
  return Math.round(Math.max(350, Math.min(ms, left * 0.2, 60000)));
}

/** Moves a human would consider: Maia's moves with at least `min` probability. */
export function sensibleMoves(logits: Map<string, number>, min = 0.05): number {
  const vals = [...logits.values()];
  if (!vals.length) return 1;
  const max = Math.max(...vals);
  const exps = vals.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return Math.max(1, exps.filter((e) => e / sum >= min).length);
}

/** Who wins on time: the flagged side loses, unless the other side can't mate (then a draw). */
export function flagResult(fen: string, flagged: Color): { result: '1-0' | '0-1' | '1/2-1/2'; reason: string } {
  const board = fen.split(' ')[0];
  const winner = flagged === 'w' ? 'b' : 'w';
  const pieces = [...board].filter((ch) => /[a-z]/i.test(ch) && (winner === 'w' ? ch === ch.toUpperCase() : ch === ch.toLowerCase()) && ch.toLowerCase() !== 'k');
  const minorOnly = pieces.length === 0 || (pieces.length === 1 && /[nb]/i.test(pieces[0]));
  if (minorOnly) return { result: '1/2-1/2', reason: 'time vs insufficient material' };
  return { result: winner === 'w' ? '1-0' : '0-1', reason: 'time' };
}
