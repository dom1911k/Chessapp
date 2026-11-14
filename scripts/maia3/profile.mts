// Bot benchmark: the profile (src/lib/benchmark/profile.ts) of one bot in self-play on a simulated
// 10+0 clock, with the app's think-time model and time-pressure looseness: the same move scoring
// and think-time split as the human benchmark (humans.mts).
// Usage: npx tsx scripts/maia3/profile.mts '<spec json>' games [out.jsonl]
import { appendFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { candidates, engine, pick, type PlayerSpec } from './players.mts';
import { phaseOf, Profile, PROFILE } from '../../src/lib/benchmark/profile.ts';
import { humanParams, setBrain } from '../../src/lib/maia/index.ts';
import { botThinkMs, positionInfo, pressureParams, swingTracker, timePressure } from '../../src/lib/thinktime.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';

const P: PlayerSpec = JSON.parse(process.argv[2]);
const games = Number(process.argv[3]);
const out = process.argv[4];
const TC = '600+0';
setBrain('maia3');
const prof = new Profile();
for (let g = 0; g < games; g++) {
  const c = new Chess();
  const fens = [c.fen()];
  const clock = { w: 600_000, b: 600_000 };
  const swing = { w: swingTracker(), b: swingTracker() };
  prof.games++;
  while (!c.isGameOver() && c.history().length < 200) {
    const fen = c.fen();
    const turn = c.turn();
    const ply = c.history().length;
    const pressure = timePressure(clock[turn], TC);
    const p = await pick(P, fens, P.elo, pressure && P.kind === 'bot' ? pressureParams(humanParams(P.elo, 'maia3'), pressure) : undefined);
    const cand = ply >= PROFILE.fromPly ? await candidates(fen, PROFILE.depth, PROFILE.multipv) : new Map<string, number>();
    const last = c.history({ verbose: true }).at(-1);
    const info = positionInfo(p.logits, p.cand, p.uci, last ? { uci: last.lan, san: last.san } : undefined);
    const ms = botThinkMs({ elo: P.elo, moveNo: Math.floor(ply / 2) + 1, leftMs: clock[turn], tc: TC, forced: c.moves().length === 1, ...info, swing: swing[turn](g, info.best) });
    prof.addThink(phaseOf(fen, Math.floor(ply / 2) + 1), ms / 1000);
    clock[turn] -= ms;
    if (clock[turn] <= 0) break;
    c.move(p.uci);
    fens.push(c.fen());
    if (ply >= PROFILE.fromPly && cand.size) {
      const best = Math.max(...cand.values());
      let score = cand.get(p.uci);
      if (score === undefined) {
        if (c.isGameOver()) score = c.isCheckmate() ? 10000 : 0;
        else { const a = await engine.analyze(c.fen(), { depth: 9 }); score = scoreToCp(povScore(a.lines[0].score, turn)); }
      }
      prof.addMove({ fen, uci: p.uci, fenAfter: c.fen(), best, score, ply, prob: p.prob });
    }
  }
}
const line = JSON.stringify({ who: 'bot', P, ...prof.summary() });
console.log(line);
if (out) appendFileSync(out, line + '\n');
process.exit(0);
