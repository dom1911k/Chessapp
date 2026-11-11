// The puzzle progression shown while solving, chess.com style: the level badge (a puzzle piece
// with your level), the rating row that counts up with a bar to the next level, the tags that
// pop on the solved square, the level-up moment and the Daily Solver award.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Puzzle } from 'lucide-react';
import { DAILY_SOLVER_GOAL, DAILY_SOLVER_XP, mastery as masteryOf, puzzleLevel, type SolveTag } from '../lib/puzzles/level';
import { FillBar } from './Reward';

const FillBarLite = (p: { from: number; to: number; delay: number; onWrap: (l: number) => void }) => (
  <FillBar from={p.from} to={p.to} delay={p.delay} ms={800} className="mt-1 h-1.5" fill="bg-gradient-to-r from-amber-300 to-amber-500" onWrap={p.onWrap} />
);
import { playSound } from '../lib/sound';
import { useCelebrate } from '../lib/celebrate';

/** Emblem colours climb every four levels: bronze, emerald, sapphire, amethyst, ruby, gold, diamond. */
const EMBLEM_TIERS: [string, string, string][] = [
  ['#f6c198', '#c4733f', '#6e3a1c'],
  ['#9af5c0', '#22a56e', '#0d5a3a'],
  ['#a8dcff', '#2f86e0', '#173f7a'],
  ['#dcbcff', '#8a4be0', '#46208a'],
  ['#ffadb2', '#dc3d4e', '#7a1522'],
  ['#fff0a0', '#e6a81c', '#8a5a05'],
  ['#f2fbff', '#8fd0f0', '#3a6f95'],
];
export const emblemTier = (level: number) => Math.min(EMBLEM_TIERS.length - 1, Math.floor((Math.max(1, level) - 1) / 4));

/** The puzzle level emblem: a bevelled shield in the tier's metal, pips for the step in the tier. */
export function LevelBadge({ level, size = 30, className = '', dim = false, tier, pips: pipCount }: { level: number; size?: number; className?: string; dim?: boolean; /** Colour tier (default: from the level). */ tier?: number; /** Pips under the number (default: step within the tier; 0 = none). */ pips?: number }) {
  const tr = Math.min(EMBLEM_TIERS.length - 1, tier ?? emblemTier(level));
  const [hi, mid, lo] = dim ? ['#e7e5e4', '#a8a29e', '#57534e'] : EMBLEM_TIERS[tr];
  const id = `em${dim ? 'd' : tr}`;
  const pips = pipCount ?? ((Math.max(1, level) - 1) % 4) + 1;
  const digits = String(level).length;
  return (
    <svg viewBox="0 0 48 52" width={size} height={size * (52 / 48)} className={`shrink-0 ${dim ? 'opacity-70' : 'drop-shadow-[0_2px_2px_rgba(40,20,0,0.3)]'} ${className}`} role="img" aria-label={`Level ${level}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
      </defs>
      <path d="M24 1.5 L44.5 8.5 V26 C44.5 38.5 35 46.8 24 50.8 C13 46.8 3.5 38.5 3.5 26 V8.5 Z" fill={lo} />
      <path d="M24 4.6 L41.6 10.6 V26 C41.6 36.6 33.6 43.9 24 47.6 C14.4 43.9 6.4 36.6 6.4 26 V10.6 Z" fill={`url(#${id})`} />
      <path d="M24 7.4 L38.8 12.5 V26 C38.8 35 32 41.3 24 44.6 C16 41.3 9.2 35 9.2 26 V12.5 Z" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.1" />
      <path d="M24 4.6 L41.6 10.6 V20 C30 16 18 16 6.4 20 V10.6 Z" fill="#fff" opacity="0.22" />
      <text x="24" y={digits > 1 ? 30.5 : 31.5} textAnchor="middle" fontSize={digits > 1 ? 19 : 22} fontWeight="900" fill="#fff" stroke={lo} strokeWidth="2.6" paintOrder="stroke" strokeLinejoin="round" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
        {level}
      </text>
      {Array.from({ length: pips }, (_, i) => (
        <circle key={i} cx={24 + (i - (pips - 1) / 2) * 5.2} cy="38.4" r="1.7" fill="#fff" stroke={lo} strokeWidth="0.7" />
      ))}
    </svg>
  );
}

function useCountUp(from: number, to: number, ms: number, delay: number) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    const t = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [from, to, ms, delay]);
  return v;
}

/**
 * Rating + progress to the next puzzle level. When `after` differs from `before`, the number
 * counts up (after `delay` ms), the delta shows beside it and the bar moves; crossing a level
 * fills the bar, pops the badge and announces the new level.
 */
