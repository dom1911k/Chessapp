// Measures how a bot's mistakes are distributed: plays `games` self-play games at `elo` with the
// old picker ("old") or the human-like one ("new") and reports centipawn loss per move.
// Usage: npx tsx scripts/maia/losses.mts elo games old|new [json params]
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { moveLogits, parseNet, type MaiaNet } from '../../src/lib/maia/net.ts';
import { chooseHumanMove, chooseMaiaMove, maiaParams, moveProbs } from '../../src/lib/maia/index.ts';
import { createNodeEngine } from '../../src/lib/engine/node.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';
const engine = createNodeEngine();
const nets = new Map<number, MaiaNet>();
const net = (r: number) => { if (!nets.has(r)) { const b = readFileSync(`public/maia/maia-${r}.bin`); nets.set(r, parseNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); } return nets.get(r)!; };
const elo = Number(process.argv[2]); const games = Number(process.argv[3]); const mode = process.argv[4] ?? 'old';
const params = process.argv[5] ? JSON.parse(process.argv[5]) : undefined;
const losses: number[] = []; const tailBlunders: number[] = []; let n = 0;
for (let g = 0; g < games; g++) {
  const c = new Chess(); const fens = [c.fen()];
  while (!c.isGameOver() && c.history().length < 160) {
    const p = maiaParams(elo);
    const moves = c.moves({ verbose: true });
    const lg = moveLogits(net(p.rating), fens.slice(-9), moves.map((m) => m.lan), new Set(moves.filter((m) => m.isKingsideCastle() || m.isQueensideCastle()).map((m) => m.lan)));
    const a = await engine.analyze(c.fen(), { depth: 10, multipv: 8 });
    const cand = new Map(a.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, c.turn()))]));
    const best = Math.max(...cand.values());
    const uci = mode === 'old' ? chooseMaiaMove(lg, p.temperature, elo, undefined)! : chooseHumanMove(lg, elo, cand, Math.random, { params })!;
    let score = cand.get(uci);
    const turn = c.turn();
    c.move(uci); fens.push(c.fen());
    if (score === undefined) { if (c.isGameOver()) score = c.isCheckmate() ? 10000 : 0; else { const b = await engine.analyze(c.fen(), { depth: 9 }); score = scoreToCp(povScore(b.lines[0].score, turn)); } }
    // Only count moves made while the game is still a game (not already totally won or lost).
    if (Math.abs(best) < 600 && c.history().length > 12) {
      const loss = Math.max(0, Math.min(1000, best - score)); losses.push(loss); n++;
      if (loss >= 300) tailBlunders.push(moveProbs(lg).find(([m]) => m === uci)?.[1] ?? 0);
    }
  }
}
const pct = (f: (x: number) => boolean) => ((losses.filter(f).length / n) * 100).toFixed(1) + '%';
const avg = (losses.reduce((x, y) => x + y, 0) / n).toFixed(0);
console.log(`${elo} ${mode}: ${n} moves, avg loss ${avg}cp | ok(<50) ${pct((x) => x < 50)} | inaccuracy(50-149) ${pct((x) => x >= 50 && x < 150)} | mistake(150-299) ${pct((x) => x >= 150 && x < 300)} | blunder(300+) ${pct((x) => x >= 300)} | of blunders, Maia prob <5%: ${tailBlunders.length ? ((tailBlunders.filter((p) => p < 0.05).length / tailBlunders.length) * 100).toFixed(0) : 0}%`);
process.exit(0);
