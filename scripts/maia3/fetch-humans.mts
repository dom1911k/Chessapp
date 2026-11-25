// Builds a public human sample for the bot-vs-human benchmark: random players from chess.com's
// public country lists and their recent games, bucketed by rating band and time control.
// Writes one JSON line per game ({ url, pgn, tc, whiteRating, blackRating, whiteResult,
// blackResult }) to <out>; tc is "base+inc" in seconds ("600+0").
// The games are other people's: keep the file local (scratch), never commit it.
// Usage: npx tsx scripts/maia3/fetch-humans.mts <out.jsonl> [gamesPerBand=60] [countries=NZ,IE,ZA,SG,CA,AU] [tcs=600+0]
//   e.g. tcs=180+2,300+0,600+0,900+10,1800+0 fills every time control in one pass over the players.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { BANDS, bandOf } from '../../src/lib/benchmark/bands.ts';

const [out, perS, countriesS, tcsS] = process.argv.slice(2);
const per = Number(perS ?? 60);
const countries = (countriesS ?? 'NZ,IE,ZA,SG,CA,AU').split(',');
const TCS = (tcsS ?? '600+0').split(',');
/** chess.com's time_control ("600", "180+2") as "base+inc". */
const tcOf = (t: string) => (t.includes('+') ? t : `${t}+0`);
const UA = { 'User-Agent': 'chess-coach-calibration-script' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(url: string): Promise<any> {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!r.ok) return null;
    await sleep(150);
    return r.json();
  }
  return null;
}

const key = (tc: string, band: string) => `${tc}|${band}`;
const have = new Map<string, number>(TCS.flatMap((tc) => BANDS.map((b) => [key(tc, b.label), 0] as [string, number])));
const seen = new Set<string>();
if (existsSync(out))
  for (const l of readFileSync(out, 'utf8').split('\n').filter(Boolean)) {
    const g = JSON.parse(l);
    seen.add(g.url);
    const b = bandOf((g.whiteRating + g.blackRating) / 2);
    const k = b && key(g.tc ?? '600+0', b.label);
    if (k && have.has(k)) have.set(k, have.get(k)! + 1);
  }
const full = () => [...have.values()].every((n) => n >= per);
const summary = () => Object.fromEntries(TCS.map((tc) => [tc, BANDS.map((b) => have.get(key(tc, b.label))).join(' ')]));

let names: string[] = [];
for (const c of countries) names.push(...((await get(`https://api.chess.com/pub/country/${c}/players`))?.players ?? []));
names = names.sort(() => Math.random() - 0.5);
console.log(`${names.length} names; have`, summary());

let checked = 0;
for (const u of names) {
  if (full()) break;
  checked++;
  const arch: string[] = (await get(`https://api.chess.com/pub/player/${u}/games/archives`))?.archives ?? [];
  for (const a of arch.slice(-2).reverse()) {
    const gs = (await get(a))?.games ?? [];
    let took = 0;
    for (const g of gs) {
      if (g.rules !== 'chess' || !g.pgn || seen.has(g.url)) continue;
      const tc = tcOf(String(g.time_control));
      if (!TCS.includes(tc)) continue;
      const gb = bandOf((g.white.rating + g.black.rating) / 2);
      // Both players near the band, so every move in the game belongs to it.
      if (!gb || have.get(key(tc, gb.label))! >= per || Math.abs(g.white.rating - g.black.rating) > 150) continue;
      if (!/\[%clk /.test(g.pgn)) continue;
      seen.add(g.url);
      appendFileSync(out, JSON.stringify({ url: g.url, pgn: g.pgn, tc, whiteRating: g.white.rating, blackRating: g.black.rating, whiteResult: g.white.result, blackResult: g.black.result }) + '\n');
      have.set(key(tc, gb.label), have.get(key(tc, gb.label))! + 1);
      if (++took >= 6) break;
    }
    if (took) break;
  }
  if (checked % 50 === 0) console.log(checked, summary());
}
console.log('done', summary());
