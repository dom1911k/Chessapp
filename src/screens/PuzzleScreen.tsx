import { useCallback, useEffect, useRef, useState } from 'react';
import { PuzzlePlayer, type PuzzleResult } from '../components/PuzzlePlayer';
import { Header, Spinner } from '../components/ui';
import type { PuzzleMode } from '../lib/nav';
import { recordAttempt, type AttemptOutcome } from '../lib/puzzles/record';
import { getRating } from '../lib/puzzles/rating';
import { nextPuzzle } from '../lib/puzzles/select';
import { fromLichess, type PuzzleSpec } from '../lib/puzzles/spec';
import { themeLabel } from '../lib/puzzles/themes';
import { addCoursePuzzle, checkChapters } from '../lib/course';
import { kvGet, kvSet } from '../lib/db';
import { useNav } from '../lib/nav';
import { useCelebrate } from '../lib/celebrate';
import { DRILLS_KEY } from './PracticeScreen';
import { awardXp } from '../lib/progress/xp';
import { ComboBanner } from '../components/PuzzleFx';
import { Flame, Timer, Trophy, Zap } from 'lucide-react';

const BEST_KEY = 'puzzleBestStreak';
/** Streak lengths that get a banner. */
const isMilestone = (n: number) => n === 3 || n === 5 || (n >= 10 && n % 5 === 0);

/** What the last puzzle earned on top of the usual XP. */
interface Bonus {
  seconds: number;
  lightning: boolean;
  streakXp: number;
  speedXp: number;
  newBest: boolean;
  lostStreak: number;
}

/** Counts from one number to another over a short moment. */
function CountUp({ from, to }: { from: number; to: number }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <>{v}</>;
}

/** The streak flame in the header: grows hotter with every puzzle in a row. */
function StreakFlame({ streak, best }: { streak: number; best: number }) {
  const hot = streak >= 10 ? 'text-fuchsia-500 fill-fuchsia-400' : streak >= 5 ? 'text-rose-500 fill-orange-400' : streak >= 3 ? 'text-orange-500 fill-amber-300' : streak ? 'text-amber-500 fill-amber-200' : 'text-stone-400';
  return (
    <div className="flex items-center gap-1.5 pr-1">
      <span key={streak} className={`flex items-center gap-0.5 ${streak ? 'animate-count-pop' : ''}`}>
        <Flame size={22} className={`${hot} ${streak >= 3 ? 'animate-flame' : ''}`} />
        <span className="text-lg font-black tabular-nums">{streak}</span>
      </span>
      {best > 0 && <span className="text-[10px] leading-tight text-stone-500">best<br />{best}</span>}
    </div>
  );
}

