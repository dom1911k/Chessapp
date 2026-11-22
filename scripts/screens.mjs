#!/usr/bin/env node
// Screenshot harness (dev tooling): drives the app in Chromium and saves the screens that matter
// into .cache/screens/<label>/, at phone and tablet sizes, in dark and light.
//
//   npm run screens                     # label "latest", all sizes, both themes, every scenario
//   npm run screens -- before           # label "before"
//   npm run screens -- after --only=coached,review --sizes=390x844 --schemes=dark
//   SCREENS_URL=http://localhost:5173 npm run screens   # use a dev server that's already running
//
// Scenarios: home, coached (versus intro, start, 1.e4, a selected piece, 2.Qh5, the pre-check,
// the coached mistake, game over, the board after the results, the ⋯ sheet), review (summary and a
// step), match (clocks: start, mid-game, low time, a premove, a flag), puzzle (hint, solution),
// promotion (Analysis), settings, collection, tabs (Puzzles, Learn, More, Cups).
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
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const shot = async (name) => {
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
    try {
      const errors = await run(size, scheme);
      console.log(errors.length ? ` page errors: ${errors.slice(0, 3).join(' | ')}` : ' ok');
    } catch (e) {
      bad++;
      console.log(` FAILED: ${e.message}`);
    }
  }
stop();
process.exit(bad ? 1 : 0);
