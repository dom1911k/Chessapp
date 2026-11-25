// Think time and clock use under other time controls, without replaying the engine (round 7).
// Replays the clocks of games recorded by charplay.mts ({"record": path}) under each time control
// with the think model (src/lib/thinktime.ts): both sides on the clock, the types' think and
// pressure factors kept. The moves don't change with the clock (looser play under pressure is
// left out), which is fine for the clock use itself.
//   npx tsx scripts/maia3/thinkfit.mts replay <rec.jsonl…> [--tcs=180+2,…] [--model=<thinktime.ts>]
//       seconds per move by phase, quick moves, clock left at the end, games lost on time, per
//       time control and rating (JSON lines; --model replays another version of the model)
//   npx tsx scripts/maia3/thinkfit.mts ends <rec.jsonl…> --resign [--tc=600+0] [--rset=…]
//       how the games end per rating: resignations, games lost on time, length, and the material
//       and evaluation at resignation (compare with humanends.mts)
//   npx tsx scripts/maia3/thinkfit.mts fit <rec.jsonl…> --humans=<humanstats.jsonl>
//       the time-control exponent k per rating that best matches people (sec/move per phase and
//       clock left at 3+2, 5+0, 15+10 and 30+0)
import { readFileSync } from 'node:fs';
import { parseTc } from '../../src/lib/clock.ts';
import { bandOf } from '../../src/lib/benchmark/bands.ts';
import { timeStats, type TimeAcc, type TimeSummary } from '../../src/lib/benchmark/timestats.ts';
import { RESIGN, shouldResign } from '../../src/lib/resign.ts';

const [mode, ...rest] = process.argv.slice(2);
const opt = (k: string) => rest.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const files = rest.filter((a) => !a.startsWith('--'));
const tcs = (opt('tcs') ?? '180+2,300+0,600+0,900+10,1800+0').split(',');
const M = await import(opt('model') ?? '../../src/lib/thinktime.ts');
const { botThinkMs, swingTracker, THINK } = M;
// --k=400:0.3,1000:0.5,…  tries another exponent curve; --openingK=0.5 another opening share.
if (opt('k')) THINK.tcExponent = opt('k')!.split(',').map((p) => p.split(':').map(Number));
if (opt('openingK')) THINK.openingK = Number(opt('openingK'));
// --set=instantK:0.8,gamePaceSigma:0.3  other numbers of THINK.
for (const kv of opt('set')?.split(',') ?? []) {
  const [k, v] = kv.split(':');
  // A curve is written value@rating/value@rating (e.g. incUse:0@700/0.9@1300).
  THINK[k] = k === 'gamePace' ? v.split('/').map(Number) : v.includes('@') ? v.split('/').map((x) => x.split('@').map(Number).reverse()) : Number(v);
}
const drawPace: ((r: () => number) => number) | undefined = M.drawPace;
// --resign: end games where the app's resignation rules (src/lib/resign.ts) would resign (record
// games with {"noResign": true}); --rset=chance:0.01@400/0.2@1000,lostMoves:3 tries other numbers.
const RESIGNING = rest.includes('--resign');
for (const kv of opt('rset')?.split(',') ?? []) {
  const [k, v] = kv.split(':');
  (RESIGN as unknown as Record<string, unknown>)[k] = v.includes('@') ? v.split('/').map((x) => x.split('@').map(Number).reverse()) : Number(v);
}

