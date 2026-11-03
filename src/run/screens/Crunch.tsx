// Crunch: the scoring chain played beat by beat (Chips and Mult boxes, label pops, scale punches,
// the pitch ladder, hit-stops, shakes and haptics), plus the pieces the tally and the finale share:
// flying particles, the blind bar, the score fire. Tap anywhere while it plays for ×3, hold to finish.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { beatMs, beatPitch, type Beat, type Chain } from '../crunch';
import { fmtBig } from '../rules';
import { TUNING as T } from '../tuning';
import { buzz, sfx, type RunSound } from '../sfx';
import { reducedMotion, useRunSettings } from '../settings';
import { FervorFlame, PixelNum } from './bits';

const C = T.crunch;
/** One colour per meaning, everywhere. */
export const CRUNCH_COLOR = { chips: 'var(--chip)', mult: 'var(--mult)', xmult: 'var(--xmult)', gold: 'var(--gold)' } as const;
const BEAT_SOUND: Record<Beat['kind'], RunSound> = { chips: 'beatChip', mult: 'beatMult', xmult: 'beatX', gold: 'beatGold' };
const BEAT_HAPTIC: Record<Beat['kind'], number> = { chips: C.haptic.chip, mult: C.haptic.mult, xmult: C.haptic.xmult, gold: C.haptic.chip };

const centerOf = (el: Element | null | undefined) => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};

/**
 * Pace for crunch animations: the game speed, ×tapSpeed after a tap, instant after a hold
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
      ctl.current.tap = C.tapSpeed;
      clearTimeout(hold);
      hold = setTimeout(() => ctl.current.active && finish(), C.holdMs);
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

interface Pop {
  id: number;
  text: string;
  kind: Beat['kind'];
}
let popId = 1;

/**
 * Plays chains into a pair of counters. `onBeat` lets the caller jiggle the beat's source icon
 * (return true if it showed the label there, so it isn't popped twice).
 */
