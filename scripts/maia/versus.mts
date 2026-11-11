// Strength check for the human-like picker: new picker (elo A, optional params) against the old
// pure-sampling picker (elo B). Usage: npx tsx scripts/maia/versus.mts eloNew eloOld games [json params]
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { moveLogits, parseNet, type MaiaNet } from '../../src/lib/maia/net.ts';
import { chooseHumanMove, chooseMaiaMove, maiaParams, vetoLimit } from '../../src/lib/maia/index.ts';
import { createNodeEngine } from '../../src/lib/engine/node.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';
const engine = createNodeEngine();
const nets = new Map<number, MaiaNet>();
const net = (r: number) => { if (!nets.has(r)) { const b = readFileSync(`public/maia/maia-${r}.bin`); nets.set(r, parseNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); } return nets.get(r)!; };
const [a, b, n] = process.argv.slice(2, 5).map(Number);
const params = process.argv[5] ? JSON.parse(process.argv[5]) : undefined;
async function play(newIsWhite: boolean) {
  const c = new Chess(); const fens = [c.fen()];
  while (!c.isGameOver() && c.history().length < 200) {
    const isNew = (c.turn() === 'w') === newIsWhite;
    const elo = isNew ? a : b;
    const p = maiaParams(elo);
    const moves = c.moves({ verbose: true });
    const lg = moveLogits(net(p.rating), fens.slice(-9), moves.map((m) => m.lan), new Set(moves.filter((m) => m.isKingsideCastle() || m.isQueensideCastle()).map((m) => m.lan)));
    let cand: Map<string, number> | undefined;
    if (isNew || vetoLimit(elo) !== null) {
      const an = await engine.analyze(c.fen(), { depth: 9, multipv: 8 });
      cand = new Map(an.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, c.turn()))]));
    }
    c.move(isNew ? chooseHumanMove(lg, elo, cand, Math.random, { params })! : chooseMaiaMove(lg, p.temperature, elo, cand)!);
    fens.push(c.fen());
  }
  if (c.isCheckmate()) return (c.turn() === 'w') === newIsWhite ? 0 : 1;
  // Unfinished or drawn: let the engine call clearly decided games.
  if (!c.isGameOver()) { const an = await engine.analyze(c.fen(), { depth: 10 }); const s = scoreToCp(povScore(an.lines[0].score, newIsWhite ? 'w' : 'b')); return s > 400 ? 1 : s < -400 ? 0 : 0.5; }
  return 0.5;
}
let s = 0;
for (let i = 0; i < n; i++) s += await play(i % 2 === 0);
const k = s / n;
const diff = k <= 0 ? -800 : k >= 1 ? 800 : -400 * Math.log10(1 / k - 1);
console.log(`new ${a} vs old ${b}: ${s}/${n} = ${(k * 100).toFixed(0)}% (≈ ${diff.toFixed(0)} Elo for new) ${params ? JSON.stringify(params) : ''}`);
process.exit(0);
