// Moments: rare celebrations over the board (chess.com's Daily Solver, and four of our own), ported
// from the prototype. After the chip tally and before the level-up panel the board dims, a
// centrepiece plays at 44% of the board's height, a title and its reward line fade in, then the
// centrepiece gives way to a green reward orb that flies into the total and fills the bar (so a
// moment can carry the bar over a level). At most two per puzzle, the rarer one last; the board
// stays dimmed between them. A tap skips to the reward orb, a second lands it. The points are
// already saved; this only shows them.
import { D, POP, SOFT, animate, sleep, speed, tween, type Token } from '../motion';
import { CONFETTI, GOLDS, emit } from '../fx';
import { sfx } from '../sfx';
import type { Moment, PathAward } from './path';
import { pathEls } from './pathUi';
import { CHIP_COLOR, barAt, fillTo, impactTotal } from './tally';
import { ISO } from './world';

/**
 * Where the chip tally stops: the moments' points haven't touched the bar yet, so the bar shows
 * `base` (before + chips) and the "+N" shows `gain` (the chips) until each reward orb lands.
 */
export function momentSplit(a: Pick<PathAward, 'moments' | 'after' | 'total'>) {
  const msum = a.moments.reduce((x, m) => x + m.points, 0);
  return { msum, base: a.after - msum, gain: a.total - msum };
}

/** A moment run's token: `skip` jumps to the reward (and then lands it), `dead` ends everything. */
export interface MomToken extends Token {
  dead?: boolean;
  done?: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}
const box = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
};

let layer: HTMLElement | null = null;
let stage: HTMLElement | null = null;
let dim: HTMLElement | null = null;
let title: HTMLElement | null = null;
let sub: HTMLElement | null = null;
const $stage = () => stage!;
const stageXY = () => {
  const r = box($stage());
  return { x: r.cx, y: r.cy };
};
function mkEl(cls: string, html = '', parent: HTMLElement = $stage()) {
  const e = document.createElement('div');
  e.className = cls;
  e.innerHTML = html;
  parent.appendChild(e);
  return e;
}
function glowAt(x: number, y: number, col = 'rgba(255,206,74,.55)', size = 200) {
  const g = mkEl('mglow');
  g.style.left = `${x}px`;
  g.style.top = `${y}px`;
  g.style.width = g.style.height = `${size}px`;
  g.style.background = `radial-gradient(circle,${col},transparent 68%)`;
  void animate(g, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], { d: 700, e: 'cubic-bezier(.2,.7,.3,1)' }).then(() => g.remove());
}
const popIn = (el: Element, d = 420, delay = 0) =>
  animate(el, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { d, delay, e: 'cubic-bezier(.3,.7,.4,1)' });
const chkPop = (el: Element, delay = 0) =>
  animate(el, [{ transform: 'translateX(-50%) scale(0) rotate(-40deg)', opacity: 0 }, { transform: 'translateX(-50%) scale(1.3) rotate(8deg)', opacity: 1, offset: 0.6 }, { transform: 'translateX(-50%) scale(1)', opacity: 1 }], { d: 380, delay, e: 'ease-out' });
const fadeOut = (els: Element[], d = 260) => els.forEach((e) => void animate(e, [{ opacity: 1 }, { opacity: 0 }], { d }));
/** A puzzle-piece badge in a board's material, without its number. */
const piece = (tier: number, size: number, tilt: number) => (ISO.badge(tier, '', size, tilt) as string).replace(/<text[^>]*>[^<]*<\/text>/, '');

// ---------- 1 · Daily Solver: three pieces snap together, 1 – 2 – 3 ----------

