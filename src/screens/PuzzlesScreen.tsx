// The Puzzles hub, chess.com style: your rating with its graph and one big "Solve Puzzles" button,
// then the modes as tiles (Rush, Daily Puzzle, Custom, Learning, your games) and your records.
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronRight, Flame, GraduationCap, Puzzle, Shield, SlidersHorizontal, Swords, Timer, Trophy, Zap } from 'lucide-react';
import { Header } from '../components/ui';
import { LineChart } from '../components/Charts';
import { db, kvGet, today } from '../lib/db';
import { useNav, type RushMode } from '../lib/nav';
import { getRating } from '../lib/puzzles/rating';
import { weakestThemes } from '../lib/puzzles/select';
import { THEME_SETS } from '../lib/puzzles/themes';
import { dailyState, dailyStreak } from '../lib/puzzles/sources';
import { loadIndex } from '../lib/puzzles/data';
import { RUSH_LABEL, rushBestKey } from './RushScreen';
import { SettingsButton } from './PlayScreen';

interface HubData {
  rating: number;
  peak: number;
  ratings: number[];
  solved: number;
  played: number;
  bestStreak: number;
  rush: Record<RushMode, number>;
  dailySolved: boolean;
  dailyStreak: number;
  weak?: string;
  total: number;
}

export function PuzzlesScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const [d, setD] = useState<HubData | null>(null);

  useEffect(() => {
    if (tab !== 'puzzles') return;
    void (async () => {
      const r = await getRating();
      const attempts = await db.attempts.toArray();
      const ratings = (await db.ratings.orderBy('at').toArray()).map((x) => x.rating).slice(-40);
      const daily = await dailyState();
      const rush = {} as Record<RushMode, number>;
      for (const m of ['3', '5', 'survival'] as RushMode[]) rush[m] = await kvGet<number>(rushBestKey(m), 0);
      const weak = (await weakestThemes(1))[0];
      setD({
        rating: r.rating,
        peak: Math.max(r.peak ?? r.rating, r.rating),
        ratings,
        solved: attempts.filter((a) => a.success).length,
        played: attempts.length,
        bestStreak: await kvGet<number>('puzzleBestStreak', 0),
        rush,
        dailySolved: daily.solved.includes(today()),
        dailyStreak: dailyStreak(daily.solved),
        weak: attempts.length >= 5 ? weak : undefined,
        total: (await loadIndex().catch(() => ({ total: 0 }))).total,
      });
    })();
  }, [tab]);

  return (
    <div className="flex h-full flex-col">
      <Header title="Puzzles" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto p-4">
        {/* Rating + Solve */}
        <div className="card !p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Puzzle rating</div>
              <div className="text-4xl font-black tabular-nums">{d?.rating ?? '…'}</div>
            </div>
            <div className="text-right text-xs text-stone-500">
              <div>Highest <b className="text-stone-800 dark:text-stone-100">{d?.peak ?? '…'}</b></div>
              <div>{d ? `${d.solved} of ${d.played} solved` : ''}</div>
            </div>
          </div>
          {d && d.ratings.length > 1 && (
            <div className="mt-2">
              <LineChart values={d.ratings} height={70} />
            </div>
          )}
          <button className="btn-primary mt-3 w-full !py-4 text-lg" onClick={() => push({ name: 'puzzle', mode: { kind: 'rated' } })}>
            <Puzzle size={20} /> Solve Puzzles
          </button>
          {d && d.total > 0 && <p className="mt-1.5 text-center text-[11px] text-stone-400">{d.total.toLocaleString()} puzzles from the Lichess database, all offline</p>}
        </div>

        {/* Daily Puzzle */}
        <button className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'puzzle', mode: { kind: 'dailyPuzzle' } })}>
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${d?.dailySolved ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            <CalendarDays size={24} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Daily Puzzle</span>
            <span className="block text-xs text-stone-500">{d?.dailySolved ? 'Solved today ✓ — come back tomorrow' : 'A new puzzle every day'}</span>
          </span>
          {d && d.dailyStreak > 0 && (
            <span className="flex items-center gap-0.5 font-bold text-orange-600">
              <Flame size={18} className="fill-orange-400" /> {d.dailyStreak}
            </span>
          )}
          <ChevronRight size={18} className="text-stone-400" />
        </button>

        {/* Puzzle Rush */}
        <div className="card !p-3">
          <div className="mb-2 flex items-center gap-2">
            <Zap size={18} className="fill-amber-400 text-amber-500" />
            <span className="font-semibold">Puzzle Rush</span>
            <span className="text-xs text-stone-500">· beat your best</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['3', '5', 'survival'] as RushMode[]).map((m) => (
              <button key={m} className="flex flex-col items-center rounded-2xl bg-stone-100 py-2.5 active:scale-[0.97] dark:bg-stone-800" onClick={() => push({ name: 'rush', mode: m })}>
                {m === 'survival' ? <Shield size={20} className="text-sky-600" /> : <Timer size={20} className="text-amber-600" />}
                <span className="mt-0.5 text-sm font-semibold">{RUSH_LABEL[m]}</span>
                <span className="text-xs text-stone-500">Best {d?.rush[m] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* More modes */}
        <div className="grid grid-cols-2 gap-2.5">
          <Tile icon={<SlidersHorizontal size={22} />} tint="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" title="Custom" text={`${THEME_SETS.length} themes, any difficulty`} onClick={() => push({ name: 'customPuzzles' })} />
          <Tile icon={<GraduationCap size={22} />} tint="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" title="Learning" text="Unrated — take your time" onClick={() => push({ name: 'puzzle', mode: { kind: 'learn' } })} />
          <Tile icon={<Swords size={22} />} tint="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" title="From your games" text="Punish the blunders you missed" onClick={() => push({ name: 'puzzle', mode: { kind: 'yours' } })} />
          {d?.weak ? (
            <Tile icon={<Puzzle size={22} />} tint="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title={THEME_SETS.find((t) => t.id === d.weak)?.label ?? 'Weak spot'} text="Your weakest theme" onClick={() => push({ name: 'puzzle', mode: { kind: 'theme', theme: d.weak! } })} />
          ) : (
            <Tile icon={<Puzzle size={22} />} tint="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="Mate in 1" text="Quick warm-up" onClick={() => push({ name: 'puzzle', mode: { kind: 'theme', theme: 'mateIn1', difficulty: -300 } })} />
          )}
        </div>

        {/* Records */}
        {d && (
          <div className="card grid grid-cols-3 gap-1 !p-3 text-center">
            <Record icon={<Trophy size={16} className="text-gold-500" />} label="Highest" value={d.peak} />
            <Record icon={<Flame size={16} className="text-orange-500" />} label="Best streak" value={d.bestStreak} />
            <Record icon={<Zap size={16} className="text-amber-500" />} label="Rush best" value={Math.max(d.rush['3'], d.rush['5'])} />
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon, tint, title, text, onClick }: { icon: ReactNode; tint: string; title: string; text: string; onClick: () => void }) {
  return (
    <button className="card flex flex-col items-start gap-1.5 !p-3 text-left active:scale-[0.98]" onClick={onClick}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span className="font-semibold leading-tight">{title}</span>
      <span className="text-xs leading-snug text-stone-500">{text}</span>
    </button>
  );
}

function Record({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-xl font-black tabular-nums">{icon}{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}
