// Profile & stats, chess.com style: your ratings per mode, your record, accuracy over time and
// best wins up top; then games, puzzles and activity.
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Lightbulb, Trophy } from 'lucide-react';
import { BarChart, LineChart } from '../components/Charts';
import { Header, Segmented } from '../components/ui';
import { db, kvGet } from '../lib/db';
import { useNav, type RushMode } from '../lib/nav';
import { allGames } from '../lib/games';
import { profileStats, scorePct, type Profile } from '../lib/games/profile';
import { opponentById } from '../lib/people';
import { getGameRating } from '../lib/rewards/rating';
import { useSettings } from '../lib/settings';
import { rushBestKey } from './RushScreen';
import type { ImportedGame } from '../lib/store/types';
import { getRating, START_RATING } from '../lib/puzzles/rating';
import { themeStats, type ThemeStat } from '../lib/puzzles/select';
import { themeLabel } from '../lib/puzzles/themes';
import { bestStreak, currentStreak } from '../lib/stats';
import { AchievementsPreview, LevelCard, WeeklyGoalCard } from '../components/Gamification';
import { weeklySummary, type WeekStats } from '../lib/weekly';
import { CareerCard, RewardsCards } from '../components/RewardsCards';
import { GameInsightsCard, GapCard } from '../components/ChessCom';

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
  week: Awaited<ReturnType<typeof weeklySummary>>;
  bots: { rating: number; peak: number; games: number };
  rush: number;
  survival: number;
  /** Latest chess.com rating per time class. */
  cc: { cls: string; rating: number }[];
  profile: Profile;
}