const JIG_GOLD = ['#ffd04a', '#f2ac12', '#c98608'];
const JIG_CREAM = ['#fff6d2', '#f9e19a', '#d9b453'];
/** A horizontal jigsaw piece: an optional socket on the left, a knob on the right. */
export function jigPath(w: number, h: number, left: boolean, right: boolean) {
  const r = h * 0.16;
  const y = h / 2;
  const c = 6;
  let d = `M${c},0 H${w - c} Q${w},0 ${w},${c}`;
  if (right) d += ` V${y - r * 0.75} C${w + r * 0.15},${y - r * 1.7} ${w + r * 2.2},${y - r * 1.6} ${w + r * 2.2},${y} C${w + r * 2.2},${y + r * 1.6} ${w + r * 0.15},${y + r * 1.7} ${w},${y + r * 0.75}`;
  d += ` V${h - c} Q${w},${h} ${w - c},${h} H${c} Q0,${h} 0,${h - c}`;
  if (left) d += ` V${y + r * 0.75} C${r * 0.15},${y + r * 1.7} ${r * 2.2},${y + r * 1.6} ${r * 2.2},${y} C${r * 2.2},${y - r * 1.6} ${r * 0.15},${y - r * 1.7} 0,${y - r * 0.75}`;
  return `${d} V${c} Q0,0 ${c},0 Z`;
}
let jid = 0;
function jigSVG(w: number, h: number, left: boolean, right: boolean, col: string[], num: number, numCol: string) {
  const id = `jg${jid++}`;
  const pad = h * 0.4;
  const edge = jigPath(w, h, left, false);
  return `<svg width="${w + pad}" height="${h + 8}" viewBox="0 0 ${w + pad} ${h + 8}" style="overflow:visible"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col[0]}"/><stop offset="1" stop-color="${col[1]}"/></linearGradient></defs><path d="${edge}" fill="${col[2]}" transform="translate(0,6)"/><path d="${jigPath(w, h, left, right)}" fill="url(#${id})"/><path d="${edge}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" transform="translate(1.5,1.5) scale(${((w - 3) / w).toFixed(3)},${((h - 3) / h).toFixed(3)})"/><text x="${w / 2}" y="${h * 0.68}" text-anchor="middle" font-size="${h * 0.52}" font-weight="900" fill="${numCol}" font-family="Plus Jakarta Sans,system-ui,sans-serif" style="paint-order:stroke" stroke="${col[2]}" stroke-opacity=".35" stroke-width="2">${num}</text></svg>`;
}
const CHECK = (s: number) =>
  `<svg class="mchk" width="${s}" height="${s}" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="#81b64c" stroke="#fff" stroke-width="2.4"/><path d="M8,14.5 l4,4 l8,-9" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

async function momDaily3(m: Moment, tk: MomToken) {
  const W = 70;
  const H = 60;
  const row = mkEl('jrow');
  const rw = 3 * W + H * 0.36;
  row.style.width = `${rw}px`;
  row.style.left = `${-rw / 2}px`;
  row.style.top = `${-H / 2}px`;
  const cols = [JIG_GOLD, JIG_CREAM, JIG_GOLD];
  const numc = ['#ffffff', '#e7a514', '#ffffff'];
  const ps: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const p = mkEl('jp', jigSVG(W, H, i > 0, i < 2, cols[i], i + 1, numc[i]) + CHECK(30), row);
    p.style.left = `${i * W}px`;
    p.style.zIndex = String(3 - i);
    p.style.opacity = '0';
    ps.push(p);
  }
  const shift = (n: number) => ((3 - n) * W) / 2;
  row.style.transform = `translateX(${shift(1)}px)`;
  for (let i = 0; i < 3; i++) {
    if (tk.skip) return;
    const p = ps[i];
    const c = p.querySelector('.mchk') as HTMLElement;
    c.style.opacity = '0';
    if (i === 0) void popIn(p, 440);
    else {
      void animate(row, [{ transform: `translateX(${shift(i)}px)` }, { transform: `translateX(${shift(i + 1)}px)` }], { d: 260, e: 'cubic-bezier(.3,.8,.3,1)' });
      void animate(p, [{ transform: 'translateX(64px) scale(.92)', opacity: 0 }, { transform: 'translateX(-4px) scale(1.02)', opacity: 1, offset: 0.75 }, { transform: 'none', opacity: 1 }], { d: 260, e: 'ease-out' });
    }
    await sleep(i ? 200 : 180, tk);
    if (tk.skip) return;
    sfx('snap', i);
    const r = box(p);
    const s = box($stage());
    if (i > 0) glowAt(r.x - s.x + 4, r.cy - s.y, 'rgba(255,214,90,.6)', 210);
    emit({ x: r.x + (i ? 2 : r.w / 2), y: r.cy, n: i ? 14 : 8, shape: 'star', colors: GOLDS.concat(['#fff']), speed: [50, 170], life: [0.35, 0.7], size: [2, 5] });
    void chkPop(c, 90);
    await sleep(i < 2 ? 300 : 260, tk);
  }
  if (tk.skip) return;
  const r = box(row);
  emit({ x: r.cx, y: r.cy, n: 26, shape: 'confetti', colors: ['#ffd04a', '#f2ac12', '#fff6d2', '#81b64c', '#ffffff'], speed: [120, 320], angle: -90, spread: 200, gravity: 320, drag: 0.95, life: [0.9, 1.5], size: [2.5, 4.5] });
  momText('Daily Solver', `Reward: ${m.points} points`);
  await sleep(1000, tk);
  ps.forEach((p, i) => void animate(p, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.6)', opacity: 0 }], { d: 240, delay: i * 40, e: 'ease-in' }));
  await sleep(300, tk);
}

// ---------- 2 · Daily Ten: a ring of ten pieces fills clockwise, a gold 10 springs into the middle ----------

async function momDaily10(m: Moment, tk: MomToken) {
  const R = 78;
  const ring = mkEl('mring');
  const ps: HTMLElement[] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const p = mkEl('mpz', piece(7, 30, -12), ring);
    p.style.left = `${Math.cos(a) * R}px`;
    p.style.top = `${Math.sin(a) * R}px`;
    ps.push(p);
    void popIn(p, 300, i * 22);
  }
  await sleep(420, tk);
  for (let i = 0; i < 10; i++) {
    if (tk.skip) return;
    const p = ps[i];
    p.classList.add('on');
    void animate(p, [{ transform: 'scale(1.45)' }, { transform: 'scale(1)' }], POP);
    sfx('fill', i);
    const r = box(p);
    emit({ x: r.cx, y: r.cy, n: 5, shape: 'star', colors: GOLDS, speed: [30, 110], life: [0.3, 0.55], size: [2, 4] });
    await sleep(i < 9 ? 82 : 140, tk);
  }
  if (tk.skip) return;
  const big = mkEl('mbig', ISO.badge(7, 10, 96, -12) as string);
  void animate(big, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15) rotate(4deg)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { d: 520, e: 'ease-out' });
  const rays = mkEl('mrays');
  void animate(rays, [{ opacity: 0 }, { opacity: 1 }], { d: 600 });
  sfx('reveal');
  const s = stageXY();
  glowAt(0, 0, 'rgba(255,226,120,.6)', 260);
  emit({ x: s.x, y: s.y, n: 34, shape: 'confetti', colors: ['#ffe08a', '#f2b51c', '#fff8dc', '#ffffff', '#81b64c'], speed: [140, 360], angle: -90, spread: 360, gravity: 260, drag: 0.95, life: [1, 1.7], size: [2.5, 4.5] });
  void animate(ring, [{ transform: 'rotate(0)' }, { transform: 'rotate(40deg)' }], { d: 2400, e: 'ease-out' });
  momText('Daily Ten', `Ten clean solves today · Reward: ${m.points} points`);
  await sleep(1350, tk);
  fadeOut([ring, big, rays]);
  await sleep(300, tk);
}

// ---------- 3 · Streak milestone: a spark rises and ignites a flame with the count inside it ----------

const FLAME: Record<number, string[]> = { 10: ['#ff4f9a', '#ff9ac8', '#fff0f7'], 25: ['#9b5cff', '#c9a4ff', '#f6efff'], 50: ['#2f9bff', '#8fd0ff', '#effaff'], 100: ['#ff9a00', '#ffd23a', '#fffbe6'] };
/** 15 pink, 30 violet, 50 blue, 100+ gold. */
export const flameKey = (n: number) => (n >= 100 ? 100 : n >= 50 ? 50 : n >= 25 ? 25 : 10);

async function momStreak(m: Moment, tk: MomToken) {
  const n = m.n ?? 0;
  const C = FLAME[flameKey(n)];
  const fl = '<path d="M0,-108 C22,-80 54,-58 50,-22 C47,8 26,24 0,24 C-26,24 -47,8 -50,-22 C-53,-50 -30,-62 -18,-86 C-14,-66 -4,-58 4,-60 C0,-76 -4,-92 0,-108 Z"/>';
  const svg = `<svg class="mfl" width="140" height="160" viewBox="-70 -128 140 160" style="overflow:visible"><g class="f1" fill="${C[0]}"><g class="fk">${fl}</g></g><g class="f2" fill="${C[1]}" transform="translate(0,6) scale(.72)"><g class="fk">${fl}</g></g><g class="f3" fill="${C[2]}" transform="translate(0,14) scale(.42)"><g class="fk">${fl}</g></g></svg><b class="mfn">${n}</b>`;
  const spark = mkEl('mspark');
  spark.style.background = `radial-gradient(circle,#fff,${C[1]} 40%,transparent 70%)`;
  sfx('rise');
  const s = stageXY();
  await tween(420, (q) => {
    const e = 1 - Math.pow(1 - q, 3);
    spark.style.transform = `translate(-50%,-50%) translateY(${(1 - e) * 110}px) scale(${0.6 + 0.4 * e})`;
    emit({ x: s.x, y: s.y + (1 - e) * 110, n: 1, shape: 'glow', colors: [C[1], '#fff'], speed: [5, 30], life: [0.25, 0.45], size: [2, 4] });
  }, tk);
  if (tk.skip) return;
  spark.remove();
  const f = mkEl('mflame', svg);
  sfx('ignite');
  glowAt(0, 0, `${C[1]}aa`, 280);
  void animate(f.querySelector('.mfl'), [{ transform: 'scale(.2,0)', opacity: 0.4 }, { transform: 'scale(1.12,1.18)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }], { d: 560, e: 'cubic-bezier(.3,.7,.4,1)' });
  const ringE = mkEl('mfring');
  ringE.style.borderColor = C[1];
  void animate(ringE, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.95 }, { transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0 }], { d: 800, e: 'cubic-bezier(.2,.8,.3,1)' });
  void popIn(f.querySelector('.mfn')!, 420, 220);
  let k = 0;
  const emb = setInterval(() => {
    if (tk.skip || !stage || ++k > 26) return clearInterval(emb);
    const q = stageXY();
    emit({ x: q.x + (Math.random() - 0.5) * 60, y: q.y + 10, n: 2, shape: 'spark', colors: [C[0], C[1], '#fff'], speed: [60, 170], angle: -90, spread: 50, gravity: -40, life: [0.4, 0.8], size: [1.5, 2.5] });
  }, 60);
  momText(`${n} in a row!`, `Streak milestone · Reward: ${m.points} points`);
  await sleep(1600, tk);
  clearInterval(emb);
  void animate(f, [{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.7,.2)' }], { d: 300, e: 'ease-in' });
  sfx('smoke');
  await sleep(320, tk);
}

// ---------- 4 · Every 100 solves: pieces rain into a pyramid, a ribbon unfurls across it ----------

async function momSolved(m: Moment, tk: MomToken) {
  const S2 = 34;
  const G = mkEl('mpyr');
  const ps: HTMLElement[] = [];
  let k = 0;
  [4, 3, 2, 1].forEach((n, ri) => {
    for (let j = 0; j < n; j++) {
      const x = (j - (n - 1) / 2) * (S2 + 2);
      const y = -ri * (S2 - 4) + 40;
      const p = mkEl('mpp', piece(k % 8, S2 + 6, ((k * 37) % 20) - 10), G);
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.opacity = '0';
      ps.push(p);
      k++;
    }
  });
  for (let i = 0; i < ps.length; i++) {
    if (tk.skip) return;
    const p = ps[i];
    void animate(p, [{ transform: 'translate(-50%,-50%) translateY(-240px) rotate(-30deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) translateY(0) rotate(0)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) translateY(-7px)', opacity: 1, offset: 0.85 }, { transform: 'translate(-50%,-50%)', opacity: 1 }], { d: 420, e: 'cubic-bezier(.5,0,.7,.4)' });
    setTimeout(() => {
      if (tk.skip || !p.isConnected) return;
      sfx('clack', i);
      const r = box(p);
      emit({ x: r.cx, y: r.y + r.h * 0.9, n: 4, shape: 'dust', colors: ['rgba(255,255,255,.5)'], speed: [30, 80], angle: -90, spread: 160, gravity: -10, drag: 0.9, life: [0.25, 0.4], size: [1.5, 2.5] });
    }, D(300));
    await sleep(85, tk);
  }
  await sleep(420, tk);
  if (tk.skip) return;
  const rb = mkEl(
    'mrib',
    `<svg width="236" height="64" viewBox="0 0 236 64"><path d="M2,22 L30,22 L30,58 L16,50 L2,58 Z" fill="#b67a06"/><path d="M234,22 L206,22 L206,58 L220,50 L234,58 Z" fill="#b67a06"/><path d="M30,22 L44,30 L44,14 Z" fill="#7e5304"/><path d="M206,22 L192,30 L192,14 Z" fill="#7e5304"/><rect x="30" y="6" width="176" height="40" rx="6" fill="url(#ribG)"/><rect x="30" y="6" width="176" height="40" rx="6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/><defs><linearGradient id="ribG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd85a"/><stop offset="1" stop-color="#e9a10f"/></linearGradient></defs><text x="118" y="36" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" font-family="Plus Jakarta Sans,system-ui,sans-serif" stroke="#a86f05" stroke-width="3" style="paint-order:stroke">${(m.n ?? 0).toLocaleString('en-US')}</text></svg><i class="mshine"></i>`,
  );
  void animate(rb, [{ transform: 'translate(-50%,-50%) scaleX(0)', opacity: 1 }, { transform: 'translate(-50%,-50%) scaleX(1.08)', opacity: 1, offset: 0.65 }, { transform: 'translate(-50%,-50%) scaleX(1)', opacity: 1 }], { d: 460, e: 'ease-out' });
  void animate(rb.querySelector('.mshine'), [{ transform: 'translateX(-140px) skewX(-20deg)' }, { transform: 'translateX(260px) skewX(-20deg)' }], { d: 900, delay: 420, e: 'ease-in-out' });
  sfx('reveal');
  const s = stageXY();
  emit({ x: s.x, y: s.y + 30, n: 30, shape: 'confetti', colors: CONFETTI, speed: [140, 340], angle: -90, spread: 200, gravity: 300, drag: 0.95, life: [1, 1.6], size: [2.5, 4.5] });
  momText(`${(m.n ?? 0).toLocaleString('en-US')} puzzles solved`, `Reward: ${m.points} points`);
  await sleep(1450, tk);
  fadeOut([G, rb]);
  await sleep(300, tk);
}

// ---------- 5 · Perfect week: seven days light up along an arc, a crown drops onto them ----------

async function momWeek(m: Moment, tk: MomToken) {
  const arc = mkEl('marc');
  const ds: HTMLElement[] = [];
  const L = 'MTWTFSS';
  for (let i = 0; i < 7; i++) {
    const a = ((200 + i * (140 / 6)) * Math.PI) / 180;
    const d = mkEl('mday', `<b>${L[i]}</b>`, arc);
    d.style.left = `${Math.cos(a) * 96}px`;
    d.style.top = `${Math.sin(a) * 96 + 70}px`;
    ds.push(d);
    void popIn(d, 280, i * 30);
  }
  await sleep(380, tk);
  for (let i = 0; i < 7; i++) {
    if (tk.skip) return;
    const d = ds[i];
    d.classList.add('on');
    d.innerHTML = `<b>${L[i]}</b>${CHECK(18)}`;
    void animate(d, [{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], POP);
    sfx('fill', i + 1);
    const r = box(d);
    emit({ x: r.cx, y: r.cy, n: 6, shape: 'star', colors: GOLDS, speed: [30, 120], life: [0.3, 0.55], size: [2, 4] });
    await sleep(115, tk);
  }
  if (tk.skip) return;
  await sleep(120, tk);
  const cr = mkEl(
    'mcrown',
    '<svg width="120" height="92" viewBox="0 0 120 92"><defs><linearGradient id="crG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#e09b0c"/></linearGradient></defs><path d="M10,78 L4,24 L32,48 L60,8 L88,48 L116,24 L110,78 Z" fill="#b77a06" transform="translate(0,5)"/><path d="M10,78 L4,24 L32,48 L60,8 L88,48 L116,24 L110,78 Z" fill="url(#crG)"/><rect x="10" y="66" width="100" height="14" rx="3" fill="#f2b51c"/><circle cx="4" cy="22" r="6" fill="#ffe17a"/><circle cx="60" cy="7" r="7" fill="#ffe17a"/><circle cx="116" cy="22" r="6" fill="#ffe17a"/><circle cx="35" cy="73" r="4.5" fill="#e0383e"/><circle cx="60" cy="73" r="5.5" fill="#5cc8e6"/><circle cx="85" cy="73" r="4.5" fill="#81b64c"/><path d="M18,62 L14,32" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/></svg>',
  );
  void animate(cr, [{ transform: 'translate(-50%,-50%) translateY(-200px) rotate(-14deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) translateY(0) rotate(0)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,-50%) translateY(-14px) rotate(3deg)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%)', opacity: 1 }], { d: 640, e: 'cubic-bezier(.5,0,.6,1)' });
  await sleep(390, tk);
  if (tk.skip) return;
  sfx('weekCrown');
  const rays = mkEl('mrays');
  void animate(rays, [{ opacity: 0 }, { opacity: 1 }], { d: 600 });
  const s = stageXY();
  glowAt(0, -10, 'rgba(255,226,120,.6)', 260);
  emit({ x: s.x, y: s.y - 10, n: 30, shape: 'star', colors: GOLDS.concat(['#fff']), speed: [100, 300], life: [0.6, 1.1], size: [3, 7] });
  momText('Perfect week', `Daily Solver 7 days in a row · Reward: ${m.points} points`);
  await sleep(1500, tk);
  fadeOut([arc, cr, rays]);
  await sleep(300, tk);
}

// ---------- The shared frame: open, text, the reward orb, close ----------

function momText(t: string, s: string) {
  if (!title || !sub) return;
  title.textContent = t;
  sub.textContent = s;
  void animate(title, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], SOFT);
  void animate(sub, [{ opacity: 0 }, { opacity: 0.85 }], { d: 420, delay: 140 });
}

async function momReward(m: Moment, tk: MomToken, gain: number, last: boolean) {
  const s = stageXY();
  const orb = document.createElement('div');
  orb.className = 'pp-orbR';
  orb.textContent = String(m.points);
  orb.style.left = `${s.x}px`;
  orb.style.top = `${s.y}px`;
  document.body.appendChild(orb);
  void animate(orb, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.18)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { d: 380, e: 'ease-out' });
  sfx('reward');
  const rp = document.createElement('div');
  rp.className = 'pp-ripple';
  rp.style.left = `${s.x}px`;
  rp.style.top = `${s.y}px`;
  rp.style.background = '#81b64c';
  document.body.appendChild(rp);
  void animate(rp, [{ transform: 'translate(-50%,-50%) scale(.1)', opacity: 0.75 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { d: 760, e: 'cubic-bezier(.2,.8,.3,1)' }).then(() => rp.remove());
  await sleep(560, tk);
  if (last && dim) void animate(dim, [{ opacity: 1 }, { opacity: 0 }], { d: 520 });
  if (title && sub) fadeOut([title, sub], 300);
  const tEl = pathEls.total;
  const t = tEl ? box(tEl) : { x: innerWidth / 2, cy: innerHeight * 0.7, w: 60 };
  const ex = t.x + Math.min(t.w, 70) * 0.5;
  const ey = t.cy;
  const qx = Math.max(s.x, ex) + 60;
  const qy = Math.min(s.y, ey) - 20;
  sfx('whoosh');
  if (!tk.skip)
    await tween(480, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * s.x + 2 * (1 - e) * e * qx + e * e * ex;
      const y = (1 - e) * (1 - e) * s.y + 2 * (1 - e) * e * qy + e * e * ey;
      orb.style.transform = `translate(-50%,-50%) translate(${x - s.x}px,${y - s.y}px) scale(${1 - 0.25 * e})`;
      emit({ x, y, n: 1, shape: 'glow', colors: ['#81b64c', '#ffffff'], speed: [5, 30], life: [0.2, 0.4], size: [2, 4] });
    }, tk);
  orb.remove();
  if (tk.dead) return;
  impactTotal(CHIP_COLOR.mom, gain, 4);
}

const SCENES: Record<Moment['kind'], (m: Moment, tk: MomToken) => Promise<void>> = { daily3: momDaily3, daily10: momDaily10, streak: momStreak, solved: momSolved, week: momWeek };

function mount(boardEl: HTMLElement) {
  unmount();
  layer = document.createElement('div');
  layer.className = 'pp-mom';
  layer.dataset.testid = 'moment-layer';
  layer.style.setProperty('--sp', String(speed()));
  layer.innerHTML = '<div class="momDim"></div><div class="momStage"></div><div class="momT"></div><div class="momS"></div>';
  boardEl.appendChild(layer);
  dim = layer.querySelector('.momDim');
  stage = layer.querySelector('.momStage');
  title = layer.querySelector('.momT');
  sub = layer.querySelector('.momS');
  dim!.style.opacity = '0';
}
function unmount() {
  document.querySelectorAll('.pp-orbR').forEach((e) => e.remove());
  layer?.remove();
  layer = stage = dim = title = sub = null;
}

async function momentShow(m: Moment, tk: MomToken, from: number, gain: number, first: boolean, last: boolean) {
  if (!layer || !stage) return from;
  stage.innerHTML = '';
  layer.dataset.kind = m.kind;
  for (const e of [title, sub]) if (e) e.style.opacity = '0';
  if (first && dim) void animate(dim, [{ opacity: 0 }, { opacity: 1 }], { d: 300 });
  await sleep(first ? 260 : 120, tk);
  if (!tk.skip) await SCENES[m.kind](m, tk);
  if (tk.dead || !stage) return from;
  stage.innerHTML = '';
  // A tap during the centrepiece skips to the reward orb; another tap lands it.
  tk.skip = false;
  await momReward(m, tk, gain, last);
  if (tk.dead) return from;
  const to = from + m.points;
  await fillTo(from, to, tk);
  if (tk.skip) barAt(to);
  return to;
}

/**
 * Play the moments over the board, from the bar at `from` (before + chips) and the "+N" at `gain0`.
 * Resolves true when they played out (or were tapped through), false when ended from outside.
 */
export async function runMoments(boardEl: HTMLElement, list: Moment[], from: number, gain0: number, tk: MomToken): Promise<boolean> {
  mount(boardEl);
  let v = from;
  let g = gain0;
  for (let i = 0; i < list.length; i++) {
    if (tk.dead) return false;
    const m = list[i];
    g += m.points;
    v = await momentShow(m, tk, v, g, i === 0, i === list.length - 1);
    tk.skip = false;
  }
  if (tk.dead) return false;
  if (layer) {
    const l = layer;
    await animate(l, [{ opacity: 1 }, { opacity: 0 }], { d: 180 });
    if (layer === l) unmount();
  }
  tk.done = true;
  return true;
}

/** End a moment run now (Next, a new puzzle, leaving): the points are already saved. */
export function endMoments(tk: MomToken | null) {
  if (tk && !tk.done) {
    tk.dead = true;
    tk.skip = true;
    tk.done = true;
  }
  unmount();
}

