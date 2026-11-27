// The Puzzle Path (chess.com's Puzzle Path): the whole world in one vertical scroll, Wood at the
// bottom, climbing upwards. On open it's drawn at `seen` (what you last saw), then the pawn walks
// to where your points put it, one hop per tile; crossing into a board parts its clouds and a
// "New board!" pill springs in. A tap skips to the end. `seen` is saved when the walk ends.
import { useEffect, useRef, useState } from 'react';
import { Header, Dialog } from '../components/ui';
import { PathBadge } from '../components/path/PathUI';
import { wposOf } from '../components/path/PathWorld';
import { BOUNCE, POP, animate, buzz, reduced, sleep, token, type Token } from '../lib/motion';
import { CONFETTI, emit } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { BOARD_FACTORS, SETTING_MULT, boardName, boardStats, getPathState, levelAt, markPathSeen, round5, type BoardRecord, type PathState } from '../lib/puzzles/path';
import { usePathUi } from '../lib/puzzles/pathUi';
import { buildScene, cellPoint, pathTag, walkTiles, type Scene, type WPos } from '../lib/puzzles/walk';
import { ISO } from '../lib/puzzles/world';
import { useSettings } from '../lib/settings';

const steps = (a: WPos, b: WPos) => (b.i - a.i) * 20 + (b.l - a.l);

