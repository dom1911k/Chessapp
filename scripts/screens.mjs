#!/usr/bin/env node
// Screenshot harness (dev tooling): drives the app in Chromium and saves the screens that matter
// into .cache/screens/<label>/, at phone and tablet sizes, in dark and light.
//
//   npm run screens                     # label "latest", all sizes, both themes, every scenario
//   npm run screens -- before           # label "before"
//   npm run screens -- after --only=coached,review --sizes=390x844 --schemes=dark
//   npm run screens -- pre --seed=7 --sizes=390x844 --schemes=dark   # repeatable, for refactors
//   SCREENS_URL=http://localhost:5173 npm run screens   # use a dev server that's already running
//
// Scenarios: home, coached (versus intro, start, 1.e4, a selected piece, 2.Qh5, the pre-check,
// the coached mistake, game over, the board after the results, the ⋯ sheet), review (summary and a
// step), match (clocks: start, mid-game, low time, a premove, a flag), puzzle (hint, solution),
// rated (the Puzzle Path card, and after a solve's tally),
// promotion (Analysis), settings, collection, tabs (Puzzles, Learn, More, Cups).
// Puzzle path QA (opt-in, slow: --only=path, or by name): tally, levelup, tierup, moments, fail,
// warmup, prompts, hint, pathscreen, worlds, howpoints, hub, dailytally, rush. They put the path
// where they need it with the dev-only window.__path setter.
//
// Polish round 3 QA (opt-in: --only=polish3, or by name): versus-stamp, versus-handoff, end-badges,
// over-win-mid, over-win-levelup, over-loss-end, review-reveal-mid, review-reveal-end, step-brilliant,
// step-blunder, tabs-mid, push-mid, sheet-open, home-delta, path-hedges (frames caught mid-flight).
//
// Gotcha: the app is driven through dev-only store imports (/src/lib/store/play.ts, nav.ts,
// settings.ts). After editing files, restart the dev server: HMR adds ?t= to module URLs and the
// imports then return a different store instance than the app's.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const label = args.find((x) => !x.startsWith('--')) ?? 'latest';
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const SIZES = opt('sizes', '360x740,390x844,1280x800').split(',').map((s) => s.split('x').map(Number));
const SCHEMES = opt('schemes', 'dark,light').split(',');
// --seed=N makes Math.random repeatable in the page (bot moves, puzzle picks), so two runs of the
// same code can be compared pixel for pixel (e.g. before and after a refactor).
const SEED = opt('seed', '');
const PORT = Number(opt('port', '5181'));
const OUT = join(process.cwd(), '.cache', 'screens', label);
const want = (k) => !ONLY || ONLY.includes(k);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm install (it is a devDependency).');
  process.exit(1);
}
try {
  const b = await chromium.launch();
  await b.close();
} catch (e) {
  console.error(`Chromium is not available for Playwright (${String(e.message).split('\n')[0]}).\nInstall it with: npx playwright install chromium`);
  process.exit(1);
}

// ---- Dev server ----
let server = null;
const BASE = process.env.SCREENS_URL ?? `http://localhost:${PORT}`;
const up = async () => fetch(BASE).then((r) => r.ok).catch(() => false);
if (!process.env.SCREENS_URL) {
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: process.platform !== 'win32' });
  for (let i = 0; i < 120 && !(await up()); i++) await sleep(500);
  if (!(await up())) fail(`The dev server did not start on ${BASE}.`);
}
const stop = () => {
  if (!server) return;
  try {
    process.kill(-server.pid);
  } catch {
    server.kill();
  }
};
process.on('exit', stop);
process.on('SIGINT', () => (stop(), process.exit(130)));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function fail(msg) {
  console.error(msg);
  stop();
  process.exit(1);
}

// ---- Helpers (run in the page) ----
const store = (p) =>
  p.evaluate(async () => {
    const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n) && !x.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
    window.__play = (await import(find('/src/lib/store/play.ts'))).usePlay;
    window.__nav = (await import(find('/src/lib/nav.ts'))).useNav;
    window.__settings = (await import(find('/src/lib/settings.ts'))).useSettings;
  });
