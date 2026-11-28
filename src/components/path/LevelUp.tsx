// The level-up moment (ported from the prototype). After the tally, the area under the board
// crossfades into the path world drawn as it was before the puzzle; the camera pans so the trail
// ahead shows; the pawn hops one tile per level (the tile left grows into a hedge). Then the board
// dims behind the level badge: a white puzzle-piece silhouette pops, the badge brightens in its
// place with a glow, a ring and slow rays, chips of the badge's material drift out, "You Completed
// Level 4!". It gets out of your way (round 8): a tap on the board or the panel closes it (even
// mid-walk: the points are saved and the crest already shows the new level), and 1.2 s after the
// level has popped it closes by itself. "See path" opens the Path. It ends at the dock's top edge,
// so Again, Analyse and Next puzzle stay in reach. Crossing a board parts its clouds and a new-board
// card follows when it closes.
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BOUNCE, POP, SOFT, D, animate, buzz, sleep, token, tween, type Token } from '../../lib/motion';
import { CONFETTI, emit } from '../../lib/fx';
import { sfx } from '../../lib/sfx';
import { BOARD_FACTORS, boardName, levelAt, markPathSeen, round5 } from '../../lib/puzzles/path';
import { buildScene, cellPoint, pathTag, walkTiles, type WPos } from '../../lib/puzzles/walk';
import { ISO } from '../../lib/puzzles/world';
import { MAT, PathBadge, PZ } from './PathUI';

const CHIPS_T = [['#c9894a', '#8f5a2c', '#f2d9a8', '#ffffff'], ['#c9cdd1', '#8a9197', '#ffffff'], ['#e3a165', '#a8642c', '#fff1dc'], ['#ffffff', '#c6d0d9', '#9aa6b2'], ['#bff4ff', '#5fd0ec', '#ffffff'], ['#d6b6fb', '#9b5de5', '#ffffff'], ['#ff9a9e', '#e0383e', '#ffffff'], ['#ffe08a', '#f2b51c', '#fff8dc']];
const wpos = (points: number): WPos => {
  const p = levelAt(points);
  return p.board > 7 ? { i: 7, l: 19 } : { i: p.board, l: p.level - 1 };
};
const rect = (el: Element) => el.getBoundingClientRect();

/** The panel's bottom: the dock's top edge, measured (the old fixed guess only when there's no dock). */
function useDockTop(): string {
  const [bottom, setBottom] = useState('calc(56px + env(safe-area-inset-bottom))');
  useEffect(() => {
    const docks = [...document.querySelectorAll<HTMLElement>('[data-dock]')];
    const dock = docks[docks.length - 1];
    if (!dock) return;
    const upd = () => setBottom(`${Math.max(0, Math.round(innerHeight - dock.getBoundingClientRect().top))}px`);
    upd();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(upd) : null;
    ro?.observe(dock);
    addEventListener('resize', upd);
    return () => {
      ro?.disconnect();
      removeEventListener('resize', upd);
    };
  }, []);
  return bottom;
}

export const LEVELUP_HOLD = 1200;

/**
 * `closing`: close now (a tap, Again or the timer): the overlay fades (160 ms), the panel slides
 * down (240 ms), then `onClosed(board)` — with the new board's number when the walk crossed one.
 */
