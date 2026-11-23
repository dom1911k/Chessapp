// The points tally after a solve, chess.com style (ported from the prototype): each part pops as
// a square chip on the solved square with its label pill, collapses into a circle on the square's
// corner, flies along a bowed curve into the total and lands with a colour ripple; the odometer
// rolls and the bar fills (crossing a level: a sweep, a bounce, glow rising, the header badge
// flips). The points are already saved; this only shows them. A tap sets token.skip and finish()
// jumps to the end.
import { BOUNCE, POP, animate, buzz, eback, eo3, reduced, sleep, tween, type Token } from '../motion';
import { BLUES, GOLDS, GREENS, GREYS, ORANGES, centre, emit } from '../fx';
import { sfx } from '../sfx';
import { levelAt, type Part, type PathAward } from './path';
import { odo, pathEls, usePathUi } from './pathUi';

export const CHIP_COLOR: Record<string, string> = { base: '#1d9fd8', speed: '#20a97a', clues: '#20a97a', streak: '#f07a2c', gold: '#f2b51c', hint: '#9a9893', flat: '#81b64c', mom: '#81b64c' };
const kindOf = (p: Part) => (p.gold ? 'gold' : p.kind === 'flat' ? 'flat' : p.kind);
const colorOf = (p: Part) => CHIP_COLOR[kindOf(p)] ?? CHIP_COLOR.base;
const colsOf = (k: string) => (k === 'gold' ? GOLDS : k === 'speed' || k === 'clues' ? BLUES : k === 'streak' ? ORANGES : k === 'hint' ? GREYS : GREENS);

export interface BoardRef {
  el: HTMLElement;
  orientation: 'white' | 'black';
}
/** Top-left of a square in % of the board. */
export function sqPos(sq: string, orientation: 'white' | 'black') {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  return { left: col * 12.5, top: row * 12.5 };
}

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** The ✓ / ✗ badge on the square's top-right corner. */
export function boardMark(b: BoardRef, sq: string, kind: 'good' | 'bad') {
  b.el.querySelectorAll('.pp-mark').forEach((e) => e.remove());
  const p = sqPos(sq, b.orientation);
  const el = document.createElement('div');
  el.className = `pp-mark ${kind}`;
  el.dataset.testid = `pp-mark-${kind}`;
  el.style.left = `${p.left + 12.5 - 1}%`;
  el.style.top = `${p.top + 1}%`;
  el.innerHTML = kind === 'good' ? CHECK : CROSS;
  b.el.appendChild(el);
  void animate(el, [{ transform: 'translate(-50%,-50%) scale(0) rotate(-60deg)' }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)' }], BOUNCE);
}
/** A soft ring spreading from a square. */
export function boardRing(b: BoardRef, sq: string, color = 'rgba(255,255,255,.7)') {
  const p = sqPos(sq, b.orientation);
  const el = document.createElement('div');
  el.className = 'pp-ring';
  el.style.borderColor = color;
  el.style.left = `${p.left + 6.25}%`;
  el.style.top = `${p.top + 6.25}%`;
  b.el.appendChild(el);
  void animate(el, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0.7 }, { transform: 'translate(-50%,-50%) scale(2)', opacity: 0 }], { d: 520, e: 'cubic-bezier(.2,.8,.3,1)' }).then(() => el.remove());
}
export function clearBoardFx(b: BoardRef | null) {
  b?.el.querySelectorAll('.pp-chip,.pp-mark,.pp-ring').forEach((e) => e.remove());
  document.querySelectorAll('.pp-orb,.pp-ripple').forEach((e) => e.remove());
}

// ---------- The header and card beats ----------

