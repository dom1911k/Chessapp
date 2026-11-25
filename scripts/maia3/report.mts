// Round 7 benchmark tables (Markdown) from the benchmark outputs: per character, form, openings,
// think time per time control, and games lost on time. Missing inputs are skipped.
// Usage: npx tsx scripts/maia3/report.mts --humans=<humanstats.jsonl> [--chars=<charplay.jsonl>]
//   [--form=<charplay.jsonl>] [--open=<charplay.jsonl>] [--open-before=<jsonl>]
//   [--time=<thinkfit replay.jsonl>] [--time-before=<thinkfit replay.jsonl>]
import { existsSync, readFileSync } from 'node:fs';
import { bandOf, BANDS } from '../../src/lib/benchmark/bands.ts';
import baseline from '../../src/lib/benchmark/baseline.json' with { type: 'json' };

const opt = (k: string) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const rows = (k: string) => {
  const f = opt(k);
  return f && existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};
type Prof = { games: number; moves: number; inacc: number; mistake: number; blunder: number };
/** Several runs of the same player: rates weighted by moves. */
function merge(ps: Prof[]): Prof | null {
  if (!ps.length) return null;
  const moves = ps.reduce((a, p) => a + p.moves, 0);
  const w = (k: 'inacc' | 'mistake' | 'blunder') => Math.round((ps.reduce((a, p) => a + p[k] * p.moves, 0) / Math.max(1, moves)) * 10) / 10;
  return { games: ps.reduce((a, p) => a + p.games, 0), moves, inacc: w('inacc'), mistake: w('mistake'), blunder: w('blunder') };
}
/** Standard error of a rate from the spread between runs (each run a few games). */
function se(ps: Prof[], k: 'inacc' | 'mistake' | 'blunder'): number {
  if (ps.length < 2) return NaN;
  const m = ps.reduce((a, p) => a + p[k], 0) / ps.length;
  const sd = Math.sqrt(ps.reduce((a, p) => a + (p[k] - m) ** 2, 0) / (ps.length - 1));
  return Math.round((sd / Math.sqrt(ps.length)) * 10) / 10;
}
const groupBy = <T,>(xs: T[], key: (x: T) => string) => xs.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) ?? []), x]), new Map<string, T[]>());
const base = new Map((baseline.bots as (Prof & { label: number })[]).map((b) => [b.label, b]));
const d = (x: number, y: number) => `${x - y >= 0 ? '+' : '−'}${Math.abs(Math.round((x - y) * 10) / 10)}`;
const ok = (...xs: boolean[]) => (xs.every(Boolean) ? 'yes' : 'no');

// 1. Characters (types and form on) against their band's baseline bot.
const chars = rows('chars').filter((r) => r.profile);
if (chars.length) {
  console.log('\n**Characters, self-play with their types (and form) vs the band baseline** (blunders / mistakes / inaccuracies per 100 moves; ±1.5)\n');
  console.log('| Character | games / moves | before: band bot B / M / I | after B / M / I | Δ B / M / I | ± (run-to-run SE) | within ±1.5 |');
  console.log('|---|---|---|---|---|---|---|');
  const order = ['lily', 'tom', 'maya', 'jonas', 'priya', 'marcus', 'sofia', 'viktor', 'mei'];
  for (const [label, rs] of [...groupBy(chars, (r) => r.label)].sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0]))) {
    const ps = rs.map((r) => r.profile);
    const a = merge(ps)!;
    const b = base.get(rs[0].elo);
    if (!b) continue;
    console.log(`| ${label[0].toUpperCase() + label.slice(1)} (${rs[0].elo}) | ${a.games} / ${a.moves} | ${b.blunder} / ${b.mistake} / ${b.inacc} | ${a.blunder} / ${a.mistake} / ${a.inacc} | ${d(a.blunder, b.blunder)} / ${d(a.mistake, b.mistake)} / ${d(a.inacc, b.inacc)} | ${se(ps, 'blunder')} / ${se(ps, 'mistake')} / ${se(ps, 'inacc')} | ${ok(Math.abs(a.blunder - b.blunder) <= 1.5, Math.abs(a.mistake - b.mistake) <= 1.5, Math.abs(a.inacc - b.inacc) <= 1.5)} |`);
  }
}

// 2. Form.
const form = rows('form').filter((r) => r.profile);
if (form.length) {
  console.log('\n**Good days and bad days: plain bots with form vs without** (B / M / I per 100 moves; ±1.5)\n');
  console.log('| Bot | games / moves | before (no form) | after (form) | Δ | ± (run-to-run SE) | within ±1.5 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const [label, rs] of groupBy(form, (r) => r.label)) {
    const ps = rs.map((r) => r.profile);
    const a = merge(ps)!;
    const b = base.get(rs[0].elo);
    if (!b) continue;
    console.log(`| ${rs[0].elo} | ${a.games} / ${a.moves} | ${b.blunder} / ${b.mistake} / ${b.inacc} | ${a.blunder} / ${a.mistake} / ${a.inacc} | ${d(a.blunder, b.blunder)} / ${d(a.mistake, b.mistake)} / ${d(a.inacc, b.inacc)} | ${se(ps, 'blunder')} / ${se(ps, 'mistake')} / ${se(ps, 'inacc')} | ${ok(Math.abs(a.blunder - b.blunder) <= 1.5, Math.abs(a.mistake - b.mistake) <= 1.5, Math.abs(a.inacc - b.inacc) <= 1.5)} |`);
  }
}