export function RatingRow({ before, after, delay = 400, xp, unrated, onLevelUp }: { before: number; after?: number; delay?: number; xp?: number; unrated?: boolean; onLevelUp?: (level: number) => void }) {
  const target = after ?? before;
  const shown = useCountUp(before, target, 900, delay);
  const delta = after !== undefined ? after - before : 0;
  const lb = puzzleLevel(before);
  const la = puzzleLevel(target);
  const up = la.level > lb.level;
  const [phase, setPhase] = useState<'idle' | 'filling' | 'levelled'>('idle');
  const announced = useRef(false);
  useEffect(() => {
    if (!up) return;
    const a = setTimeout(() => setPhase('filling'), delay);
    const b = setTimeout(() => {
      setPhase('levelled');
      if (!announced.current) {
        announced.current = true;
        playSound('reward');
        useCelebrate.getState().confetti({ force: true });
        onLevelUp?.(la.level);
      }
    }, delay + 950);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [up, delay]); // eslint-disable-line react-hooks/exhaustive-deps
  // What the bar shows: while filling, the old level going to 100%; afterwards the new level.
  const lvl = up && phase !== 'levelled' ? lb : la;
  const pct = phase === 'filling' ? 100 : delta ? (phase === 'idle' && up ? lb.pct * 100 : la.pct * 100) : lb.pct * 100;
  const barPct = after === undefined ? lb.pct * 100 : pct;
  return (
    <div className="card relative flex items-center gap-3 !rounded-[18px] !px-3 !py-2.5">
      {!unrated && <LevelBadge level={lvl.level} size={38} />}
      <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        {unrated ? (
          <span className="text-sm font-semibold text-stone-500">Unrated practice</span>
        ) : (
          <>
            <span className="font-display text-[26px] leading-none font-semibold tabular-nums">{shown}</span>
            {delta === 0 && <span className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">Level {lvl.level}</span>}
            {delta !== 0 && (
              <span key={target} className={`animate-count-pop text-[15px] font-bold tabular-nums ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`} style={{ animationDelay: `${delay}ms` }}>
                {delta > 0 ? '+' : ''}
                {delta}
              </span>
            )}
          </>
        )}
        {xp ? (
          <span className="chip animate-count-pop ml-auto bg-amber-100 !text-[11px] text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" style={{ animationDelay: `${delay + 600}ms` }}>
            +{xp} XP
          </span>
        ) : null}
      </div>
      {!unrated && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-500"
              style={{ width: `${Math.max(1.5, barPct)}%`, transition: phase === 'levelled' ? 'none' : `width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms` }}
            />
          </div>
          <LevelBadge key={phase === 'levelled' ? 'new' : 'old'} level={lvl.level + 1} size={24} dim={phase !== 'levelled'} className={phase === 'levelled' ? 'animate-badge-pop' : ''} />
        </div>
      )}
      </div>
    </div>
  );
}

/** "Level 9!" over the board when the bar completes. */
export function LevelUpBanner({ level, id }: { level: number; id: number }) {
  return (
    <div data-levelup={id} className="pointer-events-none absolute inset-x-0 top-[34%] z-30 flex flex-col items-center">
      <div className="animate-levelup flex flex-col items-center">
        <LevelBadge level={level} size={84} className="animate-badge-pop drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]" />
        <span className="-mt-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 font-display text-xl font-bold text-white shadow-lg ring-2 ring-white/70">Level {level}!</span>
      </div>
    </div>
  );
}

function squareStyle(sq: string, orientation: 'white' | 'black'): CSSProperties {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  return { left: `${(col + 0.5) * 12.5}%`, top: `${(row + 0.5) * 12.5}%` };
}

const TAG_BG: Record<SolveTag['tone'], string> = {
  gold: 'bg-gradient-to-b from-amber-300 to-amber-500 ring-amber-600/40',
  sky: 'bg-gradient-to-b from-sky-300 to-sky-500 ring-sky-600/40',
  orange: 'bg-gradient-to-b from-orange-300 to-orange-500 ring-orange-600/40',
};

/** The tags that pop on the solved square one after another: "Hard +8", then "Speed +3"… */
export function SolveTags({ sq, orientation, tags, id }: { sq: string; orientation: 'white' | 'black'; tags: SolveTag[]; id: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= tags.length) return;
    const t = setTimeout(() => setI(i + 1), 1050);
    return () => clearTimeout(t);
  }, [i, tags.length]);
  const tag = tags[i];
  if (!tag) return null;
  const p = squareStyle(sq, orientation);
  // The label sits above the square — or below it when the square is on the top rank.
  const topRow = parseFloat(String(p.top)) < 12;
  return (
    <div data-tags={id} className="pointer-events-none absolute inset-0 z-30">
      <span
        key={i}
        className={`animate-solve-tag absolute flex h-[12.5%] w-[12.5%] items-center justify-center rounded-[14%] font-display text-[min(6.2vw,32px)] font-bold text-white ring-2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] ${TAG_BG[tag.tone]}`}
        style={{ ...p, boxShadow: '0 8px 22px -6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.5)' }}
      >
        {tag.value}
      </span>
      <span
        key={`l${i}`}
        className="animate-solve-pill absolute rounded-full bg-white px-2 py-0.5 text-[min(2.8vw,12px)] font-bold whitespace-nowrap text-amber-700 shadow-md ring-1 ring-black/5"
        style={{ left: p.left, top: `calc(${p.top} ${topRow ? '+' : '-'} 9.5%)`, animationDelay: '80ms' }}
      >
        {tag.label}
      </span>
    </div>
  );
}