/** Endless rated or themed puzzle training. */
export function PuzzleScreen({ mode }: { mode: PuzzleMode }) {
  const theme = mode.kind === 'theme' || mode.kind === 'course' || mode.kind === 'drill' ? mode.theme : undefined;
  const drill = mode.kind === 'drill' ? mode : null;
  const [drillSolved, setDrillSolved] = useState(0);
  const pop = useNav((n) => n.pop);
  const course = mode.kind === 'course' ? mode : null;
  const [solvedInStep, setSolvedInStep] = useState<number | null>(null);
  useEffect(() => {
    if (course) void kvGet<Record<string, number>>('coursePuzzles', {}).then((p) => setSolvedInStep(p[course.stepId] ?? 0));
  }, [course]);
  const [spec, setSpec] = useState<PuzzleSpec | null>(null);
  const [empty, setEmpty] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [streak, setStreak] = useState(0);
  const [n, setN] = useState(0);
  const [best, setBest] = useState(0);
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const [banner, setBanner] = useState<{ id: number; streak: number } | null>(null);
  const bestToasted = useRef(false);
  useEffect(() => void kvGet<number>(BEST_KEY, 0).then(setBest), []);

  const load = useCallback(async () => {
    setSpec(null);
    setOutcome(null);
    setBonus(null);
    setBanner(null);
    const r = await getRating();
    setRating(r.rating);
    const p = await nextPuzzle(theme, drill ? r.rating - 150 : r.rating);
    if (!p) setEmpty(true);
    else {
      setSpec(fromLichess(p));
      setN((x) => x + 1);
    }
  }, [theme, drill]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFinish = async (r: PuzzleResult) => {
    if (!spec) return;
    const o = await recordAttempt(spec, r.success, r.hintsUsed, theme ? 'theme' : 'rated');
    if (course && r.success) {
      const n = await addCoursePuzzle(course.stepId);
      setSolvedInStep(n);
      if (n === course.count) void checkChapters();
    }
    if (drill && r.success) {
      const k = drillSolved + 1;
      setDrillSolved(k);
      if (k === drill.count) {
        const done = await kvGet<string[]>(DRILLS_KEY, []);
        await kvSet(DRILLS_KEY, [...done.filter((d) => d !== drill.doneKey), drill.doneKey].slice(-30));
        useCelebrate.getState().toast({ icon: 'target', title: 'Practice done!', text: `${drill.count} ${drill.label.toLowerCase()} puzzles solved.` });
      }
    }
    setOutcome(o);
    if (o.ratingAfter) setRating(o.ratingAfter);
    // Streak, speed and personal-best extras.
    const next = r.success ? streak + 1 : 0;
    const userMoves = Math.ceil(spec.solution.length / 2);
    const lightning = r.success && r.hintsUsed === 0 && r.seconds > 0 && r.seconds <= 8 + 6 * (userMoves - 1);
    const b: Bonus = {
      seconds: r.seconds,
      lightning,
      streakXp: next >= 3 ? Math.min(next, 10) : 0,
      speedXp: lightning ? 3 : 0,
      newBest: false,
      lostStreak: r.success ? 0 : streak,
    };
    if (next > best && next >= 3) {
      b.newBest = true;
      setBest(next);
      void kvSet(BEST_KEY, next);
      if (!bestToasted.current) {
        bestToasted.current = true;
        useCelebrate.getState().toast({ icon: 'trophy', title: 'New best streak!', text: 'Keep going — every puzzle in a row counts.' });
      }
    }
    if (b.streakXp + b.speedXp) void awardXp(b.streakXp + b.speedXp, true);
    if (r.success && isMilestone(next)) setBanner({ id: Date.now(), streak: next });
    setBonus(b);
    setStreak(next);
  };

  const delta = outcome?.ratingAfter !== undefined && outcome.ratingBefore !== undefined ? outcome.ratingAfter - outcome.ratingBefore : null;

  return (
    <div className="flex h-full flex-col">
      <Header
        title={drill ? `${drill.label} · ${Math.min(drillSolved, drill.count)}/${drill.count}` : course ? `${course.label}${solvedInStep !== null ? ` · ${Math.min(solvedInStep, course.count)}/${course.count}` : ''}` : theme ? themeLabel(theme) : 'Rated puzzles'}
        back
        right={
          <div className="flex items-center gap-3 pr-2">
            <StreakFlame streak={streak} best={best} />
            <div className="text-right text-sm leading-tight">
              <div className="font-bold tabular-nums">{rating ?? '…'}</div>
              <div className="text-[10px] text-stone-500">rating</div>
            </div>
          </div>
        }
      />
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-4 land:max-w-6xl">
        {empty && <p className="p-6 text-center text-stone-500">You've done every puzzle in this set. Amazing!</p>}
        {!spec && !empty && (
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        )}
        {spec && (
          <PuzzlePlayer
            key={spec.id + n}
            spec={spec}
            onFinish={onFinish}
            combo={streak}
            overlay={banner && <ComboBanner key={banner.id} id={banner.id} streak={banner.streak} />}
            onNext={drill && drillSolved >= drill.count ? pop : load}
            nextLabel={drill && drillSolved >= drill.count ? 'Back to practice' : course && solvedInStep !== null && solvedInStep >= course.count ? 'Keep practising' : 'Next puzzle'}
            footer={
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                {delta !== null && (
                  <span className={`chip !text-sm ${delta >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>
                    {delta >= 0 ? '▲' : '▼'} <CountUp from={outcome!.ratingBefore!} to={outcome!.ratingAfter!} />
                    <span className="opacity-70">({delta >= 0 ? '+' : ''}{delta})</span>
                  </span>
                )}
                {outcome?.xp ? <span className="chip animate-count-pop !text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">+{outcome.xp + (bonus ? bonus.streakXp + bonus.speedXp : 0)} XP</span> : null}
                {bonus?.lightning && (
                  <span className="chip bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                    <Zap size={13} className="fill-current" /> Lightning · {bonus.seconds}s
                  </span>
                )}
                {bonus && !bonus.lightning && outcome?.xp ? (
                  <span className="chip bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    <Timer size={13} /> {bonus.seconds}s
                  </span>
                ) : null}
                {bonus && bonus.streakXp > 0 && (
                  <span className="chip bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                    <Flame size={13} className="fill-current" /> {streak} in a row
                  </span>
                )}
                {bonus?.newBest && (
                  <span className="chip bg-gold-300/50 text-stone-800 dark:bg-gold-500/25 dark:text-gold-300">
                    <Trophy size={13} /> New best
                  </span>
                )}
                {bonus && bonus.lostStreak >= 3 && <span className="text-xs font-normal text-stone-500">Your streak of {bonus.lostStreak} ended — start a new one!</span>}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
