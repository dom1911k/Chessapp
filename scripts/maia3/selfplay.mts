// Match between two players (see players.mts), alternating colours. Prints A's score and the
// implied rating difference. A clearly decided game (|eval| >= ADJ after move 15, by a quick
// Stockfish look every few plies) is scored without playing it out.
// Usage: npx tsx scripts/maia3/selfplay.mts '<spec A json>' '<spec B json>' games [out.jsonl]
import { appendFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { candidates, pick, type PlayerSpec } from './players.mts';

const A: PlayerSpec = JSON.parse(process.argv[2]);
const B: PlayerSpec = JSON.parse(process.argv[3]);
const games = Number(process.argv[4]);
const out = process.argv[5];
const ADJ = Number(process.env.ADJ ?? 900);

async function play(aWhite: boolean): Promise<number> {
  const c = new Chess();
  const fens = [c.fen()];
  while (!c.isGameOver() && c.history().length < 220) {
    const aToMove = (c.turn() === 'w') === aWhite;
    const me = aToMove ? A : B;
    const them = aToMove ? B : A;
    const p = await pick(me, fens, them.elo);
    const ply = c.history().length;
    // Adjudicate from the mover's candidates, or a quick look every 6 plies for raw players.
    let best: number | undefined = p.cand?.size ? Math.max(...p.cand.values()) : undefined;
    if (best === undefined && ply % 6 === 0 && ply >= 30) best = Math.max(...(await candidates(c.fen(), 8, 1)).values());
    if (best !== undefined && ply >= 30 && Math.abs(best) >= ADJ) return (best > 0) === aToMove ? 1 : 0;
    c.move(p.uci);
    fens.push(c.fen());
  }
  if (c.isCheckmate()) return (c.turn() === 'w') === aWhite ? 0 : 1;
  if (!c.isGameOver()) {
    const best = Math.max(...(await candidates(c.fen(), 10, 1)).values());
    const aToMove = (c.turn() === 'w') === aWhite;
    if (Math.abs(best) >= 300) return (best > 0) === aToMove ? 1 : 0;
  }
  return 0.5;
}

let score = 0;
for (let i = 0; i < games; i++) score += await play(i % 2 === 0);
const s = score / games;
const diff = s <= 0 ? -800 : s >= 1 ? 800 : Math.round(-400 * Math.log10(1 / s - 1));
const line = JSON.stringify({ A, B, games, score, pct: Math.round(s * 1000) / 10, diff });
console.log(line);
if (out) appendFileSync(out, line + '\n');
process.exit(0);
