// The results screen after a game, as a tally (docs/polish-3-prototype.html, scene 2). Same rows and
// information as before; they arrive in beats on the motion kit: the sheet springs up, the title pops
// (a win throws a short confetti burst upwards from the sheet's top edge, never onto the numbers),
// the crown pops on the winner, the stat tiles rise and their numbers land together (the rating rolls
// on an odometer and its delta pops, accuracy and XP count up, stars light one by one), then each row
// slides in and does its thing (bars fill with a sweep, a level-up flips its badge, new things pop
// with a shine). The buttons rise last. A tap on the sheet skips to the end: every value final, every
// row visible. It plays once; with "Reduce animations" the numbers just set.
import { BADGES, rivalryLevel, rivalryRank } from '../lib/people/rivalry';
import { UserAvatar, useMyName } from './UserAvatar';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Crown, Flame, RotateCcw, Star, Trophy, Users, X } from 'lucide-react';
import { MILESTONES, START_RATING, type Milestone } from '../lib/rewards/rating';
import { opponentById } from '../lib/people';
import { challengeFor } from '../lib/people/challenges';
import { MAX_STARS } from '../lib/people/record';
import { levelFor } from '../lib/progress/xp';
import { TACTIC_KEYS, TACTIC_LABEL } from '../lib/rewards/career';
import { cosmeticTitle, KIND_LABEL } from '../lib/rewards/cosmetics';
import { SKILLS, TIERS } from '../lib/rewards/skills';
import { BOUNCE, POP, SOFT, UI_EASE, animate, eo3, haptic, reduced, sleep, token, tween, type Token } from '../lib/motion';
import { GOLDS, centre, emit } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { countTo, odo } from '../lib/numbers';
import type { GameRewards } from '../lib/store/finish';
import { CoachAvatar, Portrait } from './Coach';
import { CosmeticPreview } from './CosmeticPreview';
import { Medallion } from './Glyph';

/** One compact 48px reward row: icon, title, a short progress bar or a line, and a "New!" chip. */
function RewardRow({ icon, title, sub, bar, right, kind = 'plain' }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; bar?: ReactNode; right?: ReactNode; /** 'new': it pops its icon and chip with a shine and a chime as it lands. */ kind?: 'plain' | 'new' | 'rivalry' | 'journey' | 'level' }) {
  return (
    <div className="pp-row relative flex min-h-12 items-center gap-3 overflow-hidden py-1.5" data-row={kind}>
      <span className="pp-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] bg-white/50 opacity-0 dark:bg-white/10" />
      <span className="pp-ic flex h-8 w-8 shrink-0 items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1 text-left leading-tight">
        <div className="truncate text-[14px] font-bold">{title}</div>
        {sub && <div className="truncate text-[12px] font-medium text-stone-500">{sub}</div>}
        {bar}
      </div>
      <span className="pp-right shrink-0">{right}</span>
    </div>
  );
}

const NEW = <span className="chip shrink-0 bg-brand-700 text-white">New!</span>;

