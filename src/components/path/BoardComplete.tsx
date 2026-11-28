// Board complete (round 8): finishing a whole board gets its own moment before the new-board card.
//   Beat 1, the look back: the world fills the screen; the pawn walks any hops left on the old
//     board, the camera eases out until all 20 levels fit, "Wood board · 20 of 20", and levels
//     1 → 20 light up in turn (each check turns gold, lifts and settles, a rising note), the pawn
//     hops in place on level 20.
//   Beat 2, the trophy: a dark gradient over the top with "Board complete", the board's name and
//     four numbers counting up; the board's trophy rises from beside level 20 with rays, a ring,
//     chips of its material and gold stars, and the moment's only confetti rain.
//   Beat 3, into the new board: the text goes, the trophy shrinks onto its plinth in the world, the
//     camera zooms back and climbs, the clouds part and the pawn hops onto level 1 of the new
//     board; only then do the header crest and the path card roll over. Then the new-board card.
// One tap skips to the card. Reduced motion: a still card for 2 s. The points are saved first.
import { useEffect, useRef, useState } from 'react';
import { BOUNCE, POP, SOFT, animate, buzz, eios, sleep, token, tween, type Token } from '../../lib/motion';
import { confettiRain, emit } from '../../lib/fx';
import { sfx } from '../../lib/sfx';
import { playStep } from '../../lib/sound';
import { boardName, boardStats, levelAt, type BoardRecord } from '../../lib/puzzles/path';
import { buildScene, cellPoint, pathTag, setTile, walkTiles, type Scene, type WPos } from '../../lib/puzzles/walk';
import { ISO } from '../../lib/puzzles/world';
import { CountUp } from '../Reward';
import { BoardTrophy } from './PathUI';

const CHIPS_T = [['#c9894a', '#8f5a2c', '#f2d9a8', '#ffffff'], ['#c9cdd1', '#8a9197', '#ffffff'], ['#e3a165', '#a8642c', '#fff1dc'], ['#ffffff', '#c6d0d9', '#9aa6b2'], ['#bff4ff', '#5fd0ec', '#ffffff'], ['#d6b6fb', '#9b5de5', '#ffffff'], ['#ff9a9e', '#e0383e', '#ffffff'], ['#ffe08a', '#f2b51c', '#fff8dc']];
const wpos = (points: number): WPos => {
  const p = levelAt(points);
  return p.board > 7 ? { i: 7, l: 19 } : { i: p.board, l: p.level - 1 };
};
const SPAN = 8.6;
const TOP = 120;
const BOTTOM = 70;
const TROPHY = 170;

export interface BoardCompleteProps {
  /** Points before and after the award (the award crosses a board). */
  from: number;
  to: number;
  /** The finished board's numbers (saved already). */
  record?: BoardRecord;
  /** Reduced motion: a still card for 2 s. */
  still?: boolean;
  /** The pawn has landed on the new board: the header crest and the path card may roll over. */
  onLanded: () => void;
  /** On to the new-board card (a 300 ms crossfade). */
  onDone: (board: number) => void;
}

/** The four numbers under the title: levels, puzzles, days, best streak. */
function Stats({ record, run, instant = false }: { record?: BoardRecord; run: boolean; instant?: boolean }) {
  const st = boardStats(record);
  const tiles: [string, number | null][] = [
    ['levels', 20],
    ['puzzles', st?.puzzles ?? null],
    ['days', st?.days ?? null],
    ['best streak', st?.bestStreak ?? null],
  ];
  return (
    <div className="mt-4 grid w-full max-w-[330px] grid-cols-4 gap-2" data-testid="bc-stats">
      {tiles.map(([k, v]) => (
        <div key={k} className="bc-tile flex flex-col items-center rounded-[10px] bg-white/10 px-1 py-2 ring-1 ring-white/10">
          <span className="font-display text-[22px] leading-none font-extrabold tabular-nums">{v === null ? '–' : <CountUp from={0} to={v} ms={600} run={run} instant={instant} />}</span>
          <span className="mt-1 text-[10.5px] font-semibold text-white/70">{k}</span>
        </div>
      ))}
    </div>
  );
}

