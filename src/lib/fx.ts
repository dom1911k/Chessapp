// Particles for the Puzzle Path's moments (ported from the prototype): one canvas over the whole
// screen, one rAF loop that sleeps when nothing is alive, capped at 500 particles (half the counts
// on phones with ≤ 4 cores). Shapes: glow (pre-rendered radial sprites, additive), star, spark,
// confetti (tumbling), dust, smoke. Coordinates are viewport pixels.
import { reduced } from './motion';

export type Shape = 'glow' | 'star' | 'spark' | 'confetti' | 'dust' | 'smoke';
export interface EmitOpts {
  x: number;
  y: number;
  n?: number;
  shape?: Shape;
  colors?: string[];
  speed?: [number, number];
  /** Degrees; −90 is up. */
  angle?: number;
  spread?: number;
  gravity?: number;
  drag?: number;
  life?: [number, number];
  size?: [number, number];
  jx?: number;
  jy?: number;
  grow?: number;
}
interface P {
  x: number; y: number; vx: number; vy: number; g: number; dr: number; life: number; max: number; s: number; c: string; sh: Shape;
  rot: number; vr: number; fl: number; vf: number; grow: number;
}

export const GREENS = ['#b6e27a', '#81b64c', '#dcf7b0'];
export const GOLDS = ['#ffe27a', '#f7c631', '#fff3c4'];
export const BLUES = ['#a8e0ff', '#5aa9e6'];
export const ORANGES = ['#ffcf7a', '#ff9a3d', '#ffb366'];
export const CONFETTI = ['#81b64c', '#f7c631', '#5aa9e6', '#ff6b6b', '#ffffff', '#c084fc', '#ff9a3d'];
export const GREYS = ['#d8d6d2', '#bdbab5'];

const MAX = 500;
const lowEnd = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4;
let canvas: HTMLCanvasElement | null = null;
let cx: CanvasRenderingContext2D | null = null;
let ps: P[] = [];
let on = false;
let last = 0;
const DPR = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];

/** The FxCanvas component calls this with its canvas (and null when it unmounts). */
export function attachFx(c: HTMLCanvasElement | null) {
  canvas = c;
  cx = c?.getContext('2d') ?? null;
  if (c) sizeFx();
  else ps = [];
}
export function sizeFx() {
  if (!canvas || !cx) return;
  canvas.width = Math.max(1, Math.round(innerWidth * DPR));
  canvas.height = Math.max(1, Math.round(innerHeight * DPR));
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

const sprites = new Map<string, HTMLCanvasElement>();
function sprite(col: string) {
  let c = sprites.get(col);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.25, col);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  sprites.set(col, c);
  return c;
}

export function emit(o: EmitOpts) {
  if (!cx || reduced()) return;
  const n = Math.max(1, Math.round((o.n ?? 10) * (lowEnd ? 0.5 : 1)));
  for (let i = 0; i < n; i++) {
    const ang = (((o.angle ?? -90) + (Math.random() - 0.5) * (o.spread ?? 360)) * Math.PI) / 180;
    const sp = rnd(...(o.speed ?? [80, 220]));
    ps.push({
      x: o.x + rnd(-(o.jx ?? 0), o.jx ?? 0), y: o.y + rnd(-(o.jy ?? 0), o.jy ?? 0), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      g: o.gravity ?? 0, dr: o.drag ?? 0.95, life: 0, max: rnd(...(o.life ?? [0.5, 0.9])), s: rnd(...(o.size ?? [3, 6])),
      c: pick(o.colors ?? ['#fff']), sh: o.shape ?? 'glow', rot: rnd(0, 6.28), vr: rnd(-9, 9), fl: rnd(0, 6.28), vf: rnd(7, 15), grow: o.grow ?? 0,
    });
  }
  if (ps.length > MAX) ps.splice(0, ps.length - MAX);
  if (!on) {
    on = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
}

function star(x: number, y: number, r: number, rot: number, c: string) {
  const g = cx!;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = c;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.3 : r;
    const a = (i * Math.PI) / 4;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function loop(now: number) {
  const g = cx;
  if (!g || !canvas) {
    on = false;
    return;
  }
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  g.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life += dt;
    if (p.life >= p.max) {
      ps.splice(i, 1);
      continue;
    }
    const dr = Math.pow(p.dr, dt * 60);
    p.vx *= dr;
    p.vy *= dr;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.fl += p.vf * dt;
    const k = p.life / p.max;
    const al = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
    if (p.sh === 'glow') {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = al;
      const s = p.s * (1 + p.grow * k) * 2.4;
      g.drawImage(sprite(p.c), p.x - s, p.y - s, s * 2, s * 2);
    } else if (p.sh === 'star') {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = al;
      star(p.x, p.y, p.s * (1 - 0.35 * k), p.rot, p.c);
    } else if (p.sh === 'spark') {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = al;
      g.strokeStyle = p.c;
      g.lineWidth = p.s * 0.6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      g.stroke();
    } else if (p.sh === 'confetti') {
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = Math.min(1, al * 1.5);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.scale(1, Math.cos(p.fl));
      g.fillStyle = p.c;
      g.fillRect(-p.s, -p.s * 0.45, p.s * 2, p.s * 0.9);
      g.restore();
    } else {
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = al * (p.sh === 'smoke' ? 0.5 : 0.6);
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.s * (1 + 1.8 * k), 0, 6.283);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  if (ps.length) requestAnimationFrame(loop);
  else {
    on = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/** The centre of an element in viewport pixels. */
export function centre(el: Element): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

// ---------- Presets ----------

export const starBurst = (x: number, y: number, colors = GOLDS, n = 14) =>
  emit({ x, y, n, shape: 'star', colors, speed: [90, 240], size: [3, 6], life: [0.45, 0.85], drag: 0.92 });
export const sparkSpray = (x: number, y: number, colors = GOLDS, n = 12) =>
  emit({ x, y, n, shape: 'spark', colors, speed: [160, 340], size: [2, 3.5], life: [0.3, 0.6], drag: 0.9 });
export const confettiCannon = (x: number, y: number, n = 70) =>
  emit({ x, y, n, shape: 'confetti', colors: CONFETTI, speed: [260, 620], angle: -90, spread: 70, gravity: 900, drag: 0.985, life: [1.4, 2.4], size: [4, 7] });
export const confettiRain = (w: number, n = 90) => {
  for (let i = 0; i < n; i++) emit({ x: Math.random() * w, y: -10, n: 1, shape: 'confetti', colors: CONFETTI, speed: [40, 140], angle: 90, spread: 50, gravity: 260, drag: 0.99, life: [1.8, 2.8], size: [4, 7] });
};
export const dustPuff = (x: number, y: number, n = 8) =>
  emit({ x, y, n, shape: 'dust', colors: ['#d9cdb8', '#c7b89c'], speed: [30, 90], angle: -90, spread: 160, gravity: 60, life: [0.4, 0.7], size: [2, 4] });
export const embers = (x: number, y: number, n = 10) =>
  emit({ x, y, n, shape: 'glow', colors: ORANGES, speed: [40, 120], angle: -90, spread: 60, gravity: -60, life: [0.6, 1.2], size: [1.5, 3] });
export const smoke = (x: number, y: number, n = 6) =>
  emit({ x, y, n, shape: 'smoke', colors: GREYS, speed: [20, 50], angle: -90, spread: 50, gravity: -40, life: [0.6, 1.1], size: [3, 6] });
