// Human think time, clock use, timeouts and openings from a fetch-humans.mts sample (no engine):
// per time control and rating band, seconds per move by phase, the share of quick moves (≤ 2 s),
// the clock left at the end (share of the starting time), the share of games lost on time; and
// per band the opening profile (src/lib/benchmark/openings.ts). One JSON line per row.
// Usage: npx tsx scripts/maia3/humanstats.mts <humans.jsonl> [out.jsonl]
import { appendFileSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { BANDS, bandOf } from '../../src/lib/benchmark/bands.ts';
import { phaseOf, thinkTimes } from '../../src/lib/benchmark/profile.ts';
import { OpeningProfile } from '../../src/lib/benchmark/openings.ts';
import { parseClocks } from '../../src/lib/chesscom/parse.ts';
import { timeStats, type TimeAcc } from '../../src/lib/benchmark/timestats.ts';

const [file, out] = process.argv.slice(2);
const games = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const acc = new Map<string, TimeAcc>();
const openings = new Map<string, OpeningProfile>();
for (const g of games) {
  const band = bandOf((g.whiteRating + g.blackRating) / 2);
  if (!band) continue;
  const c = new Chess();
  try { c.loadPgn(g.pgn); } catch { continue; }
  const moves = c.history({ verbose: true });
  if (moves.length < 2) continue;
  const tc = g.tc ?? '600+0';
  const clocks = parseClocks(g.pgn);
  const key = `${tc}|${band.label}`;
  if (!acc.has(key)) acc.set(key, timeStats.empty());
  const a = acc.get(key)!;
  const spent = clocks.length === moves.length ? thinkTimes(clocks, tc) : [];
  timeStats.addGame(a, {
    tc,
    phases: moves.map((m, i) => phaseOf(m.before, Math.floor(i / 2) + 1)),
    spent,
    clocks,
    lostOnTime: g.whiteResult === 'timeout' || g.blackResult === 'timeout',
  });
  if (!openings.has(band.label)) openings.set(band.label, new OpeningProfile());
  openings.get(band.label)!.add(moves.map((m) => m.san));
}
const rows: string[] = [];
for (const [key, a] of acc) {
  const [tc, band] = key.split('|');
  rows.push(JSON.stringify({ who: 'human', kind: 'time', tc, band, ...timeStats.summary(a) }));
}
for (const b of BANDS) if (openings.has(b.label)) rows.push(JSON.stringify({ who: 'human', kind: 'opening', band: b.label, ...openings.get(b.label)!.summary() }));
for (const r of rows) console.log(r);
if (out) appendFileSync(out, rows.join('\n') + '\n');
