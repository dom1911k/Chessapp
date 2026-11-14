// Think-time check: Maia-3 bots of one rating play each other on a simulated clock with the app's
// think-time model (src/lib/thinktime.ts), including time-pressure looseness. Reports seconds per
// move, the share of instant moves, total time used, long thinks and flags.
// Usage: npx tsx scripts/maia3/thinktime.mts <elo> <games> [tc=600+0] [out.jsonl]
import { appendFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { chooseHumanMove, humanParams, maia3SelfElo, moveProbs, setBrain } from '../../src/lib/maia/index.ts';
import { botParams } from '../../src/lib/bot.ts';
import { flagResult, parseTc, sensibleMoves } from '../../src/lib/clock.ts';
import { botThinkMs, isRecapture, pressureParams, timePressure } from '../../src/lib/thinktime.ts';
import { candidates, maia3 } from './players.mts';

const [eloS, gamesS, tcArg, out] = process.argv.slice(2);
const elo = Number(eloS);
const games = Number(gamesS);
const tc = tcArg ?? '600+0';
setBrain('maia3');
const thinks: number[] = [];
const used: number[] = [];
let flags = 0;
let pressureMoves = 0;
let moves = 0;

for (let g = 0; g < games; g++) {
  const c = new Chess();
  const fens = [c.fen()];
  const clock = { w: parseTc(tc).base, b: parseTc(tc).base };
  const lastBest: Record<string, number | undefined> = {};
  let lastUci: string | undefined;
  let lastCapture = false;
  while (!c.isGameOver() && c.history().length < 200) {
    const side = c.turn();
    const fen = c.fen();
    const legal = c.moves({ verbose: true });
    const { logits } = await maia3(fens, maia3SelfElo(elo), maia3SelfElo(elo));
    const cand = await candidates(fen, botParams(elo).depth);
    const scores = [...cand.values()].sort((a, b) => b - a);
    const pressure = timePressure(clock[side], tc);
    if (pressure > 0) pressureMoves++;
    const base = humanParams(elo);
    const uci = chooseHumanMove(logits, elo, cand, Math.random, { params: pressureParams(base, pressure) })!;
    const probs = moveProbs(logits);
    const ms = botThinkMs({
      elo,
      moveNo: Math.floor(c.history().length / 2) + 1,
      leftMs: clock[side],
      tc,
      forced: legal.length === 1,
      topProb: probs[0]?.[1],
      sensible: sensibleMoves(logits),
      recapture: isRecapture(lastUci, lastCapture, uci),
      best: scores[0],
      second: scores[1],
      swing: lastBest[side] === undefined || scores[0] === undefined ? 0 : Math.abs(scores[0] - lastBest[side]!),
    });
    lastBest[side] = scores[0];
    clock[side] -= ms;
    thinks.push(ms);
    moves++;
    if (clock[side] <= 0) {
      flags++;
      flagResult(fen, side);
      break;
    }
    clock[side] += parseTc(tc).inc;
    const m = c.move(uci);
    lastUci = m.lan;
    lastCapture = !!m.captured;
    fens.push(c.fen());
  }
  for (const s of ['w', 'b'] as const) used.push((parseTc(tc).base - Math.max(0, clock[s])) / 1000);
}
const sorted = [...thinks].sort((a, b) => a - b);
const q = (x: number) => sorted[Math.floor(x * (sorted.length - 1))] / 1000;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const line = JSON.stringify({
  elo, tc, games, moves,
  avgS: +(avg(thinks) / 1000).toFixed(1),
  medianS: +q(0.5).toFixed(1),
  p90S: +q(0.9).toFixed(1),
  maxS: +q(1).toFixed(1),
  instantPct: +((thinks.filter((t) => t < 1300).length / thinks.length) * 100).toFixed(0),
  usedS: +avg(used).toFixed(0),
  flags,
  pressurePct: +((pressureMoves / moves) * 100).toFixed(1),
});
console.log(line);
if (out) appendFileSync(out, line + '\n');
process.exit(0);
