// The shared reward engine: every "number goes up / bar fills" moment in the app uses these, so
// games, puzzles and drills feel the same. Smoothness rules:
// - values are written straight to the DOM each animation frame (no React re-render per frame);
// - bars fill with transform: scaleX (GPU-composited), never width;
// - ease-out (fast start, gentle settle), optional overshoot for pops;
// - one beat at a time (useSequence), and a tap skips to the end;
// - "reduce motion" on the phone shows the final state at once.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeOutQuint = (k: number) => 1 - Math.pow(1 - k, 5);

/**
 * Runs `onFrame(value)` from `from` to `to` over `ms` (after `delay`) while `run` is true.
 * Finishes instantly when `instant` (skip) or reduced motion is on. Returns nothing: the caller
 * writes to the DOM in onFrame.
 */
export function useTween(from: number, to: number, opts: { ms?: number; delay?: number; run?: boolean; instant?: boolean; ease?: (k: number) => number; onFrame: (v: number, done: boolean) => void }) {
  const { ms = 900, delay = 0, run = true, instant = false, ease = easeOutCubic } = opts;
  const cb = useRef(opts.onFrame);
  cb.current = opts.onFrame;
  useLayoutEffect(() => {
    if (!run) {
      cb.current(from, false);
      return;
    }
    if (instant || reducedMotion() || ms <= 0 || from === to) {
      cb.current(to, true);
      return;
    }
    cb.current(from, false);
    let raf = 0;
    const timer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        cb.current(from + (to - from) * ease(k), k >= 1);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [from, to, ms, delay, run, instant, ease]);
}

/** A number that counts from `from` to `to`. Tabular digits, so it never wobbles. */
export function CountUp({
  from,
  to,
  ms = 900,
  delay = 0,
  run = true,
  instant = false,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  style,
  onDone,
}: {
  from: number;
  to: number;
  ms?: number;
  delay?: number;
  run?: boolean;
  instant?: boolean;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
  onDone?: () => void;
}) {
  const el = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);
  const fmt = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`;
  useTween(from, to, {
    ms,
    delay,
    run,
    instant,
    onFrame: (v, done) => {
      if (el.current) el.current.textContent = fmt(decimals ? v : Math.round(v));
      if (done && !fired.current) {
        fired.current = true;
        onDone?.();
      }
    },
  });
  return (
    <span ref={el} className={`tabular-nums ${className}`} style={style}>
      {fmt(from)}
    </span>
  );
}

/**
 * A progress bar that fills smoothly. `from`/`to` are in "levels": 2.4 → 3.1 fills the rest of
 * the bar, empties it (calling onWrap(3)) and fills to 10%. Uses scaleX, so it's GPU-cheap.
 */
export function FillBar({
  from,
  to,
  ms = 1000,
  delay = 0,
  run = true,
  instant = false,
  className = 'h-2.5',
  fill = 'bg-gradient-to-r from-lime-400 to-emerald-500',
  track = 'bg-stone-200 dark:bg-white/10',
  onWrap,
  onDone,
}: {
  from: number;
  to: number;
  ms?: number;
  delay?: number;
  run?: boolean;
  instant?: boolean;
  className?: string;
  fill?: string;
  track?: string;
  onWrap?: (level: number) => void;
  onDone?: () => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLDivElement>(null);
  const lastFloor = useRef(Math.floor(from));
  const fired = useRef(false);
  // Longer journeys (crossing levels) take a little longer, but not proportionally.
  const dur = ms * (1 + Math.min(1.2, Math.max(0, Math.floor(to) - Math.floor(from)) * 0.6));
  useTween(from, to, {
    ms: dur,
    delay,
    run,
    instant,
    ease: easeOutQuint,
    onFrame: (v, done) => {
      const fl = Math.floor(v);
      // At an exact whole number (and finished), show a full bar rather than an empty one.
      const frac = done && v === to && to > from && v === fl ? 1 : v - fl;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0.015, Math.min(1, frac))})`;
      if (fl > lastFloor.current) {
        lastFloor.current = fl;
        onWrap?.(fl);
        shine.current?.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
      }
      if (done && !fired.current) {
        fired.current = true;
        onDone?.();
      }
    },
  });
  return (
    <div className={`relative overflow-hidden rounded-full ${track} ${className}`}>
      <div ref={bar} className={`absolute inset-0 origin-left rounded-full will-change-transform ${fill}`} style={{ transform: `scaleX(${Math.max(0.015, from - Math.floor(from))})` }} />
      <div ref={shine} className="pointer-events-none absolute inset-0 rounded-full bg-white opacity-0" />
    </div>
  );
}

/**
 * Steps through a reward sequence: step 0, then 1 after delays[0] ms, 2 after delays[1]… Returns
 * the current step and skip(), which jumps to the end (and tells components to finish instantly).
 */
export function useSequence(delays: number[], opts: { run?: boolean } = {}) {
  const { run = true } = opts;
  const last = delays.length;
  const [step, setStep] = useState(reducedMotion() ? last : 0);
  const [skipped, setSkipped] = useState(reducedMotion());
  useEffect(() => {
    if (!run || step >= last) return;
    const t = setTimeout(() => setStep((s) => s + 1), delays[step]);
    return () => clearTimeout(t);
  }, [run, step, last, delays]);
  const skip = useCallback(() => {
    setSkipped(true);
    setStep(last);
  }, [last]);
  return { step, skip, skipped, done: step >= last };
}

/** Wraps content that should pop in (scale with a little overshoot) when `show` turns true. */
export function PopIn({ show, delay = 0, children, className = '' }: { show: boolean; delay?: number; children: React.ReactNode; className?: string }) {
  if (!show) return <div className={`invisible ${className}`} aria-hidden>{children}</div>;
  return (
    <div className={`animate-reveal ${className}`} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
