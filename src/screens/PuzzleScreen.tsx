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
import { DailySolverDots, DailySolverOverlay, LevelBadge, LevelUpBanner, MasteryStrip, RatingRow } from '../components/PuzzleProgress';
import { THEME_SETS } from '../lib/puzzles/themes';
import { db } from '../lib/db';
import { DAILY_SOLVER_GOAL, DAILY_SOLVER_XP, dailySolverKey, puzzleLevel, solveTags } from '../lib/puzzles/level';
import { kvGet as kvRead, today } from '../lib/db';
import { Flame } from 'lucide-react';
import { dailyPick, gamePuzzles, markDailySolved } from '../lib/puzzles/sources';
import { loadRange } from '../lib/puzzles/data';
import { allGames } from '../lib/games';

const BEST_KEY = 'puzzleBestStreak';
const YOURS_KEY = 'yourPuzzlesDone';
/** The daily puzzle comes from this rating range (the same for everyone on a given day). */
export const DAILY_RANGE = [1000, 1500] as const;
const MODE_TITLE: Partial<Record<PuzzleMode['kind'], string>> = { rated: 'Puzzles', learn: 'Learning mode', yours: 'From your games', dailyPuzzle: 'Daily Puzzle' };
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
  // Rated: the classic rated stream (and course/drill sets, as before). Everything else is unrated.
  const rated = mode.kind === 'rated' || mode.kind === 'course' || mode.kind === 'drill';
  const source = mode.kind === 'rated' ? 'rated' : rated ? 'theme' : 'learn';
  const yours = useRef<PuzzleSpec[] | null>(null);
  const [dailyDone, setDailyDone] = useState(false);
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
  useEffect(() => void kvGet<number>(BEST_KEY, 0).then(setBest), []);
  // Daily Solver: the first three rated puzzles solved each day earn an award.
  const [dailyCount, setDailyCount] = useState(0);
  const [award, setAward] = useState(false);
  const [extraXp, setExtraXp] = useState(0);
  const [levelUp, setLevelUp] = useState<{ id: number; level: number } | null>(null);
  /** Theme mastery for the puzzle just played: clean solves before and after. */
  const [mast, setMast] = useState<{ label: string; before: number; after: number } | null>(null);
  /** The level in the header moves only once the bar has filled. */
  const [headerLevel, setHeaderLevel] = useState<number | null>(null);
  useEffect(() => void kvRead<number>(dailySolverKey(today()), 0).then(setDailyCount), []);

  const load = useCallback(async () => {
    setSpec(null);
    setOutcome(null);
    setBonus(null);
    setBanner(null);
    setAward(false);
    setExtraXp(0);
    setLevelUp(null);
    setMast(null);
    const r = await getRating();
    setRating(r.rating);
    let next: PuzzleSpec | null = null;
    if (mode.kind === 'yours') {
      // Your own games: the blunders you could have punished, not yet solved.
      if (!yours.current) {
        const done = new Set(await kvGet<string[]>(YOURS_KEY, []));
        yours.current = gamePuzzles(await allGames()).filter((x) => !done.has(x.id)).sort(() => Math.random() - 0.5);
      }
      next = yours.current.shift() ?? null;
    } else if (mode.kind === 'dailyPuzzle') {
      const p = dailyPick(await loadRange(DAILY_RANGE[0], DAILY_RANGE[1]));
      next = p ? { ...fromLichess(p), label: 'Daily Puzzle' } : null;
    } else {
      const offset = mode.kind === 'theme' ? (mode.difficulty ?? 0) : drill ? -150 : 0;
      const p = await nextPuzzle(theme, r.rating + offset);
      next = p ? fromLichess(p) : null;
    }
    if (!next) setEmpty(true);
    else {
      setSpec(next);
      setN((x) => x + 1);
    }
  }, [theme, drill, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const onFinish = async (r: PuzzleResult) => {
    if (!spec) return;
    // Which theme this puzzle trains (the chosen one, else its first known theme), and how many
    // clean solves you had in it before.
    const mt = THEME_SETS.find((t) => t.id === theme) ?? THEME_SETS.find((t) => spec.themes.includes(t.id));
    const mBefore = mt ? await db.attempts.filter((a) => a.success && a.themes.includes(mt.id)).count() : 0;
    const o = await recordAttempt(spec, r.success, r.hintsUsed, source);
    if (mt) setMast({ label: mt.label, before: mBefore, after: mBefore + (r.success && r.hintsUsed === 0 ? 1 : 0) });
    if (mode.kind === 'yours' && r.success) void kvGet<string[]>(YOURS_KEY, []).then((d) => kvSet(YOURS_KEY, [...d, spec.id].slice(-2000)));
    if (mode.kind === 'dailyPuzzle' && r.success) {
      await markDailySolved();
      setDailyDone(true);
      useCelebrate.getState().toast({ icon: 'calendar', title: 'Daily Puzzle solved!', text: 'Come back tomorrow to keep your streak.' });
    }
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
    if (o.ratingAfter) {
      setRating(o.ratingAfter);
      if (o.ratingBefore !== undefined) setHeaderLevel(puzzleLevel(o.ratingBefore).level);
    }
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
    }
    if (b.streakXp + b.speedXp) void awardXp(b.streakXp + b.speedXp, true);
    if (r.success && isMilestone(next)) setBanner({ id: Date.now(), streak: next });
    if (r.success && rated && spec.kind === 'lichess') {
      const key = dailySolverKey(today());
      const c = (await kvRead<number>(key, 0)) + 1;
      await kvSet(key, c);
      setDailyCount(c);
      // The award plays after the square's tags have had their moment.
      // (and after the level-up moment, when this solve crosses a level)
      const crossed = o.ratingBefore !== undefined && o.ratingAfter !== undefined && puzzleLevel(o.ratingAfter).level > puzzleLevel(o.ratingBefore).level;
      if (c === DAILY_SOLVER_GOAL) setTimeout(() => setAward(true), 1050 * (1 + (b.speedXp ? 1 : 0) + (b.streakXp ? 1 : 0)) + 500 + (crossed ? 2400 : 0));
    }
    setBonus(b);
    setStreak(next);
  };

  const delta = outcome?.ratingAfter !== undefined && outcome.ratingBefore !== undefined ? outcome.ratingAfter - outcome.ratingBefore : null;
  const tags = outcome ? solveTags({ ratingDelta: delta, puzzleRating: spec?.rating, yourRating: outcome.ratingBefore, speedXp: bonus?.speedXp ?? 0, streak, streakXp: bonus?.streakXp ?? 0 }) : [];
  const xpShown = outcome?.xp ? outcome.xp + (bonus ? bonus.streakXp + bonus.speedXp : 0) + extraXp : extraXp || undefined;
  const title = drill ? `${drill.label} · ${Math.min(drillSolved, drill.count)}/${drill.count}` : course ? `${course.label}${solvedInStep !== null ? ` · ${Math.min(solvedInStep, course.count)}/${course.count}` : ''}` : theme ? themeLabel(theme) : MODE_TITLE[mode.kind] ?? 'Puzzles';
  const awardDone = () => {
    setAward(false);
    setExtraXp(DAILY_SOLVER_XP);
    void awardXp(DAILY_SOLVER_XP, true);
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        title={title}
        back
        leading={rated && rating !== null ? <LevelBadge key={headerLevel ?? puzzleLevel(rating).level} level={headerLevel ?? puzzleLevel(rating).level} size={34} className={levelUp ? 'animate-badge-pop' : ''} /> : undefined}
        right={
          <div className="flex items-center gap-3 pr-2">
            {rated && <DailySolverDots done={dailyCount} />}
            <StreakFlame streak={streak} best={best} />
          </div>
        }
      />
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-4 land:max-w-6xl">
        {empty && <p className="p-6 text-center text-stone-500">{mode.kind === 'yours' ? 'No positions from your games yet — they appear once your games are analysed and your opponents slip.' : "You've done every puzzle in this set. Amazing!"}</p>}
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
            solvedStreak={streak}
            tags={tags}
            overlay={
              <>
                {banner && <ComboBanner key={banner.id} id={banner.id} streak={banner.streak} />}
                {levelUp && <LevelUpBanner key={levelUp.id} id={levelUp.id} level={levelUp.level} />}
                {award && <DailySolverOverlay onDone={awardDone} />}
              </>
            }
            failOnWrong={rated}
            onNext={(drill && drillSolved >= drill.count) || (mode.kind === 'dailyPuzzle' && (dailyDone || outcome)) ? pop : load}
            nextLabel={drill && drillSolved >= drill.count ? 'Back to practice' : mode.kind === 'dailyPuzzle' ? 'Done' : course && solvedInStep !== null && solvedInStep >= course.count ? 'Keep practising' : 'Next'}
            progress={
              rating !== null ? (
                <div className="space-y-2.5">
                {
                rated || mode.kind === 'dailyPuzzle' ? (
                  <RatingRow key={outcome ? 'after' : 'before'} before={outcome?.ratingBefore ?? rating} after={outcome?.ratingAfter} xp={xpShown} unrated={!!outcome && outcome.ratingAfter === undefined && !rated} onLevelUp={(l) => (setLevelUp({ id: Date.now(), level: l }), setHeaderLevel(l))} />
                ) : (
                  <RatingRow before={rating} xp={xpShown} unrated />
                )}
                {mast && mast.after > mast.before && <MasteryStrip key={spec.id} label={mast.label} before={mast.before} after={mast.after} delay={1200} />}
                </div>
              ) : null
            }
            footer={
              bonus && (bonus.newBest || bonus.lostStreak >= 3 || outcome?.newPeak) ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  {outcome?.newPeak && <span className="chip bg-gold-300/50 text-stone-800 dark:bg-gold-500/25 dark:text-gold-300">★ Highest rating</span>}
                  {bonus.newBest && <span className="chip bg-gold-300/50 text-stone-800 dark:bg-gold-500/25 dark:text-gold-300">★ New best streak</span>}
                  {bonus.lostStreak >= 3 && <span className="text-stone-500">Your streak of {bonus.lostStreak} ended — start a new one!</span>}
                </div>
              ) : null
            }
          />
        )}
      </div>
    </div>
  );
}