const phase = async (p) => {
  if (!(await p.evaluate(() => !!window.__play))) await store(p);
  return p.evaluate(() => ({ phase: window.__play.getState().phase, pre: !!window.__play.getState().precheck }));
};
async function waitFor(p, phases, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await phase(p);
    if (phases.includes(s.phase) || (phases.includes('precheck') && s.pre)) return s;
    await p.waitForTimeout(250);
  }
  throw new Error(`timed out waiting for ${phases.join('/')}`);
}
const move = (p, from, to) => p.evaluate(([from, to]) => window.__play.getState().userMove({ from, to }), [from, to]);
const legal = (p, from, to) =>
  p.evaluate(([from, to]) => {
    const g = window.__play.getState().game;
    if (!g) return false;
    const fen = g.plies.length ? g.plies[g.plies.length - 1].fenAfter : g.startFen;
    const rows = fen.split(' ')[0].split('/');
    const at = (sq) => {
      const f = sq.charCodeAt(0) - 97;
      let c = 0;
      for (const ch of rows[8 - Number(sq[1])]) {
        if (/\d/.test(ch)) c += Number(ch);
        else if (c++ === f) return ch;
      }
      return null;
    };
    // Cheap pre-filter: a piece of ours on `from`, nothing of ours on `to` (the store validates the rest).
    const mine = (ch) => ch && (g.userColor === 'w' ? ch === ch.toUpperCase() : ch === ch.toLowerCase());
    return mine(at(from)) && !mine(at(to));
  }, [from, to]);
async function tap(p, sq, orientation = 'white') {
  const box = await p.evaluate(() => {
    const el = [...document.querySelectorAll('div.touch-none.select-none')].filter((e) => e.getBoundingClientRect().width > 200 && e.offsetParent).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width };
  });
  const f = sq.charCodeAt(0) - 97;
  const rk = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - rk : rk;
  await p.mouse.click(box.x + ((col + 0.5) * box.w) / 8, box.y + ((row + 0.5) * box.w) / 8);
}
async function skipReveal(p) {
  await p.waitForTimeout(2500);
  const t = p.locator('text=Tap to skip');
  if (await t.count()) await t.first().click().catch(() => {});
  await p.waitForTimeout(1500);
}

