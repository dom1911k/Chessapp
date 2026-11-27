// The pawn's walk on the Puzzle Path world (ported from the prototype): build a scene into a host,
// flip tiles (the one left grows into a hedge with leaves and a ✓; the next breathes a ring), hop
// the topiary pawn (anticipation squash, an arc with lean and falling leaves, a landing squash, the
// tile dips and ripples), part the clouds when crossing into a new board. Used by the level-up
// panel and the Path screen. Levels here are 0-based (l = level − 1), boards capped at 7 for looks.
import { BOUNCE, POP, D, animate, buzz, eios, tween, type Token } from '../motion';
import { emit } from '../fx';
import { sfx } from '../sfx';
import { ISO } from './world';
import { useSettings } from '../settings';
import { avatarUrl, frameById, frameMid } from '../avatars';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Scene {
  G: any;
  svg: SVGSVGElement;
  inner: HTMLElement;
  host: HTMLElement;
  pawn: SVGGElement | null;
  follow?: (y: number) => void;
}
export interface WPos {
  i: number;
  l: number;
}
export const LEAVES = ['#4c9a28', '#79c241', '#9bd65a', '#c6f08f'];

/** Your marker on the pawn's tag: your avatar, and your frame's middle colour for its border (read when drawn). */
export function pathTag(): { avatar: string; ring: string } {
  const s = useSettings.getState();
  const f = frameById(s.avatarFrame);
  return { avatar: avatarUrl(s.avatar), ring: f.id === 'none' ? '' : frameMid(f) };
}

/** Build the world into host's `.isoIn` child. opt: { b, lvl, w0, w1, mt, avatar, ring }. */
export function buildScene(host: HTMLElement, opt: { b: number; lvl: number; w0?: number; w1?: number; mt?: number; avatar?: string; ring?: string }, uid: string): Scene {
  const W = host.clientWidth || 374;
  const r = ISO.build(W, { ...opt, uid });
  const inner = host.querySelector('.isoIn') as HTMLElement;
  inner.innerHTML = r.svg;
  const svg = inner.querySelector('svg') as SVGSVGElement;
  return { G: r.G, svg, inner, host, pawn: svg.querySelector('.pawn') };
}
const rectOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
};
const tileEl = (sc: Scene, w: number, i: number) => sc.svg.querySelector(`.tile[data-w="${w}"][data-i="${i}"]`);

