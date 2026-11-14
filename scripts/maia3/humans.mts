// Human benchmark: the profile (src/lib/benchmark/profile.ts) of real chess.com players in one
// rating band, from a sample made by fetch-humans.mts (both players near the band, so every move
// counts). Same code as the app's dev panel (src/lib/benchmark/humans.ts).
// Usage: npx tsx scripts/maia3/humans.mts <sample.jsonl> <band min, e.g. 500> [maxGames=60] [out.jsonl]
import { appendFileSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { candidates, engine, maia3 } from './players.mts';
import { BANDS } from '../../src/lib/benchmark/bands.ts';
import { Profile } from '../../src/lib/benchmark/profile.ts';
import { addGame, type BenchDeps } from '../../src/lib/benchmark/humans.ts';
import { parseClocks } from '../../src/lib/chesscom/parse.ts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';

const [file, minS, maxS, out] = process.argv.slice(2);
const band = BANDS.find((b) => b.min === Number(minS))!;
const max = Number(maxS ?? 60);
const games = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((g) => { const avg = (g.whiteRating + g.blackRating) / 2; return avg >= band.min && avg < band.max; })
  .slice(0, max);

export const nodeDeps: BenchDeps = {
  candidates: (fen, depth, multipv) => candidates(fen, depth, multipv),
  async scoreAfter(fenAfter, turn) {
    const c = new Chess(fenAfter);
    if (c.isGameOver()) return c.isCheckmate() ? 10000 : 0;
    const a = await engine.analyze(fenAfter, { depth: 9 });
    return scoreToCp(povScore(a.lines[0].score, turn));
  },
  async prob(fens, uci, self, oppo) {
    const lg = (await maia3(fens, self, oppo)).logits;
    const vals = [...lg.values()];
    const mx = Math.max(...vals);
    const z = vals.reduce((s, v) => s + Math.exp(v - mx), 0);
    return Math.exp((lg.get(uci) ?? -1e9) - mx) / z;
  },
};

const prof = new Profile();
for (const g of games) {
  const c = new Chess();
  try { c.loadPgn(g.pgn); } catch { continue; }
  const moves = c.history({ verbose: true });
  const plies = moves.map((m) => ({
    fen: m.before, uci: m.lan, fenAfter: m.after,
    mover: m.color === 'w' ? g.whiteRating : g.blackRating,
    other: m.color === 'w' ? g.blackRating : g.whiteRating,
    count: true,
  }));
  await addGame(prof, plies, parseClocks(g.pgn), '600', nodeDeps);
}
const line = JSON.stringify({ who: 'human', band: band.label, ...prof.summary() });
console.log(line);
if (out) appendFileSync(out, line + '\n');
process.exit(0);
