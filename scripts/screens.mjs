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
// Round 4 QA (opt-in: --only=round4, or by name): home-upnext (each Up next rule), more, puzzles-tab,
// summary-fix, fix-mode, fix-done, fix-skip, end-message, over-win-long, opponent-badges,
// badge-sheet, profile-cc, odo-zoom, insights-skills, laurel-shop.
//
// Round 6 QA (in round4 too, or by name): colour-alternate, week-card, week-sheet, week-reduced,
// daily-short, history-filters, backup-card.
//
// Round 7 QA (in round4 too, or by name): play-coach-card, badges-new.
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
  // Round 7: character games are real games (no help); untimed here unless a scene sets a clock.
  await p.evaluate((scheme) => window.__settings.getState().set({ theme: scheme, coachStyle: 'detailed', coachLevel: 'full', charTimeControl: '' }), scheme);
  await p.waitForTimeout(600);

  if (want('home')) await shot('home');

  let gameId = 0;
  let blunderPly = -1;
  if (want('coached') || want('review')) {
    // Round 7: the coached game is a Play Coach game against Sam.
    await p.locator('[data-testid="play-coach-button"]').click();
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
    // Round 7: a game against a character is a real game; this one with a 10-minute clock.
    await p.evaluate(() => window.__settings.getState().set({ charTimeControl: '600+0' }));
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
    await p.evaluate(() => window.__settings.getState().set({ charTimeControl: '' }));
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
    // A fresh profile's first win: four new badges against Tom, the rating up, achievements.
    const t0 = Date.now();
    await p.evaluate((f) => window.__play.getState().newGame('w', 400, f, 'tom'), MATE_IN_1);
    await shotsAt(t0, [[660, 'p3-versus-stamp'], [2040, 'p3-versus-handoff']]); // round 5: the card starts 160ms sooner
    await waitTurn();
    await p.waitForTimeout(900);
    const t1 = Date.now();
    await p.evaluate(() => window.__play.getState().userMove({ from: 'a1', to: 'a8' }));
    await shotsAt(t1, [[650, 'p3-end-badges'], [2400, 'p3-over-win-mid']]);
    // The tally once it has landed: at most five rows, no level row, three stat tiles (or two
    // when the game is too short for a game rating, as this one-move mate is), header in view.
    await p.waitForTimeout(2600);
    const sheet = await p.evaluate(() => {
      const sh = document.querySelector('[data-testid="results-sheet"]');
      const head = document.querySelector('[data-testid="results-header"]')?.getBoundingClientRect();
      return {
        rows: sh?.querySelectorAll('.pp-row').length ?? 0,
        level: !!sh?.querySelector('[data-testid="row-level"]'),
        tiles: sh?.querySelectorAll('.pp-stat').length ?? 0,
        xp: /\bXP\b|Level up/.test(sh?.textContent ?? ''),
        headInView: !!head && head.top >= 0 && head.bottom <= innerHeight,
      };
    });
    if (sheet.rows > 5) errors.push(`over-win-levelup: ${sheet.rows} rows`);
    if (sheet.level || sheet.xp) errors.push('over-win-levelup: a level row or XP is still shown');
    if (sheet.tiles < 2 || sheet.tiles > 3) errors.push(`over-win-levelup: ${sheet.tiles} stat tiles`);
    if (!sheet.headInView) errors.push('over-win-levelup: the header is out of view');
    await shot('p3-over-win-levelup');
    await p.waitForTimeout(1500);
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
    // Come back to Home with a higher rating than you last saw: it rolls up and a "+24" chip pops.
    await p.evaluate(async () => {
      const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n) && !x.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
      const db = await import(find('/src/lib/db.ts'));
      const rating = await import(find('/src/lib/rewards/rating.ts'));
      const r = await rating.getGameRating();
      await db.kvSet('lastSeen:home.rating', r.rating);
      await db.kvSet('gameRating', { ...r, rating: r.rating + 24, peak: Math.max(r.peak, r.rating + 24) });
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

  // ---- Round 4 QA (opt-in: --only=round4, or any of these names) ----
  // home-upnext (each of the four rules), more, puzzles-tab, summary-fix, fix-mode, fix-done.
  const R = (k) => !!ONLY && (ONLY.includes(k) || ONLY.includes('round4'));
  const inPage = (fn, arg) => p.evaluate(fn, arg);
  /** Set a stored value (the kv table) in the page. */
  const kv = (k, v) => inPage(async ([k, v]) => {
    const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
    await (await import(find('/src/lib/db.ts'))).kvSet(k, v);
  }, [k, v]);
  /** Back to Home so it recomputes "Up next", then a shot with the card in view. */
  const upNextShot = async (name) => {
    // A finished game still on the Play tab would cover Home: leave it first.
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(400);
    await home();
    await p.waitForTimeout(1500);
    await p.locator('[data-testid="up-next"]').scrollIntoViewIfNeeded().catch(() => {});
    const kind = await p.evaluate(() => document.querySelector('[data-testid="up-next"]')?.dataset.kind ?? null);
    if (!name.endsWith(kind ?? 'none')) errors.push(`${name}: Up next shows ${kind}`);
    await shot(name);
    await p.evaluate(() => document.querySelectorAll('.overflow-y-auto').forEach((e) => e.scrollTo(0, 0)));
  };
  // A lost game with two key mistakes of yours (you as Black): 4…g6? allows Nxe5, then 5…Bxd1??
  // walks into Legal's mate. Both have a known better move, so "Fix 2 moments" has work to do.
  let legalId = null;
  const seedLegal = async () => {
    legalId ??= await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db } = await import(find('/src/lib/db.ts'));
      const { tryMove, START_FEN } = await import(find('/src/lib/chess/game.ts'));
      const LEGAL = ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'f1c4', 'c8g4', 'b1c3', 'g7g6', 'f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'];
      const CP = [30, 30, 30, 40, 40, 80, 80, 300, 300, 900, 900, 900, null];
      const BAD = { 7: { cls: 'mistake', comment: { text: [], themes: ['defense'], bestUci: 'g8f6', bestSan: 'Nf6', replyLine: ['f3e5'] } }, 9: { cls: 'blunder', comment: { text: [], themes: ['mate'], bestUci: 'd6e5', bestSan: 'dxe5', replyLine: ['c4f7', 'e8e7', 'c3d5'] } } };
      let fen = START_FEN;
      const plies = LEGAL.map((u, i) => {
        const r = tryMove(fen, u);
        const ply = { san: r.move.san, uci: u, fenBefore: fen, fenAfter: r.fen, color: i % 2 ? 'b' : 'w', isUser: i % 2 === 1, evalAfter: CP[i] === null ? undefined : { type: 'cp', value: CP[i] }, classification: i % 2 === 1 ? BAD[i]?.cls ?? 'best' : undefined, comment: BAD[i]?.comment };
        fen = r.fen;
        return ply;
      });
      return db.games.add({ userColor: 'b', elo: 400, opponentId: 'tom', startFen: START_FEN, startedAt: Date.now() - 600000, endedAt: Date.now(), plies, takebacks: 0, hintsUsed: 0, told: [], result: '1-0', reason: 'checkmate', userResult: 'loss', summary: { accuracy: 60, counts: { best: 4, good: 0, inaccuracy: 0, mistake: 1, blunder: 1 }, biggestMistakePly: 9 } });
    });
    return legalId;
  };
  if (R('home-upnext')) {
    // Rule 2 on a fresh profile; rule 3 once today's training is done; rule 4 with the course
    // finished (harness shortcut: the start stage past the last one); rule 1 with a last game
    // that has a key moment of yours you haven't reviewed (Legal's mate, you as Black).
    await upNextShot('r4-upnext-daily');
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const path = await import(find('/src/lib/puzzles/path.ts'));
      const db = await import(find('/src/lib/db.ts'));
      const st = await path.getPathState();
      await window.__path({ ...st, flatDays: { ...st.flatDays, dailyTrainingDone: db.today() } });
    });
    await upNextShot('r4-upnext-course');
    await kv('courseStartStage', 99);
    await upNextShot('r4-upnext-puzzles');
    await kv('courseStartStage', 0);
    await seedLegal();
    await upNextShot('r4-upnext-review');
    // Rule 1 opens "Fix your key moments" straight away.
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.locator('[data-testid="up-next"]').click();
    await p.waitForTimeout(1800);
    if (!(await p.locator('[data-testid="fix-task"]').count())) errors.push('home-upnext: Up next did not open the fix flow');
    await home();
    await p.waitForTimeout(600);
  }
  // summary-fix, fix-mode, fix-done: the summary's "Fix 2 moments", a moment with Retry on, a
  // wrong try, a found move, Show me, and the done card; then the button reads "again".
  if (R('summary-fix') || R('fix-mode') || R('fix-done')) {
    const id = await seedLegal();
    await push({ name: 'report', gameId: id });
    await p.waitForTimeout(800);
    await p.locator('[data-testid="verdict"]').click({ force: true }).catch(() => {}); // skip the reveal
    await p.waitForTimeout(900);
    const label = await p.locator('[data-testid="fix-moments"]').textContent().catch(() => null);
    if (!/Fix 2 moments/.test(label ?? '')) errors.push(`summary-fix: the button reads ${label}`);
    await shot('r4-summary-fix');
    await p.locator('[data-testid="fix-moments"]').click();
    await p.waitForTimeout(1200);
    const task = await p.locator('[data-testid="fix-task"]').textContent().catch(() => null);
    if (task !== 'Find a better move for Black.') errors.push(`fix-mode: the task reads ${task}`);
    // Before a try: Show me | Skip (no dead Try again); the strip shows both moments.
    const before = await p.evaluate(() => ({ skip: !!document.querySelector('[data-testid="fix-skip"]:not([disabled])'), again: !!document.querySelector('[data-testid="fix-again"]'), chips: [...document.querySelectorAll('[data-testid="fix-strip"] [data-state]')].map((c) => `${c.textContent}:${c.getAttribute('data-state')}`).join(',') }));
    if (!before.skip || before.again) errors.push(`fix-mode: before a try the buttons are ${JSON.stringify(before)}`);
    if (before.chips !== '4…g6:current,5…Bxd1:next') errors.push(`fix-mode: the strip reads ${before.chips}`);
    await shot('r4-fix-mode');
    // A wrong try (…Qg5?? hangs the queen to Nxg5), checked by the engine, then Try again.
    await tap(p, 'd8', 'black');
    await p.waitForTimeout(200);
    await tap(p, 'g5', 'black');
    const marked = await p.locator('[data-testid="fix-again"]:not([disabled])').waitFor({ timeout: 20000 }).then(() => true, () => false);
    if (!marked) errors.push('fix-mode: a wrong try was not marked');
    if ((await p.evaluate(() => document.querySelector('[data-testid="move-mark"]')?.getAttribute('data-ok'))) !== 'false') errors.push('fix-mode: no red cross on the wrong move');
    await shot('r4-fix-wrong');
    if (marked) await p.locator('[data-testid="fix-again"]').click();
    await p.waitForTimeout(400);
    // The better move: …Nf6.
    await tap(p, 'g8', 'black');
    await p.waitForTimeout(200);
    await tap(p, 'f6', 'black');
    await p.waitForTimeout(900);
    const line = await p.locator('[data-testid="fix-line"]').textContent().catch(() => null);
    if (!/Nf6 is the best move/.test(line ?? '')) errors.push(`fix-mode: after the right move the line reads ${line}`);
    if ((await p.evaluate(() => document.querySelector('[data-testid="move-mark"]')?.getAttribute('data-ok'))) !== 'true') errors.push('fix-mode: no green check on the right move');
    if ((await p.evaluate(() => document.querySelector('[data-testid="fix-strip"] [data-state]')?.getAttribute('data-state'))) !== 'fixed') errors.push('fix-mode: the found moment is not green in the strip');
    await shot('r4-fix-solved');
    await p.locator('[data-testid="fix-next"]').click();
    await p.waitForTimeout(1200);
    // Moment 2: Show me.
    await p.locator('[data-testid="fix-show"]').click();
    await p.waitForTimeout(900);
    if (await p.locator('[data-testid="move-mark"]').count()) errors.push('fix-mode: a mark shows after Show me');
    await shot('r4-fix-shown');
    await p.locator('[data-testid="fix-next"]').click();
    await p.waitForTimeout(1200);
    const done = await p.evaluate(() => ({ head: document.querySelector('[data-testid="fix-done"] p')?.textContent, rows: [...document.querySelectorAll('[data-testid="fix-done-row"]')].map((r) => r.textContent).join(' | '), practice: /count as practice/.test(document.body.textContent ?? '') }));
    if (done.head !== '1 of 2 fixed' || !/4…g6.*Nf6.*Found it/.test(done.rows) || !/5…Bxd1.*dxe5.*Shown/.test(done.rows) || done.practice) errors.push(`fix-done: ${JSON.stringify(done)}`);
    await shot('r4-fix-done');
    // Started from the summary, Done goes back to it.
    await p.locator('[data-testid="fix-finish"]').click();
    await p.waitForTimeout(900);
    const again = await p.locator('[data-testid="fix-moments"]').textContent().catch(() => null);
    if (!/Fix (moments )?again/.test(again ?? '')) errors.push(`fix-done: back on the summary the button reads ${again}`);
    await shot('r4-summary-again');
    await home();
    await p.waitForTimeout(600);
  }
  // fix-skip: the flow from Up next, both moments skipped; Done goes back Home.
  if (R('fix-skip')) {
    legalId = null;
    const id = await seedLegal();
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate((id) => window.__nav.getState().push({ name: 'report', gameId: id, fix: true }), id);
    await p.waitForTimeout(1500);
    await p.locator('[data-testid="fix-skip"]').click();
    await p.waitForTimeout(900);
    const chips = await p.evaluate(() => [...document.querySelectorAll('[data-testid="fix-strip"] [data-state]')].map((c) => c.getAttribute('data-state')).join(','));
    if (chips !== 'skipped,current') errors.push(`fix-skip: the strip reads ${chips}`);
    await shot('r5-fix-skip');
    await p.locator('[data-testid="fix-skip"]').click();
    await p.waitForTimeout(1200);
    const head = await p.locator('[data-testid="fix-done"] p').first().textContent().catch(() => null);
    if (head !== '0 of 2 fixed') errors.push(`fix-skip: the done card reads ${head}`);
    if (!(await p.locator('[data-testid="fix-done-target"]').count())) errors.push('fix-skip: 0 found still shows a check');
    await shot('r5-fix-skip-done');
    await p.locator('[data-testid="fix-finish"]').click();
    await p.waitForTimeout(1200);
    const where = await p.evaluate(() => ({ stack: window.__nav.getState().stack.length, tab: window.__nav.getState().tab }));
    if (where.stack !== 0 || where.tab !== 'play') errors.push(`fix-skip: Done from Up next went to ${JSON.stringify(where)}`);
  }
  // end-message: the coach's one line and the results sheet after a mate, a loss on time with two
  // moments to fix, and a resignation.
  if (R('end-message')) {
    const coachLine = () => p.evaluate(() => (window.__play.getState().game?.feed ?? []).filter((f) => f.kind === 'result').map((f) => f.text.join(' ')).pop() ?? null);
    const leave = async () => {
      await p.evaluate(() => (window.__play.getState().closeRewards?.(), window.__play.getState().leaveGame?.()));
      await home();
      await p.waitForTimeout(800);
    };
    // A mate.
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate(() => window.__play.getState().newGame('w', 400, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'tom'));
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn'], 60000);
    await p.waitForTimeout(600);
    await p.evaluate(() => window.__play.getState().userMove({ from: 'a1', to: 'a8' }));
    await p.waitForTimeout(1100);
    let line = await coachLine();
    if (line !== 'Ra8# — back-rank mate. Well played.') errors.push(`end-message: after a mate the coach says ${line}`);
    await shot('r5-end-mate-coach');
    await p.waitForTimeout(6000);
    await shot('r5-end-mate-sheet');
    await leave();
    // A loss on time, with two slips of yours (the clock runs out on the board).
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db } = await import(find('/src/lib/db.ts'));
      const { tryMove } = await import(find('/src/lib/chess/game.ts'));
      // Black keeps a pawn, so running out of time loses (against a bare king it would be a draw).
      const start = '6k1/1R6/7p/8/8/8/8/R3K3 w - - 0 1';
      const route = ['e1d1', 'd1c1', 'c1c2', 'c2d2', 'd2e2', 'e2f2', 'f2f3', 'f3e3', 'e3d3', 'd3c3', 'c3c4', 'c4d4'];
      const SLIP = new Set([3, 9]);
      let fen = start;
      const plies = [];
      route.forEach((u, i) => {
        const w = tryMove(fen, u);
        const slip = SLIP.has(i);
        plies.push({ san: w.move.san, uci: u, fenBefore: fen, fenAfter: w.fen, color: 'w', isUser: true, evalAfter: { type: 'cp', value: slip ? -150 : 300 }, classification: slip ? 'mistake' : 'good', comment: slip ? { text: [], themes: ['backRankMate'], ruleIds: [], arrows: [], highlights: [], bestUci: 'a1a8', bestSan: 'Ra8#', replyLine: [] } : undefined });
        fen = w.fen;
        const mv = ['g8h8', 'h8g8'].map((m) => tryMove(fen, m)).find(Boolean);
        plies.push({ san: mv.move.san, uci: mv.move.lan, fenBefore: fen, fenAfter: mv.fen, color: 'b', isUser: false, evalAfter: { type: 'cp', value: 300 } });
        fen = mv.fen;
      });
      await db.current.put({ id: 'play', userColor: 'w', elo: 400, opponentId: 'tom', startFen: start, startedAt: Date.now() - 400000, plies, takebacks: 0, hintsUsed: 0, told: [], timeControl: '60+0', clock: { w: 1200, b: 50000, turnStart: Date.now() } });
    });
    await p.evaluate(() => window.__play.getState().load());
    await p.waitForTimeout(3200);
    line = await coachLine();
    if (line !== 'Grandpa Tom got you this time. 2 moments to fix in the review.') errors.push(`end-message: after a loss with slips the coach says ${line}`);
    await shot('r5-end-loss-coach');
    await p.waitForTimeout(6000);
    await shot('r5-end-loss-sheet');
    await leave();
    // A resignation before a move.
    await p.evaluate(() => window.__play.getState().newGame('w', 400, undefined, 'tom'));
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn'], 60000);
    await p.evaluate(() => window.__play.getState().resign());
    await p.waitForTimeout(1100);
    line = await coachLine();
    if (line !== 'Game over. The review shows where it turned.') errors.push(`end-message: after resigning the coach says ${line}`);
    await shot('r5-end-resign-coach');
    await p.waitForTimeout(6000);
    await shot('r5-end-resign-sheet');
    await leave();
  }
  if (R('more')) {
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(1500);
    await shot('r4-more');
    await home();
    await p.waitForTimeout(600);
  }
  if (R('puzzles-tab')) {
    await p.evaluate(() => window.__nav.getState().setTab('puzzles'));
    await p.waitForTimeout(2000);
    await shot('r4-puzzles-tab');
    await p.evaluate(() => document.querySelectorAll('.overflow-y-auto').forEach((e) => e.scrollTo(0, 9999)));
    await p.waitForTimeout(400);
    await shot('r4-puzzles-tab-bottom');
    await push({ name: 'customPuzzles' });
    await p.waitForTimeout(1500);
    await shot('r4-custom');
    await home();
    await p.waitForTimeout(600);
  }

  // over-win-long: a longer won game (17 moves of yours, the last a mate), so the results sheet has
  // all three stat tiles: Rating, Accuracy and Game rating.
  if (R('over-win-long')) {
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db } = await import(find('/src/lib/db.ts'));
      const { tryMove } = await import(find('/src/lib/chess/game.ts'));
      const start = '6k1/1R6/8/8/8/8/8/R3K3 w - - 0 1';
      const route = ['e1d1', 'd1c1', 'c1c2', 'c2d2', 'd2e2', 'e2f2', 'f2f3', 'f3e3', 'e3d3', 'd3c3', 'c3c4', 'c4d4', 'd4e4', 'e4f4', 'f4g4', 'g4h4'];
      const loss = [10, 60, 25, 80, 15, 40, 120, 35, 20, 55, 30, 90, 15, 45, 25, 70];
      let fen = start;
      let ev = 500;
      const plies = [];
      route.forEach((u, i) => {
        const w = tryMove(fen, u);
        ev -= loss[i];
        plies.push({ san: w.move.san, uci: u, fenBefore: fen, fenAfter: w.fen, color: 'w', isUser: true, evalAfter: { type: 'cp', value: ev }, classification: loss[i] >= 90 ? 'inaccuracy' : 'good' });
        fen = w.fen;
        // Black's king steps between g8 and h8 (Rb7 holds the seventh rank).
        const mv = ['g8h8', 'h8g8'].map((m) => tryMove(fen, m)).find(Boolean);
        ev += 30;
        plies.push({ san: mv.move.san, uci: mv.move.lan, fenBefore: fen, fenAfter: mv.fen, color: 'b', isUser: false, evalAfter: { type: 'cp', value: ev } });
        fen = mv.fen;
      });
      await db.current.put({ id: 'play', userColor: 'w', elo: 400, opponentId: 'tom', startFen: start, startedAt: Date.now() - 420000, plies, takebacks: 0, hintsUsed: 0, told: [] });
      // Three earlier games with an accuracy, so the tile has its average (round 6).
      const prior = (k, acc) => ({ userColor: 'w', elo: 400, opponentId: 'tom', startFen: start, startedAt: Date.now() - (k + 1) * 864e5 - 6e5, endedAt: Date.now() - (k + 1) * 864e5, takebacks: 0, hintsUsed: 0, told: [], result: '1-0', reason: 'checkmate', userResult: 'win', plies: [], summary: { accuracy: acc, counts: { best: 5, good: 1, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null } });
      if ((await db.games.toArray()).filter((g) => Object.values(g.summary?.counts ?? {}).some((n) => n > 0)).length < 3) await db.games.bulkAdd([prior(3, 55), prior(4, 58), prior(5, 61)]);
    });
    await p.evaluate(() => window.__play.getState().load());
    await waitTurn();
    await p.waitForTimeout(700);
    await p.evaluate(() => window.__play.getState().userMove({ from: 'a1', to: 'a8' }));
    await p.waitForTimeout(7500);
    const tiles = await p.evaluate(() => [...document.querySelectorAll('[data-testid="results-sheet"] .pp-stat')].map((e) => e.textContent).join(' | '));
    if (!/Game rating/.test(tiles)) errors.push(`over-win-long: tiles ${tiles}`);
    // Round 6: the accuracy has its context, your average over the previous games.
    const avg = await p.locator('[data-testid="results-accuracy-avg"]').textContent().catch(() => null);
    // Round 7: "avg 59%" on its own line under "Accuracy", no dot.
    if (!/^Accuracyavg \d+%$/.test(avg ?? '')) errors.push(`over-win-long: the accuracy label reads ${avg}`);
    await shot('r4-over-win-long');
    await p.evaluate(() => (window.__play.getState().closeRewards?.(), window.__play.getState().leaveGame?.()));
    await home();
    await p.waitForTimeout(800);
  }

  // odo-zoom: every rolling number cropped at 3x (the results tile, More, Profile, the path card,
  // the Home header). Each digit strip must be exactly one line high: a taller line box lets the
  // digits above and below show through (round 5, 0.1).
  if (R('odo-zoom')) {
    const zoom = async (name, sel, pad = 8) => {
      const el = p.locator(sel).first();
      if (!(await el.count())) return errors.push(`odo-zoom: no ${sel} for ${name}`);
      await el.scrollIntoViewIfNeeded().catch(() => {});
      const spill = await el.evaluate((root) =>
        [...(root.matches('.odo') ? [root] : root.querySelectorAll('.odo'))].flatMap((o) => [...o.querySelectorAll('.st i')]).filter((i) => i.getBoundingClientRect().height > 0 && Math.abs(parseFloat(getComputedStyle(i).lineHeight) - i.getBoundingClientRect().height) > 0.5).length,
      );
      if (spill) errors.push(`odo-zoom: ${name}: ${spill} digits taller or shorter than their line`);
      const cdp = await p.context().newCDPSession(p);
      const metrics = (dpr) => cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: W < 700 });
      await metrics(3);
      await p.waitForTimeout(250);
      const b = await el.boundingBox();
      if (b) await p.screenshot({ path: join(OUT, `${tag}-r5-odo-${name}.png`), clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad } });
      await metrics(2);
      await cdp.detach();
      await p.waitForTimeout(150);
    };
    // The results tile, after a mate.
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate(() => window.__play.getState().newGame('w', 400, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'tom'));
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn'], 60000);
    await p.waitForTimeout(600);
    await p.evaluate(() => window.__play.getState().userMove({ from: 'a1', to: 'a8' }));
    await p.waitForTimeout(8000);
    await zoom('results', '[data-testid="results-rating"]');
    await p.evaluate(() => (window.__play.getState().closeRewards?.(), window.__play.getState().leaveGame?.()));
    await home();
    await p.waitForTimeout(1500);
    await zoom('home', '[data-testid="home-rating"]');
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(2500);
    await zoom('more', '[data-testid="more-rating"]');
    await home();
    await push({ name: 'profile' });
    await p.waitForTimeout(2500);
    await zoom('profile', '.odo >> visible=true');
    await home();
    await push({ name: 'puzzle', mode: { kind: 'rated' } });
    await p.waitForTimeout(3000);
    await zoom('path', '[data-testid="path-total"]');
    await home();
    await p.waitForTimeout(500);
  }

  // opponent-badges, insights-skills, laurel-shop (Phase 4).
  if (R('opponent-badges') || R('badge-sheet')) {
    // Three of Tom's eight badges: the card's badge line, its sheet, and the picker.
    await kv('opponentStats', { tom: { w: 3, l: 1, d: 0, stars: 3, bestAccuracy: 80, badges: ['white', 'clean', 'mate'], streak: 1 } });
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      (await import(find('/src/lib/changes.ts'))).announceChange('records');
    });
    await p.evaluate(() => (window.__play.getState().leaveGame?.(), window.__settings.getState().set({ opponentId: 'tom' })));
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(400);
    await home();
    await p.waitForTimeout(1500);
    const line = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="badge-line"]');
      return el ? { held: el.getAttribute('data-held'), text: el.textContent, gold: el.querySelectorAll('[data-on]').length } : null;
    });
    if (!line || line.held !== '3' || line.gold !== 3 || !/3\/8 · Next: With Black/.test(line.text ?? '')) errors.push(`opponent-badges: the badge line reads ${JSON.stringify(line)}`);
    if (await p.locator('[data-testid="rivalry"]').count()) errors.push('opponent-badges: the separate badge row is still on Home');
    if (await p.evaluate(() => /in a row — keep it going/.test(document.body.textContent ?? ''))) errors.push('opponent-badges: the win-streak banner is still on Home');
    await shot('r4-opponent-badges');
    await p.locator('[data-testid="badge-line"]').click();
    await p.waitForTimeout(900);
    const sheet = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="badge-sheet"]');
      return el ? { tiles: el.querySelectorAll('[data-badge-tile]').length, on: el.querySelectorAll('[data-badge-tile][data-on]').length, challenge: el.querySelector('[data-testid="badge-challenge"]')?.textContent ?? '' } : null;
    });
    if (!sheet || sheet.tiles !== 8 || sheet.on !== 3 || !/3 of 7 badges/.test(sheet.challenge)) errors.push(`badge-sheet: ${JSON.stringify(sheet)}`);
    await shot('r5-badge-sheet');
    await p.locator('[data-testid="badge-sheet"] button[aria-label="Close"]').click().catch(() => {});
    await p.waitForTimeout(700);
    await p.evaluate(() => document.querySelectorAll('.overflow-y-auto').forEach((e) => e.scrollTo(0, 0)));
    await p.locator('[aria-label="Change opponent"]').click();
    await p.waitForTimeout(1200);
    await shot('r4-opponent-picker');
    await p.keyboard.press('Escape').catch(() => {});
    await p.locator('button:has-text("Done")').last().click().catch(() => {});
    await p.waitForTimeout(500);
  }
  if (R('insights-skills')) {
    await push({ name: 'insights' });
    await p.waitForTimeout(1800);
    if (!(await p.locator('[data-testid="insights-skills"]').count())) errors.push('insights-skills: no Skills section');
    await shot('r4-insights-skills');
    await home();
    await p.waitForTimeout(500);
    // An old Skill tree link opens Insights at Skills.
    await push({ name: 'skills' });
    await p.waitForTimeout(1500);
    const inView = await p.evaluate(() => {
      const r = document.querySelector('#skills')?.getBoundingClientRect();
      return !!r && r.top >= 0 && r.top < innerHeight / 2;
    });
    if (!inView) errors.push('insights-skills: the skills link did not open at Skills');
    await home();
    await p.waitForTimeout(500);
  }
  // profile-cc: a chess.com import at 512 rapid and a game rating of 284. Profile offers to start
  // there; "Not now" hides it; the start sets the rating and says how many looks it unlocked; the
  // chess.com account card has the same action as a row.
  if (R('profile-cc')) {
    const saved = await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db, kvGet } = await import(find('/src/lib/db.ts'));
      const { parseCcGame } = await import(find('/src/lib/chesscom/parse.ts'));
      const pgn = '[White "Opp_123"]\n[Black "MyName"]\n[Result "0-1"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. O-O d6 0-1';
      const g = parseCcGame({ url: 'https://www.chess.com/game/live/1', pgn, time_control: '600', time_class: 'rapid', end_time: Math.floor(Date.now() / 1000) - 3600, rated: true, uuid: 'seed-512', rules: 'chess', white: { username: 'Opp_123', rating: 540, result: 'resigned' }, black: { username: 'MyName', rating: 512, result: 'win' } }, 'MyName');
      await db.imported.bulkPut([g]);
      const keep = { gameRating: await kvGet('gameRating', null), seen: await kvGet('cosmeticsSeen', []) };
      window.__settings.getState().set({ ccUsername: 'MyName', ccAutoSync: false });
      return keep;
    });
    await kv('gameRating', { rating: 284, peak: 300, games: 12, history: [{ at: Date.now(), rating: 284 }] });
    await kv('ccStartHidden', null);
    await push({ name: 'profile' });
    await p.waitForTimeout(1500);
    const card = p.locator('[data-testid="cc-start"]');
    const text = (await card.locator('p').first().textContent().catch(() => '')).replace(/^chess\.com/, '').trim();
    if (text !== 'Your chess.com rapid rating is 512. Start your rating here at 512?') errors.push(`profile-cc: the card reads "${text}"`);
    if ((await card.locator('button').first().textContent().catch(() => '')) !== 'Start at 512') errors.push('profile-cc: no "Start at 512"');
    await shot('r5-profile-cc');
    await p.locator('[data-testid="cc-start-later"]').click();
    await p.waitForTimeout(400);
    if (await card.count()) errors.push('profile-cc: "Not now" left the card');
    await home();
    await push({ name: 'profile' });
    await p.waitForTimeout(1200);
    if (await card.count()) errors.push('profile-cc: the card came back after "Not now"');
    await kv('ccStartHidden', null);
    await home();
    await push({ name: 'profile' });
    await p.waitForTimeout(1200);
    await p.locator('[data-testid="cc-start-go"]').click();
    await p.waitForTimeout(1200);
    const done = await p.locator('[data-testid="cc-start-done"]').textContent().catch(() => null);
    if (!/^Rating set to 512\. \d+ new looks? in your Collection\.$/.test(done ?? '')) errors.push(`profile-cc: the confirmation reads "${done}"`);
    const top = await p.evaluate(() => document.querySelector('[data-testid="profile-rating"]')?.textContent);
    if (!top?.endsWith('Rating 512')) errors.push(`profile-cc: the header reads "${top}"`);
    if (await p.locator('[data-testid="delta-chip"]').count()) errors.push('profile-cc: a delta chip after the start');
    const botsSub = await p.locator('text=/^Started at 512 · /').count();
    if (!botsSub) errors.push('profile-cc: the Bots row does not read "Started at 512 · …"');
    await shot('r5-profile-cc-done');
    await p.locator('[data-testid="cc-start-done"]').click();
    await p.waitForTimeout(1200);
    const at = await p.evaluate(() => window.__nav.getState().stack.at(-1)?.name);
    if (at !== 'collection') errors.push(`profile-cc: the confirmation opened ${at}`);
    await home();
    // The same action on the chess.com account card (Settings).
    await kv('gameRating', { rating: 284, peak: 512, games: 3, history: [{ at: Date.now(), rating: 284 }] });
    await push({ name: 'settings' });
    await p.waitForTimeout(1500);
    const row = p.locator('[data-testid="cc-start-row"]');
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(300);
    if (!(await row.count())) errors.push('profile-cc: no row on the chess.com account card');
    else await shot('r5-profile-cc-row');
    await home();
    await inPage(async (keep) => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db, kvSet } = await import(find('/src/lib/db.ts'));
      await db.imported.clear();
      if (keep.gameRating) await kvSet('gameRating', keep.gameRating);
      else await db.kv.delete('gameRating');
      await kvSet('cosmeticsSeen', keep.seen);
      await db.kv.delete('keptPeak');
      await db.kv.delete('ccStartHidden');
      window.__settings.getState().set({ ccUsername: '' });
    }, saved);
    await p.waitForTimeout(400);
  }
  // colour-alternate: an install still on the old White default moves to Alternate (the one-time
  // line under the chips), the chip names the next game's colour, a finished game flips it, and a
  // rematch swaps colours (its versus card says so).
  if (R('colour-alternate')) {
    const imp = (path) => inPage(async (path) => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      return !!(await import(find(path)));
    }, path);
    await imp('/src/lib/colour.ts');
    const chipOf = () => p.evaluate(() => {
      const c = [...document.querySelectorAll('[data-testid="colour-chip"]')].find((e) => e.offsetParent);
      return c ? `${c.textContent.trim()}:${c.getAttribute('data-dot')}` : null;
    });
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db } = await import(find('/src/lib/db.ts'));
      await db.kv.bulkDelete(['colourAlternateV1', 'lastColour', 'colourNews']);
      window.__settings.getState().set({ colorPref: 'w' });
      await (await import(find('/src/lib/colour.ts'))).migrateColour();
    });
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1200);
    if ((await p.evaluate(() => window.__settings.getState().colorPref)) !== 'alternate') errors.push('colour-alternate: the migration did not move White to Alternate');
    let chip = await chipOf();
    if (chip !== 'White:half') errors.push(`colour-alternate: before a game the chip reads ${chip}`);
    if (!(await p.locator('[data-testid="colour-news"]').count())) errors.push('colour-alternate: no one-time line after the migration');
    await shot('r6-colour-news');
    await p.locator('button:has-text("Options")').first().click();
    await p.waitForTimeout(800);
    const segs = await p.evaluate(() => [...document.querySelectorAll('[data-value]')].filter((e) => e.offsetParent && ['w', 'b', 'alternate', 'random'].includes(e.getAttribute('data-value'))).map((e) => `${e.getAttribute('data-value')}:${e.scrollWidth > e.clientWidth + 1 ? 'clipped' : 'fits'}`).join(','));
    if (segs !== 'w:fits,b:fits,alternate:fits,random:fits') errors.push(`colour-alternate: the You play row reads ${segs}`);
    const hint = await p.locator('[data-testid="colour-hint"]').textContent().catch(() => null);
    if (!/Next game: White\./.test(hint ?? '')) errors.push(`colour-alternate: the hint reads ${hint}`);
    await shot('r6-colour-options');
    await p.keyboard.press('Escape');
    await p.locator('button:has-text("Done")').last().click().catch(() => {});
    await p.waitForTimeout(500);
    // A finished game as White: the chip turns to Black and the one-time line goes.
    await p.evaluate(() => window.__play.getState().newGame('w', 400, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'tom'));
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn'], 60000);
    await p.waitForTimeout(500);
    await p.evaluate(() => window.__play.getState().userMove({ from: 'a1', to: 'a8' }));
    await p.locator('[data-testid="results-sheet"]').waitFor({ timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2500);
    // Rematch from the results sheet: colours swap.
    await p.locator('[data-testid="results-sheet"] button:has-text("Rematch")').click();
    await p.waitForTimeout(700);
    const vs = await p.evaluate(() => document.querySelector('[data-testid="versus"]')?.textContent ?? '');
    if (!/Black/.test(vs)) errors.push(`colour-alternate: the rematch's versus card reads ${vs}`);
    await shot('r6-colour-rematch-versus');
    const uc = await p.evaluate(() => window.__play.getState().game?.userColor);
    if (uc !== 'b') errors.push(`colour-alternate: the rematch gave ${uc}`);
    await p.waitForTimeout(1500);
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1200);
    // The rematch's colour (Black) is the last colour: next is White. The one-time line has gone.
    chip = await chipOf();
    if (chip !== 'White:half') errors.push(`colour-alternate: after the rematch the chip reads ${chip}`);
    if (await p.locator('[data-testid="colour-news"]').count()) errors.push('colour-alternate: the one-time line stayed after a game');
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      await (await import(find('/src/lib/colour.ts'))).setLastColour('w');
    });
    await p.waitForTimeout(500);
    chip = await chipOf();
    if (chip !== 'Black:half') errors.push(`colour-alternate: after a game as White the chip reads ${chip}`);
    await shot('r6-colour-after');
  }
  // Three calendar weeks of play (app and chess.com games, fixes, puzzles, training days), for Your
  // week and Game history. The week before last is weaker, so last week has trends to show.
  const seedWeeks = () => inPage(async () => {
    const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
    const { db, kvSet } = await import(find('/src/lib/db.ts'));
    const { weekStart, nextWeek } = await import(find('/src/lib/dates.ts'));
    const F = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const now = Date.now();
    const thisW = weekStart(now);
    const lastW = nextWeek(thisW, -1);
    const prevW = nextWeek(thisW, -2);
    const H = 3600e3;
    const ply = (theme) => ({ san: 'e4', uci: 'e2e4', fenBefore: F, fenAfter: F, color: 'w', isUser: true, classification: theme ? 'mistake' : 'good', comment: theme ? { themes: [theme], text: [], ruleIds: [], arrows: [], highlights: [] } : undefined });
    const game = (endedAt, res, acc, bl, theme, o = {}) => ({
      userColor: o.color ?? 'w', elo: o.elo ?? 400, opponentId: o.opp ?? 'tom', startFen: F, startedAt: endedAt - 6e5, endedAt, takebacks: 0, hintsUsed: 0, told: [],
      result: res === 'win' ? '1-0' : res === 'loss' ? '0-1' : '1/2-1/2', reason: res === 'draw' ? 'repetition' : 'checkmate', userResult: res,
      plies: [ply(theme), ply(null)],
      summary: { accuracy: acc, counts: { best: 4, good: 2, inaccuracy: 1, mistake: theme ? 1 : 0, blunder: bl }, biggestMistakePly: 0 },
    });
    await Promise.all([db.games.clear(), db.imported.clear(), db.attempts.clear(), db.activity.clear()]);
    // The week before last: 4 games, weaker.
    const prev = [game(prevW + 26 * H, 'loss', 50, 3, 'fork'), game(prevW + 50 * H, 'win', 54, 3, null), game(prevW + 74 * H, 'loss', 51, 2, 'defense'), game(prevW + 98 * H, 'win', 57, 2, null)];
    // Last week: 4 app games (one on Sunday 23:59) and 2 on chess.com; "Spotting threats" in 4 of the 6.
    const last = [game(lastW + 34 * H, 'win', 64, 1, 'defense'), game(lastW + 58 * H, 'loss', 56, 2, 'defense', { opp: 'maya', elo: 600, color: 'b' }), game(lastW + 82 * H, 'win', 67, 1, null, { color: 'b' }), game(nextWeek(lastW) - 60e3, 'win', 63, 2, 'fork')];
    // This week: a Monday 00:01 game (when it's past), then two more today.
    const mine = [game(Math.min(thisW + 60e3, now - 3 * H), 'win', 71, 0, null), game(Math.max(thisW + 2 * 60e3, now - 2 * H), 'loss', 59, 1, 'defense', { color: 'b' }), game(Math.max(thisW + 3 * 60e3, now - H), 'win', 88, 0, null)];
    await db.games.bulkAdd([...prev, ...last, ...mine]);
    const cc = (endedAt, myRating, res, theme, name) => ({ ...game(endedAt, res, 58, 1, theme), id: `cc:seed${endedAt}`, source: 'chess.com', analyzed: true, timeClass: 'rapid', myRating, elo: 520, opponentName: name, url: '', pgn: '', timeControl: '600' });
    await db.imported.bulkAdd([cc(prevW + 60 * H, 512, 'loss', null, 'kasparov_fan'), cc(lastW + 70 * H, 520, 'win', 'defense', 'anna_k'), cc(lastW + 100 * H, 530, 'loss', 'defense', 'bentley42')]);
    // The game rating after each app game.
    const ratings = [262, 270, 276, 284, 300, 292, 310, 326, 334, 330, 344];
    const appGames = [...prev, ...last, ...mine];
    await kvSet('gameRating', { rating: 344, peak: 344, games: appGames.length, history: appGames.map((g, i) => ({ at: g.endedAt, rating: ratings[i] })) });
    // Fixes and puzzles last week: 7 of 9 moments, 12 puzzles; training days: 5 last week, 2 this week.
    const att = (at, success, source) => ({ puzzleId: `p${at}${source}`, at, success, puzzleRating: 800, ratingBefore: 0, ratingAfter: 0, themes: [], source, hintsUsed: 0 });
    await db.attempts.bulkAdd([...Array.from({ length: 9 }, (_, i) => att(lastW + (30 + i) * H, i < 7, 'review')), ...Array.from({ length: 12 }, (_, i) => att(lastW + (40 + i) * H, true, 'path'))]);
    const day = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const rows = [0, 1, 2, 3, 5].map((k) => ({ day: day(lastW + k * 24 * H + 12 * H), puzzles: 3, games: 1, reviews: 1 }));
    rows.push({ day: day(now), puzzles: 2, games: 2, reviews: 0 });
    if (day(thisW) !== day(now)) rows.push({ day: day(thisW + 12 * H), puzzles: 0, games: 1, reviews: 0 });
    await db.activity.bulkPut(rows);
    await db.kv.delete('weekRecap');
    (await import(find('/src/lib/changes.ts'))).announceChange('rating');
  });

  // week-card / week-sheet: Home's This week card in its "last week" state (the first visit of a
  // new week), the Your week sheet on both tabs (focus, chess.com line, trends), the normal card
  // with its line, Profile's row, and an empty week.
  if (R('week-card') || R('week-sheet')) {
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await seedWeeks();
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1800);
    const card = p.locator('[data-testid="week-card"]');
    await card.scrollIntoViewIfNeeded().catch(() => {});
    const state = await card.getAttribute('data-state').catch(() => null);
    const cardText = await card.textContent().catch(() => '');
    if (state !== 'last') errors.push(`week-card: on a new week's first visit the card is ${state}`);
    if (!/^Last week\+42 · 6 games · 1\.3 blunders a game/.test(cardText ?? '')) errors.push(`week-card: the last-week card reads ${cardText}`);
    await shot('r6-week-card-last');
    await card.click();
    await p.waitForTimeout(1500);
    const sheet = p.locator('[data-testid="week-sheet"]');
    if ((await sheet.getAttribute('data-tab').catch(() => null)) !== 'last') errors.push('week-sheet: the card did not open on Last week');
    const read = (sel) => p.locator(`[data-testid="week-sheet"] ${sel}`).first().textContent().catch(() => null);
    const rating = await read('[data-testid="week-rating"]');
    if (!/^Rating284326\+42chess\.comrapid 512 → 530\+18$/.test((rating ?? '').replace(/\s+/g, ' ').replace(/ ?(→) ?/g, ' → ').replace(/Rating ?/, 'Rating').replace(/ (?=\d{3}\+)/, ''))) {
      if (!/284/.test(rating ?? '') || !/326/.test(rating ?? '') || !/\+42/.test(rating ?? '') || !/rapid 512 → 530/.test(rating ?? '') || !/\+18/.test(rating ?? '')) errors.push(`week-sheet: the rating reads ${rating}`);
    }
    const tiles = await p.evaluate(() => [...document.querySelectorAll('[data-testid="week-sheet"] [data-testid="week-tile"]')].map((t) => t.textContent).join(' | '));
    if (!/^6Games4W · 0D · 2L · 2 on chess\.com \| 61%Accuracywas 54% \| 1\.3Blunders a gamewas 2\.2 \| 5\/7Training daysgoal met$/.test(tiles)) errors.push(`week-sheet: the tiles read ${tiles}`);
    const extra = await read('[data-testid="week-extra"]');
    if (extra !== 'Moments fixed: 7 of 9 · Puzzles solved: 12') errors.push(`week-sheet: the line under the tiles reads ${extra}`);
    const focus = await read('[data-testid="week-focus"]');
    if (!/Spotting threats/.test(focus ?? '') || !/Came up in 4 of 6 games\. After your opponent moves/.test(focus ?? '')) errors.push(`week-sheet: the focus reads ${focus}`);
    await shot('r6-week-sheet-last');
    await p.locator('[data-testid="week-sheet"] button:has-text("This week")').click();
    await p.waitForTimeout(900);
    await shot('r6-week-sheet-this');
    const tiles2 = await p.evaluate(() => [...document.querySelectorAll('[data-testid="week-sheet"] [data-testid="week-tile"]')].map((t) => t.textContent).join(' | '));
    if (!/^3Games2W · 0D · 1L/.test(tiles2)) errors.push(`week-sheet: this week's tiles read ${tiles2}`);
    await p.locator('[data-testid="week-sheet"] [aria-label="Close"]').click();
    await p.waitForTimeout(900);
    const state2 = await card.getAttribute('data-state').catch(() => null);
    const line = await p.locator('[data-testid="week-line"]').textContent().catch(() => null);
    if (state2 !== 'normal') errors.push(`week-card: after opening, the card is ${state2}`);
    if (line !== '+18 this week · 3 games') errors.push(`week-card: the line reads ${line}`);
    await shot('r6-week-card');
    // Practise it opens practice on the theme.
    await card.click();
    await p.waitForTimeout(900);
    await p.locator('[data-testid="week-sheet"] button:has-text("Last week")').click();
    await p.waitForTimeout(900);
    await p.locator('[data-testid="week-practise"]').click();
    await p.waitForTimeout(1200);
    const top = await p.evaluate(() => window.__nav.getState().stack.at(-1));
    if (top?.name !== 'practice' || top?.theme !== 'defense') errors.push(`week-sheet: Practise it opened ${JSON.stringify(top)}`);
    await p.evaluate(() => window.__nav.getState().pop());
    await p.waitForTimeout(800);
    // Profile → Activity: one row opens the same sheet.
    await push({ name: 'profile' });
    await p.waitForTimeout(1500);
    await p.locator('button:has-text("Activity")').first().click();
    await p.waitForTimeout(800);
    const row = p.locator('[data-testid="week-row"]');
    await row.scrollIntoViewIfNeeded().catch(() => {});
    const rowText = await row.textContent().catch(() => null);
    if (rowText !== 'Your week · +18 · 3 games') errors.push(`week-row: the Profile row reads ${rowText}`);
    await shot('r6-week-row');
    await home();
    await p.waitForTimeout(500);
    // An empty week.
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db } = await import(find('/src/lib/db.ts'));
      const { weekStart } = await import(find('/src/lib/dates.ts'));
      const t = weekStart(Date.now());
      await db.games.where('endedAt').aboveOrEqual(t).delete();
      await db.attempts.where('at').aboveOrEqual(t).delete();
    });
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1500);
    await card.click();
    await p.waitForTimeout(1200);
    const empty = await p.locator('[data-testid="week-empty"]').textContent().catch(() => null);
    if (empty !== 'Nothing played this week yet. One game or a few puzzles is enough to start.') errors.push(`week-sheet: an empty week reads ${empty}`);
    await shot('r6-week-sheet-empty');
    await p.locator('[data-testid="week-sheet"] [aria-label="Close"]').click();
    await p.waitForTimeout(800);
  }
  // week-reduced: with reduced animations the Your week sheet fades in without its slide, and the
  // card's change from "last week" back to normal doesn't animate.
  if (R('week-reduced')) {
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await seedWeeks();
    await p.evaluate(() => window.__settings.getState().set({ reduceAnimations: 'on' }));
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1500);
    const card = p.locator('[data-testid="week-card"]');
    await card.scrollIntoViewIfNeeded().catch(() => {});
    if ((await card.getAttribute('data-state').catch(() => null)) !== 'last') errors.push('week-reduced: no last-week card to open');
    await card.click();
    const anim = await p.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
      const panel = document.querySelector('[data-testid="week-sheet"]')?.closest('.safe-bottom');
      const list = panel ? panel.getAnimations() : [];
      res({ panel: !!panel, slide: list.filter((a) => a.effect?.getKeyframes().some((k) => k.transform && k.transform !== 'none' && k.transform !== 'translateY(0px)')).length, fade: list.filter((a) => a.effect?.getKeyframes().some((k) => k.opacity !== undefined)).length });
    })));
    if (!anim.panel || anim.slide !== 0 || anim.fade < 1) errors.push(`week-reduced: the sheet opened with ${JSON.stringify(anim)}`);
    await p.waitForTimeout(600);
    await shot('r6-week-reduced');
    await p.locator('[data-testid="week-sheet"] [aria-label="Close"]').click();
    const cardAnim = await p.evaluate(() => new Promise((res) => setTimeout(() => {
      const c = document.querySelector('[data-testid="week-card"]');
      const moving = c ? [c, ...c.querySelectorAll('*')].flatMap((e) => e.getAnimations()).filter((a) => (a.effect?.getTiming().duration ?? 0) > 20).length : -1;
      res({ state: c?.getAttribute('data-state'), moving });
    }, 60)));
    if (cardAnim.state !== 'normal' || cardAnim.moving !== 0) errors.push(`week-reduced: the card changed with ${JSON.stringify(cardAnim)}`);
    await p.evaluate(() => window.__settings.getState().set({ reduceAnimations: 'off' }));
    await p.waitForTimeout(400);
  }

  // daily-short: a game finished today makes today's Daily training the short set (~5 min, 6
  // puzzles; Up next says so), and its done screen offers Keep going (6 more).
  if (R('daily-short')) {
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db } = await import(find('/src/lib/db.ts'));
      const F = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      // A clean win today (nothing to fix, so Up next moves on to Daily training).
      await db.games.add({ userColor: 'w', elo: 400, opponentId: 'tom', startFen: F, startedAt: Date.now() - 6e5, endedAt: Date.now() - 1000, takebacks: 0, hintsUsed: 0, told: [], result: '1-0', reason: 'checkmate', userResult: 'win', plies: [], summary: { accuracy: 90, counts: { best: 5, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null } });
      const { usePathStore } = await import(find('/src/lib/puzzles/path.ts')).catch(() => ({}));
      void usePathStore;
      (await import(find('/src/lib/store/daily.ts'))).useDaily.getState().reset();
    });
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1500);
    const up = p.locator('[data-testid="up-next"]');
    if ((await up.getAttribute('data-kind').catch(() => null)) === 'daily') {
      const t = await up.textContent();
      if (!/Daily training6 puzzles · ~5 min/.test(t ?? '')) errors.push(`daily-short: Up next reads ${t}`);
    }
    await push({ name: 'daily' });
    await p.waitForTimeout(1500);
    const plan = await p.locator('[data-testid="daily-plan"]').textContent().catch(() => null);
    if (plan !== "Today's plan (~5 min)") errors.push(`daily-short: the plan reads ${plan}`);
    await shot('r6-daily-short');
    await p.locator('button:has-text("Start training"), button:has-text("Train some more"), button:has-text("Continue session")').first().click();
    await p.waitForTimeout(3500);
    const n = await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const d = (await import(find('/src/lib/store/daily.ts'))).useDaily;
      const st = d.getState();
      const len = st.items.length;
      d.setState({ index: len, items: st.items.map((x) => ({ ...x, result: true })) });
      return { len, short: st.short };
    });
    if (n.len !== 6 || !n.short) errors.push(`daily-short: the session has ${n.len} items (short ${n.short})`);
    // Round 7: toasts wait for the done card, then come one at a time below the header.
    const seen = await p.evaluate(() => new Promise((res) => {
      let max = 0, early = 0, top = 999;
      const t0 = performance.now();
      const tick = () => {
        const ts = [...document.querySelectorAll('[data-testid="toasts"] > div')];
        const at = performance.now() - t0;
        if (at < 600 && ts.length) early++;
        max = Math.max(max, ts.length);
        ts.forEach((t) => (top = Math.min(top, t.getBoundingClientRect().top)));
        if (at < 4500) requestAnimationFrame(tick);
        else res({ max, early, top: Math.round(top) });
      };
      tick();
    }));
    if (seen.early || seen.max > 1 || (seen.max && seen.top < 56)) errors.push(`daily-short: toasts on the done card ${JSON.stringify(seen)}`);
    const more = p.locator('[data-testid="daily-more"]');
    if (!(await more.count())) errors.push('daily-short: no Keep going on the done screen');
    else if ((await more.textContent()) !== 'Keep going (6 more)') errors.push(`daily-short: Keep going reads ${await more.textContent()}`);
    await shot('r6-daily-done');
    await more.click().catch(() => {});
    await p.waitForTimeout(3500);
    const len2 = await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      return (await import(find('/src/lib/store/daily.ts'))).useDaily.getState().items.length;
    });
    if (len2 !== 12) errors.push(`daily-short: Keep going made ${len2} items`);
    await shot('r6-daily-more');
    await p.locator('button:has-text("Close")').first().click().catch(() => {});
    await p.waitForTimeout(500);
    await home();
    await p.waitForTimeout(500);
  }

  // history-filters: one row of chips (All · Wins · Losses · App · chess.com), week and month
  // headers with counts, a result chip with a source chip, the filter kept while the app is open,
  // and an empty filter.
  if (R('history-filters')) {
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await seedWeeks();
    await push({ name: 'history' });
    await p.waitForTimeout(1500);
    const chips = await p.evaluate(() => [...document.querySelectorAll('[data-testid="history-chips"] button')].map((b) => `${b.textContent}${b.hasAttribute('data-on') ? '*' : ''}`).join(','));
    if (chips !== 'All*,Wins,Losses,App,chess.com') errors.push(`history-filters: the chips read ${chips}`);
    const heads = () => p.evaluate(() => [...document.querySelectorAll('[data-testid="history-header"]')].map((h) => h.textContent).join(' | '));
    let h = await heads();
    if (!/^This week · 3 \| Last week · 6 \| /.test(h)) errors.push(`history-filters: the headers read ${h}`);
    await shot('r6-history');
    await p.locator('[data-testid="history-chips"] button:has-text("Losses")').click();
    await p.locator('[data-testid="history-chips"] button:has-text("chess.com")').click();
    await p.waitForTimeout(500);
    h = await heads();
    if (!/^Last week · 1 \| [A-Z][a-z]+( \d{4})? · 1$/.test(h)) errors.push(`history-filters: Losses on chess.com read ${h}`);
    await shot('r6-history-filtered');
    // Kept while the app is open.
    await p.evaluate(() => window.__nav.getState().pop());
    await p.waitForTimeout(700);
    await push({ name: 'history' });
    await p.waitForTimeout(1200);
    const kept = await p.evaluate(() => [...document.querySelectorAll('[data-testid="history-chips"] button[data-on]')].map((b) => b.textContent).join(','));
    if (kept !== 'Losses,chess.com') errors.push(`history-filters: the filter came back as ${kept}`);
    await p.locator('[data-testid="history-chips"] button:has-text("All")').click();
    await p.waitForTimeout(400);
    h = await heads();
    if (!/^This week · 3 \| Last week · 6/.test(h)) errors.push(`history-filters: All did not clear the filter (${h})`);
    // Without chess.com games (a username set): the import line.
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      await (await import(find('/src/lib/db.ts'))).db.imported.clear();
      window.__settings.getState().set({ ccUsername: 'MyName', ccAutoSync: false });
    });
    await p.evaluate(() => window.__nav.getState().pop());
    await p.waitForTimeout(700);
    await push({ name: 'history' });
    await p.waitForTimeout(1200);
    await p.locator('[data-testid="history-chips"] button:has-text("chess.com")').click();
    await p.waitForTimeout(400);
    const empty = await p.locator('[data-testid="history-empty"]').textContent().catch(() => null);
    if (empty !== 'No chess.com games yet. Import them in More → chess.com import.') errors.push(`history-filters: the empty filter reads ${empty}`);
    await shot('r6-history-empty');
    await p.locator('[data-testid="history-chips"] button:has-text("All")').click();
    await p.evaluate(() => window.__settings.getState().set({ ccUsername: '' }));
    await home();
    await p.waitForTimeout(500);
  }

  // backup-card: 10+ games and no backup: More shows the reminder above Settings; Later hides it for
  // 30 days; Settings says "Last backup: never".
  if (R('backup-card')) {
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const { db } = await import(find('/src/lib/db.ts'));
      await db.kv.bulkDelete(['lastBackupAt', 'backupLaterUntil']);
    });
    if ((await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      return (await import(find('/src/lib/db.ts'))).db.games.count();
    })) < 10) await seedWeeks();
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(1500);
    const card = p.locator('[data-testid="backup-card"]');
    await card.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await card.count())) errors.push('backup-card: no reminder with 10+ games and no backup');
    const order = await p.evaluate(() => {
      const c = document.querySelector('[data-testid="backup-card"]');
      const s = [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Settings'));
      return !!c && !!s && !!(c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (!order) errors.push('backup-card: the reminder is not above Settings');
    await shot('r6-backup-card');
    await p.locator('[data-testid="backup-later"]').click();
    await p.waitForTimeout(400);
    await home();
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(1200);
    if (await card.count()) errors.push('backup-card: Later did not hide it');
    await push({ name: 'settings' });
    await p.waitForTimeout(1500);
    const last = p.locator('[data-testid="backup-last"]');
    await last.scrollIntoViewIfNeeded().catch(() => {});
    if ((await last.textContent().catch(() => null)) !== 'Last backup: never') errors.push(`backup-card: Settings reads ${await last.textContent().catch(() => null)}`);
    await shot('r6-backup-settings');
    await home();
    await p.waitForTimeout(500);
  }

  // play-coach-card: Home's Play card (no Coached / Match switch, no coach chip) and the Play Coach
  // card; both options sheets; a Play Coach game (Sam, the aids, "practice"); a real game (no aids).
  if (R('play-coach-card')) {
    await p.evaluate(() => window.__play.getState().leaveGame?.());
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1200);
    const homeText = await p.locator('[data-testid="play-card"]').textContent();
    if (/Coached|Coach:|Match/.test(homeText ?? '')) errors.push(`play-coach-card: the Play card still reads ${homeText}`);
    const card = p.locator('[data-testid="play-coach-card"]');
    await card.scrollIntoViewIfNeeded().catch(() => {});
    const cardText = await card.textContent();
    if (!/Play Coach.*Sam plays at your level and teaches as you go\..*Easier.*Your level.*Harder/.test(cardText ?? '')) errors.push(`play-coach-card: the card reads ${cardText}`);
    await shot('r7-home-coach');
    await p.locator('[data-testid="play-card"] button:has-text("Options")').click();
    await p.waitForTimeout(800);
    const charOpts = await p.locator('[data-testid="options-sheet"] .section-title').allTextContents();
    if (charOpts.join(',') !== 'You play,Clock') errors.push(`play-coach-card: character options are ${charOpts.join(',')}`);
    await shot('r7-options-characters');
    await p.locator('[data-testid="options-sheet"] button:has-text("Done")').click();
    await p.waitForTimeout(600);
    await card.locator('button:has-text("Options")').click();
    await p.waitForTimeout(800);
    const coachOpts = await p.locator('[data-testid="options-sheet"] .section-title').allTextContents();
    if (coachOpts.join(',') !== 'You play,Sam talks') errors.push(`play-coach-card: Play Coach options are ${coachOpts.join(',')}`);
    await shot('r7-options-coach');
    await p.locator('[data-testid="options-sheet"] button:has-text("Done")').click();
    await p.waitForTimeout(600);
    // A Play Coach game: Sam at your level, all the help.
    await card.locator('button:has-text("Harder")').click();
    await p.locator('[data-testid="play-coach-button"]').click();
    await p.waitForTimeout(900);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn'], 60000);
    await p.waitForTimeout(800);
    const cg = await p.evaluate(() => { const g = window.__play.getState().game; return { coach: g.coach, opp: g.opponentId, match: !!g.match, elo: g.elo }; });
    const rating = await p.evaluate(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      return (await import(find('/src/lib/playerRating.ts'))).getPlayerRating();
    });
    if (cg.coach !== 'harder' || cg.opp !== 'coach' || cg.match || cg.elo !== Math.max(100, Math.round(rating + 150))) errors.push(`play-coach-card: the coach game is ${JSON.stringify(cg)} (rating ${rating})`);
    const top = await p.evaluate(() => ({ title: document.querySelector('[data-testid="game-title"]')?.textContent, sub: document.querySelector('[data-testid="game-title"]')?.nextElementSibling?.textContent }));
    if (top.sub !== 'Harder · practice') errors.push(`play-coach-card: the top bar reads ${JSON.stringify(top)}`);
    const dock = await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent).filter((t) => /^(Hint|Take back|Threats)/.test(t ?? '')).length);
    if (dock < 3) errors.push('play-coach-card: no Hint / Take back / Threats in Play Coach');
    await shot('r7-coach-game');
    await p.evaluate(() => window.__play.getState().abandon?.());
    await p.waitForTimeout(500);
    // A real game against a character: no help at all.
    await p.evaluate(() => window.__play.getState().newGame('w', 400, undefined, 'tom', { match: true }));
    await p.waitForTimeout(900);
    await p.evaluate(() => window.__play.getState().endIntro());
    await waitFor(p, ['userTurn'], 60000);
    await p.waitForTimeout(800);
    const realDock = await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.textContent).filter((t) => /^(Hint|Take back|Threats)/.test(t ?? '')).length);
    if (realDock) errors.push('play-coach-card: a real game shows help buttons');
    const sub = await p.evaluate(() => document.querySelector('[data-testid="game-title"]')?.nextElementSibling?.textContent);
    if (sub !== 'Rated · no clock') errors.push(`play-coach-card: a real game's top bar reads ${sub}`);
    await shot('r7-real-game');
    await p.evaluate(() => window.__play.getState().abandon?.());
    await p.evaluate(() => window.__settings.getState().set({ coachStrength: 'your' }));
    await home();
    await p.waitForTimeout(500);
  }

  // badges-new: the badge sheet with Comeback (id clean) and With a clock (id match), earned ones gold.
  if (R('badges-new')) {
    await kv('opponentStats', { tom: { w: 4, l: 1, d: 0, stars: 4, bestAccuracy: 80, badges: ['white', 'clean', 'match'], streak: 0 } });
    await inPage(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      (await import(find('/src/lib/changes.ts'))).announceChange('records');
    });
    await p.evaluate(() => window.__settings.getState().set({ opponentId: 'tom' }));
    await p.evaluate(() => window.__nav.getState().setTab('more'));
    await p.waitForTimeout(300);
    await home();
    await p.waitForTimeout(1200);
    await p.locator('[data-testid="badge-line"]').click();
    await p.waitForTimeout(900);
    const tiles = await p.evaluate(() => [...document.querySelectorAll('[data-badge-tile]')].map((t) => `${t.getAttribute('data-badge-tile')}${t.hasAttribute('data-on') ? '*' : ''}:${t.textContent}`));
    const want = ['clean*:ComebackWin a game you were losing', 'match*:With a clockWin a timed game'];
    for (const w of want) if (!tiles.includes(w)) errors.push(`badges-new: no tile ${w} (${tiles.join(' | ')})`);
    await shot('r7-badges-new');
    await p.locator('[data-testid="badge-sheet"] [aria-label="Close"]').click().catch(() => {});
    await p.waitForTimeout(600);
  }

  if (R('laurel-shop')) {
    // A Steady Hand bought up to II before: kept, but no longer listed as an upgrade. The Run tab
    // loads the Cups code, so open it before patching (the module isn't loaded until then).
    await p.evaluate(() => window.__nav.getState().setTab('run'));
    await p.waitForTimeout(1800);
    await p.waitForFunction(() => performance.getEntriesByType('resource').some((e) => e.name.includes('/src/cups/meta.ts')), null, { timeout: 8000 }).catch(() => {});
    await p.evaluate(async () => {
      const find = (x) => performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x) && !y.includes('?t=')) ?? performance.getEntriesByType('resource').map((e) => e.name).find((y) => y.includes(x));
      const m = await import(find('/src/cups/meta.ts'));
      await m.useCupsMeta.getState().patch({ laurels: 14, levels: { steadyHand: 2, rewind: 2 } });
    });
    await p.waitForTimeout(400);
    await p.locator('button:has-text("Laurel shop")').click();
    await p.waitForTimeout(1500);
    const ids = await p.evaluate(() => [...document.querySelectorAll('[data-testid="upgrade-row"]')].map((e) => e.getAttribute('data-id')).join(','));
    if (ids !== 'rewind,extraMinute,threatBell,colour') errors.push(`laurel-shop: upgrade rows ${ids}`);
    await shot('r4-laurel-shop');
    await p.evaluate(() => document.querySelector('.run-fadeup')?.scrollTo(0, 99999));
    await p.waitForTimeout(500);
    await shot('r4-laurel-shop-bottom');
    await p.locator('button:has-text("Back")').first().click().catch(() => {});
    await home();
    await p.waitForTimeout(600);
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
