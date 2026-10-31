#!/usr/bin/env node
// Builds the starting positions for Run mode's Convert, Hold and Boss rooms from the bundled
// puzzle set, sorted by Stockfish's evaluation. Run once; the output is committed.
//
//   node scripts/build-run-positions.mjs
//
// Output: src/run/data/positions.json  { convert: Pos[], hold: Pos[], boss: Pos[] }
//   Pos = [fen, evalCp]   (eval from the side to move = the player's side)
//
// convert: the position after a puzzle's solution, after the opponent's best reply: you are
//          +2..+6 and it is your move (and not mate in 1).
// hold:    the puzzle position *before* the losing side's mistake, played from that side:
//          you are slightly worse (-0.6..-1.5) and must not blunder.
// boss:    balanced middlegames (|eval| <= 0.6, at least 18 pieces) from puzzle positions.
// ward:    "only move" positions: the side to move faces a threat and only one move (or a few
//          moves within 0.5 of it) keeps the balance; everything else loses 2+ pawns.
//          Pos = [fen, evalCp, acceptedMoves[]]
//
//   node scripts/build-run-positions.mjs --only ward    # rebuild one kind, keep the others
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PER_KIND = 48;
const DEPTH = 13;

// --- tiny UCI wrapper around the stockfish npm package (same build the app uses) ---
const listeners = [];
const pending = [];
let sf = null;
const loader = require('stockfish');
Promise.resolve(loader('lite-single', (l) => listeners.forEach((f) => f(l)))).then((e) => {
  sf = e;
  for (const c of pending) sf.processCommand(c);
});
const send = (c) => (sf ? sf.processCommand(c) : pending.push(c));

function evaluate(fen, multipv = 1) {
  return new Promise((resolve) => {
    const lines = [];
    const f = (line) => {
      const m = line.match(/ score (cp|mate) (-?\d+)/);
      const k = Number(line.match(/ multipv (\d+)/)?.[1] ?? 1);
      if (m && line.includes(' pv ')) lines[k - 1] = { type: m[1], value: Number(m[2]), best: line.split(' pv ')[1].split(' ')[0] };
      if (line.startsWith('bestmove')) {
        listeners.splice(listeners.indexOf(f), 1);
        const top = lines[0] ?? { type: 'cp', value: 0, best: line.split(' ')[1] };
        resolve({ ...top, lines: lines.filter(Boolean) });
      }
    };
    listeners.push(f);
    send(`setoption name MultiPV value ${multipv}`);
    send(`position fen ${fen}`);
    send(`go depth ${DEPTH}`);
  });
}

// Seeded shuffle so re-running gives the same file.
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const files = ['r600', 'r800', 'r1000', 'r1200', 'r1400', 'r1600'];
const puzzles = shuffle(files.flatMap((f) => JSON.parse(readFileSync(join(root, 'public/puzzles', `${f}.json`), 'utf8'))));
const pieces = (fen) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
const cp = (s) => (s.type === 'mate' ? (s.value > 0 ? 10000 : -10000) : s.value);

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const outFile = join(root, 'src/run/data/positions.json');
let prev = {};
try {
  prev = JSON.parse(readFileSync(outFile, 'utf8'));
} catch {
  /* first build */
}
const out = { convert: [], hold: [], boss: [], ward: [] };
// With --only, the other kinds are kept as they are.
if (only) for (const k of Object.keys(out)) if (k !== only) out[k] = prev[k] ?? [];
const full = () => Object.values(out).every((l) => l.length >= PER_KIND);
let checked = 0;

send('uci');
send('setoption name Hash value 32');
for (const [, fen, moves, , themes] of puzzles) {
  if (full()) break;
  const mv = moves.split(' ');
  const t = themes.split(' ');
  checked++;

  // Ward: an only-move defence (the puzzle's victim to move, before their mistake).
  if (out.ward.length < PER_KIND && (!only || only === 'ward')) {
    const c = new Chess(fen);
    if (!c.isCheck() && pieces(fen) >= 10 && c.moves().length >= 8) {
      const s = await evaluate(fen, 4);
      const ls = s.lines;
      if (ls.length >= 3 && ls[0].type === 'cp' && ls[0].value >= -200 && ls[0].value <= 250) {
        const top = cp(ls[0]);
        const accept = ls.filter((l) => top - cp(l) <= 50).map((l) => l.best);
        const rest = ls.filter((l) => top - cp(l) > 50);
        if (accept.length <= 2 && rest.length && rest.every((l) => top - cp(l) >= 200)) out.ward.push([fen, top, accept]);
      }
    }
    if (only) continue;
  }

  // Hold + boss both start from the puzzle's FEN (side to move is about to go wrong).
  if (out.hold.length < PER_KIND || (out.boss.length < PER_KIND && t.includes('middlegame'))) {
    const c = new Chess(fen);
    if (!c.isCheck() && pieces(fen) >= 14) {
      const s = await evaluate(fen);
      const v = cp(s);
      if (out.hold.length < PER_KIND && v <= -60 && v >= -150 && s.type === 'cp') out.hold.push([fen, v]);
      else if (out.boss.length < PER_KIND && Math.abs(v) <= 60 && s.type === 'cp' && pieces(fen) >= 18 && t.includes('middlegame')) out.boss.push([fen, v]);
    }
  }

  // Convert: play setup + full solution, then the opponent's best reply.
  if (out.convert.length < PER_KIND && !t.includes('mate') && !t.includes('endgame')) {
    const c = new Chess(fen);
    try {
      for (const u of mv) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      continue;
    }
    if (c.isGameOver()) continue;
    const r = await evaluate(c.fen());
    if (!r.best || r.best === '(none)') continue;
    c.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] });
    if (c.isGameOver() || pieces(c.fen()) < 8) continue;
    const s = await evaluate(c.fen());
    const v = cp(s);
    if (s.type === 'cp' && v >= 200 && v <= 600) out.convert.push([c.fen(), v]);
  }
  if (checked % 50 === 0) console.log(checked, Object.fromEntries(Object.entries(out).map(([k, l]) => [k, l.length])));
}

mkdirSync(join(root, 'src/run/data'), { recursive: true });
writeFileSync(outFile, JSON.stringify(out));
console.log('done after', checked, 'puzzles:', Object.fromEntries(Object.entries(out).map(([k, l]) => [k, l.length])));
process.exit(0);
