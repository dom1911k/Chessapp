// Animated pixel scenes: torches and fire (classic fire automaton), coin rain, and the pixel
// screen transition.
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../sfx';
import { Sprite } from '../pixel/sprites';
import { GOLD } from '../pixel/pixelize';

const FIRE = ['#00000000', '#1b0a06', '#3a0f08', '#6e1a0a', '#a8300c', '#d9500f', '#ff7a1a', '#ffa53a', '#ffcf5c', '#ffe9a0', '#fff8dc'];

/** A burning pixel fire of w×h cells, drawn at `scale`. Logs are optional (campfire). */
export function Fire({ w = 28, h = 30, scale = 4, logs = false, className = '' }: { w?: number; h?: number; scale?: number; logs?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    const heat = new Uint8Array(w * h);
    const top = FIRE.length - 1;
    let raf = 0;
    let last = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (t - last < 70) return;
      last = t;
      // Seed the bottom row (narrower than the box, so the flame is pointed).
      for (let x = 0; x < w; x++) {
        const centre = 1 - Math.abs(x - w / 2) / (w / 2);
        heat[(h - 1) * w + x] = centre > 0.25 ? Math.min(top, Math.round(top * (0.55 + centre * 0.5) * (0.75 + Math.random() * 0.25))) : 0;
      }
      for (let y = 0; y < h - 1; y++)
        for (let x = 0; x < w; x++) {
          const src = (y + 1) * w + x;
          const decay = Math.random() < 0.55 ? 1 : 0;
          const dx = Math.round(Math.random() * 2 - 1);
          const to = y * w + Math.max(0, Math.min(w - 1, x + dx));
          heat[to] = Math.max(0, heat[src] - decay - (Math.random() < 0.08 ? 1 : 0));
        }
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < w * h; i++) {
        const v = heat[i];
        if (!v) continue;
        g.fillStyle = FIRE[v];
        g.fillRect(i % w, Math.floor(i / w), 1, 1);
      }
      if (logs) {
        g.fillStyle = '#3a1f12';
        g.fillRect(3, h - 4, w - 6, 3);
        g.fillStyle = '#5c3420';
        g.fillRect(5, h - 5, w - 12, 2);
        g.fillStyle = '#7a4a2a';
        g.fillRect(9, h - 3, w - 16, 1);
      }
      if (reduced) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [w, h, logs]);
  return <canvas ref={ref} width={w} height={h} className={`pixelated ${className}`} style={{ width: w * scale, height: h * scale, filter: 'drop-shadow(0 0 18px rgba(255,140,40,.55))' }} />;
}

/** Coins that drop into a little pile. */
export function CoinRain({ n }: { n: number }) {
  const coins = Math.min(n, 14);
  return (
    <div className="relative h-14 w-40">
      {Array.from({ length: coins }, (_, i) => (
        <span
          key={i}
          className="run-coin absolute"
          style={{ left: 20 + ((i * 37) % 110), bottom: (i % 3) * 5 + Math.floor(i / 6) * 4, animationDelay: `${i * 70}ms` }}
          onAnimationStart={() => i % 2 === 0 && sfx('coin')}
        >
          <Sprite name="coin" size={22} px={12} pal={GOLD} stroke={5} />
        </span>
      ))}
    </div>
  );
}

/**
 * Pixel transition: the screen starts covered in dark blocks that clear in a scattered order
 * (a dither dissolve). `door` plays two stone halves sliding apart instead (entering a room).
 */
export function Transition({ kind }: { kind: 'wipe' | 'door' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (kind === 'door') {
      sfx('door');
      const t = setTimeout(() => setDone(true), 900);
      return () => clearTimeout(t);
    }
    const c = ref.current!;
    const B = 14;
    const w = Math.ceil(window.innerWidth / B);
    const h = Math.ceil(window.innerHeight / B);
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    const order = Array.from({ length: w * h }, (_, i) => i).sort(() => Math.random() - 0.5);
    g.fillStyle = '#0d0814';
    g.fillRect(0, 0, w, h);
    const t0 = performance.now();
    const dur = 380;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const upto = Math.floor(order.length * k);
      for (let i = 0; i < upto; i++) g.clearRect(order[i] % w, Math.floor(order[i] / w), 1, 1);
      if (k < 1) raf = requestAnimationFrame(step);
      else setDone(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [kind]);
  if (done) return null;
  if (kind === 'door')
    return (
      <div className="pointer-events-none fixed inset-0 z-[64] overflow-hidden">
        <div className="run-door-l absolute inset-y-0 left-0 w-1/2" />
        <div className="run-door-r absolute inset-y-0 right-0 w-1/2" />
      </div>
    );
  return <canvas ref={ref} className="pixelated pointer-events-none fixed inset-0 z-[64] h-full w-full" />;
}