// Vite optimises dependencies the first time each part of the app loads, and reloads the page
// when it does: walk through a game, a puzzle and Analysis once so that settles before the run.
{
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(BASE);
  await p.waitForTimeout(6000);
  await p.reload();
  await p.waitForTimeout(3000);
  try {
    const skip = p.locator('button:has-text("Skip")');
    if (await skip.count()) await skip.first().click();
    await store(p);
    await p.getByRole('button', { name: 'Play', exact: true }).click();
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn'], 60000);
    await p.evaluate(() => window.__play.getState().abandon?.());
    for (const sc of [{ name: 'puzzle', mode: { kind: 'learn' } }, { name: 'explore', fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', orientation: 'white', title: 'Analysis' }, { name: 'collection' }]) {
      await store(p);
      await p.evaluate((sc) => window.__nav.getState().push(sc), sc);
      await p.waitForTimeout(2500);
    }
  } catch {
    /* a reload during the warm-up is exactly what it is for */
  }
  await p.waitForTimeout(2000);
  await b.close();
}

// ---- One run: a fresh profile at one size and theme ----
async function run([W, H], scheme) {
  const tag = `${W}x${H}-${scheme}`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: W < 700, hasTouch: true, colorScheme: scheme });
  if (SEED)
    await ctx.addInitScript((seed) => {
      let a = Number(seed) >>> 0 || 1;
      Math.random = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, SEED);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const shot = async (name) => {
    // A page wider than the screen can be panned sideways on a phone (and a later scrollIntoView
    // shifts every screen after it): report it like a page error.
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (wide > 0) errors.push(`${name}: page ${wide}px wider than the screen`);
    await p.screenshot({ path: join(OUT, `${tag}-${name}.png`) });
    process.stdout.write('.');
  };
  const push = (sc) => p.evaluate((sc) => window.__nav.getState().push(sc), sc);
  const home = () => p.evaluate(() => window.__nav.getState().setTab('play'));

  await p.goto(BASE);
  await p.waitForTimeout(3500);
  const skip = p.locator('button:has-text("Skip")');
  if (await skip.count()) {
    await skip.first().click();
    await p.waitForTimeout(500);
  }
  await store(p);
  await p.evaluate((scheme) => window.__settings.getState().set({ theme: scheme, coachStyle: 'detailed', matchMode: false }), scheme);
  await p.waitForTimeout(600);

  if (want('home')) await shot('home');

  let gameId = 0;
  let blunderPly = -1;
  if (want('coached') || want('review')) {
    await p.getByRole('button', { name: 'Play', exact: true }).click();
    await p.waitForTimeout(700);
    if (want('coached')) await shot('versus');
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn']);
    await p.waitForTimeout(600);
    if (want('coached')) await shot('coached-start');
    await move(p, 'e2', 'e4');
    let s = await waitFor(p, ['userTurn', 'paused']);
    if (s.phase === 'paused') {
      await p.evaluate(() => window.__play.getState().continueGame());
      await waitFor(p, ['userTurn']);
    }
    await p.waitForTimeout(500);
    if (want('coached')) await shot('coached-e4');
    await tap(p, 'g1');
    await p.waitForTimeout(350);
    if (want('coached')) await shot('coached-selected');
    await tap(p, 'g1');
    await move(p, 'd1', 'h5');
    s = await waitFor(p, ['userTurn', 'paused', 'precheck']);
    if (s.pre) {
      await p.evaluate(() => window.__play.getState().confirmPrecheck());
      s = await waitFor(p, ['userTurn', 'paused']);
    }
    await p.waitForTimeout(800);
    if (want('coached')) await shot('coached-qh5');
    if (s.phase === 'paused') {
      await p.evaluate(() => window.__play.getState().continueGame());
      await waitFor(p, ['userTurn']);
    }
    for (const [f, t] of [['h5', 'h6'], ['h5', 'f7'], ['h5', 'g6'], ['h5', 'h7'], ['h5', 'g5'], ['h5', 'e5']]) {
      if (!(await legal(p, f, t))) continue;
      if (await move(p, f, t)) break;
      if ((await phase(p)).pre) break;
    }
    s = await waitFor(p, ['userTurn', 'paused', 'precheck', 'over']);
    if (s.pre) {
      await p.waitForTimeout(500);
      if (want('coached')) await shot('coached-precheck');
      await p.evaluate(() => window.__play.getState().confirmPrecheck());
      s = await waitFor(p, ['userTurn', 'paused', 'over']);
    }
    blunderPly = await p.evaluate(() => window.__play.getState().game.plies.length - 1);
    if (s.phase === 'paused') {
      await p.waitForTimeout(2500);
      if (want('coached')) await shot('coached-mistake');
    }
    await p.evaluate(() => window.__play.getState().resign());
    await waitFor(p, ['over']);
    gameId = await p.evaluate(() => window.__play.getState().over?.gameId ?? 0);
    await skipReveal(p);
    if (want('coached')) await shot('game-over');
    const close = p.locator('[data-testid="results-sheet"] button[aria-label="Close"]');
    if (await close.count()) await close.first().click();
    await p.waitForTimeout(800);
    if (want('coached')) await shot('after-results');
    const more = p.locator('button[aria-label="More options"]');
    if (want('coached') && (await more.count())) {
      await more.first().click();
      await p.waitForTimeout(500);
      await shot('over-menu');
      await p.mouse.click(W / 2, 20);
      await p.waitForTimeout(400);
    }
  }

  if (want('review') && gameId) {
    await push({ name: 'report', gameId });
    await p.waitForTimeout(2500);
    await shot('review-summary');
    await home();
    await push({ name: 'review', gameId, ply: blunderPly });
    await p.waitForTimeout(2000);
    const seen = p.locator('[data-testid="show-my-move"]');
    if (await seen.count()) {
      await seen.click();
      await p.waitForTimeout(600);
    }
    await shot('review-step');
    await home();
  }

  if (want('match')) {
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate(() => window.__settings.getState().set({ matchMode: true, matchTimeControl: '600+0' }));
    await p.waitForTimeout(600);
    await p.getByRole('button', { name: 'Play', exact: true }).click();
    await p.waitForTimeout(500);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn']);
    await p.waitForTimeout(600);
    await shot('match-start');
    for (const [f, t] of [['e2', 'e4'], ['g1', 'f3']]) {
      if (await legal(p, f, t)) await move(p, f, t);
      await waitFor(p, ['userTurn']);
    }
    await p.waitForTimeout(500);
    await shot('match-mid');
    // A premove: play, then queue the next move while the bot thinks.
    if (await legal(p, 'f1', 'c4')) await move(p, 'f1', 'c4');
    else if (await legal(p, 'b1', 'c3')) await move(p, 'b1', 'c3');
    await waitFor(p, ['analyzing', 'botThinking', 'userTurn']);
    await tap(p, 'd2');
    await p.waitForTimeout(150);
    await tap(p, 'd3');
    await p.waitForTimeout(300);
    await shot('match-premove');
    await waitFor(p, ['userTurn']);
    await p.waitForTimeout(800);
    // Low time on your clock, then a flag.
    await p.evaluate(() => {
      const s = window.__play.getState();
      const g = s.game;
      window.__play.setState({ game: { ...g, clock: { ...g.clock, [g.userColor]: 14000, turnStart: Date.now() } } });
    });
    await p.waitForTimeout(700);
    await shot('match-lowtime');
    await p.evaluate(() => {
      const g = window.__play.getState().game;
      window.__play.setState({ game: { ...g, clock: { ...g.clock, [g.userColor]: 300, turnStart: Date.now() } } });
    });
    await waitFor(p, ['over']);
    await skipReveal(p);
    await shot('match-flag');
    await p.evaluate(() => window.__play.getState().closeRewards?.());
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate(() => window.__settings.getState().set({ matchMode: false }));
  }

  if (want('puzzle')) {
    await push({ name: 'puzzle', mode: { kind: 'learn' } });
    await p.waitForTimeout(3500);
    const hint = p.getByRole('button', { name: /^Hint/ });
    if (await hint.count()) {
      await hint.first().click();
      await p.waitForTimeout(700);
    }
    await shot('puzzle-hint');
    const sol = p.getByRole('button', { name: /Solution/ });
    if (await sol.count()) {
      await sol.first().click();
      await p.waitForTimeout(2500);
    }
    await shot('puzzle-solution');
    await home();
  }

  if (want('rated')) {
    // The Puzzle Path: a rated puzzle with the path card, then after the tally (points saved first).
    await push({ name: 'puzzle', mode: { kind: 'rated' } });
    await p.waitForTimeout(3500);
    await shot('puzzle-rated');
    const plan = await p.evaluate(async () => {
      const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n) && !x.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
      const { tryMove } = await import(find('/src/lib/chess/game.ts'));
      const s = window.__puzzle;
      if (!s) return null;
      return { sol: s.solution, side: (s.setup ? tryMove(s.fen, s.setup).fen : s.fen).split(' ')[1] };
    });
    if (plan) {
      const o = plan.side === 'w' ? 'white' : 'black';
      for (let i = 0; i < plan.sol.length; i += 2) {
        await tap(p, plan.sol[i].slice(0, 2), o);
        await p.waitForTimeout(250);
        await tap(p, plan.sol[i].slice(2, 4), o);
        if (plan.sol[i].length === 5) {
          await p.waitForTimeout(400);
          await tap(p, plan.sol[i].slice(2, 4), o);
        }
        await p.waitForTimeout(i + 2 < plan.sol.length ? 1600 : 7000);
      }
      await shot('puzzle-rated-solved');
    }
    await home();
  }

  // ---- Puzzle path QA (opt-in: --only=path, or any of these names) ----
  const P = (k) => !!ONLY && (ONLY.includes(k) || ONLY.includes('path'));
  /** Put the path anywhere: a fresh state plus the patch; `at: [board, level, offset]` sets the points, `seenAt` the last-seen. */
  const setPath = (patch) =>
    p.evaluate(async (patch) => {
      const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n) && !x.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
      const db = await import(find('/src/lib/db.ts'));
      const path = await import(find('/src/lib/puzzles/path.ts'));
      const T = db.today();
      const o = JSON.parse(patch.replaceAll('TODAY', T).replaceAll('YESTERDAY', path.prevDay(T)));
      if (o.at) {
        o.points = path.pointsAtLevel(o.at[0], o.at[1]) + (o.at[2] ?? 0);
        o.seen = o.seen ?? o.points;
        delete o.at;
      }
      if (o.seenAt) {
        o.seen = path.pointsAtLevel(o.seenAt[0], o.seenAt[1]) + (o.seenAt[2] ?? 0);
        delete o.seenAt;
      }
      await window.__path({ ...path.newPathState(null), ladderStart: 650, ...o });
    }, JSON.stringify(patch));
  /** Solve the open puzzle by tapping its moves (or play one wrong move). Resolves when the last move is in. */
  const solveOpen = async ({ wrong = false } = {}) => {
    const plan = await p.evaluate(async (wrong) => {
      const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n) && !x.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
      const { tryMove } = await import(find('/src/lib/chess/game.ts'));
      const s = window.__puzzle;
      if (!s) return null;
      const fen = s.setup ? tryMove(s.fen, s.setup).fen : s.fen;
      const side = fen.split(' ')[1];
      if (!wrong) return { moves: s.solution.filter((_, i) => i % 2 === 0), side };
      const F = 'abcdefgh';
      for (const a of F) for (let r = 1; r <= 8; r++) for (const b of F) for (let q = 1; q <= 8; q++) {
        const u = `${a}${r}${b}${q}`;
        const m = u !== s.solution[0].slice(0, 4) && tryMove(fen, u);
        if (m && !m.move.promotion) return { moves: [u], side };
      }
      return null;
    }, wrong);
    if (!plan) return false;
    const o = plan.side === 'w' ? 'white' : 'black';
    for (const [i, u] of plan.moves.entries()) {
      await tap(p, u.slice(0, 2), o);
      await p.waitForTimeout(250);
      await tap(p, u.slice(2, 4), o);
      if (u.length === 5) {
        await p.waitForTimeout(400);
        await tap(p, u.slice(2, 4), o);
      }
      if (i < plan.moves.length - 1) await p.waitForTimeout(1600);
    }
    return true;
  };
  /** Screenshots at times (ms) after `t0`. */
  const shotsAt = async (t0, list) => {
    for (const [ms, name] of list) {
      const wait = t0 + ms - Date.now();
      if (wait > 0) await p.waitForTimeout(wait);
      await shot(name);
    }
  };
  const rated = async (patch, list, opts = {}) => {
    await setPath(patch);
    await push({ name: 'puzzle', mode: { kind: 'rated' } });
    await p.waitForTimeout(3500);
    if (opts.hint) {
      const h = p.getByRole('button', { name: /^Hint/ });
      if (await h.count()) await h.first().click();
      await p.waitForTimeout(800);
    }
    if (opts.before) await shot(opts.before);
    if (await solveOpen({ wrong: opts.wrong })) await shotsAt(Date.now(), list);
    await home();
    await p.waitForTimeout(400);
  };
  if (P('tally')) await rated({ at: [0, 3, 0], streak: 2 }, [[1850, 'path-tally-impact'], [2450, 'path-tally-orb'], [5200, 'path-tally-done']]);
  if (P('levelup')) await rated({ at: [0, 5, -5] }, [[4700, 'path-levelup-open'], [5850, 'path-levelup-hop'], [7600, 'path-levelup-overlay']]);
  if (P('tierup')) await rated({ at: [1, 1, -5] }, [[5800, 'path-tierup-clouds'], [8000, 'path-tierup-overlay'], [10000, 'path-tierup-card']]);
  if (P('moments')) {
    await rated({ at: [0, 6, 0], dailyDay: 'TODAY', dailyCount: 2 }, [[5500, 'path-mom-daily3'], [7400, 'path-mom-daily3-orb']]);
    await rated({ at: [0, 6, 0], dailyDay: 'TODAY', dailyCount: 9 }, [[5700, 'path-mom-daily10'], [7600, 'path-mom-daily10-orb']]);
    await rated({ at: [0, 6, 0], streak: 14 }, [[6200, 'path-mom-streak15'], [8000, 'path-mom-streak15-orb']]);
    await rated({ at: [0, 6, 0], cleanSolved: 99 }, [[5800, 'path-mom-solved100'], [7600, 'path-mom-solved100-orb']]);
    await rated({ at: [0, 6, 0], dailyDay: 'TODAY', dailyCount: 2, weekRun: 6, weekDay: 'YESTERDAY' }, [[8700, 'path-mom-week-chained'], [10600, 'path-mom-week']]);
  }
  if (P('fail')) await rated({ at: [0, 3, 0], streak: 5 }, [[1300, 'path-fail-streak-ended']], { wrong: true });
  if (P('warmup')) {
    // Three misses in a row: the next puzzle opens with the warm-up line and a more helpful prompt.
    await setPath({ at: [0, 8, 0], missesInARow: 3, ease: -150 });
    await push({ name: 'puzzle', mode: { kind: 'rated' } });
    await p.waitForTimeout(3500);
    await shot('path-warmup');
    await home();
  }
  if (P('prompts')) {
    for (const [name, at] of [['wood', [0, 3, 0]], ['silver', [3, 5, 0]], ['champion', [6, 5, 0]]]) {
      await setPath({ at });
      await push({ name: 'puzzle', mode: { kind: 'rated' } });
      await p.waitForTimeout(3500);
      await shot(`path-prompt-${name}`);
      await home();
    }
  }
  if (P('hint')) await rated({ at: [0, 3, 0], streak: 3 }, [[2600, 'path-hint-solve']], { hint: true });
  /** The world's shared gradients are mounted once at the app root (hedge tops, clouds, shadows). */
  const checkDefs = async (name) => {
    if (!(await p.evaluate(() => !!document.getElementById('hedgeTop')))) errors.push(`${name}: the path world's shared gradients (#hedgeTop) are missing`);
  };
  if (P('pathscreen')) {
    await checkDefs('pathscreen');
    await setPath({ at: [0, 4, 0], seenAt: [0, 1, 0] });
    await push({ name: 'puzzlePath' });
    await shotsAt(Date.now(), [[1250, 'path-screen-walk'], [4200, 'path-screen-wood4']]);
    await home();
    await setPath({ at: [1, 1, 10], seenAt: [0, 19, 0] });
    await push({ name: 'puzzlePath' });
    await shotsAt(Date.now(), [[1200, 'path-screen-crossing'], [1900, 'path-screen-newboard'], [4500, 'path-screen-stone1']]);
    await home();
  }
  if (P('worlds')) {
    await checkDefs('worlds');
    for (const [b, name] of ['wood', 'stone', 'bronze', 'silver', 'crystal', 'elite', 'champion', 'legend'].entries()) {
      await setPath({ at: [b, 6, 0] });
      await push({ name: 'puzzlePath' });
      await p.waitForTimeout(1500);
      await shot(`path-world-${name}`);
      await home();
    }
  }
  if (P('howpoints')) {
    await setPath({ at: [1, 4, 0] });
    await push({ name: 'puzzlePath' });
    await p.waitForTimeout(1200);
    await p.locator('[data-testid=how-points]').click();
    await p.waitForTimeout(600);
    await shot('path-how-points');
    await home();
  }
  if (P('hub')) {
    await setPath({ at: [0, 4, 30], seenAt: [0, 2, 0], streak: 4, dailyDay: 'TODAY', dailyCount: 2 });
    await p.evaluate(() => window.__nav.getState().setTab('puzzles'));
    await p.waitForTimeout(1800);
    await shot('path-hub');
    await home();
    await p.waitForTimeout(1200);
    await p.locator('text=/Wood 4/').first().scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(400);
    await shot('path-home-row');
  }
  if (P('dailytally')) {
    await setPath({ at: [0, 3, 0] });
    await push({ name: 'daily' });
    await p.waitForTimeout(2000);
    await p.locator('button:has-text("Start training"), button:has-text("Train some more"), button:has-text("Continue session")').first().click();
    await p.waitForTimeout(3500);
    if (await solveOpen()) await shotsAt(Date.now(), [[2400, 'path-daily-tally'], [6000, 'path-daily-done']]);
    await home();
  }
  if (P('rush')) {
    // Survival: one solve, then three misses end it; a first best earns "Rush record".
    await setPath({ at: [0, 3, 0] });
    await push({ name: 'rush', mode: 'survival' });
    await p.waitForTimeout(3000);
    const start = p.locator('button:has-text("Start")');
    if (await start.count()) await start.first().click();
    await p.waitForTimeout(2500);
    await solveOpen();
    await p.waitForTimeout(1500);
    for (let i = 0; i < 3; i++) {
      await solveOpen({ wrong: true });
      await p.waitForTimeout(1500);
    }
    await p.waitForTimeout(2500);
    await shot('path-rush-record');
    await home();
  }

  // ---- Polish round 3 QA (opt-in: --only=polish3, or any of these names) ----
  // versus-stamp, versus-handoff, end-badges, over-win-mid, over-win-levelup, over-loss-end,
  // review-reveal-mid, review-reveal-end, step-brilliant, step-blunder, tabs-mid, push-mid,
  // sheet-open, home-delta, path-hedges. Each is a frame caught mid-flight at a known beat.
  const Q = (k) => !!ONLY && (ONLY.includes(k) || ONLY.includes('polish3'));
  const MATE_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  const waitTurn = () => waitFor(p, ['userTurn'], 60000);
  if (['versus-stamp', 'versus-handoff', 'end-badges', 'over-win-mid', 'over-win-levelup'].some(Q)) {
    // A fresh profile's first win levels you up (Level 1 → 2).
    const t0 = Date.now();
    await p.evaluate((f) => window.__play.getState().newGame('w', 400, f, 'tom'), MATE_IN_1);
    await shotsAt(t0, [[820, 'p3-versus-stamp'], [2200, 'p3-versus-handoff']]);
    await waitTurn();
    await p.waitForTimeout(900);
    const t1 = Date.now();
    await p.evaluate(() => window.__play.getState().userMove({ from: 'a1', to: 'a8' }));
    await shotsAt(t1, [[650, 'p3-end-badges'], [2400, 'p3-over-win-mid']]);
    // The level row: catch its badge as it flips back in.
    const flip = await p.evaluate(async () => {
      const t = Date.now();
      while (Date.now() - t < 12000) {
        const sh = document.querySelector('[data-testid="results-sheet"]');
        if (sh?.getAnimations({ subtree: true }).some((a) => JSON.stringify(a.effect?.getKeyframes?.() ?? []).includes('rotateY(-90deg)'))) return true;
        await new Promise((r) => setTimeout(r, 30));
      }
      return false;
    });
    await p.waitForTimeout(140);
    await shot(flip ? 'p3-over-win-levelup' : 'p3-over-win-levelup-missing');
    await p.waitForTimeout(3000);
    await p.evaluate(() => (window.__play.getState().closeRewards?.(), window.__play.getState().leaveGame?.()));
    await home();
    await p.waitForTimeout(800);
  }
  if (Q('over-loss-end')) {
    await p.evaluate(() => window.__play.getState().newGame('w', 400, undefined, 'tom'));
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitTurn();
    await p.evaluate(() => window.__play.getState().resign());
    await p.waitForTimeout(8000);
    await shot('p3-over-loss-end');
    await p.evaluate(() => (window.__play.getState().closeRewards?.(), window.__play.getState().leaveGame?.()));
    await home();
    await p.waitForTimeout(800);
  }
  if (['review-reveal-mid', 'review-reveal-end', 'step-brilliant', 'step-blunder'].some(Q)) {
    // A Legal's-mate record: a brilliant (5.Nxe5) and a blunder (5...Bxd1), first seen here.
    await p.evaluate((f) => window.__play.getState().newGame('w', 400, f, 'tom'), MATE_IN_1);
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitTurn();
    await p.evaluate(() => window.__play.getState().userMove({ from: 'a1', to: 'a8' }));
    await p.waitForTimeout(3000);
    const id = await p.evaluate(async () => {
      const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n) && !x.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
      const { db } = await import(find('/src/lib/db.ts'));
      const { tryMove, START_FEN } = await import(find('/src/lib/chess/game.ts'));
      const t = (await db.games.toArray()).pop();
      const LEGAL = ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'f1c4', 'c8g4', 'b1c3', 'g7g6', 'f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'];
      const CP = [30, 30, 30, 40, 40, 80, 80, 160, 210, 900, 900, 900, null];
      let fen = START_FEN;
      const plies = LEGAL.map((u, i) => {
        const r = tryMove(fen, u);
        const ply = { san: r.move.san, uci: u, fenBefore: fen, fenAfter: r.fen, color: i % 2 ? 'b' : 'w', isUser: i % 2 === 0, evalAfter: CP[i] === null ? undefined : { type: 'cp', value: CP[i] }, classification: i % 2 === 0 ? 'best' : undefined, special: i === 8 ? 'brilliant' : undefined };
        fen = r.fen;
        return ply;
      });
      return db.games.add({ ...t, id: undefined, startFen: START_FEN, plies, result: '1-0', reason: 'checkmate', userResult: 'win', endedAt: Date.now() });
    });
    await p.evaluate(() => (window.__play.getState().closeRewards?.(), window.__play.getState().leaveGame?.()));
    await p.waitForTimeout(600);
    const t0 = Date.now();
    await push({ name: 'report', gameId: id });
    await shotsAt(t0, [[1050, 'p3-review-reveal-mid'], [6200, 'p3-review-reveal-end']]);
    await p.locator('button:has-text("Start Review")').first().click();
    await p.waitForTimeout(1300);
    for (let k = 1; k <= 10; k++) {
      await p.locator('[aria-label=Forward]').first().click();
      if (k === 9 || k === 10) {
        await p.waitForTimeout(240);
        await shot(k === 9 ? 'p3-step-brilliant' : 'p3-step-blunder');
      }
      await p.waitForTimeout(650);
    }
    await home();
    await p.waitForTimeout(800);
  }
  if (Q('tabs-mid')) {
    await p.locator('[data-testid="tab-bar"] button:has-text("More")').click();
    await p.waitForTimeout(140);
    await shot('p3-tabs-mid');
    await p.waitForTimeout(800);
    await home();
    await p.waitForTimeout(800);
  }
  if (Q('push-mid')) {
    await push({ name: 'settings' });
    await p.waitForTimeout(150);
    await shot('p3-push-mid');
    await p.waitForTimeout(900);
    await home();
    await p.waitForTimeout(800);
  }
  if (Q('sheet-open')) {
    await p.locator('button:has-text("Options")').first().click();
    await p.waitForTimeout(180);
    await shot('p3-sheet-open');
    await p.keyboard.press('Escape').catch(() => {});
    await p.mouse.click(20, 40);
    await p.waitForTimeout(600);
  }
  if (Q('home-delta')) {
    // Come back to Home with more XP than you last saw: it rolls up and a "+60" chip pops.
    await p.evaluate(async () => {
      const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n) && !x.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
      const db = await import(find('/src/lib/db.ts'));
      const xp = await import(find('/src/lib/progress/xp.ts'));
      await db.kvSet('lastSeen:home.xp', await xp.getXp());
      await xp.awardXp(60, true);
    });
    await p.reload();
    await p.waitForTimeout(3000);
    await store(p);
    await shot('p3-home-delta');
  }
  if (Q('path-hedges')) {
    // Wood level 6: five tiles done (their hedges) and the next board's clouds in frame.
    await setPath({ at: [0, 6, 0] });
    await push({ name: 'puzzlePath' });
    await p.waitForTimeout(2500);
    if (!(await p.evaluate(() => !!document.getElementById('hedgeTop')))) errors.push('path-hedges: the shared gradients are missing');
    await shot('p3-path-hedges');
    await home();
  }

  if (want('promotion')) {
    await push({ name: 'explore', fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', orientation: 'white', title: 'Analysis' });
    await p.waitForTimeout(2500);
    await tap(p, 'b7');
    await p.waitForTimeout(250);
    await tap(p, 'b8');
    await p.waitForTimeout(500);
    await shot('analysis-promotion');
    await home();
  }

  if (want('settings')) {
    await push({ name: 'settings' });
    await p.waitForTimeout(1200);
    await shot('settings');
    await home();
  }
  if (want('collection')) {
    await push({ name: 'collection' });
    await p.waitForTimeout(1500);
    await shot('collection');
    await home();
  }
  if (want('tabs')) {
    for (const t of ['puzzles', 'learn', 'more', 'run']) {
      await p.evaluate((t) => window.__nav.getState().setTab(t), t);
      await p.waitForTimeout(1500);
      await shot(`tab-${t === 'run' ? 'cups' : t}`);
    }
    await home();
  }
  await b.close();
  return errors;
}

mkdirSync(OUT, { recursive: true });
console.log(`Screens → ${OUT}`);
let bad = 0;
for (const size of SIZES)
  for (const scheme of SCHEMES) {
    process.stdout.write(`${size.join('x')} ${scheme} `);
    // One retry: a fresh dev server can still reload the page once while it optimises.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const errors = await run(size, scheme);
        console.log(errors.length ? ` page errors: ${errors.slice(0, 3).join(' | ')}` : ' ok');
        break;
      } catch (e) {
        if (attempt === 2) {
          bad++;
          console.log(` FAILED: ${String(e.message).split('\n')[0]}`);
        } else process.stdout.write(' (retrying) ');
      }
    }
  }
stop();
process.exit(bad ? 1 : 0);
