// Plays Maia-vs-Maia matches to calibrate opponent strengths (run from the repo root).
// Usage: npx tsx scripts/maia/calibrate.mts eloA eloB games [tA tB]
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { moveLogits, parseNet, type MaiaNet } from '../../src/lib/maia/net.ts';
import { chooseMaiaMove, maiaParams, vetoLimit } from '../../src/lib/maia/index.ts';
import { createNodeEngine } from '../../src/lib/engine/node.ts';
import { botParams } from '../../src/lib/bot.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';
const engine = createNodeEngine();
const nets = new Map<number, MaiaNet>();
const net = (r: number) => {
  if (!nets.has(r)) { const b = readFileSync(`public/maia/maia-${r}.bin`); nets.set(r, parseNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); }
  return nets.get(r)!;
};
const [a, b, n] = process.argv.slice(2, 5).map(Number);
const ta = process.argv[5] ? Number(process.argv[5]) : undefined;
const tb = process.argv[6] ? Number(process.argv[6]) : undefined;
async function play(white: number, black: number, tw?: number, tbl?: number) {
  const c = new Chess();
  const fens = [c.fen()];
  while (!c.isGameOver() && c.history().length < 240) {
    const elo = c.turn() === 'w' ? white : black;
    const p = maiaParams(elo);
    const t = (c.turn() === 'w' ? tw : tbl) ?? p.temperature;
    const moves = c.moves({ verbose: true });
    const lg = moveLogits(net(p.rating), fens.slice(-9), moves.map((m) => m.lan), new Set(moves.filter((m) => m.isKingsideCastle() || m.isQueensideCastle()).map((m) => m.lan)));
    let candidates: Map<string, number> | undefined;
    if (vetoLimit(elo) !== null) {
      const a = await engine.analyze(c.fen(), { depth: botParams(elo).depth, multipv: 8 });
      candidates = new Map(a.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, c.turn()))]));
    }
    c.move(chooseMaiaMove(lg, t, elo, candidates)!);
    fens.push(c.fen());
  }
  if (c.isCheckmate()) return c.turn() === 'w' ? 0 : 1; // white's score
  return 0.5;
}
let sa = 0, plies = 0;
for (let i = 0; i < n; i++) {
  const aWhite = i % 2 === 0;
  const r = aWhite ? await play(a, b, ta, tb) : await play(b, a, tb, ta);
  sa += aWhite ? r : 1 - r;
}
const s = sa / n;
const diff = s <= 0 ? -800 : s >= 1 ? 800 : -400 * Math.log10(1 / s - 1);
console.log(`${a}${ta ? '@' + ta : ''} vs ${b}${tb ? '@' + tb : ''}: ${sa}/${n} = ${(s * 100).toFixed(0)}%  (≈ ${diff.toFixed(0)} Elo for A)`);
process.exit(0);