export function setTile(sc: Scene, w: number, i: number, st: 'done' | 'cur' | 'next' | 'fut', pop = false) {
  const t = tileEl(sc, w, i);
  if (!t) return;
  const tin = t.querySelector('.tin') as SVGGElement;
  tin.innerHTML = ISO.tileSVG(sc.G, ISO.TH[w], st, i + 1);
  if (!pop) return;
  void animate(tin, [{ transform: 'scale(.72,.18)', opacity: 0.6 }, { transform: 'scale(1.1,1.14)', opacity: 1, offset: 0.55 }, { transform: 'scale(.97,.95)', offset: 0.8 }, { transform: 'scale(1)' }], { d: 560, e: 'cubic-bezier(.3,.7,.4,1)' });
  const c = tin.querySelector('.chk');
  if (c) void animate(c, [{ transform: 'scale(0) rotate(-25deg)', opacity: 0 }, { transform: 'scale(1.3) rotate(6deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { d: 420, delay: 200, e: 'ease-out' });
  const r = rectOf(tin);
  emit({ x: r.cx, y: r.cy, n: 14, shape: 'confetti', colors: LEAVES, speed: [60, 170], angle: -90, spread: 150, gravity: 260, drag: 0.97, life: [0.6, 1.1], size: [2, 3.5] });
  emit({ x: r.cx, y: r.cy - 4, n: 8, shape: 'star', colors: ['#ffffff', '#e8ffd0'], speed: [40, 120], angle: -90, spread: 120, life: [0.35, 0.6], size: [2, 4] });
  sfx('grow');
}
/** The tile you land on dips and rings. */
function dipTile(sc: Scene, w: number, i: number) {
  const t = tileEl(sc, w, i);
  if (!t) return;
  const tin = t.querySelector('.tin');
  void animate(tin, [{ transform: 'translateY(0)' }, { transform: 'translateY(3.5px) scale(1.03,.94)', offset: 0.25 }, { transform: 'translateY(0)' }], { d: BOUNCE.d, e: 'ease-out' });
  const { sx, sy } = sc.G;
  const rp = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  rp.setAttribute('class', 'rip');
  rp.setAttribute('rx', (sx * 0.6).toFixed(1));
  rp.setAttribute('ry', (sy * 0.6).toFixed(1));
  t.appendChild(rp);
  void animate(rp, [{ transform: 'scale(.6)', opacity: 0.9 }, { transform: 'scale(1.55)', opacity: 0 }], { d: 620, e: 'cubic-bezier(.2,.7,.3,1)' }).then(() => rp.remove());
}
function pawnFeet(sc: Scene) {
  const e = sc.pawn!.querySelector('.psh')!;
  const r = rectOf(e);
  return { x: r.cx, y: r.cy };
}
function landIso(sc: Scene) {
  sfx('pawnLand');
  buzz(9);
  const p = pawnFeet(sc);
  [0, 180].forEach((a) => emit({ x: p.x, y: p.y, n: 4, shape: 'dust', colors: ['rgba(255,255,255,.55)', 'rgba(235,228,214,.5)'], speed: [40, 110], angle: a, spread: 30, gravity: -10, drag: 0.88, life: [0.25, 0.45], size: [1.4, 2.8] }));
  emit({ x: p.x, y: p.y - 2, n: 5, shape: 'confetti', colors: LEAVES, speed: [40, 100], angle: -90, spread: 160, gravity: 260, drag: 0.95, life: [0.5, 0.8], size: [1.6, 2.6] });
  const ps = sc.pawn!.querySelector('.ps')!;
  let t0: number | null = null;
  const f = (n: number) => {
    t0 = t0 ?? n;
    const k = Math.min(1, (n - t0) / D(BOUNCE.d));
    const e = 1 - Math.exp(-6.5 * k) * Math.cos(11 * k);
    ps.setAttribute('transform', `scale(${(1.16 - 0.16 * e).toFixed(3)},${(0.8 + 0.2 * e).toFixed(3)})`);
    if (k < 1) requestAnimationFrame(f);
    else ps.removeAttribute('transform');
  };
  requestAnimationFrame(f);
}
function hopIso(sc: Scene, ca: { gx: number; gy: number }, cb: { gx: number; gy: number }, ms: number, hf: number, tk: Token) {
  const G = sc.G;
  const pa = ISO.sp(G, ca.gx, ca.gy);
  const pb = ISO.sp(G, cb.gx, cb.gy);
  const pw = sc.pawn!;
  const pj = pw.querySelector('.pj')!;
  const ps = pw.querySelector('.ps')!;
  const sh = pw.querySelector('.psh')!;
  const tg = pw.querySelector('.ptag');
  const H = G.sy * 1.55 * hf;
  const dir = Math.sign(pb.x - pa.x) || 1;
  let shed = false;
  sfx('hop');
  if (tg) void animate(tg, [{ opacity: 1 }, { opacity: 0 }], { d: 120 });
  return tween(ms, (k) => {
    let x = pa.x;
    let y = pa.y;
    let h = 0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    if (k < 0.2) {
      const a = Math.sin(((k / 0.2) * Math.PI) / 2);
      sx = 1 + 0.16 * a;
      sy = 1 - 0.22 * a;
      rot = -dir * 5 * a;
    } else if (k < 0.84) {
      const a = (k - 0.2) / 0.64;
      const e = eios(a);
      x = pa.x + (pb.x - pa.x) * e;
      y = pa.y + (pb.y - pa.y) * e;
      h = Math.sin(Math.PI * a) * H;
      sx = 0.9 + 0.1 * a;
      sy = 1.14 - 0.14 * a;
      rot = dir * (9 * Math.sin(Math.PI * Math.min(1, a * 1.15)) - 5 * (1 - a) * (a < 0.15 ? 1 - a / 0.15 : 0));
      if (!shed && a > 0.08) {
        shed = true;
        const f = pawnFeet(sc);
        emit({ x: f.x, y: f.y - G.sx * 0.5, n: 6, shape: 'confetti', colors: LEAVES, speed: [30, 90], angle: 90, spread: 140, gravity: 220, drag: 0.96, life: [0.6, 1], size: [1.8, 3] });
      }
    } else {
      const a = Math.sin(((k - 0.84) / 0.16) * Math.PI);
      x = pb.x;
      y = pb.y;
      sx = 1 + 0.18 * a;
      sy = 1 - 0.24 * a;
    }
    pw.setAttribute('transform', `translate(${x.toFixed(1)},${(y - G.sy * 0.05).toFixed(1)})`);
    pj.setAttribute('transform', `translate(0,${(-h).toFixed(1)})`);
    ps.setAttribute('transform', `rotate(${rot.toFixed(2)}) scale(${sx.toFixed(3)},${sy.toFixed(3)})`);
    const hn = Math.min(1, h / (G.sy * 1.55));
    sh.setAttribute('transform', `scale(${(1 - 0.45 * hn).toFixed(3)})`);
    sh.setAttribute('opacity', (1 - 0.55 * hn).toFixed(2));
    sc.follow?.(y - h * 0.5);
  }, tk).then(() => {
    if (tk.skip) return;
    pj.removeAttribute('transform');
    sh.removeAttribute('transform');
    sh.setAttribute('opacity', '1');
    landIso(sc);
    if (tg) {
      const base = tg.getAttribute('transform') ?? '';
      void animate(tg, [{ opacity: 0, transform: `${base} translate(0,6) scale(.6)` }, { opacity: 1, transform: base }], { ...POP, delay: 260 });
    }
  });
}
/** Clouds slide away, the haze lifts and the sign loses its lock, as the pawn heads for board w. */
export function partClouds(sc: Scene, w: number) {
  sfx('wind');
  sc.svg.querySelectorAll<SVGGElement>(`.cloudW[data-w="${w}"]`).forEach((c, k) => {
    const x = Number(c.dataset.x);
    const dir = x < sc.G.W / 2 ? -1 : 1;
    const tf = c.getAttribute('transform') ?? '';
    void animate(c, [{ transform: tf, opacity: 1 }, { transform: `${tf} translate(${dir * 160}px,-20px)`, opacity: 0 }], { d: 1100, delay: k * 40, e: 'cubic-bezier(.4,0,.2,1)' });
  });
  sc.svg.querySelectorAll(`.haze[data-w="${w}"]`).forEach((h) => void animate(h, [{ opacity: h.getAttribute('opacity') ?? '1' }, { opacity: 0 }], { d: 900 }));
  sc.svg.querySelectorAll(`.lockTag[data-w="${w}"]`).forEach((h) => void animate(h, [{ opacity: 1 }, { opacity: 0 }], { d: 400 }));
  const sg = sc.svg.querySelector(`.sign[data-w="${w}"]`);
  if (sg) {
    const tx = sg.querySelector('text');
    if (tx) {
      tx.textContent = ISO.TH[w].n;
      tx.setAttribute('fill', '#6b3e1c');
    }
    const rc = sg.querySelector('rect:nth-of-type(2)');
    rc?.setAttribute('fill', '#fff8ec');
    rc?.setAttribute('stroke', '#c9974a');
  }
}
/** Hop from position a to b, one tile per hop (ms each), flipping tiles and crossing boards. */
export async function walkTiles(sc: Scene, a: WPos, b: WPos, per: number, hf: number, tk: Token, onCross?: (w: number) => Promise<void>) {
  let ci = a.i;
  let cl = a.l;
  while (ci < b.i || (ci === b.i && cl < b.l)) {
    if (tk.skip) return;
    const ni = cl === 19 ? ci + 1 : ci;
    const nl = cl === 19 ? 0 : cl + 1;
    if (ni > 7) break;
    const ca = ISO.cell(ci, cl);
    const cb = ISO.cell(ni, nl);
    const cross = ni !== ci;
    const [wi, wl] = [ci, cl];
    setTimeout(() => {
      if (!tk.skip) setTile(sc, wi, wl, 'done', true);
    }, D(per * 0.25));
    if (cross)
      setTimeout(() => {
        if (!tk.skip) partClouds(sc, ni);
      }, D(per * 0.1));
    await hopIso(sc, ca, cb, per, hf, tk);
    if (tk.skip) return;
    setTile(sc, ni, nl, 'cur');
    dipTile(sc, ni, nl);
    if (nl < 19) setTile(sc, ni, nl + 1, 'next');
    else if (ni < 7) setTile(sc, ni + 1, 0, 'next');
    if (cross && onCross) await onCross(ni);
    ci = ni;
    cl = nl;
  }
}
/** Where a position's tile sits in the scene. */
export function cellPoint(sc: Scene, p: WPos) {
  const c = ISO.cell(p.i, p.l);
  return ISO.sp(sc.G, c.gx, c.gy) as { x: number; y: number };
}
