// Blunder profile: self-play games of one player type at one rating, every move scored by
// Stockfish (depth 10, MultiPV 8). For blunders (300+ cp, game not yet decided) it says what
// kind they were:
//   hung     left a piece en prise that wasn't before (or moved it to an attacked square)
//   threat   ignored a threat: a piece that was already attacked stays lost, or walked into mate
//   other    no simple motif (deeper tactics, positional collapse)
// and how often the blunder was a move the model itself gave < 5% ("random-looking").
// Usage: npx tsx scripts/maia3/blunders.mts '<spec json>' games [out.jsonl]
import { appendFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { candidates, engine, pick, type PlayerSpec } from './players.mts';
import { hangingPieces, parseFen } from '../../src/lib/chess/pos.ts';
import { preMoveCheck } from '../../src/lib/coach/precheck.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';

const P: PlayerSpec = JSON.parse(process.argv[2]);
const games = Number(process.argv[3]);
const out = process.argv[4];
const losses: number[] = [];
const kinds = { hung: 0, threat: 0, other: 0 };
let tail = 0;
let blunders = 0;

for (let g = 0; g < games; g++) {
  const c = new Chess();
  const fens = [c.fen()];
  while (!c.isGameOver() && c.history().length < 160) {
    const fen = c.fen();
    const turn = c.turn();
    const p = await pick(P, fens, P.elo);
    const cand = p.cand ?? (await candidates(fen, 10));
    const best = Math.max(...cand.values());
    let score = cand.get(p.uci);
    c.move(p.uci);
    fens.push(c.fen());
    if (score === undefined) {
      if (c.isGameOver()) score = c.isCheckmate() ? 10000 : 0;
      else { const a = await engine.analyze(c.fen(), { depth: 9 }); score = scoreToCp(povScore(a.lines[0].score, turn)); }
    }
    if (Math.abs(best) >= 600 || c.history().length <= 12) continue;
    const loss = Math.max(0, Math.min(1000, best - score));
    losses.push(loss);
    if (loss < 300) continue;
    blunders++;
    if (p.prob < 0.05) tail++;
    const pre = preMoveCheck(fen, p.uci);
    const before = new Set(hangingPieces(parseFen(fen).board, turn).filter((h) => h.loss >= 2).map((h) => h.sq));
    const stillHanging = hangingPieces(parseFen(c.fen()).board, turn).some((h) => h.loss >= 2 && before.has(h.sq));
    if (pre?.kind === 'mate' || (stillHanging && pre?.kind !== 'hang')) kinds.threat++;
    else if (pre?.kind === 'hang') kinds.hung++;
    else kinds.other++;
  }
}
const n = losses.length;
const pct = (x: number, of = n) => Math.round((x / Math.max(1, of)) * 1000) / 10;
const res = {
  P, games, moves: n,
  avgLoss: Math.round(losses.reduce((a, b) => a + b, 0) / n),
  inacc: pct(losses.filter((x) => x >= 50 && x < 150).length),
  mistake: pct(losses.filter((x) => x >= 150 && x < 300).length),
  blunder: pct(blunders),
  ofBlunders: { hung: pct(kinds.hung, blunders), threat: pct(kinds.threat, blunders), other: pct(kinds.other, blunders), randomLooking: pct(tail, blunders) },
};
console.log(JSON.stringify(res));
if (out) appendFileSync(out, JSON.stringify(res) + '\n');
process.exit(0);
