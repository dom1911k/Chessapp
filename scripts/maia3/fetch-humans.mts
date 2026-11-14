// Builds a public human sample for the bot-vs-human benchmark: random players from chess.com's
// public country lists, bucketed by their rapid rating, and their recent 10+0 rapid games.
// Writes one JSON line per game ({ pgn, white, black, whiteRating, blackRating }) to <out>.
// The games are other people's: keep the file local (scratch), never commit it.
// Usage: npx tsx scripts/maia3/fetch-humans.mts <out.jsonl> [gamesPerBand=60] [countries=NZ,IE,ZA,SG,CA,AU]
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { BANDS, bandOf } from '../../src/lib/benchmark/bands.ts';

const [out, perS, countriesS] = process.argv.slice(2);
const per = Number(perS ?? 60);
const countries = (countriesS ?? 'NZ,IE,ZA,SG,CA,AU').split(',');
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

const have = new Map<string, number>(BANDS.map((b) => [b.label, 0]));
const seen = new Set<string>();
if (existsSync(out))
  for (const l of readFileSync(out, 'utf8').split('\n').filter(Boolean)) {
    const g = JSON.parse(l);
    seen.add(g.url);
    const b = bandOf((g.whiteRating + g.blackRating) / 2);
    if (b) have.set(b.label, have.get(b.label)! + 1);
  }
const full = () => [...have.values()].every((n) => n >= per);

let names: string[] = [];
for (const c of countries) names.push(...((await get(`https://api.chess.com/pub/country/${c}/players`))?.players ?? []));
names = names.sort(() => Math.random() - 0.5);
console.log(`${names.length} names; have`, Object.fromEntries(have));

let checked = 0;
for (const u of names) {
  if (full()) break;
  checked++;
  const st = await get(`https://api.chess.com/pub/player/${u}/stats`);
  const r = st?.chess_rapid?.last?.rating;
  const b = r ? bandOf(r) : null;
  if (!b || have.get(b.label)! >= per) continue;
  const arch: string[] = (await get(`https://api.chess.com/pub/player/${u}/games/archives`))?.archives ?? [];
  for (const a of arch.slice(-2).reverse()) {
    const gs = (await get(a))?.games ?? [];
    let took = 0;
    for (const g of gs) {
      if (g.time_class !== 'rapid' || g.time_control !== '600' || g.rules !== 'chess' || !g.pgn || seen.has(g.url)) continue;
      const avg = (g.white.rating + g.black.rating) / 2;
      const gb = bandOf(avg);
      // Both players near the band, so every move in the game belongs to it.
      if (!gb || have.get(gb.label)! >= per || Math.abs(g.white.rating - g.black.rating) > 150) continue;
      if (!/\[%clk /.test(g.pgn)) continue;
      seen.add(g.url);
      appendFileSync(out, JSON.stringify({ url: g.url, pgn: g.pgn, whiteRating: g.white.rating, blackRating: g.black.rating }) + '\n');
      have.set(gb.label, have.get(gb.label)! + 1);
      if (++took >= 6) break;
    }
    if (took) break;
  }
  if (checked % 50 === 0) console.log(checked, Object.fromEntries(have));
}
console.log('done', Object.fromEntries(have));
