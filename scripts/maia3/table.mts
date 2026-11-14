// Merges human (humans.mts) and bot (profile.mts) profiles into src/lib/benchmark/baseline.json
// (only aggregates: no games or names) and prints the bot-vs-human table as Markdown.
// Usage: npx tsx scripts/maia3/table.mts <humans.jsonl> <bots.jsonl> [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { benchTable, type BotRow, type HumanRow } from '../../src/lib/benchmark/table.ts';
import { CCMAP } from '../../src/lib/games/ccmap.ts';
import { maia3SelfElo } from '../../src/lib/maia/index.ts';

const [hf, bf, flag] = process.argv.slice(2);
const lines = (f: string) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
// Latest result wins per band / label.
const humans = [...new Map(lines(hf).map((h) => [h.band, h])).values()] as HumanRow[];
const bots = [...new Map(lines(bf).map((b) => [b.P.elo, { ...b, label: b.P.elo }])).values()].map(({ who: _w, P: _p, ...b }) => b) as BotRow[];
const rows = benchTable(humans, bots, CCMAP.priorOffset);
const t = (p?: HumanRow | BotRow) => (p?.think ? `${p.think.opening}/${p.think.middlegame}/${p.think.endgame}` : '–');
console.log('| chess.com band | games / moves | blunder % | mistake % | hung/threat/random % | think O/M/E s | <2 s % | bot (SelfElo) | blunder % | mistake % | hung/threat/random % | think O/M/E s | <2 s % |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const h = r.human, b = r.bot;
  const kinds = (p?: HumanRow | BotRow) => (p ? `${Math.round(p.ofBlunders.hung)}/${Math.round(p.ofBlunders.threat)}/${Math.round(p.ofBlunders.randomLooking)}` : '–');
  console.log(`| ${r.band} | ${h ? `${h.games} / ${h.moves}` : '–'} | ${h?.blunder ?? '–'} | ${h?.mistake ?? '–'} | ${kinds(h)} | ${t(h)} | ${h?.think?.fast ?? '–'} | ${b ? `${b.label} (${Math.round(maia3SelfElo(b.label))})` : '–'} | ${b?.blunder ?? '–'} | ${b?.mistake ?? '–'} | ${kinds(b)} | ${t(b)} | ${b?.think?.fast ?? '–'} |`);
}
if (flag === '--write') {
  writeFileSync('src/lib/benchmark/baseline.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), note: 'Humans: public chess.com 10+0 rapid sample (both players within 150 of each other). Bots: self-play on a simulated 10+0 clock.', humans, bots }, null, 1) + '\n');
  console.log('wrote src/lib/benchmark/baseline.json');
}
process.exit(0);
