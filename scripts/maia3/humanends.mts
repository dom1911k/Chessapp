// How people's games end, per rating band (round 7): the share ending in resignation, checkmate,
// on time, abandoned or drawn; game length in plies; and for resignations the resigner's material
// balance and the engine's evaluation (resigner's point of view) at that moment.
// Usage: npx tsx scripts/maia3/humanends.mts <humans.jsonl> [tcs=all] [out.jsonl]
import { appendFileSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { BANDS, bandOf } from '../../src/lib/benchmark/bands.ts';
import { material } from '../../src/cups/material.ts';
import { engine } from './players.mts';
import { povScore, scoreToCp } from '../../src/lib/chess/evaluation.ts';

const [file, tcsArg, out] = process.argv.slice(2);
const tcs = tcsArg && tcsArg !== 'all' ? new Set(tcsArg.split(',')) : null;
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

interface Acc { games: number; reasons: Record<string, number>; plies: number[]; resignMat: number[]; resignEval: number[]; resignMove: number[] }
const acc = new Map<string, Acc>();
for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const g = JSON.parse(line);
  if (tcs && !tcs.has(g.tc)) continue;
  const band = bandOf((g.whiteRating + g.blackRating) / 2);
  if (!band) continue;
  const c = new Chess();
  try { c.loadPgn(g.pgn); } catch { continue; }
  const plies = c.history().length;
  const loser = g.whiteResult === 'win' ? 'b' : g.blackResult === 'win' ? 'w' : null;
  const reason = loser ? (loser === 'w' ? g.whiteResult : g.blackResult) : 'draw';
  if (!acc.has(band.label)) acc.set(band.label, { games: 0, reasons: {}, plies: [], resignMat: [], resignEval: [], resignMove: [] });
  const a = acc.get(band.label)!;
  a.games++;
  a.reasons[reason] = (a.reasons[reason] ?? 0) + 1;
  a.plies.push(plies);
  if (reason === 'resigned' && loser) {
    const fen = c.fen();
    a.resignMat.push((loser === 'w' ? 1 : -1) * material(fen).diff);
    a.resignMove.push(Math.floor(plies / 2) + 1);
    if (!c.isGameOver()) {
      const r = await engine.analyze(fen, { depth: 10 });
      a.resignEval.push(Math.max(-2000, Math.min(2000, scoreToCp(povScore(r.lines[0].score, loser)))));
    }
  }
}
const rows: string[] = [];
for (const b of BANDS) {
  const a = acc.get(b.label);
  if (!a) continue;
  const pct = (k: string) => Math.round(((a.reasons[k] ?? 0) / a.games) * 1000) / 10;
  rows.push(JSON.stringify({
    who: 'human', kind: 'ends', band: b.label, games: a.games,
    resigned: pct('resigned'), checkmated: pct('checkmated'), timeout: pct('timeout'), abandoned: pct('abandoned'), draw: Math.round((((a.reasons.draw ?? 0) + (a.reasons.agreed ?? 0) + (a.reasons.repetition ?? 0) + (a.reasons.stalemate ?? 0) + (a.reasons.insufficient ?? 0) + (a.reasons.timevsinsufficient ?? 0) + (a.reasons['50move'] ?? 0)) / a.games) * 1000) / 10,
    plies: avg(a.plies), pliesMedian: median(a.plies),
    resignMaterial: median(a.resignMat), resignEval: median(a.resignEval), resignMove: median(a.resignMove),
  }));
}
for (const r of rows) console.log(r);
if (out) appendFileSync(out, rows.join('\n') + '\n');
process.exit(0);
