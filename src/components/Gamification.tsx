import { useEffect, useRef, useState } from 'react';
import { useTween } from './Reward';
import { kvSet } from '../lib/db';
import { useNav } from '../lib/nav';
import { ACHIEVEMENTS, gatherStats, unlockedAchievements, type Stats } from '../lib/progress/achievements';
import { GOAL_KEY, weeklyGoal } from '../lib/progress/weekly';
import { useCelebrate } from '../lib/celebrate';
import { Portrait } from './Coach';
import { Header } from './ui';
import { Check, ChevronRight } from 'lucide-react';
import { Medallion } from './Glyph';

/** Re-reads data whenever celebrations fire (achievements or the weekly goal may have changed). */
function useRefreshKey() {
  const burst = useCelebrate((s) => s.burst);
  const toasts = useCelebrate((s) => s.toasts.length);
  return `${burst}-${toasts}`;
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeeklyGoalCard({ editable = false }: { editable?: boolean }) {
  const [w, setW] = useState<Awaited<ReturnType<typeof weeklyGoal>> | null>(null);
  const key = useRefreshKey();
  const load = () => void weeklyGoal().then(setW);
  useEffect(load, [key]);
  if (!w) return null;
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const todayIdx = (new Date().getDay() + 6) % 7;
  return (
    <div className="card !p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">{w.met ? 'Weekly goal reached!' : 'Weekly goal'}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {w.days} of {w.goal} training days this week · rest days never reset anything
          </div>
        </div>
        {editable && (
          <select
            value={w.goal}
            onChange={(e) => void kvSet(GOAL_KEY, Number(e.target.value)).then(load)}
            className="rounded-lg bg-stone-100 px-2 py-1 text-sm dark:bg-stone-800"
            aria-label="Days per week"
          >
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>{n} days</option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-2 flex justify-between">
        {DAY_LETTERS.map((d, i) => {
          const dt = new Date(start);
          dt.setDate(start.getDate() + i);
          const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          const done = w.activeDays.includes(k);
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  done ? 'bg-brand-700 text-white' : i === todayIdx ? 'ring-2 ring-brand-500 text-brand-700 dark:text-brand-500' : 'bg-stone-100 text-stone-500 dark:text-stone-400 dark:bg-stone-800'
                }`}
              >
                {done ? <Check size={12} strokeWidth={3} /> : d}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AchievementsPreview() {
  const push = useNav((s) => s.push);
  const [n, setN] = useState(0);
  const key = useRefreshKey();
  useEffect(() => void unlockedAchievements().then((u) => setN(Object.keys(u).length)), [key]);
  return (
    <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'achievements' })}>
      <Medallion name="medal" tint="gold" />
      <span className="flex-1">
        <span className="block font-semibold">Achievements</span>
        <span className="block text-xs text-stone-500 dark:text-stone-400">{n} of {ACHIEVEMENTS.length} collected</span>
      </span>
      <ChevronRight size={18} className="text-stone-400" />
    </button>
  );
}

export function AchievementsScreen() {
  const [have, setHave] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    void unlockedAchievements().then(setHave);
    void gatherStats().then(setStats);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <Header title="Achievements" back />
      <div className="mx-auto grid w-full max-w-xl flex-1 auto-rows-min grid-cols-3 gap-2.5 overflow-y-auto p-4">
        {ACHIEVEMENTS.map((a) => {
          const got = !!have[a.id];
          const prog = !got && stats && a.progress ? a.progress(stats) : null;
          return (
            <div key={a.id} className="card flex flex-col items-center !p-2.5 text-center" data-got={got || undefined}>
              {/* Locked: the medal is dimmed, the words stay readable. */}
              <span className={got ? '' : 'opacity-50'}>
                {a.portrait ? <Portrait id={a.portrait} size={40} className={got ? '' : 'grayscale'} /> : <Medallion name={a.icon} tint="gold" size={40} muted={!got} />}
              </span>
              <span className={`mt-1 text-xs font-bold leading-tight ${got ? '' : 'text-stone-600 dark:text-stone-300'}`}>{a.title}</span>
              <span className="mt-0.5 text-xs leading-tight text-stone-500 dark:text-stone-400">{a.description}</span>
              {prog && prog[1] > 1 && <span className="mt-1 text-xs font-semibold text-brand-700 dark:text-brand-500">{prog[0]}/{prog[1]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Home: this week's goal as a ring. When today newly counts (or the goal is reached), the ring
 * sweeps from where you last saw it to the new fill and today's dot pops.
 */
export function WeekRing() {
  const [w, setW] = useState<Awaited<ReturnType<typeof weeklyGoal>> | null>(null);
  const key = useRefreshKey();
  const tab = useNav((s) => s.tab);
  const stackEmpty = useNav((s) => s.stack.length === 0);
  useEffect(() => void weeklyGoal().then(setW), [key, tab, stackEmpty]);
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    if (!w) return;
    let last = w.days;
    try {
      const raw = localStorage.getItem('seenWeekDays');
      const [wk, n] = (raw ?? '').split(':');
      // Only compare within the same week (a new week starts from its own count, no sweep).
      const id = weekId();
      last = wk === id ? Number(n) : w.days;
      localStorage.setItem('seenWeekDays', `${id}:${w.days}`);
    } catch {
      /* no storage: no sweep */
    }
    setSeen(Math.min(last, w.days));
  }, [w]);
  const ring = useRef<SVGCircleElement>(null);
  const R = 22;
  const C = 2 * Math.PI * R;
  const from = w && seen !== null ? Math.min(1, seen / w.goal) : 0;
  const to = w ? Math.min(1, w.days / w.goal) : 0;
  useTween(from, to, { ms: 1100, delay: 350, run: !!w && seen !== null, onFrame: (v) => ring.current?.setAttribute('stroke-dashoffset', String(C * (1 - v))) });
  if (!w) return null;
  const grew = seen !== null && w.days > seen;
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const todayIdx = (new Date().getDay() + 6) % 7;
  return (
    <div className="card flex items-center gap-3.5 !p-3.5">
      <div className="relative h-14 w-14 shrink-0">
        <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" strokeWidth="6" className="stroke-stone-200 dark:stroke-white/10" />
          <circle ref={ring} cx="28" cy="28" r={R} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - from)} className={w.met ? 'stroke-hue-amber-400' : 'stroke-brand-500'} />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-display text-lg font-semibold tabular-nums ${grew ? 'animate-count-pop' : ''}`} style={grew ? { animationDelay: '1300ms' } : undefined}>
          {w.days}<span className="text-xs text-stone-500 dark:text-stone-400">/{w.goal}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{w.met ? 'Weekly goal reached!' : 'This week'}</div>
        <div className="mt-1.5 flex gap-1.5">
          {DAY_LETTERS.map((d, i) => {
            const dt = new Date(start);
            dt.setDate(start.getDate() + i);
            const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const done = w.activeDays.includes(k);
            const fresh = done && i === todayIdx && grew;
            return (
              <span
                key={i}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? (w.met ? 'bg-hue-amber-400 text-hue-amber-950' : 'bg-brand-700 text-white') : i === todayIdx ? 'text-brand-700 ring-2 ring-brand-500 dark:text-brand-500' : 'bg-stone-100 text-stone-500 dark:text-stone-400 dark:bg-white/[0.06]'} ${fresh ? 'animate-badge-pop' : ''}`}
                style={fresh ? { animationDelay: '1200ms' } : undefined}
              >
                {done ? <Check size={11} strokeWidth={3.5} /> : d}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** "W" + ISO-ish week number for the current week (to compare ring progress within one week). */
function weekId(): string {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}W${Math.ceil(((d.getTime() - start.getTime()) / 864e5 + start.getDay() + 1) / 7)}`;
}
