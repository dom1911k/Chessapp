// Self-play benchmark with the app's real-game pipeline (round 7): player types, today's form, the
// opening book (book depth by rating, identity starts, the types' opening plans), Maia-3 with the
// type hooks, time pressure, think time (× the type's), resigning by temperament and the flag.
// Both sides are the same player; each side draws its own types and form per game.
// Usage: npx tsx scripts/maia3/charplay.mts '<spec json>' <games> [out.jsonl]
//   spec  { id?: character id, elo?: rating (default: the character's), types?: string[] (default:
//           the character's, drawn per game), form?: false, book?: false, tc?: '600+0',
//           score?: true (blunder/mistake/inaccuracy profile from ply 12, slow),
//           plies?: n (stop after n plies: openings), record?: path (per-ply think inputs, for
//           thinkfit.mts replay), label?: string }
// Prints one JSON line: the profile (if scored), the opening profile, think time / clock use and
// results.
import { appendFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { candidates, engine, maia3 } from './players.mts';
import { phaseOf, Profile, PROFILE } from '../../src/lib/benchmark/profile.ts';
import { OpeningProfile } from '../../src/lib/benchmark/openings.ts';
import { timeStats } from '../../src/lib/benchmark/timestats.ts';
import { chooseHumanMove, humanParams, maia3SelfElo, setBrain, shiftedTemperature } from '../../src/lib/maia/index.ts';
import { botParams } from '../../src/lib/bot.ts';
import { botThinkMs, drawPace, positionInfo, pressureParams, swingTracker, timePressure } from '../../src/lib/thinktime.ts';
import { flagResult, parseTc } from '../../src/lib/clock.ts';
import { shouldResign } from '../../src/lib/resign.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';
import { opponentById, typesFor } from '../../src/lib/people/index.ts';
import { bookDepth, bookMove, castleWeight, openingTemperature, OPENING_CASTLE, OPENING_TEMP } from '../../src/lib/people/openings.ts';
import { quirkById, quirkEffects, typeOpening, TYPE_TUNING, type QuirkCtx } from '../../src/lib/playerTypes.ts';
import { drawForm } from '../../src/lib/form.ts';
import { material } from '../../src/cups/material.ts';

interface Spec {
  id?: string;
  elo?: number;
  types?: string[];
  form?: boolean;
  book?: boolean;
  tc?: string;
  score?: boolean;
  plies?: number;
  record?: string;
  label?: string;
}
type Side = 'w' | 'b';

const S: Spec = JSON.parse(process.argv[2]);
// OPENING_TEMP='{"peak":[[200,1.6],…],"fullUntil":4,"endMove":6}' tries other opening temperatures.
if (process.env.OPENING_TEMP) Object.assign(OPENING_TEMP, JSON.parse(process.env.OPENING_TEMP));
if (process.env.OPENING_CASTLE) Object.assign(OPENING_CASTLE, JSON.parse(process.env.OPENING_CASTLE));
const games = Number(process.argv[3]);
const out = process.argv[4];
const who = opponentById(S.id);
const elo = S.elo ?? who?.elo ?? 1000;
const tc = S.tc ?? '600+0';
const { base, inc } = parseTc(tc);
setBrain('maia3');

const prof = new Profile();
const openings = new OpeningProfile();
const times = timeStats.empty();
const results = { w: 0, d: 0, b: 0, flags: 0, resigns: 0, plies: 0 };
const bal = (fen: string, me: Side) => (me === 'w' ? 1 : -1) * material(fen).diff;

for (let g = 0; g < games; g++) {
  const c = new Chess();
  const fens = [c.fen()];
  const sans: string[] = [];
  const ucis: string[] = [];
  const clock: Record<Side, number> = { w: base, b: base };
  const swing = { w: swingTracker(), b: swingTracker() };
  const types: Record<Side, string[]> = { w: S.types ?? typesFor(who), b: S.types ?? typesFor(who) };
  const form: Record<Side, number> = { w: S.form === false ? 0 : drawForm(), b: S.form === false ? 0 : drawForm() };
  const pace: Record<Side, number> = { w: drawPace(), b: drawPace() };
  const plan: Record<Side, number> = { w: Math.random(), b: Math.random() };
  const state: Record<Side, Record<string, number>> = { w: {}, b: {} };
  const evals: Record<Side, number[]> = { w: [], b: [] };
  const own: Record<Side, number> = { w: 0, b: 0 };
  const phases: ('opening' | 'middlegame' | 'endgame')[] = [];
  const spent: number[] = [];
  const clocks: number[] = [];
  const rec: Record<string, unknown>[] = [];
  let lostOnTime = false;
  let result: '1-0' | '0-1' | '1/2-1/2' | null = null;
  prof.games++;
  while (!c.isGameOver() && sans.length < (S.plies ?? 200)) {
    const fen = c.fen();
    const side = c.turn() as Side;
    const opp: Side = side === 'w' ? 'b' : 'w';
    const ply = sans.length;
    const moveNo = Math.floor(ply / 2) + 1;
    const ids = types[side];
    const ctx: QuirkCtx = { fen, sans: [...sans], moveNo, bot: side, me: opp, botEval: evals[side].at(-1), botLeftMs: clock[side], state: state[side], lastUserUci: ucis.at(-1), fromStart: true, plan: plan[side] };
    // Openings: the types' plans first, then the character's book (below 1200 only its first moves).
    const planned = ids.length ? typeOpening(ids, ctx, Math.random) : null;
    const book = planned?.uci ?? (S.book !== false && own[side] < bookDepth(elo) ? bookMove(S.id, sans) : null);
    let uci = book;
    let mods = quirkEffects(ids, ctx);
    const pressure = timePressure(clock[side] / mods.pressure, tc);
    const playElo = Math.max(100, elo + form[side] + mods.elo);
    let seen: { logits?: Map<string, number>; cand?: Map<string, number> } = {};
    if (!uci) {
      const { logits } = await maia3(fens, maia3SelfElo(playElo), maia3SelfElo(elo + mods.oppo));
      const cand = await candidates(fen, botParams(elo).depth);
      mods = quirkEffects(ids, { ...ctx, botEval: cand.size ? Math.max(...cand.values()) : undefined });
      const verbose = new Map(c.moves({ verbose: true }).map((m) => [m.lan, m]));
      const weighted = new Map([...logits].map(([m, v]) => [m, v + Math.log(Math.max(1e-6, verbose.has(m) ? mods.weight(verbose.get(m)!) * castleWeight(playElo, moveNo, verbose.get(m)!.san) : 1))]));
      const p = { ...humanParams(playElo), temperature: shiftedTemperature(playElo, mods.temp) * openingTemperature(playElo, moveNo) };
      uci = chooseHumanMove(weighted, playElo, cand, Math.random, { params: pressure ? pressureParams(p, pressure) : p })!;
      seen = { logits, cand };
    }
    const bestNow = seen.cand?.size ? Math.max(...seen.cand.values()) : undefined;
    if (bestNow !== undefined) evals[side].push(bestNow);
    if (!book && shouldResign({ elo, moveNo, evals: evals[side], temperament: who?.resign ?? mods.resign })) {
      result = side === 'w' ? '0-1' : '1-0';
      results.resigns++;
      break;
    }
    const last = ply ? { uci: ucis[ply - 1], san: sans[ply - 1] } : undefined;
    const info = positionInfo(seen.logits, seen.cand, uci, last);
    const forced = c.moves().length === 1;
    const endgame = phaseOf(fen, moveNo) === 'endgame';
    const forget = ids.includes('timeTrouble') ? TYPE_TUNING.timeTrouble.forget : 1;
    const think = { elo, moveNo, tc, book: !!book, forced, ...info, endgame, forget };
    const ms = base ? botThinkMs({ ...think, leftMs: clock[side], swing: swing[side](g, info.best), pace: pace[side], mult: mods.think }) : 0;
    rec.push({ ...think, phase: phaseOf(fen, moveNo), mult: mods.think });
    if (base) {
      clock[side] -= ms;
      if (clock[side] <= 0) {
        lostOnTime = true;
        result = flagResult(fen, side).result;
        results.flags++;
        break;
      }
      clock[side] += inc;
      spent.push(ms / 1000);
      clocks.push(clock[side] / 1000);
    }
    phases.push(phaseOf(fen, moveNo));
    const m = c.move(uci);
    sans.push(m.san);
    ucis.push(m.lan);
    fens.push(c.fen());
    if (book) own[side]++;
    // Tilter: each own move counts it down; losing material to the other side's move sets it off
    // (for the other side this move is "your move", as in a game against you).
    if ((state[side].tilt ?? 0) > 0) state[side].tilt--;
    const oppLost = bal(fen, opp) - bal(c.fen(), opp);
    if (oppLost > 0)
      for (const id of types[opp]) {
        const ch = quirkById(id)?.afterUserMove?.({ ...ctx, bot: opp, me: side }, oppLost);
        if (ch) Object.assign(state[opp], ch);
      }
    // The blunder/mistake/inaccuracy profile (same scoring as the human sample).
    if (S.score && ply >= PROFILE.fromPly) {
      const cand = await candidates(fen, PROFILE.depth, PROFILE.multipv);
      if (cand.size) {
        const best = Math.max(...cand.values());
        let score = cand.get(uci);
        if (score === undefined) {
          if (c.isGameOver()) score = c.isCheckmate() ? 10000 : 0;
          else { const a = await engine.analyze(c.fen(), { depth: 9 }); score = scoreToCp(povScore(a.lines[0].score, side)); }
        }
        prof.addMove({ fen, uci, fenAfter: c.fen(), best, score, ply, prob: seen.logits ? probOf(seen.logits, uci) : 1 });
      }
    }
  }
  if (!result && c.isGameOver()) result = c.isCheckmate() ? (c.turn() === 'w' ? '0-1' : '1-0') : '1/2-1/2';
  if (result === '1-0') results.w++;
  else if (result === '0-1') results.b++;
  else if (result) results.d++;
  results.plies += sans.length;
  openings.add(sans);
  if (base) timeStats.addGame(times, { tc, phases, spent, clocks, lostOnTime });
  if (S.record) appendFileSync(S.record, JSON.stringify({ elo, id: S.id, plies: rec }) + '\n');
}

function probOf(lg: Map<string, number>, u: string): number {
  const vals = [...lg.values()];
  const mx = Math.max(...vals);
  const z = vals.reduce((s, v) => s + Math.exp(v - mx), 0);
  return Math.exp((lg.get(u) ?? -1e9) - mx) / z;
}

const line = JSON.stringify({
  who: 'bot',
  kind: 'selfplay',
  label: S.label ?? S.id ?? String(elo),
  spec: S,
  elo,
  ...(S.score ? { profile: prof.summary() } : {}),
  opening: openings.summary(),
  ...(base ? { time: timeStats.summary(times) } : {}),
  results: { ...results, avgPlies: Math.round(results.plies / Math.max(1, games)) },
});
console.log(line);
if (out) appendFileSync(out, line + '\n');
process.exit(0);
