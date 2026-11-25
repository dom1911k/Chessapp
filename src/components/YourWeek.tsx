// Your week: a look back at a calendar week (This week / Last week) with the rating, four tiles
// compared with the week before, fixes and puzzles, and one thing to work on. Opened from Home's
// This week card and from Profile → Activity.
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronRight, TrendingDown, TrendingUp, X } from 'lucide-react';
import { nextWeek, weekLabel, weekStart } from '../lib/dates';
import { useNav } from '../lib/nav';
import { THEMES } from '../lib/themes';
import { signed, weekHasActivity, weekStats, type WeekStats } from '../lib/weekly';
import { ChessComBadge } from './ChessCom';
import { Dialog, Segmented } from './ui';

export type WeekTab = 'this' | 'last';

/** The theme's lesson, cut to its first sentence. */
export const firstSentence = (s: string) => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s).trim();

/** The week and the one before it (for the "was" values). */
async function load(tab: WeekTab, now = Date.now()): Promise<{ week: WeekStats; prev: WeekStats }> {
  const start = tab === 'this' ? weekStart(now) : nextWeek(weekStart(now), -1);
  const [week, prev] = await Promise.all([weekStats(start), weekStats(nextWeek(start, -1))]);
  return { week, prev };
}

export function YourWeekSheet({ open, onClose, initial = 'this' }: { open: boolean; onClose: () => void; initial?: WeekTab }) {
  const [tab, setTab] = useState<WeekTab>(initial);
  const [data, setData] = useState<{ tab: WeekTab; week: WeekStats; prev: WeekStats } | null>(null);
  useEffect(() => {
    if (open) setTab(initial);
  }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void load(tab).then((d) => alive && setData({ tab, ...d }));
    return () => {
      alive = false;
    };
  }, [open, tab]);
  const d = data?.tab === tab ? data : null;
  return (
    <Dialog open={open} onClose={onClose}>
      <div data-testid="week-sheet" data-tab={tab}>
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">Your week</h2>
            <p className="mt-0.5 text-[13px] text-stone-500 dark:text-stone-400" data-testid="week-dates">
              {weekLabel(tab === 'this' ? weekStart(Date.now()) : nextWeek(weekStart(Date.now()), -1))}
            </p>
          </div>
          <button className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 dark:bg-white/[0.08] dark:text-stone-300" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'this', label: 'This week' },
            { value: 'last', label: 'Last week' },
          ]}
        />
        <div className="mt-3 min-h-[120px]">{d ? <WeekBody week={d.week} prev={d.prev} tab={tab} onClose={onClose} /> : null}</div>
      </div>
    </Dialog>
  );
}

