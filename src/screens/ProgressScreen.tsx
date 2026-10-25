import { useEffect, useState } from 'react';
import { BarChart, LineChart } from '../components/Charts';
import { Header } from '../components/ui';
import { db } from '../lib/db';
import { useNav } from '../lib/nav';
import { getRating, START_RATING } from '../lib/puzzles/rating';
import { themeStats, type ThemeStat } from '../lib/puzzles/select';
import { themeLabel } from '../lib/puzzles/themes';
import { bestStreak, currentStreak } from '../lib/stats';
import { SettingsButton } from './PlayScreen';

interface Data {
  rating: number;
  ratings: number[];
  games: { w: number; d: number; l: number };
  blunders: number[];
  accuracy: number[];
  puzzles: { total: number; solved: number };
  streak: number;
  best: number;
  themes: ThemeStat[];
  days: { day: string; n: number }[];
}

export function ProgressScreen() {
  const tab = useNav((s) => s.tab);
  const push = useNav((s) => s.push);
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    if (tab !== 'progress') return;
    void (async () => {
      const games = await db.games.orderBy('endedAt').toArray();
      const attempts = await db.attempts.toArray();
      const ratings = (await db.ratings.orderBy('at').toArray()).map((r) => r.rating);
      const activity = await db.activity.toArray();
      const last14: { day: string; n: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        const a = activity.find((x) => x.day === key);
        last14.push({ day: key, n: a ? a.puzzles + a.games + a.reviews : 0 });
      }
      setD({
        rating: (await getRating()).rating,
        ratings: [START_RATING, ...ratings],
        games: {
          w: games.filter((g) => g.userResult === 'win').length,
          d: games.filter((g) => g.userResult === 'draw').length,
          l: games.filter((g) => g.userResult === 'loss').length,
        },
        blunders: games.slice(-15).map((g) => g.summary.counts.blunder),
        accuracy: games.slice(-20).map((g) => g.summary.accuracy),
        puzzles: { total: attempts.length, solved: attempts.filter((a) => a.success).length },
        streak: await currentStreak(),
        best: await bestStreak(),
        themes: (await themeStats()).filter((t) => t.attempts >= 3).sort((a, b) => b.score - a.score),
        days: last14,
      });
    })();
  }, [tab]);

  if (!d) return <div className="h-full" />;
  const strong = d.themes.slice(0, 3);
  const weak = d.themes.slice(-3).reverse().filter((t) => !strong.includes(t));
  const maxDay = Math.max(1, ...d.days.map((x) => x.n));
  return (
    <div className="flex h-full flex-col">
      <Header title="Progress" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="Puzzle rating" value={d.rating} />
          <Stat label="Day streak" value={`🔥 ${d.streak}`} sub={`best ${d.best}`} />
          <Stat label="Games" value={d.games.w + d.games.d + d.games.l} sub={`${d.games.w}W ${d.games.d}D ${d.games.l}L`} />
        </div>
        <div className="card !p-3">
          <div className="mb-1 text-sm font-semibold text-stone-500">Puzzle rating over time</div>
          <LineChart values={d.ratings} />
          <div className="text-xs text-stone-500">{d.puzzles.solved} of {d.puzzles.total} puzzles solved</div>
        </div>
        <div className="card !p-3">
          <div className="mb-1 text-sm font-semibold text-stone-500">Last 14 days</div>
          <div className="flex h-16 items-end gap-1">
            {d.days.map((x) => (
              <div key={x.day} className="flex-1 rounded-t bg-brand-500" style={{ height: `${Math.max(4, (x.n / maxDay) * 100)}%`, opacity: x.n ? 1 : 0.15 }} title={`${x.day}: ${x.n}`} />
            ))}
          </div>
        </div>
        <div className="card !p-3">
          <div className="mb-1 text-sm font-semibold text-stone-500">Blunders per game (last {d.blunders.length})</div>
          <BarChart values={d.blunders} />
        </div>
        <div className="card !p-3">
          <div className="mb-1 text-sm font-semibold text-stone-500">Game accuracy</div>
          <LineChart values={d.accuracy} color="#3b82f6" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <ThemeList title="💪 Strongest themes" list={strong} />
          <ThemeList title="🎯 Work on" list={weak} />
        </div>
        <button className="btn-secondary w-full" onClick={() => push({ name: 'history' })}>
          All past games
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card !p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
      {sub && <div className="text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}

function ThemeList({ title, list }: { title: string; list: ThemeStat[] }) {
  return (
    <div className="card !p-3">
      <div className="mb-1.5 text-sm font-semibold">{title}</div>
      {list.length === 0 ? (
        <div className="text-xs text-stone-500">Solve a few more themed puzzles to see this.</div>
      ) : (
        list.map((t) => (
          <div key={t.id} className="flex justify-between text-sm">
            <span>{themeLabel(t.id)}</span>
            <span className="text-stone-500">{Math.round((t.solved / t.attempts) * 100)}%</span>
          </div>
        ))
      )}
    </div>
  );
}
