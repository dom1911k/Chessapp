// The motion kit for the Puzzle Path's moments (ported from docs/puzzle-path-prototype.html):
// springs as CSS linear() easings, a WAAPI wrapper, rAF tweens and sleeps, all scaled by one speed
// factor (1 normal, 0.6 "Fast tally"), cut to ≤ 120ms when animations are reduced, and stoppable
// with a skip token so a tap ends a sequence cleanly. Only transform, opacity and filter animate.
import { useSettings } from './settings';

export interface Ease {
  e: string;
  d: number;
}
const LIN = typeof CSS !== 'undefined' && !!CSS.supports?.('animation-timing-function', 'linear(0, 0.5, 1)');

/** A damped spring sampled into a CSS linear() easing, plus its natural duration. */
export function spring(k: number, c: number): Ease {
  let x = 0;
  let v = 0;
  let t = 0;
  let n = 0;
  const dt = 1 / 240;
  const pts = [0];
  while (t < 2.5) {
    const a = -k * (x - 1) - c * v;
    v += a * dt;
    x += v * dt;
    t += dt;
    if (++n % 4 === 0) pts.push(+x.toFixed(4));
    if (t > 0.15 && Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) break;
  }
  pts.push(1);
  return { e: LIN ? `linear(${pts.join(',')})` : 'cubic-bezier(.34,1.56,.64,1)', d: Math.round(t * 1000) };
}
/** Chips, numbers, small badges. */
export const POP = spring(320, 18);
/** Badges, landings, big reveals. */
export const BOUNCE = spring(300, 11);
/** Text and lists sliding in. */
export const SOFT = spring(200, 24);
export const SNAP = spring(520, 30);

export const eo3 = (k: number) => 1 - Math.pow(1 - k, 3);
export const eio3 = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const eios = (k: number) => -(Math.cos(Math.PI * k) - 1) / 2;
export const eback = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

// ---------- Speed and reduced motion ----------

let speedOverride: number | null = null;
/** Fast tally (0.6) or normal (1); a test or a dev page can override it. */
export function speed(): number {
  if (speedOverride !== null) return speedOverride;
  return useSettings.getState().puzzleTallySpeed === 'fast' ? 0.6 : 1;
}
export const setSpeedOverride = (v: number | null) => {
  speedOverride = v;
};
/** "Reduce animations": the app setting, which by default follows the phone. */
export function reduced(): boolean {
  const s = useSettings.getState().reduceAnimations ?? 'system';
  if (s === 'on') return true;
  if (s === 'off') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
/** A duration at the current speed. */
export const D = (ms: number) => ms * speed();

/** Set `skip` to end a running sequence: tweens and sleeps resolve at once. */
export interface Token {
  skip: boolean;
}
export const token = (): Token => ({ skip: false });

export interface AnimOpts {
  d: number;
  e?: string;
  delay?: number;
  fill?: FillMode;
}
/** el.animate with the speed factor and reduced motion applied; resolves when it finishes. */
export function animate(el: Element | null | undefined, frames: Keyframe[], o: AnimOpts | Ease): Promise<void> {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
  let opts: AnimOpts = o as AnimOpts;
  if (reduced()) opts = { ...opts, d: Math.min(opts.d, 120), e: 'ease-out' };
  try {
    return (el as HTMLElement)
      .animate(frames, { duration: D(opts.d), easing: opts.e || 'ease', fill: opts.fill || 'both', delay: D(opts.delay || 0) })
      .finished.then(() => undefined)
      .catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

/** A rAF loop over `ms` calling fn(0…1), for things that follow a path (flights, the pawn). */
export function tween(ms: number, fn: (k: number) => void, tk?: Token): Promise<void> {
  return new Promise((res) => {
    const t0 = performance.now();
    const d = Math.max(1, D(reduced() ? Math.min(ms, 90) : ms));
    const f = (now: number) => {
      if (tk?.skip) return res();
      const k = Math.min(1, (now - t0) / d);
      fn(k);
      if (k < 1) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });
}

export const sleep = (ms: number, tk?: Token) =>
  new Promise<void>((r) => {
    if (tk?.skip) return r();
    const t = setTimeout(r, D(reduced() ? Math.min(ms, 150) : ms));
    if (tk) {
      const check = setInterval(() => {
        if (tk.skip) {
          clearTimeout(t);
          clearInterval(check);
          r();
        }
      }, 30);
      setTimeout(() => clearInterval(check), D(ms) + 60);
    }
  });

/** A short buzz when haptics are on: 6–10ms beats, 18–28 for gold and level-ups, [30,40,60] for a new board. */
export function buzz(p: number | number[]) {
  if (!useSettings.getState().haptics) return;
  try {
    navigator.vibrate?.(p);
  } catch {
    /* no vibration */
  }
}

/** The app's haptic vocabulary (it respects the vibration setting). */
export const HAPTIC = { select: 6, success: 12, warn: [10, 40, 10], big: [30, 40, 60] } as const;
export type HapticKind = keyof typeof HAPTIC;
/** select: tabs, switches, sheets, Play · success: a star, a badge · warn: a blunder badge · big: a level-up, a new board. */
export const haptic = (kind: HapticKind) => buzz(HAPTIC[kind] as number | number[]);

/** UI motion (tabs, switches, pages, sheets, fades): fast out, no overshoot. Also the CSS variable --ease-ui. */
export const UI_EASE = 'cubic-bezier(.2,.8,.3,1)';

/** Content that swaps (a tab pane, a coach bubble, a skeleton turning into content): fades up 6px. */
export function crossfade(el: Element | null | undefined, dur = 220): Promise<void> {
  return animate(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { d: dur, e: UI_EASE });
}
