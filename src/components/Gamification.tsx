import { useEffect, useState } from 'react';
import { kvSet } from '../lib/db';
import { useNav } from '../lib/nav';
import { ACHIEVEMENTS, gatherStats, unlockedAchievements, type Stats } from '../lib/progress/achievements';
import { GOAL_KEY, weeklyGoal } from '../lib/progress/weekly';
import { getXp, levelFor } from '../lib/progress/xp';
import { useCelebrate } from '../lib/celebrate';
import { Portrait } from './Coach';
import { Header } from './ui';

/** Re-reads data whenever celebrations fire (XP/achievements may have changed). */
function useRefreshKey() {
  const burst = useCelebrate((s) => s.burst);
  const toasts = useCelebrate((s) => s.toasts.length);
  return `${burst}-${toasts}`;
}

export function LevelBadge() {
  const [xp, setXp] = useState<number | null>(null);
  const key = useRefreshKey();
  useEffect(() => void getXp().then(setXp), [key]);
  if (xp === null) return null;
  const l = levelFor(xp);
  return (
    <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title={l.title}>
      ⭐ Lv {l.level}
    </span>
  );
}

export function LevelCard() {
  const [xp, setXp] = useState(0);
  const key = useRefreshKey();
  useEffect(() => void getXp().then(setXp), [key]);
  const l = levelFor(xp);
  return (
    <div className="card flex items-center gap-4 !p-3">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-sm">
        <span className="text-[10px] font-semibold uppercase leading-none">Level</span>
        <span className="text-2xl font-black leading-none">{l.level}</span>
      </div>
      <div className="flex-1">
        <div className="font-bold">{l.title}</div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(l.into / l.span) * 100}%` }} />
        </div>
        <div className="mt-0.5 text-xs text-stone-500">
          {l.into} / {l.span} XP to level {l.level + 1} · {xp} XP total
        </div>
      </div>
    </div>
  );
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
          <div className="font-bold">{w.met ? '🌱 Weekly goal reached!' : 'Weekly goal'}</div>
          <div className="text-xs text-stone-500">
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
                  done ? 'bg-brand-500 text-white' : i === todayIdx ? 'ring-2 ring-brand-500 text-brand-700 dark:text-brand-500' : 'bg-stone-100 text-stone-400 dark:bg-stone-800'
                }`}
              >
                {done ? '✓' : d}
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
    <button className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'achievements' })}>
      <span className="text-2xl">🏅</span>
      <span className="flex-1">
        <span className="block font-semibold">Achievements</span>
        <span className="block text-xs text-stone-500">{n} of {ACHIEVEMENTS.length} collected</span>
      </span>
      <span className="text-stone-400">›</span>
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
            <div key={a.id} className={`card flex flex-col items-center !p-2.5 text-center ${got ? '' : 'opacity-55'}`}>
              {a.portrait ? <Portrait id={a.portrait} size={40} className={got ? '' : 'grayscale'} /> : <span className={`text-3xl ${got ? '' : 'grayscale'}`}>{a.icon}</span>}
              <span className="mt-1 text-xs font-bold leading-tight">{a.title}</span>
              <span className="mt-0.5 text-[10px] leading-tight text-stone-500">{a.description}</span>
              {prog && prog[1] > 1 && <span className="mt-1 text-[10px] font-semibold text-brand-700 dark:text-brand-500">{prog[0]}/{prog[1]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