// 3. Openings.
const humans = rows('humans');
const hOpen = new Map(humans.filter((h) => h.kind === 'opening').map((h) => [h.band, h]));
const open = rows('open');
const openBefore = rows('open-before');
if (open.length || openBefore.length) {
  console.log('\n**Openings, plies 1–20** (early queen by move 6 %, castled by move 10 %, theory share of plies 1–12 %, first ply out of theory; ±5 points, ±0.5 ply)\n');
  console.log('| Bot | people (band, games) | before | after | within |');
  console.log('|---|---|---|---|---|');
  const f = (o?: { earlyQueen: number; castled: number; theory: number; leave: number }) => (o ? `${o.earlyQueen} / ${o.castled} / ${o.theory} / ${o.leave}` : '–');
  for (const [id, elo] of [['lily', 200], ['tom', 400], ['maya', 600], ['jonas', 800]] as const) {
    const band = bandOf(elo + 1)!.label;
    const h = hOpen.get(band);
    const bef = openBefore.find((r) => r.label === id);
    const on = open.find((r) => r.spec?.id === id && !r.spec.types)?.opening;
    const within = h && on ? ok(...(['earlyQueen', 'castled', 'theory'] as const).map((k) => Math.abs(on[k] - h[k]) <= 5), Math.abs(on.leave - h.leave) <= 0.5) : '–';
    console.log(`| ${id[0].toUpperCase() + id.slice(1)} (${elo}) | ${f(h)} (${band}, ${h?.games ?? 0}) | ${f(bef)} | ${f(on)} | ${within} |`);
  }
}

// 4. Think time per time control and band, and 5. games lost on time.
const hTime = new Map(humans.filter((h) => h.kind === 'time').map((h) => [`${h.tc}|${h.band}`, h]));
const time = rows('time');
const timeBefore = new Map(rows('time-before').map((r) => [`${r.tc}|${r.band}`, r]));
if (time.length) {
  console.log('\n**Think time by time control** (seconds per move opening / middlegame / endgame, quick moves ≤ 2 s %, clock left at the end %; targets ±20% per phase, ±10 points left)\n');
  console.log('| TC | band | people (games) | before | after | within |');
  console.log('|---|---|---|---|---|---|');
  const f = (t?: { opening: number; middlegame: number; endgame: number; quick: number; left: number }) => (t ? `${t.opening} / ${t.middlegame} / ${t.endgame} · ${t.quick}% · ${t.left}%` : '–');
  for (const tc of ['180+2', '300+0', '600+0', '900+10', '1800+0'])
    for (const b of BANDS) {
      const a = time.find((r) => r.tc === tc && r.band === b.label);
      if (!a) continue;
      const h = hTime.get(`${tc}|${b.label}`);
      const within = h && h.games >= 10 ? ok(...(['opening', 'middlegame', 'endgame'] as const).map((k) => Math.abs(a[k] / h[k] - 1) <= 0.2), Math.abs(a.left - h.left) <= 10) : 'few games';
      console.log(`| ${tc} | ${b.label} | ${f(h)} (${h?.games ?? 0}) | ${f(timeBefore.get(`${tc}|${b.label}`))} | ${f(a)} | ${within} |`);
    }
  console.log('\n**Games lost on time** (share of games, %; ±3 points)\n');
  console.log('| band | 10+0 people | before | after | 5+0 people | before | after | within |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const b of BANDS) {
    const cell = (tc: string) => [hTime.get(`${tc}|${b.label}`), timeBefore.get(`${tc}|${b.label}`), time.find((r) => r.tc === tc && r.band === b.label)];
    const [h10, b10, a10] = cell('600+0');
    const [h5, b5, a5] = cell('300+0');
    if (!a10 && !a5) continue;
    const within = h10 && a10 && h5 && a5 ? ok(Math.abs(a10.timeouts - h10.timeouts) <= 3, Math.abs(a5.timeouts - h5.timeouts) <= 3) : '–';
    console.log(`| ${b.label} | ${h10?.timeouts ?? '–'} | ${b10?.timeouts ?? '–'} | ${a10?.timeouts ?? '–'} | ${h5?.timeouts ?? '–'} | ${b5?.timeouts ?? '–'} | ${a5?.timeouts ?? '–'} | ${within} |`);
  }
}
// 6. How games end: resignations and game length (--ends-humans humanends.mts, --ends-before /
//    --ends-after thinkfit.mts ends --resign).
const eh = new Map(rows('ends-humans').map((r) => [r.band, r]));
const eb = new Map(rows('ends-before').map((r) => [r.band, r]));
const ea = rows('ends-after');
if (ea.length) {
  console.log('\n**How games end** (share ending in resignation %, game length in plies, and at resignation the resigner\'s material and engine evaluation; people: all five time controls; bots: self-play replays at 10+0)\n');
  console.log('| band | games (people / bots) | resigned % people / before / after | plies people / before / after | material at resignation people / after | eval at resignation people / after |');
  console.log('|---|---|---|---|---|---|');
  const f = (x: unknown) => (x === null || x === undefined ? '–' : String(x));
  for (const a of ea) {
    const h = eh.get(a.band);
    const b = eb.get(a.band);
    if (!h) continue;
    console.log(`| ${a.band} | ${h.games} / ${a.games} | ${h.resigned} / ${f(b?.resigned)} / ${a.resigned} | ${h.plies} / ${f(b?.plies)} / ${a.plies} | ${f(h.resignMaterial)} / ${f(a.resignMaterial)} | ${f(h.resignEval)} / ${f(a.resignEval)} |`);
  }
}
process.exit(0);
