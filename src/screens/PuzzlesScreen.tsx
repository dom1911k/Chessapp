// The Puzzles hub, chess.com style: the puzzle path card (your level, points, the bar, a window
// onto the world) with one big "Solve Puzzles" button and the difficulty, then the modes as tiles
// (Rush, Daily Puzzle, Custom, Learning, your games) and your records.
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarCheck, CalendarDays, ChevronRight, Flame, GraduationCap, Puzzle, Shield, SlidersHorizontal, Swords, Timer, Trophy, Zap } from 'lucide-react';
import { Arrive, Header, Segmented, SkelText } from '../components/ui';
import { GreenDot, PathBadge, SolverDots, StreakFlame } from '../components/path/PathUI';
import { PathWindow } from '../components/path/PathWorld';
import { boardName, getPathState, levelAt, pathBehind, type PathState } from '../lib/puzzles/path';
import { useSettings } from '../lib/settings';
import { db, kvGet, today } from '../lib/db';
import { useNav, type RushMode } from '../lib/nav';
import { getRating } from '../lib/puzzles/rating';
import { weakestThemes } from '../lib/puzzles/select';
import { THEME_SETS } from '../lib/puzzles/themes';
import { dailyState, dailyStreak } from '../lib/puzzles/sources';
import { loadIndex } from '../lib/puzzles/data';
import { dueCount } from '../lib/store/daily';
import { RUSH_LABEL, rushBestKey } from './RushScreen';
import { SettingsButton } from './PlayScreen';

interface HubData {
  rating: number;
  peak: number;
  ratings: number[];
  ratingDates: number[];
  solved: number;
  played: number;
  bestStreak: number;
  rush: Record<RushMode, number>;
  dailySolved: boolean;
  dailyStreak: number;
  weak?: string;
  total: number;
  due: number;
  path: PathState;
}

