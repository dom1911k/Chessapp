// Quirk calibration: a quirked Maia against a plain Maia at the same rating, alternating colours,
// with a simulated 10+0 clock (human-like think times, so Speedster/Time Trouble count).
// Prints the quirked side's score, and for Copycat how often it mirrored in its first 6 moves.
// Usage: npx tsx scripts/maia/quirks.mts <quirkId> <elo> <games> [json overrides for TUNING.quirks[quirkId]] [out]
// BRAIN=maia3 (default) uses the Maia-3 opponents, BRAIN=maia1 the classic ones.
import { readFileSync, appendFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { moveLogits, parseNet, type MaiaNet } from '../../src/lib/maia/net.ts';
import { chooseHumanMove, maia3SelfElo, maiaParams, setBrain, shiftedTemperature } from '../../src/lib/maia/index.ts';
import { engine, maia3 } from '../maia3/players.mts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';
import { flagResult, humanThinkMs, sensibleMoves } from '../../src/lib/clock.ts';
import { quirkById, quirkEffects, type QuirkCtx } from '../../src/cups/quirks.ts';
import { material } from '../../src/cups/material.ts';
import { TUNING } from '../../src/cups/tuning.ts';

const [id, eloS, gamesS, over, out] = process.argv.slice(2);
const elo = Number(eloS);
const games = Number(gamesS);
if (over) Object.assign((TUNING.quirks as Record<string, object>)[id], JSON.parse(over));
const quirk = quirkById(id);
if (!quirk) throw new Error(`no quirk ${id}`);

const BRAIN = (process.env.BRAIN ?? 'maia3') as 'maia1' | 'maia3';
setBrain(BRAIN);
const nets = new Map<number, MaiaNet>();
const net = (r: number) => { if (!nets.has(r)) { const b = readFileSync(`public/maia/maia-${r}.bin`); nets.set(r, parseNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); } return nets.get(r)!; };
const mirror = (uci: string) => uci.replace(/[1-8]/g, (r) => String(9 - Number(r)));
const bal = (fen: string, me: 'w' | 'b') => (me === 'w' ? 1 : -1) * material(fen).diff;
const DEPTH = Number(process.env.DEPTH ?? 8);
const ADJ = Number(process.env.ADJ ?? 700);
let copyChances = 0;
let copies = 0;

async function play(quirkWhite: boolean): Promise<number> {
  const c = new Chess();
  const fens = [c.fen()];
  const sans: string[] = [];
  const ucis: string[] = [];
  const clock = { w: 600_000, b: 600_000 };
  const state: Record<string, number> = {};
  const qSide = quirkWhite ? 'w' : 'b';
  let lastBalBeforeQ = 0;
  while (!c.isGameOver() && sans.length < 160) {
    const side = c.turn();
    const fen = c.fen();
    const isQ = side === qSide;
    const moveNo = Math.floor(sans.length / 2) + 1;
    const moves = c.moves({ verbose: true });
    const ctx: QuirkCtx = { fen, sans: [...sans], moveNo, bot: qSide, me: qSide === 'w' ? 'b' : 'w', botLeftMs: clock[side], state, lastUserUci: ucis[ucis.length - 1], fromStart: true };
    let uci: string | null = isQ ? (quirk!.opening?.(ctx, Math.random) ?? null) : null;
    const book = !!uci;
    let sensible = 1;
    let think = 1;
    if (!uci) {
      const lg = BRAIN === 'maia3'
        ? (await maia3(fens, maia3SelfElo(elo), maia3SelfElo(elo))).logits
        : moveLogits(net(maiaParams(elo).rating), fens.slice(-9), moves.map((m) => m.lan), new Set(moves.filter((m) => m.isKingsideCastle() || m.isQueensideCastle()).map((m) => m.lan)));
      const a = await engine.analyze(fen, { depth: DEPTH, multipv: 8 });
      const cand = new Map(a.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, side))]));
      // Adjudicate a clearly decided game (both sides are the same strength) to save time on mop-ups.
      const best = cand.size ? Math.max(...cand.values()) : 0;
      if (sans.length >= 20 && Math.abs(best) >= ADJ) return (best > 0) === isQ ? 1 : 0;
      sensible = sensibleMoves(lg);
      if (isQ) {
        const e = quirkEffects([id], { ...ctx, botEval: cand.size ? Math.max(...cand.values()) : undefined });
        const byUci = new Map(moves.map((m) => [m.lan, m]));
        const w = new Map([...lg].map(([m, v]) => [m, v + Math.log(Math.max(1e-6, e.weight(byUci.get(m)!)))]));
        uci = chooseHumanMove(w, elo, cand, Math.random, { params: { temperature: shiftedTemperature(elo, e.temp) } });
        think = e.think;
      } else uci = chooseHumanMove(lg, elo, cand, Math.random);
    } else think = quirkEffects([id], ctx).think;
    if (isQ && id === 'copycat' && moveNo <= TUNING.quirks.copycat.untilMove && ucis.length) {
      const m = mirror(ucis[ucis.length - 1]);
      if (moves.some((x) => x.lan === m)) {
        copyChances++;
        if (uci === m) copies++;
      }
    }
    const spent = humanThinkMs({ moveNo, sensible, leftMs: clock[side], tc: '600+0', book, forced: moves.length === 1 }) * think;
    clock[side] -= spent;
    if (clock[side] <= 0) {
      const f = flagResult(fen, side);
      return f.result === '1/2-1/2' ? 0.5 : (f.result === '1-0') === quirkWhite ? 1 : 0;
    }
    if (isQ) lastBalBeforeQ = bal(fen, qSide);
    const m = c.move(uci!);
    sans.push(m.san);
    ucis.push(m.lan);
    fens.push(c.fen());
    if (isQ) {
      if ((state.tilt ?? 0) > 0) state.tilt--;
    } else {
      const lost = lastBalBeforeQ - bal(c.fen(), qSide);
      const ch = lost > 0 ? quirk!.afterUserMove?.(ctx, lost) : null;
      if (ch) Object.assign(state, ch);
    }
  }
  if (c.isCheckmate()) return (c.turn() === 'w') === quirkWhite ? 0 : 1;
  if (!c.isGameOver()) {
    const a = await engine.analyze(c.fen(), { depth: 10 });
    const s = scoreToCp(povScore(a.lines[0].score, qSide));
    return s > 300 ? 1 : s < -300 ? 0 : 0.5;
  }
  return 0.5;
}

let score = 0;
for (let i = 0; i < games; i++) score += await play(i % 2 === 0);
const line = JSON.stringify({ id, brain: BRAIN, elo, games, score, pct: Math.round((score / games) * 1000) / 10, over: over ? JSON.parse(over) : null, copy: id === 'copycat' ? Math.round((copies / Math.max(1, copyChances)) * 100) : undefined });
console.log(line);
if (out) appendFileSync(out, line + '\n');
process.exit(0);