export function PuzzlePathScreen() {
  const [st, setSt] = useState<PathState | null>(null);
  const [promo, setPromo] = useState<number | null>(null);
  const [how, setHow] = useState(false);
  // A finished board's trophy, tapped: its card (the board, when, how many puzzles and days).
  const [trophy, setTrophy] = useState<{ board: number; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const walk = useRef<Token | null>(null);

  /** Draw the world with the pawn at `at`, and the boards up to two past `to`. */
  const draw = (at: number, to: number, keepScroll = false) => {
    const h = box.current;
    if (!h) return null;
    const a = wposOf(at);
    const b = wposOf(to);
    const y = h.scrollTop;
    const sc = buildScene(h, { b: a.i, lvl: a.l, w0: Math.max(0, a.i - 1), w1: Math.min(7, b.i + 2), mt: 120, ...pathTag() }, 'pt');
    scene.current = sc;
    const pp = cellPoint(sc, a);
    h.scrollTop = keepScroll ? y : pp.y - h.clientHeight * 0.6;
    // The scroll follows the pawn with a damped spring: it eases in and settles.
    let v = 0;
    sc.follow = (py) => {
      const target = py - h.clientHeight * 0.6;
      v = v * 0.82 + (target - h.scrollTop) * 0.028;
      h.scrollTop += v;
    };
    return sc;
  };

  const finish = (s: PathState) => {
    if (walk.current) walk.current.skip = true;
    walk.current = null;
    setPromo(null);
    void markPathSeen(s.points);
    usePathUi.getState().set({ behind: false });
    const sc = draw(s.points, s.points, true);
    if (sc && box.current) box.current.scrollTop = cellPoint(sc, wposOf(s.points)).y - box.current.clientHeight * 0.6;
  };

  useEffect(() => {
    let alive = true;
    void getPathState().then(async (s) => {
      if (!alive) return;
      setSt(s);
      const a = wposOf(s.seen);
      const b = wposOf(s.points);
      if (steps(a, b) <= 0 || reduced()) {
        draw(s.points, s.points);
        void markPathSeen(s.points);
        usePathUi.getState().set({ behind: false });
        return;
      }
      const sc = draw(s.seen, s.points);
      if (!sc) return;
      const tk = token();
      walk.current = tk;
      await sleep(500, tk);
      if (tk.skip || !alive) return;
      const per = Math.max(300, Math.min(520, 3200 / steps(a, b)));
      await walkTiles(sc, a, b, per, 1, tk, async (ni) => {
        setPromo(ni);
        const r = box.current?.getBoundingClientRect();
        if (r) emit({ x: r.left + r.width / 2, y: r.top + r.height * 0.4, n: 70, shape: 'confetti', colors: CONFETTI, speed: [240, 560], angle: -90, spread: 130, gravity: 650, drag: 0.975, life: [1.3, 2.1], size: [4, 7] });
        sfx('tierUp');
        buzz([30, 40, 60]);
        setTimeout(() => setPromo((p) => (p === ni ? null : p)), 1900);
        await sleep(900, tk);
      });
      if (tk.skip || !alive) return;
      walk.current = null;
      void markPathSeen(s.points);
      usePathUi.getState().set({ behind: false });
    });
    return () => {
      alive = false;
      if (walk.current) walk.current.skip = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = st ? levelAt(st.points) : null;
  return (
    <div className="flex h-full flex-col">
      <Header title="Puzzle path" back />
      <div className="relative min-h-0 flex-1">
        <div
          ref={box}
          className="isoBox absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none]"
          style={{ background: st ? ISO.TH[Math.min(7, wposOf(st.seen).i)].g[1] : '#2a6127' }}
          onClick={(e) => {
            if (walk.current && st) return finish(st);
            const t = (e.target as Element).closest?.('.trophy') as SVGGElement | null;
            if (!t) return setTrophy(null);
            const r = t.getBoundingClientRect();
            setTrophy({ board: Number(t.dataset.board), x: r.left + r.width / 2, y: r.top });
          }}
          data-testid="path-world"
        >
          <div className="isoIn" />
        </div>
        <div className="wlight" />
        {/* HUD: the badge, the board, the level and the points. It gives way to the "New board!" pill. */}
        {pos && st && (
          <div className={`pointer-events-none absolute top-2 left-2.5 flex items-center gap-2 rounded-xl bg-[rgba(24,21,18,.82)] py-1.5 pr-3 pl-1.5 text-white shadow-[0_6px_16px_rgba(0,0,0,.35)] transition-opacity duration-200 ${promo !== null ? 'opacity-0' : ''}`} data-testid="path-hud">
            <PathBadge tier={pos.tier} level={pos.level} size={30} />
            <div>
              <b className="block text-[13px] leading-tight font-extrabold">{boardName(pos.board)} board</b>
              <small className="block text-[12px] font-semibold text-[#d9d6d1]">
                Level {pos.level} of 20 · {st.points.toLocaleString('en-US')} points
              </small>
            </div>
          </div>
        )}
        {promo !== null && <NewBoardPill board={promo} />}
      </div>
      {trophy && st && <TrophyCard board={trophy.board} x={trophy.x} y={trophy.y} record={st.boards?.[trophy.board]} onClose={() => setTrophy(null)} />}
      {/* Sticky bottom bar */}
      {pos && st && (
        <div className="safe-bottom flex items-center gap-3 border-t border-black/5 bg-white px-4 py-2.5 dark:border-white/5 dark:bg-[#262522]" data-testid="path-bar">
          <div className="min-w-0 flex-1 text-[13px]">
            <div>
              <b>{boardName(pos.board)}</b> <span className="text-stone-500">· Level {pos.level} · {pos.into.toLocaleString('en-US')} / {pos.cost.toLocaleString('en-US')}</span>
            </div>
            <div className="text-[17px] leading-tight font-extrabold tabular-nums">{st.points.toLocaleString('en-US')} points</div>
          </div>
          <button className="btn-secondary !px-3 !py-2 text-sm" onClick={() => setHow(true)} data-testid="how-points">
            How points work
          </button>
        </div>
      )}
      <HowPointsWork open={how} onClose={() => setHow(false)} points={st?.points ?? 0} />
    </div>
  );
}

/** "Wood board · Finished 27 Nov 2026 · 186 puzzles · 34 days · Best streak 14" over its trophy. */
function TrophyCard({ board, x, y, record, onClose }: { board: number; x: number; y: number; record?: BoardRecord; onClose: () => void }) {
  const st = boardStats(record);
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void animate(el.current, [{ opacity: 0, transform: 'translateY(8px) scale(.94)' }, { opacity: 1, transform: 'none' }], POP);
  }, [board]);
  const W = 228;
  const left = Math.max(12, Math.min(innerWidth - W - 12, x - W / 2));
  const when = st ? (([yy, mm, dd]) => new Date(yy, mm - 1, dd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))(st.done.split('-').map(Number)) : '';
  return (
    <div ref={el} className="fixed z-30 rounded-2xl bg-white px-4 py-3 text-[#312e2b] shadow-[0_10px_28px_rgba(0,0,0,.4)]" style={{ left, top: Math.max(64, y - 132), width: W }} onClick={onClose} data-testid="trophy-card">
      <b className="block text-[16px] font-extrabold">{boardName(board)} board</b>
      <span className="block text-[13px] text-stone-500">Finished{when ? ` ${when}` : ''}</span>
      {st && (
        <>
          <span className="mt-1.5 block text-[14px]">
            <b>{st.puzzles}</b> puzzle{st.puzzles === 1 ? '' : 's'} · <b>{st.days}</b> day{st.days === 1 ? '' : 's'}
          </span>
          <span className="block text-[13px] text-stone-600">Best streak {st.bestStreak}</span>
        </>
      )}
    </div>
  );
}

function NewBoardPill({ board }: { board: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void animate(el.current, [{ transform: 'translateX(-50%) translateY(-40px) scale(.5)', opacity: 0 }, { transform: 'translateX(-50%) scale(1)', opacity: 1 }], BOUNCE);
  }, []);
  return (
    <div ref={el} className="pointer-events-none absolute top-3 left-1/2 z-10 flex items-center gap-2.5 rounded-full border-2 border-[#f7c631] bg-[rgba(24,21,18,.92)] py-1.5 pr-[18px] pl-2 text-white shadow-[0_8px_22px_rgba(0,0,0,.45)]" style={{ transform: 'translateX(-50%)' }} data-testid="new-board-pill">
      <PathBadge tier={Math.min(7, board)} level={1} size={38} />
      <div>
        <b className="block text-[19px] leading-tight font-extrabold text-[#ffe27a]">New board!</b>
        <small className="block text-xs font-semibold text-[#e4e2df]">Welcome to the {boardName(board)} board</small>
      </div>
    </div>
  );
}

/** Every rule in plain words, with this board's numbers. */
export function HowPointsWork({ open, onClose, points }: { open: boolean; onClose: () => void; points: number }) {
  const setting = useSettings((s) => s.puzzleDifficulty) ?? 'standard';
  const pos = levelAt(points);
  const g = BOARD_FACTORS[Math.min(7, pos.board)];
  const sm = SETTING_MULT[setting];
  const n = (raw: number) => Math.round(raw * g * sm);
  const r5 = (raw: number) => round5(raw * g);
  const name = boardName(pos.board);
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between gap-3 border-b border-black/5 py-1 last:border-0 dark:border-white/5">
      <span>{k}</span>
      <b className="shrink-0 tabular-nums">{v}</b>
    </div>
  );
  return (
    <Dialog open={open} onClose={onClose} title="How points work">
      <div className="max-h-[68vh] space-y-4 overflow-y-auto text-[13.5px] leading-snug" data-testid="how-dialog">
        <p className="text-stone-600 dark:text-stone-300">
          Every puzzle you solve earns points, and points move your pawn along the path: 20 levels on each of eight boards, from Wood to Legend. On the <b>{name}</b> board every puzzle pays <b>×{g}</b>
          {sm > 1 ? <> and your difficulty setting adds <b>×{sm}</b></> : null}. Points never go down.
        </p>
        <section>
          <h3 className="section-title mb-1">A clean solve (no hint)</h3>
          <Row k="Easy · Medium · Hard · Expert puzzle" v={`${n(8)} · ${n(12)} · ${n(16)} · ${n(22)}`} />
          <Row k="Speed, by how quickly you solve it" v="+1 to +7" />
          <Row k="Streak: each puzzle in a row adds one more (up to 14)" v={`+${n(1)} … +${n(14)}`} />
          <Row k="Few clues · no clues in the prompt" v={`+${n(2)} · +${n(4)}`} />
          <Row k="New best streak (from 5)" v={`+${r5(25)}`} />
          <Row k="Your hardest puzzle yet (after 20 solves)" v={`+${r5(25)}`} />
          <Row k="Every 50 hard puzzles" v={`+${r5(50)}`} />
        </section>
        <section>
          <h3 className="section-title mb-1">Hints and misses</h3>
          <p>Solved with a hint: one point per correct move. Your streak is kept but doesn't grow, and it doesn't count for the moments below.</p>
          <p className="mt-1">A wrong move: no points, and the streak starts again. After a few misses the next puzzles get a little easier and the clues come back.</p>
        </section>
        <section>
          <h3 className="section-title mb-1">Moments</h3>
          <Row k="Daily Solver: 3 clean solves in a day" v={`+${Math.round(60 * g)}`} />
          <Row k="Daily Ten: 10 clean solves in a day" v={`+${r5(25)}`} />
          <Row k="15 · 30 · 50 · 100 in a row" v={`+${r5(50)} · ${r5(100)} · ${r5(200)} · ${r5(300)}`} />
          <Row k="Every 100 puzzles solved (every 1,000: more)" v={`+${r5(50)} (${r5(250)})`} />
          <Row k="Perfect week: the Daily Solver 7 days in a row" v={`+${r5(150)}`} />
        </section>
        <section>
          <h3 className="section-title mb-1">Where points come from</h3>
          <Row k="Puzzles, courses and practice drills" v="full points" />
          <Row k="Daily training: new puzzles" v="full points" />
          <Row k="Daily training: reviews" v={`+${r5(8)}`} />
          <Row k="Finishing Daily training (once a day)" v={`+${r5(40)}`} />
          <Row k="From your games" v={`+${r5(15)}`} />
          <Row k="Daily Puzzle (once a day)" v={`+${r5(25)}`} />
          <Row k="Puzzle Rush: a new personal best" v={`+${r5(50)}`} />
          <Row k="Custom and unrated puzzles" v="no points" />
        </section>
        <section>
          <h3 className="section-title mb-1">Difficulty and clues</h3>
          <p>Puzzles get harder as you climb the path, not with your rating. Hard and Extra hard (on the Puzzles screen) pick tougher puzzles and pay ×1.3 and ×1.6. The prompt names the theme at first; the clues fade as you climb, and from Champion there are none.</p>
          <p className="mt-1">Your puzzle rating still moves as before; it's shown small while you solve, and you can hide it in Settings.</p>
        </section>
      </div>
    </Dialog>
  );
}
