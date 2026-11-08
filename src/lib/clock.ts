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

/** A standard normal sample (Box–Muller) from a 0..1 source. */
function normal(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Below this much time left, a person starts to speed up (and keeps speeding up). */
export const PRESSURE_MS = 180_000;

/**
 * How long a human-like opponent thinks (ms). People don't think for a steady share of their time:
 * - some moves are instinctive and come at once (forced moves, book moves, obvious replies);
 * - the rest spread out the way human think times do — mostly short, now and then much longer;
 * - occasionally they sink into a real think at a critical moment;
 * - with less than about three minutes left they get faster and faster, still with the odd
 *   longer think in between; in the last seconds they bang out moves.
 * `sensible` = moves a human would seriously consider (Maia's likely moves or near-equal engine
 * lines). `rng` gives 0..1 samples.
 */
export function humanThinkMs(
  o: { moveNo: number; sensible: number; leftMs: number; tc: string; book?: boolean; forced?: boolean },
  rng: () => number = Math.random,
): number {
  const { base, inc } = parseTc(o.tc);
  const left = Math.max(0, o.leftMs);
  // Faster games are played faster across the board (a 3-minute player rarely pauses 2 s on a recapture).
  const pace = Math.min(1, Math.max(0.45, base / 600_000) ** 0.35);
  // Time pressure: 1 = relaxed, falling smoothly towards ~0.2 as the clock runs down from 3 minutes.
  const pressure = left >= PRESSURE_MS ? 1 : 0.25 + 0.75 * (left / PRESSURE_MS) ** 1.25;
  const cap = Math.min(60_000, left * (pressure < 1 ? 0.1 : 0.2));
  const floor = left < 15_000 ? 250 : 300;
  // The floor itself wobbles a little: even the fastest moves aren't metronomic.
  const clamp = (ms: number) => Math.round(Math.max(floor + 150 * rng(), Math.min(ms, cap)));

  // 1. Instinctive moves: no real thought, just the time to see it and move the piece.
  const instinct = o.forced ? 0.85 : o.book ? 0.65 : o.sensible <= 1 ? 0.5 : o.sensible === 2 ? 0.25 : 0.12;
  if (rng() < instinct + (1 - pressure) * 0.25) {
    const quick = (400 + 900 * rng() ** 1.6) * pace * (0.6 + 0.4 * pressure);
    return clamp(quick);
  }

  // 2. A normal think: a share of the time left (expecting ~40 moves, at least 10 more), shaped by
  //    the stage of the game and how many moves are worth considering, with a human-like spread.
  const budget = left / Math.max(14, 50 - o.moveNo) + inc * 0.8;
  const phase = o.moveNo <= 6 ? 0.25 : o.moveNo <= 12 ? 0.7 : 1;
  const complexity = 0.6 + 0.15 * Math.min(6, Math.max(1, o.sensible));
  let ms = 0.75 * budget * phase * complexity * pressure * Math.exp(0.55 * normal(rng) - 0.15);

  // 3. Now and then a long think — less often, and shorter, when time is short.
  if (o.moveNo > 8 && rng() < 0.09 * (0.4 + 0.6 * pressure)) ms *= 2.2 + 1.8 * rng();
  return clamp(ms);
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