export function ProfileScreen() {
  const push = useNav((s) => s.push);
  const ccUser = useSettings((s) => s.ccUsername);
  const [d, setD] = useState<Data | null>(null);
  const [view, setView] = useState<'stats' | 'games' | 'puzzles' | 'activity'>('stats');

  useEffect(() => {
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
      const every = await allGames({ includeUnanalyzed: true });
      const imported = (await db.imported.orderBy('endedAt').toArray()) as ImportedGame[];
      const cc = new Map<string, number>();
      for (const g of imported) if (g.myRating) cc.set(g.timeClass, g.myRating);
      const bot = await getGameRating();
      const rushBest = async (m: RushMode) => kvGet<number>(rushBestKey(m), 0);
      setD({
        bots: { rating: bot.rating, peak: bot.peak, games: bot.games },
        rush: Math.max(await rushBest('3'), await rushBest('5')),
        survival: await rushBest('survival'),
        cc: ['bullet', 'blitz', 'rapid', 'daily'].filter((c) => cc.has(c)).map((cls) => ({ cls, rating: cc.get(cls)! })),
        profile: profileStats(every, (g) => g.opponentName ?? opponentById(g.opponentId)?.name ?? `Bot ${g.elo}`),
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
        week: await weeklySummary(),
      });
    })();
  }, []);

  if (!d) return <div className="h-full" />;
  const strong = d.themes.slice(0, 3);
  const weak = d.themes.slice(-3).reverse().filter((t) => !strong.includes(t));
  const maxDay = Math.max(1, ...d.days.map((x) => x.n));
  const p = d.profile;
  const total = p.score.w + p.score.d + p.score.l;
  return (
    <div className="flex h-full flex-col">
      <Header title="Profile" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center gap-3 px-1">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white">{(ccUser || 'Y')[0].toUpperCase()}</span>
          <span>
            <span className="block text-xl font-bold">{ccUser || 'You'}</span>
            <span className="block text-sm text-stone-500">{total} games · {d.streak} day{d.streak === 1 ? '' : 's'} in a row</span>
          </span>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: 'stats', label: 'Stats' }, { value: 'games', label: 'Games' }, { value: 'puzzles', label: 'Puzzles' }, { value: 'activity', label: 'Activity' }]}
        />
        {view === 'stats' && (
          <>
            <div className="card divide-y divide-stone-100 !p-0 dark:divide-stone-800">
              <RatingRow label="Bots" sub={`${d.bots.games} rated games`} value={d.bots.rating} best={d.bots.peak} onClick={() => push({ name: 'journey' })} />
              <RatingRow label="Puzzles" sub={d.puzzles.total ? `${d.puzzles.solved} of ${d.puzzles.total} solved` : "No puzzles yet"} value={d.rating} best={Math.max(d.rating, ...d.ratings)} />
              <RatingRow label="Puzzle Rush" sub={`Survival best ${d.survival}`} value={d.rush} />
              {d.cc.map((c) => (
                <RatingRow key={c.cls} label={`chess.com ${c.cls}`} sub="Latest imported game" value={c.rating} />
              ))}
            </div>
            <div className="card !p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="section-title">Record</span>
                <span className="text-xs text-stone-500">{scorePct(p.score)}% score</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                {total > 0 && (
                  <>
                    <div className="bg-emerald-500" style={{ width: `${(p.score.w / total) * 100}%` }} />
                    <div className="bg-stone-400" style={{ width: `${(p.score.d / total) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(p.score.l / total) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="mt-1.5 grid grid-cols-3 text-center text-sm">
                <span><b className="text-emerald-600">{p.score.w}</b> won</span>
                <span><b>{p.score.d}</b> drawn</span>
                <span><b className="text-red-500">{p.score.l}</b> lost</span>
              </div>
            </div>
            <div className="card !p-3">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="section-title">Accuracy by week</span>
                {p.accuracy !== null && <span className="text-xs text-stone-500">average {p.accuracy}%</span>}
              </div>
              {p.accuracyByWeek.length > 1 ? (
                <LineChart values={p.accuracyByWeek.map((w) => w.accuracy)} labels={[`${p.accuracyByWeek[0].week} wk ago`, 'this week']} color="#3b82f6" height={90} suffix="%" />
              ) : (
                <p className="text-xs text-stone-500">Play over a couple of weeks to see your trend.</p>
              )}
            </div>
            <div className="card !p-0">
              <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 section-title">
                <Trophy size={15} className="text-gold-500" /> Best wins
              </div>
              {p.bestWins.length === 0 && <p className="px-3 pb-3 text-xs text-stone-500">Your wins against the strongest opponents show up here.</p>}
              {p.bestWins.map((b) => (
                <button key={String(b.gameId)} className="flex w-full items-center gap-3 px-3 py-2 text-left active:bg-stone-100 dark:active:bg-stone-800" onClick={() => push({ name: 'report', gameId: b.gameId })}>
                  <span className="w-12 text-lg font-black tabular-nums">{b.rating}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.opponent}</span>
                    <span className="block text-xs text-stone-500">
                      {b.source === 'chess.com' ? 'chess.com · ' : ''}
                      {new Date(b.endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {b.accuracy !== null ? ` · ${b.accuracy}% accuracy` : ''}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-stone-400" />
                </button>
              ))}
            </div>
            <button className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'insights' })}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                <Lightbulb size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Insights</span>
                <span className="block text-xs text-stone-500">Where you win and lose: phase, opening, colour, time of day, speed</span>
              </span>
              <ChevronRight size={18} className="text-stone-400" />
            </button>
          </>
        )}
        {view === 'games' && (
          <>
            <GameInsightsCard />
            <GapCard />
            <div className="card !p-3">
              <div className="mb-1 section-title">Game accuracy</div>
              <LineChart values={d.accuracy} color="#3b82f6" suffix="%" />
            </div>
            <div className="card !p-3">
              <div className="mb-1 section-title">Blunders per game (last {d.blunders.length})</div>
              <BarChart values={d.blunders} />
            </div>
            <button className="btn-secondary w-full" onClick={() => push({ name: 'history' })}>
              All past games
            </button>
          </>
        )}
        {view === 'puzzles' && (
          <>
            <div className="card !p-3">
              <div className="mb-1 section-title">Puzzle rating over time</div>
              <LineChart values={d.ratings} />
              <div className="text-xs text-stone-500">{d.puzzles.solved} of {d.puzzles.total} puzzles solved</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <ThemeList title="Strongest puzzle themes" list={strong} />
              <ThemeList title="Work on" list={weak} />
            </div>
          </>
        )}
        {view === 'activity' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Days in a row" value={d.streak} />
              <Stat label="Longest streak" value={d.best} />
            </div>
            <div className="card !p-3">
              <div className="mb-1 section-title">Last 14 days</div>
              <div className="flex h-16 items-end gap-1">
                {d.days.map((x) => (
                  <div key={x.day} className="flex-1 rounded-t bg-brand-500" style={{ height: `${Math.max(4, (x.n / maxDay) * 100)}%`, opacity: x.n ? 1 : 0.15 }} title={`${x.day}: ${x.n}`} />
                ))}
              </div>
            </div>
            <LevelCard />
            <WeeklyGoalCard editable />
            <WeekCard week={d.week} />
            <RewardsCards />
            <AchievementsPreview />
            <CareerCard />
          </>
        )}
      </div>
    </div>
  );
}

function RatingRow({ label, sub, value, best, onClick }: { label: string; sub: string; value: number; best?: number; onClick?: () => void }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold capitalize">{label}</span>
        <span className="block truncate text-xs text-stone-500">{sub}</span>
      </span>
      <span className="text-right">
        <span className="font-display block text-[22px] leading-tight font-semibold tabular-nums">{value}</span>
        {best !== undefined && best > value && <span className="block text-[11px] text-stone-400">best {best}</span>}
      </span>
      {onClick && <ChevronRight size={16} className="text-stone-400" />}
    </>
  );
  return onClick ? (
    <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-stone-100 dark:active:bg-stone-800" onClick={onClick}>{inner}</button>
  ) : (
    <div className="flex items-center gap-3 px-3 py-2.5">{inner}</div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="card !p-3 text-center">
      <div className="font-display text-[22px] font-semibold tabular-nums">{value}</div>
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

function WeekCard({ week }: { week: { thisWeek: WeekStats; lastWeek: WeekStats } }) {
  const { thisWeek: t, lastWeek: l } = week;
  const rows: { label: string; now: string; before: string; better: boolean | null }[] = [
    { label: 'Training days', now: `${t.activeDays}/7`, before: `${l.activeDays}/7`, better: t.activeDays === l.activeDays ? null : t.activeDays > l.activeDays },
    { label: 'Puzzles solved', now: `${t.puzzlesSolved}`, before: `${l.puzzlesSolved}`, better: t.puzzlesSolved === l.puzzlesSolved ? null : t.puzzlesSolved > l.puzzlesSolved },
    { label: 'Games', now: `${t.games}`, before: `${l.games}`, better: null },
    {
      label: 'Game accuracy',
      now: t.accuracy === null ? '–' : `${t.accuracy}%`,
      before: l.accuracy === null ? '–' : `${l.accuracy}%`,
      better: t.accuracy === null || l.accuracy === null || t.accuracy === l.accuracy ? null : t.accuracy > l.accuracy,
    },
    {
      label: 'Blunders per game',
      now: t.blundersPerGame === null ? '–' : `${t.blundersPerGame}`,
      before: l.blundersPerGame === null ? '–' : `${l.blundersPerGame}`,
      better: t.blundersPerGame === null || l.blundersPerGame === null || t.blundersPerGame === l.blundersPerGame ? null : t.blundersPerGame < l.blundersPerGame,
    },
  ];
  return (
    <div className="card !p-3">
      <div className="mb-1 flex justify-between section-title">
        <span>This week</span>
        <span className="font-normal">vs. last week</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-0.5 text-sm">
          <span>{r.label}</span>
          <span>
            <b>{r.now}</b>{' '}
            <span className={r.better === null ? 'text-stone-400' : r.better ? 'text-emerald-600' : 'text-red-500'}>
              {r.better === null ? '' : r.better ? '▲' : '▼'} {r.before}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
