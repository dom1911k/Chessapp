// Crunch: the scoring chain as a list of beats (pure, no DOM). Every trigger of a move or a room
// end becomes one beat: chips first, then +mult, then ×mult (then gold), each carrying the
// counter values after it lands. The UI plays them one by one; the numbers are exactly the score's.
import { TUNING as T } from './tuning';
import { addMult, fmtBig, roomScore } from './rules';
import type { Fire, RelicId, RoomResult, RoomState } from './types';
import type { TechId } from './codex';

export type BeatKind = 'chips' | 'mult' | 'xmult' | 'gold';
export interface BeatSource {
  /** 'piece' = the moved piece itself. */
  relic: RelicId | 'rival' | 'tech' | 'fervor' | 'piece';
  tech?: TechId;
}
export interface Beat {
  kind: BeatKind;
  /** What the trigger adds (chips, +mult, gold) or multiplies by (×mult). */
  amount: number;
  label: string;
  src: BeatSource;
  /** Counter values once this beat has landed. */
  chips: number;
  mult: number;
}
export interface Chain {
  beats: Beat[];
  from: { chips: number; mult: number };
  to: { chips: number; mult: number; score: number };
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const xOf = (fires: Fire[]) => fires.reduce((s, f) => s * (f.xmult ?? 1), 1);
const srcOf = (f: Fire): BeatSource => ({ relic: f.relic, tech: f.tech });

export function beatLabel(kind: BeatKind, amount: number): string {
  if (kind === 'chips') return `+${fmtBig(amount)}`;
  if (kind === 'mult') return `+${amount} Mult`;
  if (kind === 'xmult') return `×${amount} Mult`;
  return `+${amount}g`;
}

/**
 * Beats for a set of new fires (and optionally the moved piece's own chips), starting from
 * counters (chips, add, x) at the given Fervor. Order: piece chips, chip fires, +mult, ×mult, gold.
 */
function chainFrom(start: { chips: number; add: number; x: number }, fervor: number, fires: Fire[], pieceChips = 0): Beat[] {
  let { chips, add, x } = start;
  const mult = () => r2(add * x * fervor);
  const beats: Beat[] = [];
  const push = (kind: BeatKind, amount: number, src: BeatSource) => beats.push({ kind, amount, label: beatLabel(kind, amount), src, chips: Math.round(chips), mult: mult() });
  if (pieceChips > 0) {
    chips += pieceChips;
    push('chips', Math.round(pieceChips), { relic: 'piece' });
  }
  for (const f of fires.filter((f) => f.chips)) {
    chips += f.chips!;
    push('chips', f.chips!, srcOf(f));
  }
  for (const f of fires.filter((f) => f.mult)) {
    add = r2(add + f.mult!);
    push('mult', f.mult!, srcOf(f));
  }
  for (const f of fires.filter((f) => f.xmult)) {
    x *= f.xmult!;
    push('xmult', f.xmult!, srcOf(f));
  }
  for (const f of fires.filter((f) => f.gold)) push('gold', f.gold!, srcOf(f));
  return beats;
}

/** The chain for one move: the room before it and after it (the store's two snapshots). */
export function moveChain(before: RoomState, after: RoomState): Chain {
  const a = roomScore(before);
  const b = roomScore(after);
  const m = after.moves[after.moves.length - 1];
  const fresh = after.fires.slice(before.fires.length);
  const beats = m ? chainFrom({ chips: a.chips, add: addMult(before), x: xOf(before.fires) }, before.fervor ?? 1, fresh, m.accuracy) : [];
  // The last beat lands on the score's own numbers (Fervor can break on a blunder).
  if (beats.length) Object.assign(beats[beats.length - 1], { chips: b.chips, mult: b.mult });
  return { beats, from: { chips: a.chips, mult: a.mult }, to: { chips: b.chips, mult: b.mult, score: b.score } };
}

/** The tally's chain: the room-end fires (and Fervor, already in the live mult), from the live counters. */
export function endChain(res: Pick<RoomResult, 'chips' | 'mult' | 'score' | 'fires' | 'modifier' | 'fervorIn'>): Chain {
  const live = res.fires.filter((f) => f.at >= 0);
  const end = res.fires.filter((f) => f.at < 0);
  const base = T.score.baseMult + (res.modifier === 'focused' ? T.modifiers.focused.mult : 0);
  const add = r2(base + live.reduce((s, f) => s + (f.mult ?? 0), 0));
  const x = xOf(live);
  const liveChips = res.chips - end.reduce((s, f) => s + (f.chips ?? 0), 0);
  // Fervor in force (old saves: the result's mult divided by everything else).
  const allAdd = r2(add + end.reduce((s, f) => s + (f.mult ?? 0), 0));
  const allX = x * xOf(end);
  const fervor = res.fervorIn ?? (allAdd * allX > 0 ? res.mult / (allAdd * allX) : 1);
  const beats = chainFrom({ chips: liveChips, add, x }, fervor, end);
  if (beats.length) Object.assign(beats[beats.length - 1], { chips: res.chips, mult: res.mult });
  return { beats, from: { chips: liveChips, mult: r2(add * x * fervor) }, to: { chips: res.chips, mult: res.mult, score: res.score } };
}

/** How long beat i lasts (ms) at a game speed. */
export function beatMs(i: number, speed = 1): number {
  const C = T.crunch;
  return Math.max(C.beatMin, C.beatFirst * C.beatDecay ** i) / speed;
}
/** Semitones for the i-th consecutive trigger of a move. */
export const beatPitch = (i: number) => Math.min(T.crunch.semitoneMax, i * T.crunch.semitoneStep);
/** Total chain length (ms) at a speed, hit-stops included. */
export function chainMs(beats: Beat[], speed = 1): number {
  return beats.reduce((s, b, i) => s + beatMs(i, speed) + (b.kind === 'xmult' ? T.crunch.hitStopMs / speed : 0), 0);
}

/** Room-end shake in px: clamp(log10(score) − offset, min, max). */
export function slamShake(score: number): number {
  const R = T.crunch.roomEnd;
  return Math.max(R.shakeMin, Math.min(R.shakeMax, Math.log10(Math.max(1, score)) - R.shakeOffset));
}
/** Score fire: 0 below fireAt× the blind, else log2(score / blind), capped. */
export function fireIntensity(score: number, blind: number): number {
  const R = T.crunch.roomEnd;
  if (blind <= 0 || score < R.fireAt * blind) return 0;
  return Math.min(R.fireMax, Math.log2(score / blind));
}
/** Slabs in a room's finale column (log scale; at least 1 for any score). */
export function slabsFor(score: number): number {
  const F = T.crunch.finale;
  if (score <= 0) return 0;
  return Math.max(1, Math.min(F.slabMax, Math.round(Math.log10(1 + score) * F.slabsPerDecade)));
}
/** Finale count-up tick gaps (ms), accelerating, that fill the count time. */
export function finaleTicks(speed = 1): number[] {
  const F = T.crunch.finale;
  const out: number[] = [];
  let gap: number = F.tickFirst;
  let t = 0;
  while (t < F.countMs) {
    out.push(gap / speed);
    t += gap;
    gap = Math.max(F.tickMin, gap * F.tickDecay);
  }
  return out;
}

/** Score milestone ids for a room score ('room-10k' …). */
export const scoreMilestoneId = (score: number) => `room-${score}`;
export function scoreMilestones(score: number): string[] {
  return T.crunch.milestones.filter((x) => score > x.score).map((x) => scoreMilestoneId(x.score));
}

/** A fake chain for the dev panel: 12 triggers with a ×mult in the middle. */
export function fakeChain(chips = 120, mult = 2): Chain {
  const fires: Fire[] = [
    { relic: 'siege', chips: 15, at: 0 },
    { relic: 'siege', chips: 20, at: 0 },
    { relic: 'siege', chips: 25, at: 0 },
    { relic: 'hunter', mult: 0.5, at: 0 },
    { relic: 'patience', mult: 0.5, at: 0 },
    { relic: 'tempo', xmult: 2, at: 0 },
    { relic: 'clean', mult: 1, at: 0 },
    { relic: 'forkmaster', mult: 0.5, at: 0 },
    { relic: 'pins', mult: 0.5, at: 0 },
    { relic: 'rite', mult: 1, at: 0 },
    { relic: 'bloodhound', gold: 1, at: 0 },
  ];
  // Beat 7 of 12 is the ×mult (chainFrom would sort by kind, so the order is built here).
  let c = chips;
  let add = mult;
  let x = 1;
  const beats: Beat[] = [];
  const push = (kind: BeatKind, amount: number, src: BeatSource) => beats.push({ kind, amount, label: beatLabel(kind, amount), src, chips: c, mult: r2(add * x) });
  c += 64;
  push('chips', 64, { relic: 'piece' });
  for (const f of fires) {
    if (f.chips) (c += f.chips), push('chips', f.chips, srcOf(f));
    else if (f.mult) (add = r2(add + f.mult)), push('mult', f.mult, srcOf(f));
    else if (f.xmult) (x *= f.xmult), push('xmult', f.xmult, srcOf(f));
    else if (f.gold) push('gold', f.gold, srcOf(f));
  }
  const last = beats[beats.length - 1];
  return { beats, from: { chips, mult }, to: { chips: last.chips, mult: last.mult, score: Math.round(last.chips * last.mult) } };
}
