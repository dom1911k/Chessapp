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

function evaluate(fen) {
  return new Promise((resolve) => {
    let last = null;
    const f = (line) => {
      const m = line.match(/ score (cp|mate) (-?\d+)/);
      if (m && line.includes(' pv ')) last = { type: m[1], value: Number(m[2]), best: line.split(' pv ')[1].split(' ')[0] };
      if (line.startsWith('bestmove')) {
        listeners.splice(listeners.indexOf(f), 1);
        resolve(last ?? { type: 'cp', value: 0, best: line.split(' ')[1] });
      }
    };
    listeners.push(f);
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

const out = { convert: [], hold: [], boss: [] };
const full = () => Object.values(out).every((l) => l.length >= PER_KIND);
let checked = 0;

send('uci');
send('setoption name Hash value 32');
for (const [, fen, moves, , themes] of puzzles) {
  if (full()) break;
  const mv = moves.split(' ');
  const t = themes.split(' ');
  checked++;

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
writeFileSync(join(root, 'src/run/data/positions.json'), JSON.stringify(out));
console.log('done after', checked, 'puzzles:', Object.fromEntries(Object.entries(out).map(([k, l]) => [k, l.length])));
process.exit(0);