export function flameUp(streak: number) {
  usePathUi.getState().set({ streak });
  for (const el of [pathEls.flame, pathEls.cardFlame]) {
    const svg = el?.querySelector('svg');
    void animate(svg, [{ transform: 'scale(1.7) translateY(-2px)' }, { transform: 'scale(1)' }], BOUNCE);
  }
  const svg = pathEls.flame?.querySelector('svg');
  if (svg) {
    const r = centre(svg);
    emit({ x: r.x, y: r.y + r.h * 0.1, n: 12, shape: 'glow', colors: ORANGES, speed: [30, 110], angle: -90, spread: 70, gravity: -90, life: [0.5, 1], size: [2, 4] });
  }
  sfx('ember');
}
export function flameOut() {
  const svg = pathEls.flame?.querySelector('svg');
  if (svg) {
    const r = centre(svg);
    emit({ x: r.x, y: r.y - r.h * 0.1, n: 14, shape: 'smoke', colors: GREYS, speed: [15, 60], angle: -90, spread: 50, gravity: -50, drag: 0.97, life: [0.7, 1.2], size: [3, 6] });
    void animate(svg, [{ transform: 'scale(1)' }, { transform: 'scale(.55)' }, { transform: 'scale(1)' }], { d: 620, e: 'ease-in-out' });
  }
  sfx('smoke');
  setTimeout(() => usePathUi.getState().set({ streak: 0 }), 220);
}
export function dotFill(i: number) {
  usePathUi.getState().set({ daily: i + 1 });
  requestAnimationFrame(() => {
    const d = pathEls.dots?.children[i] as HTMLElement | undefined;
    if (!d) return;
    void animate(d, [{ transform: 'scale(0) rotate(-120deg)' }, { transform: 'scale(1) rotate(0)' }], BOUNCE);
    const r = centre(d);
    emit({ x: r.x, y: r.y, n: 10, shape: 'star', colors: GOLDS, speed: [40, 140], life: [0.35, 0.7], size: [2, 5] });
  });
}

/** The bar at a points value (odometer, width, "170 / 175"); the badge/labels follow the UI store. */
export function barAt(points: number, into?: number) {
  const P = levelAt(points);
  const v = into ?? P.into;
  const pct = Math.max(0, Math.min(1, v / P.cost)) * 100;
  if (pathEls.fill) pathEls.fill.style.width = `${Math.max(2, pct)}%`;
  odo(pathEls.total, points);
  if (pathEls.tonext) pathEls.tonext.textContent = `${Math.round(Math.max(0, Math.min(v, P.cost))).toLocaleString('en-US')} / ${P.cost.toLocaleString('en-US')}`;
}