/** The three-piece Daily Solver award over the board, then the reward flying up. Tap to skip. */
export function DailySolverOverlay({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0); // pieces appear at 1..3, title at 4, coin at 5, done at 6
  useEffect(() => {
    const delays = [250, 380, 380, 380, 900, 1500, 300];
    if (step >= delays.length) return onDone();
    const t = setTimeout(() => setStep(step + 1), delays[step]);
    return () => clearTimeout(t);
  }, [step, onDone]);
  useEffect(() => {
    if (step === 1) playSound('notify');
    if (step === 4) {
      playSound('reward');
      useCelebrate.getState().confetti({ force: true });
    }
  }, [step]);
  return (
    <div className="animate-fade-in absolute inset-0 z-40 flex flex-col items-center justify-center rounded-md bg-stone-950/70 backdrop-blur-[2px]" onClick={onDone}>
      {step < 5 ? (
        <>
          <div className="flex items-end gap-1">
            {Array.from({ length: DAILY_SOLVER_GOAL }, (_, k) => (
              <div key={k} className={`relative ${step >= k + 1 ? 'animate-piece-in' : 'opacity-0'}`} style={{ transform: `translateY(${k === 1 ? -6 : 0}px)` }}>
                <LevelBadge level={k + 1} size={k === 1 ? 72 : 64} />
                <span className="absolute -top-2 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                  <Check size={14} strokeWidth={3.5} />
                </span>
              </div>
            ))}
          </div>
          <div className={`mt-5 text-center transition-opacity duration-300 ${step >= 4 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="font-display text-2xl font-bold text-white drop-shadow">Daily Solver</div>
            <div className="mt-0.5 text-sm text-white/80">Reward: {DAILY_SOLVER_XP} XP</div>
          </div>
        </>
      ) : (
        <div className="relative h-full w-full">
          <span className="animate-glow-pulse absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/25" />
          <span className="animate-coin-fly absolute top-1/2 left-1/2 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-lime-300 to-emerald-500 font-display text-2xl font-bold text-white shadow-[0_0_0_6px_rgba(163,230,53,0.35)] ring-2 ring-white/80" style={{ '--fly': '260px' } as CSSProperties}>
            {DAILY_SOLVER_XP}
          </span>
          <div className="absolute inset-x-0 bottom-[28%] text-center">
            <div className="font-display text-2xl font-bold text-white/70">Daily Solver</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Progress to today's Daily Solver award: three tiny pieces. */
export function DailySolverDots({ done }: { done: number }) {
  if (done >= DAILY_SOLVER_GOAL) return null;
  return (
    <span className="flex items-center gap-0.5" title={`Daily Solver: ${done} of ${DAILY_SOLVER_GOAL} today`}>
      {Array.from({ length: DAILY_SOLVER_GOAL }, (_, k) => (
        <Puzzle key={k} size={13} className={k < done ? 'fill-amber-300 text-amber-600' : 'text-stone-300 dark:text-stone-600'} />
      ))}
    </span>
  );
}

const TIER_STYLE = [
  'from-stone-300 to-stone-400 text-stone-700',
  'from-amber-600 to-amber-800 text-amber-50',
  'from-slate-200 to-slate-400 text-slate-800',
  'from-amber-300 to-yellow-500 text-amber-950',
  'from-fuchsia-400 to-violet-600 text-white',
];

/** A small medal for a mastery tier. */
export function TierMedal({ tier, size = 26, className = '' }: { tier: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b font-black shadow-sm ring-2 ring-white/70 dark:ring-black/30 ${TIER_STYLE[tier]} ${className}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {tier === 0 ? '·' : ['I', 'II', 'III', 'IV'][tier - 1]}
    </span>
  );
}

/** Theme mastery after a puzzle: the bar fills with the solve, and the medal pops on a new tier. */
export function MasteryStrip({ label, before, after, delay = 900 }: { label: string; before: number; after: number; delay?: number }) {
  const mb = masteryOf(before);
  const ma = masteryOf(after);
  const [tier, setTier] = useState(mb.tier);
  const [popped, setPopped] = useState(false);
  return (
    <div className="flex items-center gap-2.5 px-1">
      <TierMedal key={tier} tier={tier} className={popped ? 'animate-badge-pop' : ''} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="font-semibold">{label} <span className="font-normal text-stone-500">· {popped ? `${ma.name}!` : mb.name}</span></span>
          <span className="text-stone-400 tabular-nums">{ma.next ? `${after}/${ma.next}` : `${after} solved`}</span>
        </div>
        <FillBarLite
          from={mb.pos}
          to={ma.pos}
          delay={delay}
          onWrap={(l) => {
            setTier(l);
            setPopped(true);
            playSound('reward');
          }}
        />
      </div>
    </div>
  );
}
