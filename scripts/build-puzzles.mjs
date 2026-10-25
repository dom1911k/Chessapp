#!/usr/bin/env node
// Builds the bundled puzzle set from the Lichess puzzle database (CC0).
//
//   npm run puzzles                      # downloads lichess_db_puzzle.csv.zst (~300 MB)
//   npm run puzzles -- --input file.zst  # use an already downloaded file (.csv or .csv.zst)
//   npm run puzzles -- --count 20000 --min 600 --max 1800
//
// Output: public/puzzles/index.json + one JSON shard per rating band.
// Selection is balanced across training themes and rating bands, and seeded,
// so re-running on the same input gives the same result.
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Decompress } from 'fzstd';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_DB = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const COUNT = Number(args.count ?? 20000);
const MIN = Number(args.min ?? 600);
const MAX = Number(args.max ?? 1800);
const BAND = 200;
const OUT = join(root, args.out ?? 'public/puzzles');
const SEED = Number(args.seed ?? 42);

// Training themes we balance across (Lichess theme names).
const TRAINING_THEMES = [
  'mateIn1', 'mateIn2', 'fork', 'pin', 'skewer', 'discoveredAttack', 'backRankMate', 'hangingPiece',
  'endgame', 'trappedPiece', 'attackingF2F7', 'promotion', 'defensiveMove', 'deflection', 'doubleCheck', 'kingsideAttack',
];
// Themes that don't help a learner and only cost bytes.
const DROP_THEMES = new Set(['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'mix', 'playerGames']);

// Small seeded PRNG (mulberry32).
let s = SEED >>> 0;
const rand = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const bands = [];
for (let b = MIN; b < MAX; b += BAND) bands.push(b);
const perBucket = Math.ceil(COUNT / (bands.length * TRAINING_THEMES.length));

/** Reservoirs keyed by `${theme}|${band}` plus a general pool per band. */
const reservoirs = new Map();
const seen = new Map();
function offer(key, cap, item) {
  let r = reservoirs.get(key);
  if (!r) reservoirs.set(key, (r = []));
  const n = (seen.get(key) ?? 0) + 1;
  seen.set(key, n);
  if (r.length < cap) r.push(item);
  else {
    const j = Math.floor(rand() * n);
    if (j < cap) r[j] = item;
  }
}

let total = 0;
let kept = 0;
function handleLine(line) {
  if (!line || line.startsWith('PuzzleId')) return;
  total++;
  const f = line.split(',');
  const [id, fen, moves, rating, rd, popularity, plays, themes] = f;
  const r = Number(rating);
  if (r < MIN || r >= MAX) return;
  if (Number(rd) > 90 || Number(popularity) < 80 || Number(plays) < 300) return;
  const mv = moves.split(' ');
  if (mv.length > 8) return; // at most 4 moves for the solver: beginner friendly
  const th = themes.split(' ').filter((t) => t && !DROP_THEMES.has(t));
  kept++;
  const band = Math.floor((r - MIN) / BAND) * BAND + MIN;
  const item = [id, fen, moves, r, th.join(' ')];
  for (const t of th) if (TRAINING_THEMES.includes(t)) offer(`${t}|${band}`, perBucket, item);
  offer(`*|${band}`, Math.ceil(COUNT / bands.length), item);
}

async function* lines(stream) {
  let buf = '';
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    buf += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      yield buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
    }
  }
  if (buf) yield buf;
}

/** Wraps a byte stream with streaming zstd decompression. */
function zstdStream(input) {
  return Readable.from(
    (async function* () {
      const out = [];
      const d = new Decompress((chunk) => out.push(chunk));
      for await (const chunk of input) {
        d.push(new Uint8Array(chunk));
        while (out.length) yield out.shift();
      }
      d.push(new Uint8Array(0), true);
      while (out.length) yield out.shift();
    })(),
  );
}

async function openInput() {
  let path = args.input;
  if (!path) {
    const cacheDir = join(root, '.cache');
    mkdirSync(cacheDir, { recursive: true });
    path = join(cacheDir, 'lichess_db_puzzle.csv.zst');
    if (!existsSync(path)) {
      console.log(`Downloading ${URL_DB} …`);
      const res = await fetch(URL_DB);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
    }
  }
  console.log(`Reading ${path}`);
  const raw = createReadStream(path, { highWaterMark: 1 << 20 });
  return path.endsWith('.zst') ? zstdStream(raw) : raw;
}

const started = Date.now();
const input = await openInput();
for await (const line of lines(input)) {
  handleLine(line);
  if (total % 1_000_000 === 0) console.log(`  ${total.toLocaleString()} puzzles scanned, ${kept.toLocaleString()} eligible`);
}

// Assemble: theme buckets first (balanced), then top up each band from its general pool.
const chosen = new Map();
const perBand = Math.floor(COUNT / bands.length);
for (const band of bands) {
  const bandItems = new Map();
  for (const t of TRAINING_THEMES) for (const it of reservoirs.get(`${t}|${band}`) ?? []) bandItems.set(it[0], it);
  let list = [...bandItems.values()];
  // Shuffle so trimming doesn't favour any theme, then trim to the band quota.
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  list = list.slice(0, perBand);
  const have = new Set(list.map((x) => x[0]));
  for (const it of reservoirs.get(`*|${band}`) ?? []) {
    if (list.length >= perBand) break;
    if (!have.has(it[0])) list.push(it);
  }
  chosen.set(band, list.sort((a, b) => a[3] - b[3]));
}

if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(join(OUT, f));
mkdirSync(OUT, { recursive: true });
const index = { source: 'Lichess puzzle database (CC0) — https://database.lichess.org/#puzzles', built: new Date().toISOString().slice(0, 10), total: 0, bands: [] };
for (const [band, list] of chosen) {
  const file = `r${band}.json`;
  writeFileSync(join(OUT, file), JSON.stringify(list));
  const themes = {};
  for (const it of list) for (const t of it[4].split(' ')) if (t) themes[t] = (themes[t] ?? 0) + 1;
  index.bands.push({ min: band, max: band + BAND, file, count: list.length, themes });
  index.total += list.length;
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(0)}s: scanned ${total.toLocaleString()}, eligible ${kept.toLocaleString()}, wrote ${index.total} puzzles to ${OUT}`);