export function PuzzlesScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const [d, setD] = useState<HubData | null>(null);
  // Refreshed when you come back from a puzzle or the Path.
  const depth = useNav((s) => s.stack.length);

  useEffect(() => {
    if (tab !== 'puzzles') return;
    void (async () => {
      const r = await getRating();
      const attempts = await db.attempts.toArray();
      const rows = (await db.ratings.orderBy('at').toArray()).slice(-40);
      const ratings = rows.map((x) => x.rating);
      const daily = await dailyState();
      const rush = {} as Record<RushMode, number>;
      for (const m of ['3', '5', 'survival'] as RushMode[]) rush[m] = await kvGet<number>(rushBestKey(m), 0);
      const weak = (await weakestThemes(1))[0];
      setD({
        rating: r.rating,
        peak: Math.max(r.peak ?? r.rating, r.rating),
        ratings,
        ratingDates: rows.map((x) => x.at),
        solved: attempts.filter((a) => a.success).length,
        played: attempts.length,
        bestStreak: (await getPathState()).bestStreak,
        rush,
        dailySolved: daily.solved.includes(today()),
        dailyStreak: dailyStreak(daily.solved),
        weak: attempts.length >= 5 ? weak : undefined,
        due: await dueCount(),
        total: (await loadIndex().catch(() => ({ total: 0 }))).total,
        path: await getPathState(),
      });
    })();
  }, [tab, depth]);

  return (
    <div className="flex h-full flex-col">
      <Header title="Puzzles" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto p-4">
        {/* The puzzle path + Solve */}
        <PathHubCard d={d} onOpen={() => push({ name: 'puzzlePath' })} onSolve={() => push({ name: 'puzzle', mode: { kind: 'rated' } })} />

        {/* Daily Puzzle */}
        <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'puzzle', mode: { kind: 'dailyPuzzle' } })}>
          <span className={`flex h-12 w-12 items-center justify-center rounded-[10px] ${d?.dailySolved ? 'bg-brand-600 text-white' : 'bg-hue-amber-100 text-hue-amber-700 dark:bg-hue-amber-900/40 dark:text-hue-amber-300'}`}>
            <CalendarDays size={24} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Daily Puzzle</span>
            <span className="block text-xs text-stone-500">{d?.dailySolved ? 'Solved today ✓ — come back tomorrow' : 'A new puzzle every day'}</span>
          </span>
          {d && d.dailyStreak > 0 && (
            <span className="flex items-center gap-0.5 font-bold text-hue-orange-600">
              <Flame size={18} className="fill-hue-orange-400" /> {d.dailyStreak}
            </span>
          )}
          <ChevronRight size={18} className="text-stone-400" />
        </button>

        {/* Daily training (spaced reviews of positions you missed + weak-spot puzzles) */}
        <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'daily' })}>
          <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-brand-100 text-brand-700 dark:bg-brand-800/40 dark:text-brand-500">
            <CalendarCheck size={24} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Daily training</span>
            <span className="block text-xs text-stone-500">{d?.due ? `${d.due} position${d.due === 1 ? '' : 's'} to review, then weak-spot puzzles` : 'Puzzles picked for your weak spots'}</span>
          </span>
          {d?.due ? <span className="chip bg-danger-700 text-white">{d.due}</span> : null}
          <ChevronRight size={18} className="text-stone-400" />
        </button>

        {/* Puzzle Rush */}
        <div className="card !p-3">
          <div className="mb-2 flex items-center gap-2">
            <Zap size={18} className="fill-hue-amber-400 text-hue-amber-500" />
            <span className="font-semibold">Puzzle Rush</span>
            <span className="text-xs text-stone-500">· beat your best</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['3', '5', 'survival'] as RushMode[]).map((m) => (
              <button key={m} className="flex flex-col items-center rounded-[10px] bg-stone-100 py-2.5 active:scale-[0.97] dark:bg-stone-800" onClick={() => push({ name: 'rush', mode: m })}>
                {m === 'survival' ? <Shield size={20} className="text-hue-sky-600" /> : <Timer size={20} className="text-hue-amber-600" />}
                <span className="mt-0.5 text-sm font-semibold">{RUSH_LABEL[m]}</span>
                <span className="text-xs text-stone-500">Best {d?.rush[m] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* More modes */}
        <div className="grid grid-cols-2 gap-2.5">
          <Tile icon={<SlidersHorizontal size={22} />} tint="bg-hue-violet-100 text-hue-violet-700 dark:bg-hue-violet-900/40 dark:text-hue-violet-300" title="Custom" text={`${THEME_SETS.length} themes, any difficulty`} onClick={() => push({ name: 'customPuzzles' })} />
          <Tile icon={<GraduationCap size={22} />} tint="bg-hue-sky-100 text-hue-sky-700 dark:bg-hue-sky-900/40 dark:text-hue-sky-300" title="Learning" text="Unrated — take your time" onClick={() => push({ name: 'puzzle', mode: { kind: 'learn' } })} />
          <Tile icon={<Swords size={22} />} tint="bg-hue-rose-100 text-hue-rose-700 dark:bg-hue-rose-900/40 dark:text-hue-rose-300" title="From your games" text="Punish the blunders you missed" onClick={() => push({ name: 'puzzle', mode: { kind: 'yours' } })} />
          {d?.weak ? (
            <Tile icon={<Puzzle size={22} />} tint="bg-hue-amber-100 text-hue-amber-700 dark:bg-hue-amber-900/40 dark:text-hue-amber-300" title={THEME_SETS.find((t) => t.id === d.weak)?.label ?? 'Weak spot'} text="Your weakest theme" onClick={() => push({ name: 'puzzle', mode: { kind: 'theme', theme: d.weak! } })} />
          ) : (
            <Tile icon={<Puzzle size={22} />} tint="bg-hue-amber-100 text-hue-amber-700 dark:bg-hue-amber-900/40 dark:text-hue-amber-300" title="Mate in 1" text="Quick warm-up" onClick={() => push({ name: 'puzzle', mode: { kind: 'theme', theme: 'mateIn1', difficulty: -300 } })} />
          )}
        </div>

        {/* Records */}
        {d && (
          <div className="card grid grid-cols-3 gap-1 !p-3 text-center">
            <Record icon={<Trophy size={16} className="text-gold-500" />} label="Highest" value={d.peak} />
            <Record icon={<Flame size={16} className="text-hue-orange-500" />} label="Best streak" value={d.bestStreak} />
            <Record icon={<Zap size={16} className="text-hue-amber-500" />} label="Rush best" value={Math.max(d.rush['3'], d.rush['5'])} />
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon, tint, title, text, onClick }: { icon: ReactNode; tint: string; title: string; text: string; onClick: () => void }) {
  return (
    <button className="card tile flex flex-col items-start gap-1.5 !p-3 text-left transition-[filter] active:brightness-95" onClick={onClick}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span className="font-semibold leading-tight">{title}</span>
      <span className="text-xs leading-snug text-stone-500">{text}</span>
    </button>
  );
}

function Record({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div>
      <div className="font-display flex items-center justify-center gap-1 text-[22px] font-semibold tabular-nums">{icon}{value}</div>
      <div className="text-[11px] text-stone-500">{label}</div>
    </div>
  );
}

/** The hub's top card: the path at a glance; tapping it opens the Path (a green dot while the pawn has tiles to walk). */
function PathHubCard({ d, onOpen, onSolve }: { d: HubData | null; onOpen: () => void; onSolve: () => void }) {
  const difficulty = useSettings((s) => s.puzzleDifficulty) ?? 'standard';
  const set = useSettings((s) => s.set);
  const p = d?.path;
  const pos = levelAt(p?.points ?? 0);
  const next = pos.level === 20 ? { tier: Math.min(7, pos.board + 1), level: 1 } : { tier: pos.tier, level: pos.level + 1 };
  const daily = p && p.dailyDay === today() ? p.dailyCount : 0;
  return (
    <div className="card !p-4" data-testid="hub-path">
      <div role="button" tabIndex={0} className="flex cursor-pointer gap-3" onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} aria-label="Open the puzzle path">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="relative">
              <PathBadge tier={pos.tier} level={pos.level} size={58} />
              {p && pathBehind(p.seen, p.points) && <GreenDot className="top-0 right-0" />}
            </span>
            <div className="min-w-0">
              <div className="text-[13px]">
                <b>{boardName(pos.board)}</b> <span className="text-stone-500">· Level {pos.level}</span>
              </div>
              <div className="text-[26px] leading-tight font-extrabold tabular-nums"><Arrive inline ready={!!p} skeleton={<SkelText w="3.2em" />}>{p?.points.toLocaleString('en-US')}</Arrive></div>
              <div className="flex items-center gap-2">
                <SolverDots count={daily} />
                <StreakFlame streak={p?.streak ?? 0} size={16} />
              </div>
            </div>
          </div>
          <div className="relative mt-3 mr-3">
            <div className="h-3 overflow-hidden rounded-full bg-[#dcd9d4] dark:bg-[#43403d]">
              <div className="h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" style={{ width: `${Math.max(2, (pos.into / pos.cost) * 100)}%`, background: 'linear-gradient(180deg,#fbae63,#f3913f 60%,#ec8231)' }} />
            </div>
            <PathBadge tier={next.tier} level={next.level} size={34} className="absolute top-1/2 -right-4 -translate-y-1/2" />
          </div>
          <div className="mt-1.5 text-right text-xs text-stone-500 tabular-nums">
            {pos.into.toLocaleString('en-US')} / {pos.cost.toLocaleString('en-US')}
          </div>
        </div>
        {p && <PathWindow points={p.points} width={96} height={118} className="shrink-0 self-start rounded-xl ring-1 ring-black/10 dark:ring-white/10" />}
      </div>
      <button className="btn-primary mt-3 w-full !rounded-[10px] !py-4 font-display text-xl" onClick={onSolve}>
        <Puzzle size={20} /> Solve Puzzles
      </button>
      <div className="mt-2.5">
        <Segmented
          value={difficulty}
          onChange={(v) => set({ puzzleDifficulty: v })}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'hard', label: 'Hard' },
            { value: 'extraHard', label: 'Extra hard' },
          ]}
        />
      </div>
      {d && (
        <p className="mt-2 text-center text-[11px] text-stone-500">
          Puzzle rating {d.rating} · best {d.peak}
          {d.total > 0 ? ` · ${d.total.toLocaleString()} puzzles, all offline` : ''}
        </p>
      )}
    </div>
  );
}