function flipCrest(points: number) {
  const w = pathEls.crest;
  void animate(w, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { d: 150, e: 'ease-in' }).then(() => {
    usePathUi.getState().set({ points });
    void animate(w, [{ transform: 'rotateY(-90deg) scale(1.35)' }, { transform: 'rotateY(0) scale(1)' }], BOUNCE);
    if (w) {
      const c = centre(w);
      emit({ x: c.x, y: c.y, n: 16, shape: 'star', colors: GOLDS, speed: [60, 190], life: [0.4, 0.8], size: [3, 7] });
    }
    void animate(pathEls.endBadge, [{ transform: 'translateY(-50%) scale(1.6) rotate(-20deg)' }, { transform: 'translateY(-50%) scale(1)' }], BOUNCE);
  });
}
async function levelCross(points: number, tk: Token) {
  void animate(pathEls.sweep, [{ transform: 'translateX(-150%)' }, { transform: 'translateX(330%)' }], { d: 520, e: 'ease-in-out' });
  void animate(pathEls.track, [{ transform: 'scale(1.03,1.7)', filter: 'brightness(1.6)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], BOUNCE);
  if (pathEls.track) {
    const tr = pathEls.track.getBoundingClientRect();
    for (let i = 0; i < 4; i++) emit({ x: tr.left + (tr.width * (i + 0.5)) / 4, y: tr.top + tr.height / 2, jx: tr.width / 8, n: 9, shape: 'glow', colors: ORANGES.concat(GOLDS), speed: [60, 210], angle: -90, spread: 120, gravity: -50, life: [0.5, 1], size: [2, 5] });
  }
  sfx('unlock');
  buzz(14);
  flipCrest(points);
  await sleep(300, tk);
}

/** Fill the bar from one total to another, flipping the level at every boundary crossed. */
export async function fillTo(from: number, to: number, tk: Token) {
  let v = from;
  while (v < to - 1e-6) {
    if (tk.skip) return;
    const P = levelAt(v);
    const end = P.start + P.cost;
    if (to >= end) {
      const a = v;
      await tween(300, (k) => {
        const x = a + (end - a) * eo3(k);
        barAt(x, x - P.start);
      }, tk);
      if (tk.skip) return;
      await levelCross(end, tk);
      if (tk.skip) return;
      v = end;
      barAt(v);
      void animate(pathEls.fill, [{ opacity: 0.2 }, { opacity: 1 }], { d: 220 });
    } else {
      const a = v;
      await tween(440, (k) => {
        const x = a + (to - a) * eo3(k);
        const w = P.into + (to - a) * Math.min(1.06, eback(k));
        barAt(x, w);
      }, tk);
      v = to;
    }
  }
}

function makeChip(b: BoardRef, sq: string, p: Part) {
  const pos = sqPos(sq, b.orientation);
  const el = document.createElement('div');
  el.className = `pp-chip ${kindOf(p)}`;
  el.style.left = `${pos.left}%`;
  el.style.top = `${pos.top}%`;
  el.style.setProperty('--c', colorOf(p));
  // On the top rank the pill would leave the board: it sits just inside the square instead. On the
  // edge files it lines up with the board's edge rather than centring on the square.
  if (pos.left === 0) el.style.cssText += ';--lx:2px;--tx:0%';
  if (pos.left === 87.5) el.style.cssText += ';--lx:calc(100% - 2px);--tx:-100%';
  const lab = pos.top === 0 ? ' style="bottom:auto;top:2px"' : '';
  el.innerHTML = `<div class="csq"><span>+${p.points}</span></div><div class="clab"${lab}>${p.label}</div>`;
  b.el.appendChild(el);
  return el;
}
function popChip(el: HTMLElement, p: Part) {
  void animate(el.querySelector('.csq'), [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], POP);
  const tx = el.style.getPropertyValue('--tx') || '-50%';
  void animate(el.querySelector('.clab'), [{ transform: `translate(${tx},10px) scale(.5)`, opacity: 0 }, { transform: `translate(${tx},0) scale(1)`, opacity: 1 }], { ...POP, delay: 70 });
  if (p.gold)
    requestAnimationFrame(() => {
      const r = centre(el.querySelector('.csq')!);
      emit({ x: r.x, y: r.y, n: 14, shape: 'star', colors: colsOf('gold'), speed: [60, 200], life: [0.35, 0.65], size: [3, 6] });
    });
}
async function collapse(el: HTMLElement) {
  const tx = el.style.getPropertyValue('--tx') || '-50%';
  void animate(el.querySelector('.clab'), [{ opacity: 1 }, { opacity: 0, transform: `translate(${tx},-8px) scale(.8)` }], { d: 200 });
  await animate(el.querySelector('.csq'), [{ transform: 'translate(0,0) scale(1)', borderRadius: '0%' }, { transform: 'translate(36%,-36%) scale(.46)', borderRadius: '50%' }], { d: 300, e: 'cubic-bezier(.55,0,.3,1)' });
}
/** A circle flying into the total along a bowed curve. Resolves on landing. */
export async function flyTo(fromEl: Element | { x: number; y: number; w: number }, text: string, color: string, tk: Token, ms = 440) {
  const r = fromEl instanceof Element ? centre(fromEl) : { ...fromEl, h: fromEl.w };
  const orb = document.createElement('div');
  orb.className = 'pp-orb';
  orb.style.setProperty('--c', color);
  orb.textContent = text;
  orb.style.left = `${r.x}px`;
  orb.style.top = `${r.y}px`;
  orb.style.width = orb.style.height = `${Math.max(26, r.w)}px`;
  document.body.appendChild(orb);
  const t = pathEls.total ? centre(pathEls.total) : { x: innerWidth / 2, y: innerHeight * 0.7, w: 60 };
  const sx = r.x;
  const sy = r.y;
  const tx = (pathEls.total?.getBoundingClientRect().left ?? t.x) + Math.min(t.w, 70) * 0.5;
  const ex = tx;
  const ey = t.y;
  const qx = Math.max(sx, ex) + 50;
  const qy = Math.min(sy, ey) - 30;
  sfx('whoosh');
  await tween(ms, (k) => {
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * qx + e * e * ex;
    const y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * qy + e * e * ey;
    orb.style.transform = `translate(-50%,-50%) translate(${x - sx}px,${y - sy}px) scale(${1 - 0.2 * e})`;
  }, tk);
  orb.remove();
}
/** Landing on the total: a colour ripple, the total pops, "+N" grows. */
export function impactTotal(color: string, gain: number, step: number) {
  const tEl = pathEls.total;
  if (tEl) {
    const t = tEl.getBoundingClientRect();
    const rp = document.createElement('div');
    rp.className = 'pp-ripple';
    rp.style.left = `${t.left + Math.min(t.width, 70) * 0.5}px`;
    rp.style.top = `${t.top + t.height / 2}px`;
    rp.style.background = color;
    document.body.appendChild(rp);
    void animate(rp, [{ transform: 'translate(-50%,-50%) scale(.12)', opacity: 0.8 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { d: 680, e: 'cubic-bezier(.2,.8,.3,1)' }).then(() => rp.remove());
    void animate(tEl, [{ transform: 'scale(1.2)' }, { transform: 'scale(1)' }], POP);
  }
  usePathUi.getState().set({ gain });
  requestAnimationFrame(() => void animate(pathEls.gain, [{ transform: 'translateY(5px) scale(1.4)' }, { transform: 'none' }], POP));
  sfx('impact', step);
  buzz(6);
}

export interface TallyHooks {
  /** The ✓ on the square (after the last part lands). */
  onMark(): void;
}

/**
 * Run the chips for an award's parts on the solved square. Moments are left for their own scenes:
 * the bar stops at before + chips. Returns false when skipped.
 */
export async function runTally(award: PathAward, b: BoardRef, sq: string, tk: Token, hooks: TallyHooks): Promise<boolean> {
  const ui = usePathUi.getState();
  const before = award.before;
  barAt(before);
  // As the solve lands: the Daily Solver piece springs in, and the flame (if no streak chip).
  const clean = award.parts.some((p) => p.kind === 'base');
  if (clean && award.dailyCount <= 3 && award.dailyCount > ui.daily) setTimeout(() => !tk.skip && dotFill(award.dailyCount - 1), 160);
  const streakChip = award.parts.some((p) => p.kind === 'streak');
  if (clean && !streakChip && award.streak > ui.streak) setTimeout(() => !tk.skip && flameUp(award.streak), 260);
  if (reduced()) return true;
  await sleep(450, tk);
  let shown = before;
  let gain = 0;
  let q: Promise<void> = Promise.resolve();
  const flights: Promise<void>[] = [];
  for (const [k, p] of award.parts.entries()) {
    if (tk.skip) return false;
    const chip = makeChip(b, sq, p);
    popChip(chip, p);
    if (p.gold) sfx('gold');
    else sfx('tick', k);
    buzz(p.gold ? 18 : 8);
    await sleep(p.gold ? 720 : 520, tk);
    if (tk.skip) return false;
    await collapse(chip);
    if (tk.skip) return false;
    const sqEl = chip.querySelector('.csq')!;
    const box = centre(sqEl);
    chip.remove();
    flights.push(
      flyTo({ x: box.x, y: box.y, w: box.w }, `+${p.points}`, colorOf(p), tk).then(() => {
        if (tk.skip) return;
        gain += p.points;
        impactTotal(colorOf(p), gain, k);
        if (p.kind === 'streak') flameUp(award.streak);
        const from = shown;
        const to = shown + p.points;
        shown = to;
        q = q.then(() => fillTo(from, to, tk));
      }),
    );
    await sleep(150, tk);
  }
  await Promise.all(flights);
  await q;
  if (tk.skip) return false;
  hooks.onMark();
  sfx('correct');
  await sleep(380, tk);
  return !tk.skip;
}
