// Juice shared by every cup screen: paced animation sequences (tap to speed up, hold to finish),
// coin streams flying into counters, spark bursts and flames behind a big number.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { TUNING } from '../tuning';
import { reducedMotion, useRunSettings } from '../settings';

const J = TUNING.juice;

const centerOf = (el: Element | null | undefined) => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};

/**
 * Pace for cup animations: the game speed, ×tapSpeed after a tap, instant after a hold
 * (or when skipped). `wait` sleeps at the current pace; `finish` ends every wait at once.
 */
export function usePace() {
  const ctl = useRef({ active: false, tap: 1, instant: false, wakes: new Set<() => void>() });
  const finish = useCallback(() => {
    ctl.current.instant = true;
    ctl.current.wakes.forEach((w) => w());
    ctl.current.wakes.clear();
  }, []);
  const wait = useCallback((ms: number) => {
    const c = ctl.current;
    if (c.instant || ms <= 0) return Promise.resolve();
    return new Promise<void>((res) => {
      const done = () => (clearTimeout(id), c.wakes.delete(done), res());
      const id = setTimeout(done, ms / ((useRunSettings.getState().speed || 1) * c.tap));
      c.wakes.add(done);
    });
  }, []);
  const speed = () => (useRunSettings.getState().speed || 1) * ctl.current.tap;
  // Tap anywhere: faster; hold: finish. Never blocks the tap itself (the board still gets it).
  useEffect(() => {
    let hold: ReturnType<typeof setTimeout> | undefined;
    const down = () => {
      if (!ctl.current.active) return;
      ctl.current.tap = J.tapSpeed;
      clearTimeout(hold);
      hold = setTimeout(() => ctl.current.active && finish(), J.holdMs);
    };
    const up = () => clearTimeout(hold);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      clearTimeout(hold);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
    };
  }, [finish]);
  /** Start a paced sequence (resets tap speed and instant). */
  const begin = useCallback((instant = false) => {
    Object.assign(ctl.current, { active: true, tap: 1, instant });
  }, []);
  const end = useCallback(() => {
    ctl.current.active = false;
  }, []);
  return { wait, finish, begin, end, speed, ctl };
}
export type Pace = ReturnType<typeof usePace>;

/** Flames behind a score that beat its blind twice over (intensity 1..4). */
export function ScoreFire({ intensity }: { intensity: number }) {
  if (intensity <= 0 || reducedMotion()) return null;
  const n = 4 + Math.round(intensity * 3);
  const h = 20 + intensity * 7;
  return (
    <div className="pointer-events-none absolute inset-x-0 -bottom-1 z-0 flex justify-center opacity-80" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="run-tongue"
          style={{ height: h * (0.6 + ((i * 37) % 10) / 22), width: 10 + intensity * 2, marginLeft: -3, animationDelay: `${(i * 97) % 400}ms`, background: `radial-gradient(ellipse at 50% 85%, #fff6c8 0 14%, ${intensity >= 3 ? '#ff6bd5' : '#ff8a3c'} 40%, ${intensity >= 2 ? '#e2475a' : '#ffb454'} 62%, transparent 75%)` }}
        />
      ))}
    </div>
  );
}

/**
 * Particles flying from one element to another (coins into the gold counter, materials into the
 * pouch); `onLand(i)` as each arrives. Reduced motion: no particles, every onLand at once.
 */
export function Stream({ from, to, n, color, round = false, ms = 520, stagger = J.coinStaggerMs, onLand, onDone }: { from: RefObject<HTMLElement | null>; to: RefObject<HTMLElement | null>; n: number; color: string; round?: boolean; ms?: number; stagger?: number; onLand?: (i: number) => void; onDone?: () => void }) {
  const [parts, setParts] = useState<{ id: number; x: number; y: number; dx: number; dy: number; go: boolean; delay: number }[]>([]);
  useEffect(() => {
    const a = centerOf(from.current);
    const b = centerOf(to.current);
    const speed = useRunSettings.getState().speed || 1;
    if (!a || !b || reducedMotion() || n <= 0) {
      for (let i = 0; i < n; i++) onLand?.(i);
      onDone?.();
      return;
    }
    const list = Array.from({ length: n }, (_, i) => ({ id: i, x: a.x + ((i * 53) % 40) - 20, y: a.y + ((i * 31) % 20) - 10, dx: 0, dy: 0, go: false, delay: (i * stagger) / speed }));
    list.forEach((p) => ((p.dx = b.x - p.x), (p.dy = b.y - p.y)));
    setParts(list);
    const timers: ReturnType<typeof setTimeout>[] = [];
    requestAnimationFrame(() => requestAnimationFrame(() => setParts((ps) => ps.map((p) => ({ ...p, go: true })))));
    list.forEach((p, i) => timers.push(setTimeout(() => onLand?.(i), p.delay + ms / speed)));
    timers.push(setTimeout(() => (setParts([]), onDone?.()), list[list.length - 1].delay + ms / speed + 30));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!parts.length) return null;
  const speed = useRunSettings.getState().speed || 1;
  return createPortal(
    parts.map((p) => (
      <span
        key={p.id}
        className="run-stream"
        style={{
          left: p.x - 6, top: p.y - 6, width: 12, height: 12, background: color, borderRadius: round ? '50%' : 0,
          transform: p.go ? `translate(${p.dx}px, ${p.dy}px) scale(0.7)` : 'translate(0,0) scale(1.2)',
          transitionDuration: `${ms / speed}ms`, transitionDelay: `${p.delay}ms`,
        }}
      />
    )),
    document.body,
  );
}

/** A ring of particles bursting out of a point (the boxes colliding). */
export function Sparks({ n = J.particles, colors }: { n?: number; colors: string[] }) {
  if (reducedMotion()) return null;
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 z-20" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 3) * 0.2;
        const d = 34 + (i % 4) * 14;
        return <span key={i} className="run-shard absolute" style={{ background: colors[i % colors.length], ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px` }} />;
      })}
    </div>
  );
}