export function BoardComplete({ from, to, record, still = false, onLanded, onDone }: BoardCompleteProps) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const grad = useRef<HTMLDivElement>(null);
  const prize = useRef<HTMLDivElement>(null);
  const rays = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const newPill = useRef<HTMLDivElement>(null);
  const run = useRef<Token | null>(null);
  const ended = useRef(false);
  const landed = useRef(false);
  const a = wpos(from);
  const b = wpos(to);
  const oldBoard = levelAt(from).board;
  const newBoard = levelAt(to).board;
  const t0 = Math.min(7, oldBoard);
  const t1 = Math.min(7, newBoard);
  const name = `${boardName(oldBoard)} board`;

  const land = () => {
    if (landed.current) return;
    landed.current = true;
    onLanded();
  };
  /** On to the card (once): the header rolls over if it hasn't, then a 300 ms crossfade. */
  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    if (run.current) run.current.skip = true;
    land();
    // The card fades in over the world (which stays put underneath until it's gone).
    onDone(newBoard);
  };

  useEffect(() => {
    if (still) {
      const t = setTimeout(finish, 2000);
      sfx('boardDone');
      return () => clearTimeout(t);
    }
    const h = host.current;
    if (!h) return;
    const tk = token();
    run.current = tk;
    const W = innerWidth;
    const H = innerHeight;
    // The zoom that fits the finished board's 20 levels between TOP and BOTTOM, and a world built
    // that much wider (same tiles) so the zoomed-out view still fills the screen's width.
    const G0 = ISO.geom(W, SPAN);
    const content = 19 * G0.sy + G0.sx * 1.9 + G0.sy * 1.3;
    const s = Math.min(1, (H - TOP - BOTTOM) / content);
    const Wb = W / s;
    const sc: Scene = buildScene(h, { b: a.i, lvl: a.l, w0: a.i, w1: Math.min(7, a.i + 1), mt: 60, W: Wb, span: SPAN / s, ...pathTag() }, 'bc');
    const inner = sc.inner;
    inner.style.transformOrigin = '0 0';
    let tx = (W - Wb) / 2;
    let ty = H * 0.62 - cellPoint(sc, a).y;
    let z = 1;
    const put = () => (inner.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${z.toFixed(4)})`);
    put();
    let cv = 0;
    sc.follow = (y) => {
      const target = H * 0.62 - y * z;
      cv = cv * 0.82 + (target - ty) * 0.028;
      ty += cv;
      put();
    };
    const screenOf = (p: { x: number; y: number }) => ({ x: tx + p.x * z, y: ty + p.y * z });
    const top19 = cellPoint(sc, { i: a.i, l: 19 }).y - G0.sx * 1.9;
    const zoomTo = (z1: number, tx1: number, ty1: number, ms: number) => {
      const [z0, x0, y0] = [z, tx, ty];
      return tween(ms, (k) => {
        const e = eios(k);
        z = z0 + (z1 - z0) * e;
        tx = x0 + (tx1 - x0) * e;
        ty = y0 + (ty1 - y0) * e;
        put();
      }, tk);
    };
    const q = (sel: string) => root.current?.querySelector(sel) ?? null;

    void (async () => {
      void animate(root.current, [{ opacity: 0 }, { opacity: 1 }], { d: 300 });
      sfx('open');
      await sleep(300, tk);
      // Beat 1: the hops left on the old board, at normal zoom.
      if (a.l < 19) await walkTiles(sc, a, { i: a.i, l: 19 }, 520, 1, tk);
      if (tk.skip) return;
      sc.follow = undefined;
      void animate(pill.current, [{ opacity: 0, transform: 'translate(-50%,-8px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { ...SOFT, delay: 300 });
      await zoomTo(s, 0, TOP - s * top19, 900);
      if (tk.skip) return;
      // Levels 1 → 20 light up in turn.
      for (let i = 0; i < 20; i++) {
        if (tk.skip) return;
        setTile(sc, a.i, i, 'done');
        const tin = sc.svg.querySelector(`.tile[data-w="${a.i}"][data-i="${i}"] .tin`);
        const chk = tin?.querySelector('.chk');
        const paths = chk?.querySelectorAll('path');
        if (chk && paths?.length === 2) {
          void animate(chk, [{ transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { d: 400, e: 'ease-out' });
          void animate(paths[1], [{ stroke: '#ffe066', filter: 'drop-shadow(0 0 4px rgba(255,216,74,.95))' }, { stroke: '#ffffff', filter: 'drop-shadow(0 0 0 rgba(255,216,74,0))' }], { d: 400, e: 'ease-in' });
          void animate(paths[0], [{ stroke: '#a8740c' }, { stroke: '#2f6d16' }], { d: 400, e: 'ease-in' });
        }
        const p = screenOf(cellPoint(sc, { i: a.i, l: i }));
        emit({ x: p.x, y: p.y - 6, n: 6, shape: 'glow', colors: ['#fff4c2', '#ffe066'], speed: [10, 40], angle: -90, spread: 90, gravity: -30, drag: 0.92, life: [0.35, 0.6], size: [2, 4] });
        playStep(Math.min(i, 14));
        await sleep(70, tk);
      }
      if (tk.skip) return;
      // The pawn hops in place on level 20.
      const pj = sc.pawn?.querySelector('.pj');
      if (pj) void animate(pj, [{ transform: 'translateY(0)' }, { transform: 'translateY(-12px)', offset: 0.4 }, { transform: 'translateY(0)' }], { d: 420, e: 'ease-out' });
      buzz(12);
      await sleep(450, tk);
      if (tk.skip) return;

      // Beat 2: the trophy.
      void animate(grad.current, [{ opacity: 0 }, { opacity: 1 }], { d: 300 });
      void animate(q('.bc-lab'), [{ opacity: 0, transform: 'translateY(8px)', letterSpacing: '.4em' }, { opacity: 1, transform: 'none', letterSpacing: '.14em' }], { d: 600, e: 'cubic-bezier(.2,.8,.3,1)', delay: 80 });
      root.current?.querySelectorAll('.bc-name span').forEach((el, k) => void animate(el, [{ transform: 'translateY(30px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { ...POP, delay: 260 + k * 38 }));
      root.current?.querySelectorAll('.bc-tile').forEach((el, k) => void animate(el, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 480 + k * 70 }));
      root.current?.dispatchEvent(new Event('bc-stats'));
      const tw = ISO.trophyAt(sc.G, a.i);
      const start = screenOf({ x: tw.x, y: tw.y });
      const k0 = (1.8 * sc.G.sx * z) / TROPHY;
      const cx = W / 2;
      const cy = H * 0.64;
      const hTrophy = (TROPHY * 160) / 120;
      // The prize is anchored at its plinth (134/160 of the way down): rise from beside level 20.
      const at = (x: number, y: number, k: number) => `translate(${(x - TROPHY / 2).toFixed(1)}px,${(y - hTrophy * (134 / 160)).toFixed(1)}px) scale(${k.toFixed(3)})`;
      const pz = prize.current;
      if (pz) {
        pz.style.transformOrigin = `${TROPHY / 2}px ${hTrophy * (134 / 160)}px`;
        void animate(pz, [{ transform: at(start.x, start.y, k0), opacity: 0, filter: 'brightness(3)' }, { transform: at(cx, cy, 1), opacity: 1, filter: 'brightness(1)' }], { ...BOUNCE, d: BOUNCE.d + 200, fill: 'forwards' });
      }
      void animate(rays.current, [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }], { d: 800, e: 'ease-out', delay: 200 });
      void animate(glow.current, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 0.6, transform: 'scale(1)' }], { d: 800, e: 'ease-out', delay: 200 });
      void animate(ring.current, [{ transform: 'scale(.5)', opacity: 0.9 }, { transform: 'scale(2.4)', opacity: 0 }], { d: 700, e: 'cubic-bezier(.2,.8,.3,1)', delay: 380 });
      setTimeout(() => {
        if (tk.skip) return;
        emit({ x: cx, y: cy - hTrophy * 0.35, n: 40, shape: 'confetti', colors: CHIPS_T[t0], speed: [80, 230], angle: -90, spread: 360, gravity: 50, drag: 0.96, life: [1.2, 2.2], size: [1.8, 3.6] });
        emit({ x: cx, y: cy - hTrophy * 0.35, n: 26, shape: 'star', colors: ['#ffe27a', '#f7c631', '#fff3c4'], speed: [120, 360], life: [0.5, 1.1], size: [3, 8] });
        confettiRain(W, 90);
        sfx('boardDone');
        buzz([30, 40, 60]);
      }, 380);
      await sleep(1800, tk);
      if (tk.skip) return;

      // Beat 3: into the new board.
      void animate(grad.current, [{ opacity: 1 }, { opacity: 0 }], { d: 300, fill: 'forwards' });
      void animate(rays.current, [{ opacity: 1 }, { opacity: 0 }], { d: 300, fill: 'forwards' });
      void animate(glow.current, [{ opacity: 0.6 }, { opacity: 0 }], { d: 300, fill: 'forwards' });
      void animate(pill.current, [{ opacity: 1 }, { opacity: 0 }], { d: 300, fill: 'forwards' });
      const back = screenOf({ x: tw.x, y: tw.y });
      if (pz) await animate(pz, [{ transform: at(cx, cy, 1) }, { transform: at(back.x, back.y, k0) }], { ...SOFT, d: 600, fill: 'forwards' });
      if (tk.skip) return;
      // From now on it's part of the world.
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = tw.svg;
      const pawn = sc.svg.querySelector('.pawn');
      pawn?.parentNode?.insertBefore(g, pawn);
      if (pz) pz.style.visibility = 'hidden';
      // Back to 1× and up to the pawn, then onto the new board.
      await zoomTo(1, (W - Wb) / 2, H * 0.62 - cellPoint(sc, { i: a.i, l: 19 }).y, 700);
      if (tk.skip) return;
      sc.follow = (y) => {
        const target = H * 0.62 - y;
        cv = cv * 0.82 + (target - ty) * 0.028;
        ty += cv;
        put();
      };
      await walkTiles(sc, { i: a.i, l: 19 }, { i: b.i, l: 0 }, 760, 1.4, tk);
      if (tk.skip) return;
      // Landing dust in the new board's colours, and its name.
      const foot = sc.pawn?.querySelector('.psh')?.getBoundingClientRect();
      if (foot) emit({ x: foot.left + foot.width / 2, y: foot.top + foot.height / 2, n: 16, shape: 'dust', colors: [ISO.TH[t1].g[0], ISO.TH[t1].nx[0], '#ffffff'], speed: [40, 140], angle: -90, spread: 180, gravity: 40, drag: 0.9, life: [0.4, 0.8], size: [2, 4] });
      land();
      void animate(newPill.current, [{ opacity: 0, transform: 'translate(-50%,-14px) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { ...POP, fill: 'forwards' });
      // The rest of this award on the new board, if it went further than level 1.
      if (b.l > 0) await walkTiles(sc, { i: b.i, l: 0 }, b, 520, 1, tk);
      if (tk.skip) return;
      await sleep(700, tk);
      if (!tk.skip) finish();
    })();
    return () => {
      tk.skip = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (still) {
    return (
      <div ref={root} className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#141210] px-6 text-center text-white" onClick={finish} data-testid="board-complete" data-still>
        <BoardTrophy board={oldBoard} size={150} />
        <div className="mt-3 text-[11px] font-extrabold tracking-[0.14em] text-[#f7c631] uppercase">Board complete</div>
        <div className="mt-1 text-[30px] font-extrabold tracking-[-0.01em]">{name}</div>
        <Stats record={record} run instant />
      </div>
    );
  }
  return (
    <div ref={root} className="fixed inset-0 z-[70] overflow-hidden" style={{ background: ISO.TH[t0].g[0] }} onClick={finish} data-testid="board-complete">
      <div ref={host} className="absolute inset-0">
        <div className="isoIn absolute top-0 left-0 will-change-transform" />
      </div>
      <div className="wlight" />
      <div ref={pill} className="absolute top-[max(16px,env(safe-area-inset-top))] left-1/2 rounded-full bg-[rgba(20,18,14,.72)] px-3.5 py-1.5 text-[14px] font-extrabold whitespace-nowrap text-white opacity-0 shadow-lg backdrop-blur" data-testid="bc-pill">
        {name} · <span className="text-[#ffd84a]">20 of 20</span>
      </div>
      <div ref={grad} className="pointer-events-none absolute inset-x-0 top-0 h-[60%] opacity-0" style={{ background: 'linear-gradient(180deg, rgba(14,12,10,.94), rgba(14,12,10,.82) 55%, rgba(14,12,10,0))' }}>
        <div className="flex flex-col items-center px-4 pt-[max(56px,9vh)] text-center text-white">
          <div className="bc-lab text-[11px] font-extrabold tracking-[0.14em] text-[#f7c631] uppercase opacity-0">Board complete</div>
          <div className="bc-name mt-1 text-[30px] font-extrabold tracking-[-0.01em]">
            {[...name].map((c, i) => (
              <span key={i} className="inline-block">
                {c === ' ' ? '\u00a0' : c}
              </span>
            ))}
          </div>
          <StatsWhenRun root={root} record={record} />
        </div>
      </div>
      <div ref={rays} className="pointer-events-none absolute left-1/2 top-[64%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-[58%] rounded-full opacity-0" style={{ background: 'repeating-conic-gradient(rgba(255,236,190,.22) 0 8deg,transparent 8deg 20deg)', WebkitMask: 'radial-gradient(circle,#000 18%,transparent 66%)', mask: 'radial-gradient(circle,#000 18%,transparent 66%)', animation: 'ppspin 24s linear infinite' }} />
      <div ref={glow} className="pointer-events-none absolute left-1/2 top-[64%] h-[260px] w-[260px] -translate-x-1/2 -translate-y-[62%] rounded-full opacity-0" style={{ background: 'radial-gradient(circle,rgba(255,226,140,.7),rgba(255,226,140,0) 65%)' }} />
      <div ref={ring} className="pointer-events-none absolute left-1/2 top-[64%] -ml-[60px] -mt-[110px] h-[120px] w-[120px] rounded-full border-[3px] border-white/90 opacity-0" />
      <div ref={prize} className="pointer-events-none absolute top-0 left-0 opacity-0" data-testid="bc-trophy">
        <BoardTrophy board={oldBoard} size={TROPHY} />
      </div>
      <div ref={newPill} className="absolute top-[max(16px,env(safe-area-inset-top))] left-1/2 rounded-full bg-[#f7c631] px-3.5 py-1.5 text-[14px] font-extrabold whitespace-nowrap text-[#3a2a00] opacity-0 shadow-lg" data-testid="bc-newpill">
        {boardName(newBoard)} board
      </div>
    </div>
  );
}

/** The numbers count up when beat 2 starts (the moment says so with an event on the root). */
function StatsWhenRun({ root, record }: { root: React.RefObject<HTMLDivElement | null>; record?: BoardRecord }) {
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const on = () => setRun(true);
    el.addEventListener('bc-stats', on);
    return () => el.removeEventListener('bc-stats', on);
  }, [root]);
  return <Stats record={record} run={run} />;
}
