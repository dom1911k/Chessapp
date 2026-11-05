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