export function LevelUpPanel({ from, to, board, instant, closing, onClose, onClosed, onOpenPath }: { from: number; to: number; board: HTMLElement; instant: boolean; closing: boolean; onClose: () => void; onClosed: (tierBoard?: number) => void; onOpenPath?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const run = useRef<Token | null>(null);
  const bottom = useDockTop();
  const dim = useRef<HTMLDivElement>(null);
  const sil = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const rays = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<{ top: number; bl: number; bt: number; bw: number } | null>(null);
  const a = wpos(from);
  const b = wpos(to);
  const done = a.i === b.i ? b.l : 20;
  useEffect(() => {
    const r = rect(board);
    setGeo({ top: r.bottom, bl: r.left, bt: r.top, bw: r.width });
  }, [board]);
  // Closing: stop the walk where it is (it's only a picture) and get out of the way.
  useEffect(() => {
    if (!closing) return;
    if (run.current) run.current.skip = true;
    const crossed = b.i > a.i ? levelAt(to).board : undefined;
    void Promise.all([animate(over.current, [{ opacity: 1 }, { opacity: 0 }], { d: 160 }), animate(host.current, [{ transform: 'translateY(0)' }, { transform: 'translateY(105%)' }], { ...SOFT, d: 240 })]).then(() => onClosed(crossed));
  }, [closing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!geo || !host.current) return;
    const tk = token();
    run.current = tk;
    const h = host.current;
    const H = h.clientHeight;
    const start = instant ? b : a;
    const sc = buildScene(h, { b: start.i, lvl: start.l, w0: start.i, w1: Math.min(7, Math.max(b.i, start.i) + 1), mt: 60, ...pathTag() }, 'lv');
    const pp = cellPoint(sc, start);
    let camY = H * 0.38 - pp.y;
    const put = () => (sc.inner.style.transform = `translateY(${camY.toFixed(1)}px)`);
    put();
    let cv = 0;
    sc.follow = (y) => {
      const t = H * 0.64 - y;
      cv = cv * 0.82 + (t - camY) * 0.028;
      camY += cv;
      put();
    };
    const overlay = async (fast: boolean) => {
      if (fast) {
        for (const r of [dim, badge, text, rays]) if (r.current) r.current.style.opacity = '1';
        return;
      }
      void animate(dim.current, [{ opacity: 0 }, { opacity: 1 }], { d: 280 });
      const wp = sil.current;
      await animate(wp, [{ transform: 'scale(.3) rotate(-14deg)', opacity: 0 }, { transform: 'scale(1.14) rotate(-14deg)', opacity: 1, offset: 0.7 }, { transform: 'scale(1) rotate(-14deg)', opacity: 1 }], { d: 340, e: 'ease-out', fill: 'forwards' });
      void animate(wp, [{ opacity: 1, transform: 'scale(1) rotate(-14deg)' }, { opacity: 0, transform: 'scale(.82) rotate(-14deg)' }], { d: 280, fill: 'forwards' });
      void animate(badge.current, [{ transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0, filter: 'brightness(3.2)' }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, filter: 'brightness(1)' }], BOUNCE);
      void animate(glow.current, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0.95 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.5 }], { d: 800, e: 'ease-out' });
      void animate(rays.current, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { d: 700, e: 'ease-out' });
      void animate(ring.current, [{ transform: 'scale(.5)', opacity: 0.9 }, { transform: 'scale(2.2)', opacity: 0 }], { d: 650, e: 'cubic-bezier(.2,.8,.3,1)' });
      if (badge.current) {
        const r = rect(badge.current);
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        emit({ x, y, n: 34, shape: 'confetti', colors: CHIPS_T[a.i], speed: [70, 200], angle: -90, spread: 360, gravity: 40, drag: 0.96, life: [1.2, 2.2], size: [1.6, 3.2] });
        emit({ x, y, n: 22, shape: 'glow', colors: ['#ffffff', '#fff4d6'], speed: [40, 160], gravity: 20, drag: 0.96, life: [0.9, 1.6], size: [1.2, 2.4] });
      }
      void animate(text.current, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 140 });
      sfx('levelUp');
      buzz(28);
    };
    const seen = () => void markPathSeen(levelAt(to).start);
    void (async () => {
      if (instant) {
        camY = H * 0.64 - pp.y;
        put();
        await overlay(true);
        seen();
        await sleep(LEVELUP_HOLD, tk);
        if (!tk.skip) onClose();
        return;
      }
      void animate(h, [{ opacity: 0 }, { opacity: 1 }], { d: 260 });
      sfx('open');
      const c0 = camY;
      const c1 = H * 0.64 - pp.y;
      await tween(720, (k) => {
        camY = c0 + (c1 - c0) * (1 - Math.pow(1 - k, 3));
        put();
      }, tk);
      if (tk.skip) return;
      await sleep(140, tk);
      if (tk.skip) return;
      await walkTiles(sc, a, b, 620, 1.1, tk, async () => {
        const c = rect(h);
        emit({ x: c.left + c.width / 2, y: c.top + c.height * 0.35, n: 60, shape: 'confetti', colors: CONFETTI, speed: [220, 520], angle: -90, spread: 120, gravity: 600, drag: 0.975, life: [1.2, 2], size: [4, 7] });
        sfx('tierUp');
      });
      if (tk.skip) return;
      await overlay(false);
      seen();
      // The level has popped: a moment to take it in, then it closes by itself.
      await sleep(LEVELUP_HOLD, tk);
      if (!tk.skip) onClose();
    })();
    return () => {
      tk.skip = true;
    };
  }, [geo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!geo) return null;
  const S = Math.min(geo.bw, 420);
  return (
    <>
      {/* The board overlay */}
      <div ref={over} className="pointer-events-none fixed z-[60]" style={{ left: geo.bl, top: geo.bt, width: geo.bw, height: geo.bw }} data-testid="level-overlay">
        <div ref={dim} className="absolute inset-0 opacity-0" style={{ background: 'rgba(14,13,11,.72)' }} />
        <div ref={rays} className="absolute top-[46%] left-1/2 opacity-0" style={{ width: S * 0.8, height: S * 0.8, margin: `-${S * 0.4}px 0 0 -${S * 0.4}px`, borderRadius: '50%', background: 'repeating-conic-gradient(rgba(255,236,190,.16) 0 9deg,transparent 9deg 22.5deg)', WebkitMask: 'radial-gradient(circle,#000 18%,transparent 66%)', mask: 'radial-gradient(circle,#000 18%,transparent 66%)', animation: 'ppspin 16s linear infinite' }} />
        <div ref={glow} className="absolute top-[46%] left-1/2 opacity-0" style={{ width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,236,190,.55),rgba(255,236,190,0) 65%)' }} />
        <div ref={ring} className="absolute top-[46%] left-1/2 opacity-0" style={{ width: 100, height: 100, margin: '-50px 0 0 -50px', borderRadius: '50%', border: '3px solid rgba(255,255,255,.9)' }} />
        <div ref={sil} className="absolute top-[46%] left-1/2 opacity-0" style={{ width: 108, height: 108, margin: '-54px 0 0 -54px' }}>
          <svg viewBox="0 0 60 60" width="108" height="108">
            <path d={PZ} fill="#fff" />
          </svg>
        </div>
        <div ref={badge} className="absolute top-[46%] left-1/2 opacity-0" style={{ transform: 'translate(-50%,-50%)' }}>
          <PathBadge tier={a.i} level={done} size={86} tilt={-14} />
        </div>
        <div ref={text} className="absolute inset-x-0 top-[calc(46%+52px)] text-center text-[15px] font-extrabold text-white opacity-0 [text-shadow:0_2px_8px_rgba(0,0,0,.6)]">
          You Completed Level {done}!
        </div>
      </div>
      {/* The path panel under the board */}
      <div ref={host} className="fixed inset-x-0 z-[55] overflow-hidden" style={{ top: geo.top, bottom, background: ISO.TH[a.i].g[0] }} onClick={onClose} data-testid="level-panel">
        <div className="isoIn absolute inset-x-0 top-0 will-change-transform" />
        <div className="wlight" />
        {onOpenPath && (
          // "See path ›": the way to the full Path (a 44px+ tap target around the pill; not a close tap).
          <button
            className="absolute top-0 right-0 z-10 flex h-[52px] items-start justify-end pt-[10px] pr-[10px] pl-4"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPath();
            }}
            data-testid="levelup-seepath"
          >
            <span className="flex items-center gap-0.5 rounded-full py-1 pr-1.5 pl-2.5 text-[13px] font-bold text-white backdrop-blur-sm" style={{ background: 'rgba(20,30,15,.55)' }}>
              See path <ChevronRight size={15} strokeWidth={2.6} />
            </span>
          </button>
        )}
      </div>
    </>
  );
}