/** A small seeded generator (mulberry32), so replays are repeatable. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

interface Ply { moveNo: number; phase: 'opening' | 'middlegame' | 'endgame'; mult?: number; best?: number; [k: string]: unknown }
interface Rec { elo: number; plies: Ply[] }
const games: Rec[] = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));

// --lengths=<humans.jsonl>: end each bot game at a length drawn from people's games at that band and
// time control (in the app one side is a person, who resigns or leaves as people do; bots below
// 1000 hardly ever resign, so self-play games run longer than real ones).
const lengths = new Map<string, number[]>();
if (opt('lengths')) {
  const { Chess } = await import('chess.js');
  for (const l of readFileSync(opt('lengths')!, 'utf8').split('\n').filter(Boolean)) {
    const h = JSON.parse(l);
    const band = bandOf((h.whiteRating + h.blackRating) / 2)?.label;
    if (!band) continue;
    const c = new Chess();
    try { c.loadPgn(h.pgn); } catch { continue; }
    const key = `${h.tc}|${band}`;
    lengths.set(key, [...(lengths.get(key) ?? []), c.history().length]);
  }
}

interface Ends { games: number; resigned: number; flagged: number; plies: number[]; mat: number[]; evals: number[] }
const ends = new Map<number, Ends>();

/** Replay `gs` under `tc`: clock use per rating (and how the games end, in `ends`). */
function replay(gs: Rec[], tc: string, seed0 = 1): Map<number, TimeAcc> {
  const byElo = new Map<number, TimeAcc>();
  ends.clear();
  const { base, inc } = parseTc(tc);
  gs.forEach((g0, gi) => {
    const r = rng(seed0 + gi);
    const pool = lengths.get(`${tc}|${bandOf(g0.elo + 1)?.label}`);
    const g = pool?.length ? { ...g0, plies: g0.plies.slice(0, pool[Math.floor(r() * pool.length)]) } : g0;
    const clock = [base, base];
    // This game's think pace for each side (as the app draws it per game).
    const pace = [drawPace?.(r) ?? 1, drawPace?.(r) ?? 1];
    const swing = [swingTracker(), swingTracker()];
    const spent: number[] = [];
    const clocks: number[] = [];
    const evals: number[][] = [[], []];
    let lost = false;
    let resigned = -1;
    for (let i = 0; i < g.plies.length; i++) {
      const p = g.plies[i];
      const side = i % 2;
      // Resigning instead of moving (not from a book move), as in the app.
      if (RESIGNING && !p.book && p.best !== undefined) {
        evals[side].push(p.best);
        if (shouldResign({ elo: g.elo, moveNo: p.moveNo, evals: evals[side] }, r)) {
          resigned = i;
          break;
        }
      }
      // As in the app: the type's think factor on top (its pressure factor only loosens the moves).
      const ms = botThinkMs({ ...p, tc, leftMs: clock[side], swing: swing[side](gi, p.best), pace: pace[side], mult: p.mult ?? 1 }, r) * (M.THINK.incUse === undefined ? (p.mult ?? 1) : 1);
      clock[side] -= ms;
      if (clock[side] <= 0) {
        lost = true;
        break;
      }
      clock[side] += inc;
      spent.push(ms / 1000);
      clocks.push(clock[side] / 1000);
    }
    if (!byElo.has(g.elo)) byElo.set(g.elo, timeStats.empty());
    timeStats.addGame(byElo.get(g.elo)!, { tc, phases: g.plies.slice(0, spent.length).map((p) => p.phase), spent, clocks, lostOnTime: lost });
    if (!ends.has(g.elo)) ends.set(g.elo, { games: 0, resigned: 0, flagged: 0, plies: [], mat: [], evals: [] });
    const e = ends.get(g.elo)!;
    e.games++;
    if (lost) e.flagged++;
    if (resigned >= 0) {
      e.resigned++;
      e.mat.push(Number(g.plies[resigned].mat ?? 0));
      e.evals.push(Math.max(-2000, Math.min(2000, Number(g.plies[resigned].best ?? 0))));
    }
    e.plies.push(resigned >= 0 ? resigned : spent.length || g.plies.length);
  });
  return byElo;
}

if (mode === 'ends') {
  // How the replayed games end per rating, at one time control (default 10+0).
  replay(games, opt('tc') ?? '600+0');
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
  for (const [elo, e] of [...ends].sort((x, y) => x[0] - y[0]))
    console.log(JSON.stringify({ who: 'bot', kind: 'ends', elo, band: bandOf(elo + 1)?.label, games: e.games, resigned: Math.round((e.resigned / e.games) * 1000) / 10, timeout: Math.round((e.flagged / e.games) * 1000) / 10, plies: Math.round(e.plies.reduce((a, b) => a + b, 0) / e.games), pliesMedian: med(e.plies), resignMaterial: med(e.mat), resignEval: med(e.evals) }));
  process.exit(0);
}

if (mode === 'replay') {
  for (const tc of tcs) for (const [elo, a] of [...replay(games, tc)].sort((x, y) => x[0] - y[0])) console.log(JSON.stringify({ who: 'bot', kind: 'time', tc, elo, band: bandOf(elo + 1)?.label, ...timeStats.summary(a) }));
  process.exit(0);
}

if (mode === 'fit') {
  const humans = readFileSync(opt('humans')!, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((h) => h.kind === 'time');
  const human = (tc: string, band: string | undefined) => humans.find((h) => h.tc === tc && h.band === band && h.games >= 8) as TimeSummary | undefined;
  const fitTcs = tcs.filter((t) => t !== '600+0');
  const elos = [...new Set(games.map((g) => g.elo))].sort((a, b) => a - b);
  const err = (b: TimeSummary, h: TimeSummary) => {
    let e = 0;
    for (const p of ['opening', 'middlegame', 'endgame'] as const) if (h[p] > 0 && b[p] > 0) e += Math.log(b[p] / h[p]) ** 2;
    return e + ((b.left - h.left) / 20) ** 2 + ((b.quick - h.quick) / 20) ** 2;
  };
  let total = 0;
  for (const elo of elos) {
    const gs = games.filter((g) => g.elo === elo);
    const band = bandOf(elo + 1)?.label;
    let best = { k: NaN, e: Infinity };
    for (let k = 0; k <= 1.2001; k += 0.05) {
      THINK.tcExponent = [[0, k], [3000, k]];
      let e = 0;
      let n = 0;
      for (const tc of fitTcs) {
        const h = human(tc, band);
        if (!h) continue;
        e += err(timeStats.summary(replay(gs, tc).get(elo)!), h);
        n++;
      }
      if (n && e < best.e) best = { k: Math.round(k * 100) / 100, e: Math.round(e * 1000) / 1000 };
    }
    console.log(JSON.stringify({ elo, band, ...best }));
    total += best.e;
  }
  console.log(JSON.stringify({ total: Math.round(total * 1000) / 1000 }));
  process.exit(0);
}

console.error('Usage: thinkfit.mts replay|fit <rec.jsonl…> [--tcs=…] [--model=…] [--humans=…]');
process.exit(1);