export function WeekBody({ week: w, prev, tab, onClose }: { week: WeekStats; prev: WeekStats; tab: WeekTab; onClose: () => void }) {
  const push = useNav((s) => s.push);
  if (!weekHasActivity(w))
    return (
      <p className="rounded-[10px] bg-stone-100 px-3 py-4 text-center text-sm text-stone-600 dark:bg-white/[0.05] dark:text-stone-300" data-testid="week-empty">
        {tab === 'this' ? 'Nothing played this week yet. One game or a few puzzles is enough to start.' : 'Nothing played last week.'}
      </p>
    );
  const rated = w.rating.rated > 0;
  const goalMet = w.activeDays >= w.goal;
  const extra = [w.fixes.tried > 0 && <span key="f">Moments fixed: <b className="text-stone-800 dark:text-stone-100">{w.fixes.found} of {w.fixes.tried}</b></span>, w.puzzles > 0 && <span key="p">Puzzles solved: <b className="text-stone-800 dark:text-stone-100">{w.puzzles}</b></span>].filter(Boolean);
  return (
    <div className="space-y-2.5">
      <div className="rounded-[10px] bg-stone-100 px-3 py-2.5 dark:bg-white/[0.05]" data-testid="week-rating">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-stone-500 dark:text-stone-400">Rating</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[26px] leading-tight font-extrabold tabular-nums">
            {rated && (
              <>
                {w.rating.start}
                <ArrowRight size={18} className="text-stone-400" />
              </>
            )}
            {w.rating.end}
          </span>
          {rated && <Delta n={w.rating.end - w.rating.start} className="ml-auto" />}
        </div>
        {w.ccRating && (
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-stone-600 tabular-nums dark:text-stone-300" data-testid="week-cc">
            <ChessComBadge />
            <span>
              {w.ccRating.cls} {w.ccRating.start !== w.ccRating.end ? <>{w.ccRating.start} → {w.ccRating.end}</> : w.ccRating.end}
            </span>
            {w.ccRating.start !== w.ccRating.end && <Delta n={w.ccRating.end - w.ccRating.start} small />}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5" data-testid="week-tiles">
        <Tile value={w.games} label="Games" sub={`${w.w}W · ${w.d}D · ${w.l}L${w.cc ? ` · ${w.cc} on chess.com` : ''}`} />
        <Tile
          value={w.accuracy === null ? '—' : `${w.accuracy}%`}
          label="Accuracy"
          trend={trendOf(w.accuracy, prev.accuracy, 'up')}
          sub={prev.accuracy !== null && w.accuracy !== null ? `was ${prev.accuracy}%` : undefined}
        />
        <Tile
          value={w.blundersPerGame === null ? '—' : w.blundersPerGame.toFixed(1)}
          label="Blunders a game"
          trend={trendOf(w.blundersPerGame, prev.blundersPerGame, 'down')}
          sub={prev.blundersPerGame !== null && w.blundersPerGame !== null ? `was ${prev.blundersPerGame.toFixed(1)}` : undefined}
        />
        <Tile value={`${w.activeDays}/7`} label="Training days" sub={goalMet ? 'goal met' : `goal ${w.goal} days`} subClass={goalMet ? 'font-semibold text-brand-700 dark:text-brand-500' : undefined} />
      </div>
      {extra.length > 0 && (
        <p className="px-0.5 text-[13px] text-stone-500 dark:text-stone-400" data-testid="week-extra">
          {extra.map((e, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {e}
            </span>
          ))}
        </p>
      )}
      <div className="rounded-[10px] bg-brand-500/10 px-3 py-3 ring-1 ring-brand-500/30" data-testid="week-focus">
        <div className="text-[11px] font-bold tracking-[0.08em] text-brand-700 uppercase dark:text-brand-500">This week's focus</div>
        {w.focus ? (
          <>
            <div className="mt-0.5 text-[16px] font-bold">{THEMES[w.focus.theme].label}</div>
            <p className="mt-0.5 text-[13px] leading-snug text-stone-600 dark:text-stone-300">
              Came up in {w.focus.games} of {w.focus.of} games. {firstSentence(THEMES[w.focus.theme].lesson)}
            </p>
            <button
              className="btn-primary mt-2.5 !min-h-11 w-full"
              data-testid="week-practise"
              onClick={() => {
                onClose();
                push({ name: 'practice', theme: w.focus!.theme });
              }}
            >
              Practise it
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-[13px] text-stone-600 dark:text-stone-300">No pattern stood out yet.</p>
        )}
      </div>
    </div>
  );
}

/** Better or worse than the week before (`good`: which way is better); null without a previous value. */
function trendOf(now: number | null, was: number | null, good: 'up' | 'down'): { up: boolean; better: boolean } | null {
  if (now === null || was === null || now === was) return null;
  const up = now > was;
  return { up, better: up === (good === 'up') };
}

function Tile({ value, label, sub, trend, subClass }: { value: ReactNode; label: string; sub?: string; trend?: { up: boolean; better: boolean } | null; subClass?: string }) {
  const Icon = trend?.up ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-[10px] bg-stone-100 px-3 py-2.5 dark:bg-white/[0.05]" data-testid="week-tile" data-label={label}>
      <div className="flex items-center gap-1.5 text-[26px] leading-tight font-extrabold tabular-nums">
        {value}
        {trend && <Icon size={18} strokeWidth={2.5} className={trend.better ? 'text-brand-600 dark:text-brand-500' : 'text-stone-400'} data-testid="week-trend" data-better={trend.better} />}
      </div>
      <div className="text-[14px] font-bold">{label}</div>
      {sub && <div className={`text-[12px] leading-snug ${subClass ?? 'text-stone-500 dark:text-stone-400'}`}>{sub}</div>}
    </div>
  );
}

/** "+42" in a green chip; a drop in a neutral one. */
function Delta({ n, small = false, className = '' }: { n: number; small?: boolean; className?: string }) {
  return (
    <span className={`shrink-0 rounded-[6px] px-1.5 font-bold tabular-nums ${small ? 'py-px text-[12px]' : 'py-0.5 text-[15px]'} ${n > 0 ? 'bg-brand-500/15 text-brand-700 dark:text-brand-500' : 'bg-stone-200 text-stone-600 dark:bg-white/10 dark:text-stone-300'} ${className}`}>
      {signed(n)}
    </span>
  );
}

/** Profile → Activity: "Your week · +42 · 6 games", opening the sheet. */
export function YourWeekRow() {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState<WeekStats | null>(null);
  useEffect(() => void weekStats(weekStart(Date.now())).then(setW), []);
  const parts = w ? [w.rating.rated ? signed(w.rating.end - w.rating.start) : null, w.games ? `${w.games} game${w.games === 1 ? '' : 's'}` : null].filter(Boolean) : [];
  return (
    <>
      <button className="card tile flex w-full items-center gap-3 !p-3.5 text-left" onClick={() => setOpen(true)} data-testid="week-row">
        <span className="min-w-0 flex-1 truncate font-semibold">
          Your week
          {parts.length > 0 && <span className="font-normal text-stone-500 dark:text-stone-400"> · {parts.join(' · ')}</span>}
        </span>
        <ChevronRight size={16} className="shrink-0 text-stone-400" />
      </button>
      <YourWeekSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