const PROMPT_LINE = ['Every puzzle names its theme', 'Themes start to fade', 'Some puzzles only name the goal', 'Your first puzzles with no clues', 'Half of puzzles without clues', 'Mostly no clues', 'No clues from here on', 'The final board'];

/** The new-board takeover card (a tier-up), with a window onto the new board. */
export function TierUpCard({ board, onClose, onOpenPath }: { board: number; onClose: () => void; onOpenPath?: () => void }) {
  const t = Math.min(7, board);
  const prev = Math.max(0, t - 1);
  const root = useRef<HTMLDivElement>(null);
  const crest = useRef<HTMLDivElement>(null);
  const win = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const o = root.current;
    if (!o) return;
    const q = (s: string) => o.querySelector(s);
    void animate(q('.tc-rays'), [{ transform: 'scale(.25)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.42 }], { d: 1000, e: 'cubic-bezier(.2,.9,.3,1)' });
    void animate(q('.tc-lab'), [{ opacity: 0, transform: 'translateY(8px)', letterSpacing: '.4em' }, { opacity: 1, transform: 'none', letterSpacing: '.14em' }], { d: 600, e: 'cubic-bezier(.2,.8,.3,1)', delay: 120 });
    void animate(crest.current, [{ transform: 'translateY(-240px) scale(.5) rotate(-20deg)', opacity: 0 }, { transform: 'translateY(0) scale(1) rotate(0)', opacity: 1 }], { d: BOUNCE.d + 120, e: BOUNCE.e, delay: 160 });
    o.querySelectorAll('.tc-name span').forEach((s, k) => void animate(s, [{ transform: 'translateY(34px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { ...POP, delay: 520 + k * 38 }));
    void animate(win.current, [{ opacity: 0, transform: 'translateY(26px) scale(.94)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 760 });
    o.querySelectorAll('.tc-perk').forEach((s, k) => void animate(s, [{ transform: 'translateX(-34px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { ...SOFT, delay: 980 + k * 130 }));
    void animate(q('.tc-btns'), [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 1400 });
    const land = setTimeout(() => {
      if (!crest.current) return;
      const r = rect(crest.current);
      emit({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: 44, shape: 'star', colors: ['#ffe27a', '#f7c631', '#fff3c4'], speed: [140, 400], life: [0.5, 1.1], size: [4, 9] });
      sfx('pawnLand');
      buzz([30, 40, 60]);
    }, D(160) + BOUNCE.d * 0.35);
    // (No confetti rain here: the board moment had it.)
    sfx('tierUp');
    // The window onto the new board: the pawn on tile 1, the old board's last hedges behind it.
    // (Drawn a moment later, so drawing it doesn't hold up the entrance; the window comes in at 760 ms.)
    const draw = setTimeout(() => {
      if (!win.current) return;
      const sc = buildScene(win.current, { b: t, lvl: 0, w0: Math.max(0, t - 1), w1: Math.min(7, t + 1), mt: 40, ...pathTag() }, 'tw');
      const p1 = cellPoint(sc, { i: t, l: 1 });
      sc.inner.style.transform = `translateY(${(win.current.clientHeight * 0.58 - p1.y).toFixed(1)}px)`;
    }, D(420));
    return () => {
      clearTimeout(land);
      clearTimeout(draw);
    };
  }, [t]);
  const name = `${boardName(board)} board`;
  return (
    // It crossfades in over the board moment's world (a CSS fade from its first paint, so it never
    // shows un-animated while its window onto the new board is being drawn).
    <div ref={root} className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden px-6 text-center text-white" style={{ background: `radial-gradient(circle at 50% 24%, color-mix(in srgb, ${MAT[t][1]} 38%, #161412), #141210 62%)`, animation: 'fade-in 300ms ease both' }} data-testid="tierup-card">
      <div className="tc-rays pointer-events-none absolute top-[30%] left-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'repeating-conic-gradient(rgba(255,236,190,.22) 0 7deg,transparent 7deg 18deg)', animation: 'ppspin 30s linear infinite' }} />
      <div className="tc-lab relative mb-2 text-[11px] font-extrabold tracking-[0.14em] text-[#f7c631] uppercase opacity-0">New board unlocked</div>
      <div ref={crest} className="relative opacity-0">
        <PathBadge tier={t} level={1} size={120} />
      </div>
      <div className="tc-name relative mt-2 text-[30px] font-extrabold tracking-[-0.01em]">
        {[...name].map((c, i) => (
          <span key={i} className="inline-block opacity-0">
            {c === ' ' ? ' ' : c}
          </span>
        ))}
      </div>
      <div ref={win} className="isoWin relative mt-3 overflow-hidden rounded-2xl opacity-0 shadow-[0_18px_40px_rgba(0,0,0,.55)] ring-1 ring-white/15" style={{ width: 310, height: 150, background: ISO.TH[t].g[0] }}>
        <div className="isoIn absolute inset-x-0 top-0" />
      </div>
      <ul className="relative mt-4 space-y-1 text-[14px] font-semibold text-white/90">
        <li className="tc-perk opacity-0">
          Every puzzle pays ×{BOARD_FACTORS[t]} <s className="text-white/45">×{BOARD_FACTORS[prev]}</s>
        </li>
        <li className="tc-perk opacity-0">Daily Solver +{Math.round(60 * BOARD_FACTORS[t])}</li>
        <li className="tc-perk opacity-0">{board > 7 ? `Levels cost a little more · ${round5(60 * BOARD_FACTORS[7])}+ a day` : PROMPT_LINE[t]}</li>
      </ul>
      <div className="tc-btns relative mt-6 flex w-full max-w-xs flex-col items-center gap-3 opacity-0">
        <button className="btn-primary w-full !py-3 text-base" onClick={onClose} data-testid="tierup-keep">
          Keep climbing
        </button>
        <button className="text-sm font-bold text-white underline" onClick={onOpenPath ?? onClose}>
          See your new board
        </button>
      </div>
    </div>
  );
}

/** Reduced motion: a simple "Level 5" banner instead of the panel. */
export function LevelBanner({ points, onDone }: { points: number; onDone: () => void }) {
  const p = levelAt(points);
  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55" data-testid="level-banner">
      <PathBadge tier={p.tier} level={p.level} size={86} />
      <div className="mt-2 text-lg font-extrabold text-white">Level {p.level}</div>
    </div>
  );
}
