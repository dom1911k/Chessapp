// The results screen after a game, as a tally (docs/polish-3-prototype.html, scene 2). Three stat
// tiles (rating ±, accuracy, game rating) and the rows, grouped by kind, four at most: the opponent's
// badges (the new ones pop in a strip), the achievements (one row, their icons in a strip), the new
// looks (one row, with a preview) and what's next (the opponent this win unlocked, or the next stop
// on the Journey). Tap a group for its list.
// They arrive in beats on the motion kit: the sheet springs up, the title pops (a win throws a short
// confetti burst upwards from the sheet's top edge, never onto the numbers), the crown pops on the
// winner, the stat tiles rise and their numbers land together, then each row slides in and does its
// thing. The header and buttons stay put; only the rows scroll (on a small phone), and the sheet never
// scrolls itself. The buttons rise last. A tap on the sheet skips to the end: every value final, every
// row visible. It plays once (under 4s); with "Reduce animations" the numbers just set.
import { BADGES, CHALLENGE_BADGES, nextBadge } from '../lib/people/rivalry';
import { UserAvatar, useMyName } from './UserAvatar';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeIcon } from './BadgeIcon';
import { ChevronRight, Crown, Flame, RotateCcw, Trophy, Users, X } from 'lucide-react';
import { MILESTONES, START_RATING, type Milestone } from '../lib/rewards/rating';
import { opponentById } from '../lib/people';
import { challengeFor } from '../lib/people/challenges';
import { cosmeticTitle, KIND_LABEL } from '../lib/rewards/cosmetics';
import { SKILLS, TIERS } from '../lib/rewards/skills';
import { BOUNCE, POP, SOFT, UI_EASE, animate, eo3, haptic, reduced, sleep, token, tween, type Token } from '../lib/motion';
import { GOLDS, centre, emit } from '../lib/fx';
import { sfx } from '../lib/sfx';
import { countTo, odo } from '../lib/numbers';
import type { GameRewards } from '../lib/store/finish';
import { CoachAvatar, Portrait } from './Coach';
import { StrangerAvatar } from './StrangerAvatar';
import { styleLine } from '../lib/people/stranger';
import { CosmeticPreview } from './CosmeticPreview';
import { Medallion } from './Glyph';
import { Sheet, sheetExit, useSheetDrag } from './Sheet';

/**
 * One compact 48px reward row: icon, title, a short progress bar, a strip of icons or a line, and a
 * "New!" chip. `onOpen`: the row opens its list (once the tally is done), with a chevron.
 */
function RewardRow({ icon, title, sub, bar, strip, right, kind = 'plain', onOpen, testId }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; bar?: ReactNode; strip?: ReactNode; right?: ReactNode; /** 'new': it pops its icon and chip with a shine and a chime as it lands. */ kind?: 'plain' | 'new' | 'rivalry' | 'journey' | 'level' | 'group'; onOpen?: () => void; testId?: string }) {
  return (
    <div className={`pp-row relative flex min-h-12 items-center gap-3 overflow-hidden py-1.5 ${onOpen ? 'press -mx-2 rounded-[8px] px-2' : ''}`} data-row={kind} data-testid={testId} onClick={onOpen ? (e) => (e.stopPropagation(), onOpen()) : undefined} role={onOpen ? 'button' : undefined}>
      <span className="pp-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] bg-white/50 opacity-0 dark:bg-white/10" />
      <span className="pp-ic flex h-8 w-8 shrink-0 items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1 text-left leading-tight">
        <div className="truncate text-[14px] font-bold">{title}</div>
        {sub && <div className="truncate text-[12px] font-medium text-stone-500">{sub}</div>}
        {strip && <div className="pp-strip mt-1 flex items-center gap-1">{strip}</div>}
        {bar}
      </div>
      <span className="pp-right shrink-0">{right}</span>
      {onOpen && <ChevronRight size={16} className="-ml-1 shrink-0 text-stone-400" />}
    </div>
  );
}