/** A thin progress bar: its fill is scaled (transform only), with a white sweep for the moment it fills. */
function Bar({ frac, fill, barRef }: { frac: number; fill: string; barRef?: (el: HTMLElement | null) => void }) {
  return (
    <span ref={barRef} className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
      <span className={`pp-fill absolute inset-0 origin-left rounded-full ${fill}`} style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, frac))})` }} />
      <span className="pp-sweep2 absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)] opacity-0" />
    </span>
  );
}

/** A tile of the stat strip: the value 18/800 over an 11/600 label. */
function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="pp-stat flex flex-col items-center justify-center rounded-[8px] bg-stone-100 px-1 py-2 dark:bg-stone-800">
      <div className="text-[18px] leading-none font-extrabold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-stone-500">{label}</div>
    </div>
  );
}

/** "by checkmate", "on time", "by resignation"… */
export function reasonText(reason: string): string {
  if (reason === 'time') return 'on time';
  if (reason === 'time vs insufficient material') return 'timeout vs insufficient material';
  return `by ${reason}`;
}

/** Where a rating sits on the Journey: index of the stretch it's in + how far along (2.4 = 40% into the third). */
function journeyPos(rating: number): { pos: number; next?: Milestone; prev: number } {
  const marks = [START_RATING, ...MILESTONES.map((m) => m.rating)];
  for (let i = 0; i < marks.length - 1; i++) {
    if (rating < marks[i + 1]) return { pos: i + Math.max(0, (rating - marks[i]) / (marks[i + 1] - marks[i])), next: MILESTONES[i], prev: marks[i] };
  }
  return { pos: marks.length - 1, prev: marks[marks.length - 1] };
}

const frac = (pos: number) => pos - Math.floor(pos);
/**
 * Fill a bar from one position (level + fraction) to another: at each whole level it fills to the
 * end, `onWrap(level)` plays (and awaits), and it refills from 0.
 */
async function fillBar(el: Element | null | undefined, from: number, to: number, ms: number, tk: Token, onWrap?: (level: number) => Promise<void> | void) {
  const f = el?.querySelector('.pp-fill');
  if (!f || to <= from) return;
  let a = from;
  while (a < to - 1e-6 && !tk.skip) {
    const lvl = Math.floor(a);
    const end = Math.min(to, lvl + 1);
    const f0 = a - lvl;
    const f1 = end - lvl;
    await animate(f, [{ transform: `scaleX(${Math.max(0.02, f0)})` }, { transform: `scaleX(${f1})` }], { d: Math.max(220, (ms * (f1 - f0)) / Math.max(1, to - from)), e: UI_EASE });
    if (tk.skip) return;
    if (end === lvl + 1) {
      void animate(el?.querySelector('.pp-sweep2'), [{ transform: 'translateX(-120%)', opacity: 1 }, { transform: 'translateX(330%)', opacity: 1 }], { d: 520, e: 'ease-in-out' });
      await onWrap?.(lvl + 1);
      void animate(f, [{ transform: 'scaleX(0.02)', opacity: 0.4 }, { transform: 'scaleX(0.02)', opacity: 1 }], { d: 120 });
    }
    a = end;
  }
}

export function RewardsOverlay({ r, onClose, onReport, onRematch, onNewOpponent, onPlayNext }: { r: GameRewards; onClose: () => void; onReport?: () => void; onRematch?: () => void; onNewOpponent?: () => void; onPlayNext?: (id: string) => void }) {
  const o = opponentById(r.opponentId);
  const myName = useMyName();
  const lvBefore = levelFor(r.xpBefore);
  const lvAfter = levelFor(r.xpAfter);
  // Once all five stars are in, the rivalry carries the progression.
  const hasStars = !!o && r.starsBefore < MAX_STARS;
  const tactics = TACTIC_KEYS.filter((k) => r.tactics[k]);
  const streak = r.winStreak ?? 0;
  const won = r.userResult === 'win';
  const delta = r.ratingAfter - r.ratingBefore;
  const jb = journeyPos(r.ratingBefore);
  const ja = journeyPos(r.ratingAfter);
  const xpFrom = lvBefore.level + lvBefore.into / lvBefore.span;
  const xpTo = lvAfter.level + lvAfter.into / lvAfter.span;
  const rvFrom = r.rivalry ? rivalryLevel(r.rivalry.pointsBefore).pos : 0;
  const rvTo = r.rivalry ? rivalryLevel(r.rivalry.pointsAfter).pos : 0;
  const ch = challengeFor(r.opponentId);
  const reached = MILESTONES.filter((m) => m.rating > r.ratingBefore && m.rating <= r.ratingAfter).pop();
  const meWon = r.userResult === 'win' ? true : r.userResult === 'loss' ? false : null;
  const theyWon = meWon === null ? null : !meWon;

  // What changes in discrete steps (the rest is driven frame by frame on the elements).
  const [done, setDone] = useState(false);
  const [starsLit, setStarsLit] = useState(r.starsBefore);
  const [rivalNow, setRivalNow] = useState(r.rivalry?.levelBefore ?? 1);
  const [levelNow, setLevelNow] = useState(lvBefore.level);
  const [milestoneHit, setMilestoneHit] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const q = useRef<Record<string, HTMLElement | null>>({});
  const ref = (k: string) => (el: HTMLElement | null) => {
    q.current[k] = el;
  };
  const tkRef = useRef<Token>(token());

  /** The end state: every value final, every row and button visible. */
  const finish = () => {
    const tk = tkRef.current;
    tk.skip = true;
    const sh = sheet.current;
    if (!sh) return;
    sh.getAnimations({ subtree: true }).forEach((a) => a.finish());
    back.current?.getAnimations().forEach((a) => a.finish());
    sh.style.transform = 'none';
    if (back.current) back.current.style.opacity = '1';
    odo(q.current.rating, r.ratingAfter);
    if (q.current.acc) q.current.acc.textContent = `${r.accuracy.toFixed(1)}%`;
    if (q.current.xp) q.current.xp.textContent = `+${r.xpAfter - r.xpBefore}`;
    sh.querySelectorAll<HTMLElement>('.pp-hide').forEach((e) => {
      e.getAnimations().forEach((a) => a.cancel());
      e.style.opacity = '1';
      e.style.transform = e.dataset.tf ?? 'none';
    });
    const bar = (el: HTMLElement | null | undefined, pos: number, full = false) => {
      const f = el?.querySelector<HTMLElement>('.pp-fill');
      if (!f) return;
      f.getAnimations().forEach((a) => a.cancel());
      f.style.transform = `scaleX(${full ? 1 : Math.max(0.02, frac(pos))})`;
    };
    bar(q.current.rvBar, rvTo, Math.floor(rvTo) === rvTo && rvTo > rvFrom);
    bar(q.current.jBar, ja.pos);
    bar(q.current.lvBar, xpTo);
    setStarsLit(r.starsAfter);
    setRivalNow(r.rivalry?.levelAfter ?? 1);
    setLevelNow(lvAfter.level);
    if (reached) setMilestoneHit(true);
    setDone(true);
  };

  // The numbers start where they were (the tweens own their text from here).
  useLayoutEffect(() => {
    odo(q.current.rating, r.ratingBefore);
    if (q.current.acc) q.current.acc.textContent = '0.0%';
    if (q.current.xp) q.current.xp.textContent = '+0';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // A fresh token per run (React's dev double-mount cancels the first one).
    const tk = token();
    tkRef.current = tk;
    const $ = q.current;
    const sh = sheet.current;
    if (!sh) return;
    if (reduced()) {
      finish();
      return;
    }
    const rows = [...sh.querySelectorAll<HTMLElement>('.pp-row')];
    const over = () => tk.skip;
    void (async () => {
      // 1 · The sheet springs up; the backdrop fades in.
      void animate(back.current, [{ opacity: 0 }, { opacity: 1 }], { d: 300 });
      await animate(sh, [{ transform: 'translateY(105%)' }, { transform: 'none' }], SOFT);
      if (over()) return;
      // 2 · The header: a glow, the title pops; a win throws confetti up from the sheet's top edge.
      void animate($.glow, [{ opacity: 0 }, { opacity: 1 }], { d: 500 });
      void animate($.title, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], POP);
      if (won) {
        const s = sh.getBoundingClientRect();
        emit({ x: s.left + s.width / 2, y: s.top - 4, jx: 120, n: 46, shape: 'confetti', colors: ['#81b64c', '#b6e27a', '#f7c631', '#ffffff', '#5aa9e6'], speed: [220, 460], angle: -90, spread: 70, gravity: 700, drag: 0.975, life: [0.6, 1], size: [3.5, 6] });
      }
      await sleep(220, tk);
      if (over()) return;
      // 3 · The crown pops on the winner (and the "Beaten" stamp on a first win).
      const cr = $.crown;
      if (cr) {
        void animate(cr, [{ opacity: 0, transform: 'scale(0) rotate(-60deg)' }, { opacity: 1, transform: 'scale(1.3) rotate(8deg)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { d: BOUNCE.d, e: 'ease-out' });
        sfx('crown');
        const c = centre(cr);
        emit({ x: c.x, y: c.y, n: 10, shape: 'star', colors: GOLDS, speed: [50, 150], life: [0.35, 0.6], size: [2, 4] });
      }
      void animate($.beaten, [{ opacity: 0, transform: 'rotate(-12deg) scale(2.2)' }, { opacity: 1, transform: 'rotate(-12deg) scale(.92)', offset: 0.7 }, { opacity: 1, transform: 'rotate(-12deg) scale(1)' }], { d: 320, delay: 260, e: 'cubic-bezier(.5,0,.6,1)' });
      // 4 · The stat tiles rise in, 90ms apart.
      sh.querySelectorAll('.pp-stat').forEach((s, k) => void animate(s.parentElement, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 120 + k * 90 }));
      await sleep(300, tk);
      if (over()) return;
      // 5 · The numbers land together.
      const pRating = (async () => {
        const from = r.ratingBefore;
        await tween(900, (k) => odo($.rating, from + (r.ratingAfter - from) * eo3(k)), tk);
        if (over()) return;
        odo($.rating, r.ratingAfter);
        void animate($.delta, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], POP);
        sfx('land', delta >= 0 ? 6 : 1);
      })();
      const pAcc = countTo($.acc, 0, r.accuracy, 800, 1, tk, (s) => `${s}%`);
      const pXp = countTo($.xp, 0, r.xpAfter - r.xpBefore, 700, 0, tk, (s) => `+${s}`);
      const pStars = (async () => {
        if (!hasStars) return;
        await sleep(420, tk);
        for (let n = r.starsBefore + 1; n <= r.starsAfter && !over(); n++) {
          setStarsLit(n);
          await sleep(30, tk);
          const st = $.star;
          void animate(st, [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.5) rotate(10deg)', offset: 0.55 }, { transform: 'none' }], { d: BOUNCE.d, e: 'ease-out' });
          sfx('star', n - r.starsBefore - 1);
          haptic('success');
          if (st) {
            const c = centre(st);
            emit({ x: c.x, y: c.y, n: 12, shape: 'star', colors: GOLDS, speed: [60, 170], life: [0.35, 0.65], size: [2, 4.5] });
          }
          await sleep(280, tk);
        }
      })();
      await Promise.all([pRating, pAcc, pXp, pStars]);
      if (over()) return;
      // 6 · The rows slide in one at a time and each does its thing.
      let k = 0;
      for (const row of rows) {
        if (over()) return;
        void animate(row.parentElement, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], SOFT);
        await sleep(200, tk);
        const kind = row.dataset.row;
        if (kind === 'rivalry') {
          await fillBar($.rvBar, rvFrom, rvTo, 520, tk, (l) => setRivalNow(l));
          void animate(row.querySelector('.pp-right'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], POP);
          sfx('land', 4 + k);
        } else if (kind === 'journey') {
          await fillBar($.jBar, jb.pos, ja.pos, 520, tk, () => {
            setMilestoneHit(true);
            sfx('achieve');
          });
        } else if (kind === 'level') {
          await fillBar($.lvBar, xpFrom, xpTo, 600, tk, async (l) => {
            sfx('unlock');
            haptic('big');
            const b = $.lvBadge;
            await animate(b, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { d: 140, e: 'ease-in' });
            setLevelNow(l);
            void animate(b, [{ transform: 'rotateY(-90deg) scale(1.35)' }, { transform: 'none' }], BOUNCE);
            if (b) {
              const c = centre(b);
              emit({ x: c.x, y: c.y, n: 14, shape: 'star', colors: GOLDS, speed: [60, 180], life: [0.4, 0.75], size: [2.5, 5] });
            }
            await sleep(420, tk);
          });
        } else if (kind === 'new') {
          void animate(row.querySelector('.pp-ic'), [{ transform: 'scale(0)' }, { transform: 'scale(1.3)', offset: 0.6 }, { transform: 'none' }], { d: 340, e: 'ease-out' });
          void animate(row.querySelector('.pp-right'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { ...POP, delay: 120 });
          void animate(row.querySelector('.pp-shine'), [{ transform: 'translateX(0) skewX(-20deg)', opacity: 1 }, { transform: 'translateX(560%) skewX(-20deg)', opacity: 1 }], { d: 900, e: 'ease-in-out' });
          sfx('achieve');
        }
        k++;
        await sleep(60, tk);
      }
      if (over()) return;
      // 7 · The buttons rise in last; the coach on Game Review nods.
      void animate($.btns, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], SOFT);
      void animate($.coach, [{ transform: 'rotate(-14deg) scale(.8)' }, { transform: 'none' }], { ...BOUNCE, delay: 160 });
      await sleep(400, tk);
      if (!over()) finish();
    })();
    return () => {
      tk.skip = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ring = (w: boolean | null) => (w ? 'ring-2 ring-[#81b64c] ring-offset-2 ring-offset-white dark:ring-offset-stone-900' : w === false ? 'grayscale-[0.5] opacity-80' : '');
  const crown = (
    <span ref={ref('crown')} className="pp-hide absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#81b64c] text-white opacity-0 shadow">
      <Crown size={12} strokeWidth={2.6} />
    </span>
  );
  // Rows start hidden; finish() shows them all.
  const hide = done ? '' : 'pp-hide opacity-0';

  return (
    <div ref={back} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" style={{ opacity: 0 }} onClick={onClose}>
      <div
        ref={sheet}
        className="safe-bottom relative flex w-full max-w-md flex-col overflow-hidden rounded-t-[14px] bg-white shadow-2xl sm:rounded-[14px] dark:bg-stone-900"
        style={{ maxHeight: 'min(88dvh, 720px)', transform: 'translateY(105%)' }}
        onClick={(e) => (e.stopPropagation(), !done && finish())}
        data-testid="results-sheet"
      >
        <button className="absolute top-1.5 right-1.5 z-20 rounded-full p-1.5 text-stone-500 active:bg-stone-100 dark:active:bg-stone-800" onClick={(e) => (e.stopPropagation(), onClose())} aria-label="Close">
          <X size={18} />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-3">
          {/* Header: the result between the two players; the winner ringed in green with a crown. */}
          <div className="relative flex items-center justify-between gap-3 px-3">
            <i
              ref={ref('glow')}
              className="pp-hide pointer-events-none absolute -inset-x-4 -top-5 bottom-0 opacity-0"
              style={{ background: won ? 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(129,182,76,.35), transparent 70%)' : 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(160,160,160,.12), transparent 70%)' }}
            />
            <div className="relative flex w-[84px] shrink-0 flex-col items-center gap-1">
              <span className={`relative rounded-md ${ring(meWon)}`}>
                {meWon && crown}
                <UserAvatar size={56} className="block" />
              </span>
              <span className="w-full truncate text-center text-xs font-semibold text-stone-600 dark:text-stone-300">{myName}</span>
            </div>
            <div className="relative min-w-0 flex-1 text-center">
              <div ref={ref('title')} className="pp-hide flex items-center justify-center gap-1.5 text-[26px] leading-tight font-extrabold tracking-[-0.02em] opacity-0">
                {won && <Trophy size={20} className="shrink-0 fill-[#f7c631] text-[#e0a800]" />}
                {r.userResult === 'win' ? 'You won' : r.userResult === 'draw' ? 'Draw' : 'You lost'}
              </div>
              <div className="mt-0.5 text-[13px] font-medium text-stone-500">{reasonText(r.reason)}</div>
            </div>
            <div className="relative flex w-[84px] shrink-0 flex-col items-center gap-1">
              <span className={`relative rounded-md ${ring(theyWon)}`}>
                {theyWon && crown}
                {r.firstWin && o && (
                  <span ref={ref('beaten')} data-tf="rotate(-12deg)" className="pp-hide absolute -top-2 -right-3 z-10 rounded-md border-2 border-danger-700 bg-white/90 px-1.5 text-[11px] font-black tracking-wider text-danger-700 uppercase opacity-0 shadow dark:bg-stone-900/90" style={{ transform: 'rotate(-12deg)' }}>
                    Beaten
                  </span>
                )}
                {o ? (
                  <Portrait id={o.id} mood={r.userResult === 'win' ? 'worried' : r.userResult === 'loss' ? 'happy' : 'neutral'} size={56} />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-md bg-stone-200 text-stone-500 dark:bg-stone-800">
                    <Users size={24} />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-xs font-semibold text-stone-600 dark:text-stone-300">{o ? o.name : 'Bot'}</span>
            </div>
          </div>

          {/* One stat strip: rating ±, accuracy, stars, XP. */}
          <div className={`mt-4 grid gap-2 ${hasStars ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div className={hide}>
              <Stat
                value={<span ref={ref('rating')} className="odo inline-block" data-testid="results-rating" />}
                label={
                  <span className="flex items-center gap-1">
                    Rating
                    <span ref={ref('delta')} className={`${hide} font-bold tabular-nums`} style={{ color: delta > 0 ? '#5f9a2e' : delta < 0 ? '#e07b6c' : undefined }}>
                      {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
                      {Math.abs(delta)}
                    </span>
                  </span>
                }
              />
            </div>
            <div className={hide}>
              <Stat value={<span ref={ref('acc')} data-testid="results-accuracy" />} label="Accuracy" />
            </div>
            {hasStars && (
              <div className={hide}>
                <Stat
                  value={
                    <span className="flex items-center justify-center gap-1">
                      <span ref={ref('star')} className="inline-flex">
                        <Star size={16} className={starsLit > 0 ? 'fill-[#f7c631] text-[#e0a800]' : 'text-stone-400'} />
                      </span>
                      {starsLit}/{MAX_STARS}
                    </span>
                  }
                  label={r.starsAfter > r.starsBefore ? `+${r.starsAfter - r.starsBefore} star` : 'Stars'}
                />
              </div>
            )}
            <div className={hide}>
              <Stat value={<span ref={ref('xp')} data-testid="results-xp" />} label="XP" />
            </div>
          </div>

          {/* Compact rows, one after another. */}
          <div className="mt-3 divide-y divide-black/5 dark:divide-white/[0.06]">
            {o && r.rivalry && (
              <div className={hide}>
                <RewardRow
                  kind="rivalry"
                  icon={<span className="flex h-8 w-8 flex-col items-center justify-center rounded-md bg-hue-rose-600 text-white"><span className="text-[11px] leading-none font-bold uppercase">Lv</span><span className="text-[13px] leading-none font-extrabold tabular-nums">{rivalNow}</span></span>}
                  title={<>Rivalry with {o.name} · {rivalryRank(rivalNow)}</>}
                  bar={<Bar barRef={ref('rvBar')} frac={done ? frac(rvTo) : frac(rvFrom)} fill="bg-hue-rose-500" />}
                  right={r.rivalry.levelAfter > r.rivalry.levelBefore && rivalNow >= r.rivalry.levelAfter ? <span className="chip shrink-0 bg-hue-rose-600 text-white">Level up · +{r.rivalry.xp} XP</span> : <span className="shrink-0 text-xs font-bold text-hue-rose-600 tabular-nums dark:text-hue-rose-400">+{r.rivalry.gained}</span>}
                />
              </div>
            )}
            {o && r.rivalry?.newBadges.map((id) => (
              <div key={id} className={hide}>
                <RewardRow kind="new" icon={<span className="flex h-8 w-8 items-center justify-center rounded-md bg-hue-rose-600 text-white"><Check size={16} strokeWidth={3} /></span>} title={BADGES.find((b) => b.id === id)?.label ?? 'Badge'} sub={`Rivalry badge with ${o.name}`} right={NEW} />
              </div>
            ))}
            <div className={hide}>
              <RewardRow
                kind="journey"
                icon={<Medallion name="map" tint="blue" size={32} />}
                title={milestoneHit && reached ? <>{reached.title} reached!</> : ja.next ? <>Next: {ja.next.title} at {ja.next.rating}</> : 'Top of the journey!'}
                bar={<Bar barRef={ref('jBar')} frac={done ? frac(ja.pos) : frac(jb.pos)} fill="bg-hue-sky-500" />}
                right={milestoneHit ? NEW : undefined}
              />
            </div>
            <div className={hide}>
              <RewardRow
                kind="level"
                icon={
                  <span ref={ref('lvBadge')} className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f7c045] text-[13px] font-extrabold text-[#3a2a00] [backface-visibility:hidden]">
                    {levelNow}
                  </span>
                }
                title={levelNow > lvBefore.level ? <>Level up! {lvAfter.title}</> : <>Level {levelNow} · {lvBefore.title}</>}
                bar={<Bar barRef={ref('lvBar')} frac={done ? frac(xpTo) : frac(xpFrom)} fill="bg-[#f7c045]" />}
                right={levelNow > lvBefore.level ? NEW : undefined}
              />
            </div>
            {streak >= 2 && (
              <div className={hide}>
                <RewardRow
                  icon={<Flame size={26} className={streak >= 5 ? 'fill-hue-rose-400 text-hue-rose-500' : 'fill-hue-orange-400 text-hue-orange-500'} />}
                  title={`${streak} wins in a row`}
                  sub={r.newBestStreak ? 'Your best streak ever!' : `Best: ${r.bestWinStreak ?? streak}`}
                  right={r.newBestStreak ? <span className="chip shrink-0 bg-[#f7c045] text-[#3a2a00]">New best</span> : undefined}
                />
              </div>
            )}
            {r.unlocked && opponentById(r.unlocked) && (
              <div className={hide}>
                <RewardRow
                  kind="new"
                  icon={<Portrait id={r.unlocked} size={32} />}
                  title={<>New opponent: {opponentById(r.unlocked)!.name}</>}
                  sub={`Rating ${opponentById(r.unlocked)!.elo}`}
                  right={onPlayNext ? <button className="btn-primary !mb-[3px] !min-h-8 shrink-0 !px-3 !py-1 text-sm" onClick={(e) => (e.stopPropagation(), onPlayNext(r.unlocked!))}>Play</button> : NEW}
                />
              </div>
            )}
            {tactics.length > 0 && (
              <div className={hide}>
                <RewardRow icon={<Medallion name="zap" tint="gold" size={32} />} title="Tactics you played" sub={tactics.map((k) => `${r.tactics[k]}× ${r.tactics[k] === 1 ? TACTIC_LABEL[k].one : TACTIC_LABEL[k].many}`).join(' · ')} />
              </div>
            )}
            {r.milestones.map((m) => (
              <div key={m.rating} className={hide}>
                <RewardRow kind="new" icon={<Medallion name="map" tint="gold" size={32} />} title={m.title} sub={`Journey · ${m.rating} · ${m.line}`} right={NEW} />
              </div>
            ))}
            {(r.challengeOpened || r.challengeDone) && ch && (
              <div className={hide}>
                <RewardRow kind="new" icon={<Medallion name="flag" tint="gold" size={32} />} title={<>{r.challengeDone ? 'Challenge complete' : 'Challenge unlocked'}: {ch.title}</>} sub={r.challengeDone ? 'You did it!' : `${ch.description} Try it next game against ${o?.name}.`} right={NEW} />
              </div>
            )}
            {r.unlocks.map((c) => (
              <div key={c.id} className={hide}>
                <RewardRow kind="new" icon={<CosmeticPreview c={c} size={32} />} title={cosmeticTitle(c)} sub={`New ${KIND_LABEL[c.kind].one.toLowerCase()} · equip it in your Collection`} right={NEW} />
              </div>
            ))}
            {r.achievements.map((a) => (
              <div key={a.id} className={hide}>
                <RewardRow kind="new" icon={a.portrait ? <Portrait id={a.portrait} size={32} /> : <Medallion name={a.icon} tint="gold" size={32} />} title={a.title} sub={`Achievement · ${a.description}`} right={NEW} />
              </div>
            ))}
            {r.skillsUp.map((sk) => {
              const k = SKILLS.find((x) => x.id === sk.id)!;
              return (
                <div key={sk.id} className={hide}>
                  <RewardRow kind="new" icon={<Medallion name={k.icon} tint="blue" size={32} />} title={k.name} sub={`Skill · ${TIERS[sk.tier].name} — your skill tree grew`} right={NEW} />
                </div>
              );
            })}
          </div>
          {!done && <p className="mt-2 text-center text-xs text-stone-500">Tap to skip</p>}
        </div>

        {/* Actions: they rise in last; the sheet scrolls above them. */}
        <div ref={ref('btns')} className={`${hide} shrink-0 space-y-2 border-t border-black/[0.06] px-4 pt-3 pb-3 dark:border-white/[0.06]`}>
          {onReport ? (
            <button className="btn-primary !min-h-14 w-full text-[17px] !font-extrabold" onClick={onReport}>
              <span ref={ref('coach')} className="inline-flex">
                <CoachAvatar size={26} />
              </span>{' '}
              Game Review
            </button>
          ) : (
            <button className="btn-primary !min-h-14 w-full text-[17px] !font-extrabold" onClick={onClose}>
              Continue
            </button>
          )}
          {(onRematch || onNewOpponent) && (
            <div className="grid grid-cols-2 gap-2">
              {onRematch && (
                <button className="btn-secondary" onClick={onRematch}>
                  <RotateCcw size={16} /> Rematch
                </button>
              )}
              {onNewOpponent && (
                <button className="btn-secondary" onClick={onNewOpponent}>
                  <Users size={16} /> New bot
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