export function useChainPlayer(init: { chips: number; mult: number }, pace: Pace, opts: { onBeat?: (b: Beat) => boolean | void; onShake?: (px: number) => void; chipsRef?: RefObject<HTMLElement | null> } = {}) {
  const [chips, setChips] = useState(init.chips);
  const [mult, setMult] = useState(init.mult);
  const [punch, setPunch] = useState({ chips: 0, mult: 0 });
  const [flashX, setFlashX] = useState(0);
  const [hitStop, setHitStop] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [flyer, setFlyer] = useState<{ id: number; x: number; y: number; dx: number; dy: number; go: boolean; text: string } | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const pop = (text: string, kind: Beat['kind']) => {
    const p = { id: popId++, text, kind };
    setPops((x) => [...x.slice(-5), p]);
    setTimeout(() => setPops((x) => x.filter((y) => y.id !== p.id)), 900);
  };

  /** Count the mult up from a to b (×mult) over ms. */
  const countUp = (a: number, b: number, ms: number) =>
    new Promise<void>((res) => {
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
        if (pace.ctl.current.instant || k >= 1) return setMult(b), res();
        setMult(Math.round((a + (b - a) * (1 - (1 - k) ** 2)) * 100) / 100);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

  const run = async (chain: Chain, o: { quiet?: boolean; from?: { x: number; y: number } | null }) => {
    pace.begin(!!o.quiet);
    const reduced = reducedMotion();
    setChips(chain.from.chips);
    setMult(chain.from.mult);
    // Chips pop off the moved piece and fly into the Chips box.
    const target = centerOf(optsRef.current.chipsRef?.current);
    const first = chain.beats[0];
    if (!o.quiet && !reduced && o.from && target && first?.src.relic === 'piece') {
      const f = { id: popId++, x: o.from.x, y: o.from.y, dx: target.x - o.from.x, dy: target.y - o.from.y, go: false, text: first.label };
      setFlyer(f);
      requestAnimationFrame(() => requestAnimationFrame(() => setFlyer((x) => (x?.id === f.id ? { ...x, go: true } : x))));
      await pace.wait(C.chipFlyMs);
      setFlyer(null);
    }
    for (let i = 0; i < chain.beats.length; i++) {
      if (pace.ctl.current.instant) break;
      const b = chain.beats[i];
      const ms = beatMs(i);
      // Beats are timed from their own start, so render and timer overhead don't add up.
      let t0 = performance.now();
      const left = (total: number) => total - (performance.now() - t0) * pace.speed();
      const box = b.kind === 'chips' ? 'chips' : 'mult';
      if (b.kind === 'xmult' && !reduced) {
        // Hit-stop: everything holds for a moment, then the heavy hit.
        setHitStop(true);
        await pace.wait(C.hitStopMs);
        setHitStop(false);
        t0 = performance.now();
      }
      const shown = optsRef.current.onBeat?.(b);
      if (!shown) pop(b.label, b.kind);
      sfx(BEAT_SOUND[b.kind], 0, false, beatPitch(i));
      buzz(BEAT_HAPTIC[b.kind]);
      if (b.kind === 'gold') {
        await pace.wait(left(ms));
        continue;
      }
      if (!reduced) setPunch((p) => ({ ...p, [box]: p[box] + 1 }));
      if (b.kind === 'xmult') {
        setFlashX((x) => x + 1);
        if (!reduced) optsRef.current.onShake?.(C.xmultShakePx);
        await pace.wait(C.punchMs / 2);
        await countUp(chainMult(chain, i - 1), b.mult, Math.max(60, left(ms)) / pace.speed());
      } else {
        // The value changes on the punch's peak.
        await pace.wait(C.punchMs / 2);
        if (b.kind === 'chips') setChips(b.chips);
        else setMult(b.mult);
        await pace.wait(left(ms));
      }
    }
    setChips(chain.to.chips);
    setMult(chain.to.mult);
    pace.end();
  };

  /** Queue a chain; a running one is finished at once first (input is never held up). */
  const play = useCallback((chain: Chain, o: { quiet?: boolean; from?: { x: number; y: number } | null } = {}) => {
    if (busy.current > 0) pace.finish();
    busy.current++;
    const p = queue.current.then(() => run(chain, o)).finally(() => void busy.current--);
    queue.current = p.catch(() => undefined);
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Set the counters directly (a take-back, a new room). */
  const snap = useCallback((v: { chips: number; mult: number }) => {
    if (busy.current > 0) return;
    setChips(v.chips);
    setMult(v.mult);
  }, []);
  const playing = () => busy.current > 0;

  return { chips, mult, punch, flashX, hitStop, pops, flyer, play, snap, playing };
}
export type ChainPlayer = ReturnType<typeof useChainPlayer>;

/** The mult shown before beat i+1 (i = -1: the chain's start). */
function chainMult(chain: Chain, i: number) {
  for (let j = i; j >= 0; j--) if (chain.beats[j].kind !== 'gold') return chain.beats[j].mult;
  return chain.from.mult;
}

/** The Chips (blue) and Mult (red) boxes, with punches, pops and the ×mult flash. */
export function ScoreBoxes({ p, chipsRef, multRef, size = 2.5, fervor, slide = 0, children, className = '' }: { p: ChainPlayer; chipsRef?: RefObject<HTMLDivElement | null>; multRef?: RefObject<HTMLDivElement | null>; size?: number; fervor?: number; /** 0..1: the boxes slide together (room end). */ slide?: number; children?: ReactNode; className?: string }) {
  const pops = (kind: 'chips' | 'mult') => p.pops.filter((x) => (kind === 'chips' ? x.kind === 'chips' : x.kind !== 'chips'));
  const box = (kind: 'chips' | 'mult', style: CSSProperties) => (
    <div className="relative" style={style}>
      <div
        ref={kind === 'chips' ? chipsRef : multRef}
        key={`${kind}${p.punch[kind]}`}
        className={`flex items-center justify-center rounded px-2 py-1 ${p.punch[kind] ? 'run-punch' : ''} ${kind === 'mult' && p.hitStop ? 'run-hitstop' : ''}`}
        style={{ background: kind === 'chips' ? 'rgba(79,179,255,.2)' : 'rgba(255,93,108,.2)', boxShadow: `inset 0 0 0 1px ${kind === 'chips' ? 'rgba(79,179,255,.6)' : 'rgba(255,93,108,.6)'}`, minWidth: size * 14 }}
      >
        {kind === 'mult' && p.flashX > 0 && <span key={p.flashX} className="run-xflash pointer-events-none absolute inset-0 rounded" />}
        <PixelNum value={kind === 'chips' ? p.chips : p.mult} big={kind === 'chips'} size={size} color={kind === 'chips' ? 'var(--chip)' : 'var(--mult)'} />
      </div>
      {pops(kind).map((x) => (
        <span key={x.id} className="run-float run-sans pointer-events-none absolute -top-3 left-1/2 z-30 rounded px-1 text-[11px] font-black whitespace-nowrap text-white" style={{ background: CRUNCH_COLOR[x.kind], color: x.kind === 'gold' ? '#2a1a00' : undefined }}>
          {x.text}
        </span>
      ))}
    </div>
  );
  const dx = slide * 26;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {box('chips', { transform: `translateX(${dx}px)`, transition: `transform ${C.roomEnd.slideMs}ms cubic-bezier(.6,0,.9,.4)` })}
      <span style={{ opacity: 1 - slide, transition: 'opacity 150ms' }}>
        <PixelNum value="×" size={size} color="var(--ink-dim)" glow={false} />
      </span>
      {box('mult', { transform: `translateX(${-dx}px)`, transition: `transform ${C.roomEnd.slideMs}ms cubic-bezier(.6,0,.9,.4)` })}
      {fervor !== undefined && <FervorFlame value={fervor} size={0.8} />}
      {children}
      {p.flyer &&
        createPortal(
          <span
            className="run-chip-fly run-sans text-[10px] font-black text-white"
            style={{ left: p.flyer.x - 11, top: p.flyer.y - 11, transform: p.flyer.go ? `translate(${p.flyer.dx}px, ${p.flyer.dy}px) scale(0.8)` : 'translate(0,-10px) scale(1.25)', transitionDuration: `${C.chipFlyMs / (useRunSettings.getState().speed || 1)}ms` }}
          >
            {p.flyer.text}
          </span>,
          document.body,
        )}
    </div>
  );
}

/** The blind bar: fills toward the blind, then overflows (×ratio) when beaten. */
export function BlindBar({ score, target, animate = false, className = '' }: { score: number; target: number; animate?: boolean; className?: string }) {
  if (target <= 0) return null;
  const ratio = score / target;
  const fill = Math.min(1, ratio);
  const over = ratio > 1 ? Math.min(1, Math.log2(ratio) / 3) : 0;
  return (
    <div className={`w-full ${className}`}>
      <div className="run-sans mb-0.5 flex justify-between text-[10px] font-bold">
        <span className="text-[var(--ink-dim)]">BLIND {fmtBig(target)}</span>
        <span style={{ color: ratio >= 1 ? '#5ee59a' : 'var(--ink)' }}>
          {fmtBig(score)}
          {ratio >= 1.05 ? ` · ×${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}` : ''}
        </span>
      </div>
      <div className="relative h-1.5 w-full bg-black/50" style={{ boxShadow: '0 0 0 1px #1b0f22' }}>
        <div className="absolute inset-y-0 left-0" style={{ width: `${fill * 100}%`, background: ratio >= 1 ? '#5ee59a' : 'var(--chip)', transition: animate ? `width ${C.roomEnd.barMs}ms cubic-bezier(.2,.8,.3,1)` : 'width 200ms' }} />
        {over > 0 && <div className="run-overflow absolute inset-y-0 left-0" style={{ width: `${over * 100}%` }} />}
      </div>
    </div>
  );
}

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
export function Stream({ from, to, n, color, round = false, ms = 520, stagger = C.roomEnd.coinStaggerMs, onLand, onDone }: { from: RefObject<HTMLElement | null>; to: RefObject<HTMLElement | null>; n: number; color: string; round?: boolean; ms?: number; stagger?: number; onLand?: (i: number) => void; onDone?: () => void }) {
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
export function Sparks({ n = C.roomEnd.particles, colors }: { n?: number; colors: string[] }) {
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