/** One line of a group's list (the sheet a grouped row opens). */
function ListItem({ icon, title, sub }: { icon: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[14px] font-bold">{title}</div>
        {sub && <div className="text-[12px] font-medium text-stone-500">{sub}</div>}
      </div>
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
      <div className="mt-1 text-center text-[12px] leading-tight font-semibold text-stone-500 dark:text-stone-400">{label}</div>
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
  const streak = r.winStreak ?? 0;
  const won = r.userResult === 'win';
  const delta = r.ratingAfter - r.ratingBefore;
  const jb = journeyPos(r.ratingBefore);
  const ja = journeyPos(r.ratingAfter);
  const ch = challengeFor(r.opponentId);
  const reached = MILESTONES.filter((m) => m.rating > r.ratingBefore && m.rating <= r.ratingAfter).pop();
  const meWon = r.userResult === 'win' ? true : r.userResult === 'loss' ? false : null;
  const theyWon = meWon === null ? null : !meWon;
  const accText = (v: number) => (r.noMoves ? '—' : `${v.toFixed(1)}%`);

  // ---- The rows, grouped by kind (four at most): badges, achievements, unlocks, next ----
  const newBadges = o ? (r.rivalry?.newBadges ?? []) : [];
  const held = r.rivalry?.badges ?? 0;
  const next = nextBadge(r.rivalry?.held);
  const challengeLine = (r.challengeOpened || r.challengeDone) && ch ? (r.challengeDone ? `Challenge complete: ${ch.title}` : 'Special challenge unlocked') : null;
  const nextOpp = r.unlocked ? opponentById(r.unlocked) : undefined;
  // The last slot: the opponent this win unlocked (with Play), else the Journey. A milestone reached
  // while the slot shows the opponent joins the achievements.
  type Item = { key: string; icon: ReactNode; title: ReactNode; sub?: ReactNode };
  const achItems: Item[] = [
    ...r.achievements.map((a) => ({ key: a.id, icon: a.portrait ? <Portrait id={a.portrait} size={28} /> : <Medallion name={a.icon} tint="gold" size={28} />, title: a.title, sub: a.description })),
    ...r.skillsUp.map((sk) => {
      const k = SKILLS.find((x) => x.id === sk.id)!;
      return { key: `skill:${sk.id}`, icon: <Medallion name={k.icon} tint="blue" size={28} />, title: k.name, sub: `Skill · ${TIERS[sk.tier].name} — see Insights → Skills` };
    }),
    ...(nextOpp ? r.milestones.map((m) => ({ key: `ms:${m.rating}`, icon: <Medallion name="map" tint="gold" size={28} />, title: m.title, sub: `Journey · ${m.rating} · ${m.line}` })) : []),
  ];
  const unlockItems: Item[] = r.unlocks.map((c) => ({ key: c.id, icon: <CosmeticPreview c={c} size={28} />, title: cosmeticTitle(c), sub: `New ${KIND_LABEL[c.kind].one.toLowerCase()} · equip it in your Collection` }));
  const [detail, setDetail] = useState<null | 'rivalry' | 'ach' | 'unlocks'>(null);

  // What changes in discrete steps (the rest is driven frame by frame on the elements).
  const [done, setDone] = useState(false);
  const [milestoneHit, setMilestoneHit] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  // Closing slides the sheet away (×, the backdrop, Continue, or a drag down by its handle).
  const closing = useRef(false);
  const close = (from = 0) => {
    if (closing.current) return;
    closing.current = true;
    tkRef.current.skip = true;
    void sheetExit(sheet.current, back.current, from).then(onClose);
  };
  const drag = useSheetDrag(sheet, back, close, !detail);
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
    if (q.current.acc) q.current.acc.textContent = accText(r.accuracy);
    if (q.current.gr && r.gameRating) q.current.gr.textContent = String(r.gameRating);
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
    bar(q.current.jBar, ja.pos);
    if (reached) setMilestoneHit(true);
    setDone(true);
  };

  // The numbers start where they were (the tweens own their text from here).
  useLayoutEffect(() => {
    odo(q.current.rating, r.ratingBefore);
    if (q.current.acc) q.current.acc.textContent = r.noMoves ? '—' : '0.0%';
    if (q.current.gr) q.current.gr.textContent = '0';
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
    /** A strip's icons pop in one after another (90ms apart), each with a rising note. */
    const popStrip = (row: HTMLElement, base = 0) => {
      [...row.querySelectorAll<HTMLElement>('.pp-strip > *')].forEach((el, j) => {
        void animate(el, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.3)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { ...POP, delay: j * 90 });
        setTimeout(() => !over() && sfx('land', base + j), j * 90);
      });
      return row.querySelectorAll('.pp-strip > *').length;
    };
    void (async () => {
      // 1 · The sheet springs up; the backdrop fades in.
      void animate(back.current, [{ opacity: 0 }, { opacity: 1 }], { d: 300 });
      void animate(sh, [{ transform: 'translateY(105%)' }, { transform: 'none' }], SOFT);
      await sleep(320, tk);
      if (over()) return;
      // 2 · The header: a glow, the title pops; a win throws confetti up from the sheet's top edge.
      void animate($.glow, [{ opacity: 0 }, { opacity: 1 }], { d: 500 });
      void animate($.title, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], POP);
      if (won) {
        const s = sh.getBoundingClientRect();
        emit({ x: s.left + s.width / 2, y: s.top - 4, jx: 120, n: 46, shape: 'confetti', colors: ['#81b64c', '#b6e27a', '#f7c631', '#ffffff', '#5aa9e6'], speed: [220, 460], angle: -90, spread: 70, gravity: 700, drag: 0.975, life: [0.6, 1], size: [3.5, 6] });
      }
      await sleep(140, tk);
      if (over()) return;
      // 3 · The crown pops on the winner (and the "Beaten" stamp on a first win).
      const cr = $.crown;
      if (cr) {
        void animate(cr, [{ opacity: 0, transform: 'scale(0) rotate(-60deg)' }, { opacity: 1, transform: 'scale(1.3) rotate(8deg)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { d: BOUNCE.d, e: 'ease-out' });
        sfx('crown');
        const c = centre(cr);
        emit({ x: c.x, y: c.y, n: 10, shape: 'star', colors: GOLDS, speed: [50, 150], life: [0.35, 0.6], size: [2, 4] });
      }
      void animate($.beaten, [{ opacity: 0, transform: 'rotate(-12deg) scale(2.2)' }, { opacity: 1, transform: 'rotate(-12deg) scale(.92)', offset: 0.7 }, { opacity: 1, transform: 'rotate(-12deg) scale(1)' }], { d: 320, delay: 200, e: 'cubic-bezier(.5,0,.6,1)' });
      // 4 · The stat tiles rise in, 70ms apart.
      sh.querySelectorAll('.pp-stat').forEach((s, k) => void animate(s.parentElement, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: 60 + k * 70 }));
      await sleep(180, tk);
      if (over()) return;
      // 5 · The numbers land together (the rows start while they finish).
      const pRating = (async () => {
        const from = r.ratingBefore;
        await tween(750, (k) => odo($.rating, from + (r.ratingAfter - from) * eo3(k)), tk);
        if (over()) return;
        odo($.rating, r.ratingAfter);
        void animate($.delta, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], POP);
        sfx('land', delta >= 0 ? 6 : 1);
      })();
      const pAcc = r.noMoves ? Promise.resolve() : countTo($.acc, 0, r.accuracy, 700, 1, tk, (s) => `${s}%`);
      const pGr = r.gameRating ? countTo($.gr, 0, r.gameRating, 650, 0, tk) : Promise.resolve();
      await sleep(480, tk);
      if (over()) return;
      // 6 · The rows slide in one at a time and each does its thing (the sheet never scrolls itself).
      for (const row of rows) {
        if (over()) return;
        const wrap = row.parentElement;
        void animate(wrap, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], SOFT);
        await sleep(120, tk);
        const kind = row.dataset.row;
        if (kind === 'rivalry') {
          // The new badges pop in one after another; the count lands after them.
          const n = popStrip(row, 3);
          if (n) {
            haptic('success');
            await sleep(Math.min(300, n * 90 + 120), tk);
          }
          void animate(row.querySelector('.pp-right'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], n ? POP : SOFT);
        } else if (kind === 'journey') {
          await fillBar($.jBar, jb.pos, ja.pos, 420, tk, () => {
            setMilestoneHit(true);
            sfx('achieve');
          });
        } else if (kind === 'group') {
          const n = popStrip(row, 2);
          void animate(row.querySelector('.pp-right'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { ...POP, delay: 80 });
          void animate(row.querySelector('.pp-shine'), [{ transform: 'translateX(0) skewX(-20deg)', opacity: 1 }, { transform: 'translateX(560%) skewX(-20deg)', opacity: 1 }], { d: 900, e: 'ease-in-out' });
          if (n <= 1) sfx('achieve');
          await sleep(Math.min(300, n * 90 + 120), tk);
        } else if (kind === 'new') {
          void animate(row.querySelector('.pp-ic'), [{ transform: 'scale(0)' }, { transform: 'scale(1.3)', offset: 0.6 }, { transform: 'none' }], { d: 340, e: 'ease-out' });
          void animate(row.querySelector('.pp-right'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { ...POP, delay: 120 });
          void animate(row.querySelector('.pp-shine'), [{ transform: 'translateX(0) skewX(-20deg)', opacity: 1 }, { transform: 'translateX(560%) skewX(-20deg)', opacity: 1 }], { d: 900, e: 'ease-in-out' });
          sfx('achieve');
          await sleep(240, tk);
        }
        await sleep(40, tk);
      }
      await Promise.all([pRating, pAcc, pGr]);
      if (over()) return;
      // 7 · The buttons rise in last; the coach on Game Review nods.
      void animate($.btns, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], SOFT);
      void animate($.coach, [{ transform: 'rotate(-14deg) scale(.8)' }, { transform: 'none' }], { ...BOUNCE, delay: 160 });
      await sleep(260, tk);
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
  // A strip icon starts hidden too (it pops in as its row lands).
  const stripIcon = (key: string, icon: ReactNode) => (
    <span key={key} className={`${hide} inline-flex`}>
      {icon}
    </span>
  );
  const open = (k: 'rivalry' | 'ach' | 'unlocks') => (done ? () => setDetail(k) : undefined);

  return (
    <div ref={back} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" style={{ opacity: 0 }} onClick={() => close()}>
      <div
        ref={sheet}
        className="safe-bottom relative flex w-full max-w-md flex-col overflow-hidden rounded-t-[14px] bg-white shadow-2xl sm:rounded-[14px] dark:bg-stone-900"
        style={{ maxHeight: 'min(88dvh, 720px)', transform: 'translateY(105%)' }}
        onClick={(e) => (e.stopPropagation(), !done && !closing.current && finish())}
        {...drag}
        data-testid="results-sheet"
      >
        <div data-sheet-handle className="absolute inset-x-12 top-0 z-10 flex h-5 cursor-grab touch-none justify-center pt-1.5" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
        </div>
        <button className="absolute top-1.5 right-1.5 z-20 rounded-full p-1.5 text-stone-500 active:bg-stone-100 dark:active:bg-stone-800" onClick={(e) => (e.stopPropagation(), close())} aria-label="Close">
          <X size={18} />
        </button>
        {/* The header and the stats stay put; only the rows below them scroll. */}
        <div className="shrink-0 px-4 pt-5" data-testid="results-header">
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
              <div ref={ref('title')} className="pp-hide flex items-center justify-center gap-1.5 text-[clamp(21px,6.6vw,26px)] leading-tight font-extrabold tracking-[-0.02em] whitespace-nowrap opacity-0">
                {/* The trophy only where there's room for it beside the title (not on a 360px phone). */}
                {won && <Trophy size={20} className="shrink-0 fill-[#f7c631] text-[#e0a800] max-[380px]:hidden" />}
                {r.userResult === 'win' ? 'You won' : r.userResult === 'draw' ? 'Draw' : 'You lost'}
              </div>
              <div className="mt-0.5 text-[13px] font-medium text-stone-500">{reasonText(r.reason)}</div>
              {streak >= 2 && (
                <div className="mt-0.5 inline-flex items-center gap-0.5 text-[12px] font-bold text-hue-orange-600 dark:text-hue-orange-400" data-testid="results-streak">
                  <Flame size={13} className={streak >= 5 ? 'fill-hue-rose-400 text-hue-rose-500' : 'fill-hue-orange-400 text-hue-orange-500'} />
                  {streak} in a row{r.newBestStreak ? ' · best ever' : ''}
                </div>
              )}
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
                ) : r.stranger ? (
                  <StrangerAvatar avatar={r.stranger.avatar} size={56} />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-md bg-stone-200 text-stone-500 dark:bg-stone-800">
                    <Users size={24} />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-xs font-semibold text-stone-600 dark:text-stone-300" data-testid="results-opponent">{o ? o.name : r.stranger ? r.stranger.name : 'Bot'}</span>
            </div>
          </div>

          {/* One stat strip: rating ±, accuracy and, when the game was long enough to judge, your game rating. */}
          <div className={`mt-4 grid gap-2 ${r.gameRating ? 'grid-cols-3' : 'grid-cols-2'}`} data-testid="results-stats">
            <div className={hide}>
              <Stat
                value={<span ref={ref('rating')} className="odo inline-block" data-testid="results-rating" />}
                label={
                  r.practice ? (
                    // Play Coach is practice: your rating doesn't move.
                    <span data-testid="results-unrated">Unrated · practice</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      Rating
                      <span ref={ref('delta')} className={`${hide} font-bold tabular-nums`} style={{ color: delta > 0 ? '#5f9a2e' : delta < 0 ? '#e07b6c' : undefined }}>
                        {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
                        {Math.abs(delta)}
                      </span>
                    </span>
                  )
                }
              />
            </div>
            <div className={hide}>
              {/* Context: your average over the previous 10 games (neutral, not good or bad). */}
              <Stat
                value={<span ref={ref('acc')} data-testid="results-accuracy" />}
                label={
                  r.accuracyAvg !== undefined && !r.noMoves ? (
                    <span data-testid="results-accuracy-avg">
                      Accuracy
                      <span className="block font-medium">avg {r.accuracyAvg}%</span>
                    </span>
                  ) : (
                    'Accuracy'
                  )
                }
              />
            </div>
            {r.gameRating ? (
              <div className={hide}>
                <Stat value={<span ref={ref('gr')} data-testid="results-game-rating" />} label="Game rating" />
              </div>
            ) : null}
          </div>
        </div>

        {/* The rows, grouped (four at most); on a small phone they scroll under the fixed header. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-3" data-testid="results-rows">
          <div className="divide-y divide-black/5 dark:divide-white/[0.06]">
            {/* A Quick match opponent: who they were and how they played (no badges with strangers). */}
            {r.stranger && (
              <div className={hide}>
                <RewardRow testId="row-style" icon={<StrangerAvatar avatar={r.stranger.avatar} size={30} />} title={r.stranger.name} sub={styleLine(r.stranger.types)} />
              </div>
            )}
            {o && (r.rivalry || challengeLine) && (
              <div className={hide}>
                <RewardRow
                  kind="rivalry"
                  testId="row-rivalry"
                  onOpen={newBadges.length || challengeLine ? open('rivalry') : undefined}
                  icon={<BadgeIcon id={newBadges[0] ?? next?.id ?? 'streak'} size={30} on={newBadges.length > 0 || !next} />}
                  title={newBadges.length ? <>{o.name} · {newBadges.length} new badge{newBadges.length === 1 ? '' : 's'}</> : <>{o.name} · {held}/8 badges</>}
                  sub={challengeLine ?? (newBadges.length ? undefined : next ? `Next: ${next.label} · ${next.hint.toLowerCase()}` : 'All eight badges')}
                  strip={newBadges.length ? newBadges.map((id) => stripIcon(id, <BadgeIcon id={id} size={20} />)) : undefined}
                  right={newBadges.length ? <span className="shrink-0 text-xs font-bold text-hue-rose-700 tabular-nums dark:text-hue-rose-300" data-testid="row-rivalry-count">{held}/8</span> : undefined}
                />
              </div>
            )}
            {achItems.length > 0 && (
              <div className={hide}>
                <RewardRow
                  kind="group"
                  testId="row-achievements"
                  onOpen={open('ach')}
                  icon={<Medallion name="trophy" tint="gold" size={32} />}
                  title={achItems.length === 1 ? achItems[0].title : `${achItems.length} achievements`}
                  strip={achItems.slice(0, 8).map((a) => stripIcon(a.key, <span className="inline-flex scale-[.64] origin-left -mr-2.5">{a.icon}</span>))}
                  right={NEW}
                />
              </div>
            )}
            {unlockItems.length > 0 && (
              <div className={hide}>
                <RewardRow
                  kind="group"
                  testId="row-unlocks"
                  onOpen={unlockItems.length > 1 ? open('unlocks') : undefined}
                  icon={<CosmeticPreview c={r.unlocks[0]} size={32} />}
                  title={unlockItems.length === 1 ? <>New {KIND_LABEL[r.unlocks[0].kind].one.toLowerCase()}: {cosmeticTitle(r.unlocks[0])}</> : `${unlockItems.length} new looks`}
                  sub={unlockItems.length === 1 ? 'Equip it in your Collection' : undefined}
                  strip={unlockItems.length > 1 ? r.unlocks.slice(0, 8).map((c) => stripIcon(c.id, <CosmeticPreview c={c} size={18} />)) : undefined}
                  right={NEW}
                />
              </div>
            )}
            {nextOpp ? (
              <div className={hide}>
                <RewardRow
                  kind="new"
                  testId="row-next"
                  icon={<Portrait id={nextOpp.id} size={32} />}
                  title={<>New opponent: {nextOpp.name}</>}
                  sub={`Rating ${nextOpp.elo}`}
                  right={onPlayNext ? <button className="btn-primary !mb-[3px] !min-h-8 shrink-0 !px-3 !py-1 text-sm" onClick={(e) => (e.stopPropagation(), onPlayNext(nextOpp.id))}>Play</button> : NEW}
                />
              </div>
            ) : (
              <div className={hide}>
                <RewardRow
                  kind="journey"
                  testId="row-next"
                  icon={<Medallion name="map" tint="blue" size={32} />}
                  title={milestoneHit && reached ? <>{reached.title} reached!</> : ja.next ? <>Next: {ja.next.title} at {ja.next.rating}</> : 'Top of the journey!'}
                  bar={<Bar barRef={ref('jBar')} frac={done ? frac(ja.pos) : frac(jb.pos)} fill="bg-hue-sky-500" />}
                  right={milestoneHit ? NEW : undefined}
                />
              </div>
            )}
          </div>
          {!done && <p className="mt-2 text-center text-xs text-stone-500">Tap to skip</p>}
        </div>

        {/* Actions: they rise in last and stay put under the rows. */}
        <div ref={ref('btns')} className={`${hide} shrink-0 space-y-2 border-t border-black/[0.06] px-4 pt-3 pb-3 dark:border-white/[0.06]`}>
          {onReport ? (
            <button className="btn-primary !min-h-14 w-full text-[17px] !font-extrabold" onClick={onReport}>
              <span ref={ref('coach')} className="inline-flex">
                <CoachAvatar size={26} />
              </span>{' '}
              Game Review
            </button>
          ) : (
            <button className="btn-primary !min-h-14 w-full text-[17px] !font-extrabold" onClick={() => close()}>
              Continue
            </button>
          )}
          {(onRematch || onNewOpponent) && (
            <div className="grid grid-cols-2 gap-2">
              {onRematch && (
                <button className="btn-secondary whitespace-nowrap" onClick={onRematch}>
                  <RotateCcw size={16} /> Rematch
                </button>
              )}
              {onNewOpponent && (
                <button className="btn-secondary whitespace-nowrap" onClick={onNewOpponent} data-testid="results-new-opponent">
                  {/* On a small phone the icon goes so "New opponent" stays on one line. */}
                  <Users size={16} className={r.stranger ? 'max-[380px]:hidden' : ''} /> {r.stranger ? 'New opponent' : 'New bot'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* A group's list, over the results (its own taps and drags stay inside it). */}
      <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <Sheet open={!!detail} onClose={() => setDetail(null)} z={60} panelClass="card safe-bottom w-full max-w-md !rounded-t-[14px] !rounded-b-none !px-5 !pt-0 !pb-5 sm:!rounded-[14px]" testId="results-detail">
          {(closeDetail) => (
            <>
              <div data-sheet-handle className="-mx-5 mb-1 flex cursor-grab touch-none justify-center pt-2 pb-3" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
              </div>
              {detail === 'rivalry' && o && (
                <>
                  <h3 className="text-[17px] font-extrabold">Badges with {o.name}</h3>
                  <p className="text-[13px] text-stone-500 dark:text-stone-400">{held} of 8 · {held >= CHALLENGE_BADGES ? 'their special challenge is open' : `${CHALLENGE_BADGES - held} more to open their special challenge`}</p>
                  <div className="mt-2 divide-y divide-black/5 dark:divide-white/[0.06]">
                    {newBadges.map((id) => {
                      const b = BADGES.find((x) => x.id === id);
                      return <ListItem key={id} icon={<BadgeIcon id={id} size={28} />} title={b?.label ?? 'Badge'} sub={b?.hint} />;
                    })}
                    {challengeLine && ch && <ListItem icon={<Medallion name="flag" tint="gold" size={28} />} title={challengeLine} sub={r.challengeDone ? 'You did it!' : `${ch.title}: ${ch.description} Try it next game against ${o.name}.`} />}
                  </div>
                </>
              )}
              {detail === 'ach' && (
                <>
                  <h3 className="text-[17px] font-extrabold">{achItems.length === 1 ? 'New achievement' : `${achItems.length} achievements`}</h3>
                  <div className="mt-2 divide-y divide-black/5 dark:divide-white/[0.06]">
                    {achItems.map((a) => (
                      <ListItem key={a.key} icon={a.icon} title={a.title} sub={a.sub} />
                    ))}
                  </div>
                </>
              )}
              {detail === 'unlocks' && (
                <>
                  <h3 className="text-[17px] font-extrabold">{unlockItems.length} new looks</h3>
                  <div className="mt-2 divide-y divide-black/5 dark:divide-white/[0.06]">
                    {unlockItems.map((a) => (
                      <ListItem key={a.key} icon={a.icon} title={a.title} sub={a.sub} />
                    ))}
                  </div>
                </>
              )}
              <button className="btn-secondary mt-3 w-full" onClick={closeDetail}>
                Done
              </button>
            </>
          )}
        </Sheet>
      </div>
    </div>
  );
}
