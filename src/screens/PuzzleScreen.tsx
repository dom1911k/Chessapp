import { useCallback, useEffect, useRef, useState } from 'react';
import { PuzzlePlayer, type PuzzleResult } from '../components/PuzzlePlayer';
import { Header, Spinner } from '../components/ui';
import type { PuzzleMode } from '../lib/nav';
import { recordAttempt, type AttemptOutcome } from '../lib/puzzles/record';
import { getRating } from '../lib/puzzles/rating';
import { nextPathSpec, nextPuzzle } from '../lib/puzzles/select';
import { fromLichess, type PuzzleSpec } from '../lib/puzzles/spec';
import { themeLabel } from '../lib/puzzles/themes';
import { addCoursePuzzle, checkChapters } from '../lib/course';
import { kvGet, kvSet, today } from '../lib/db';
import { useNav } from '../lib/nav';
import { useCelebrate } from '../lib/celebrate';
import { DRILLS_KEY } from './PracticeScreen';
import { ComboBanner } from '../components/PuzzleFx';
import { LiveCrest, LiveDots, LiveFlame, LivePathCard } from '../components/path/PathUI';
import { usePathUi } from '../lib/puzzles/pathUi';
import { barAt, boardMark, boardRing, clearBoardFx, flameOut, runTally, type BoardRef } from '../lib/puzzles/tally';
import { buzz, reduced, token, type Token } from '../lib/motion';
import { LevelBanner, LevelUpPanel, TierUpCard } from '../components/path/LevelUp';
import { sfx } from '../lib/sfx';
import { getPathState, type PathAward, type PathSource, type PathState } from '../lib/puzzles/path';
import { useSettings } from '../lib/settings';
import { useContext } from 'react';
import { PuzzleTimer } from '../components/PuzzleProgress';
import { dailyPick, gamePuzzles, markDailySolved } from '../lib/puzzles/sources';
import { loadRange } from '../lib/puzzles/data';
import { allGames } from '../lib/games';

const YOURS_KEY = 'yourPuzzlesDone';
/** The daily puzzle comes from this rating range (the same for everyone on a given day). */
export const DAILY_RANGE = [1000, 1500] as const;
const MODE_TITLE: Partial<Record<PuzzleMode['kind'], string>> = { rated: 'Puzzles', learn: 'Learning mode', yours: 'From your games', dailyPuzzle: 'Daily Puzzle' };
/** Streak lengths that get a banner. */
const isMilestone = (n: number) => n === 3 || n === 5 || (n >= 10 && n % 5 === 0);

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
  const [n, setN] = useState(0);
  const [banner, setBanner] = useState<{ id: number; streak: number } | null>(null);
  // The Puzzle Path: points, persistent streak and today's Daily Solver count.
  const [path, setPath] = useState<PathState | null>(null);
  const [award, setAward] = useState<PathAward | null>(null);
  const board = useRef<BoardRef | null>(null);
  const onBoard = useCallback((b: BoardRef) => (board.current = b), []);
  const tally = useRef<Token | null>(null);
  const [tallying, setTallying] = useState(false);
  // After the tally: the level-up panel (or a banner when animations are reduced), then a new-board card.
  const [levelUp, setLevelUp] = useState<{ from: number; to: number; instant: boolean } | null>(null);
  const [banner2, setBanner2] = useState<number | null>(null);
  const [tierCard, setTierCard] = useState<number | null>(null);
  /** Show the saved state in the header and card (no gain). */
  const syncUi = (st: PathState, gain = 0) => usePathUi.getState().set({ points: st.points, streak: st.streak, daily: st.dailyDay === today() ? st.dailyCount : 0, gain });
  useEffect(() => {
    void getPathState().then((st) => {
      setPath(st);
      syncUi(st);
    });
    return () => {
      if (tally.current) tally.current.skip = true;
      useCelebrate.getState().setHold(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const difficulty = useSettings((st) => st.puzzleDifficulty) ?? 'standard';
  const showRating = useSettings((st) => st.puzzleShowRating) ?? true;
  // Which source the path scores this mode as (custom themes and learning earn nothing).
  const pathSource: PathSource = rated ? 'full' : mode.kind === 'yours' ? 'yours' : mode.kind === 'dailyPuzzle' ? 'dailyPuzzle' : 'none';

  const load = useCallback(async () => {
    endTally();
    clearBoardFx(board.current);
    setLevelUp(null);
    setBanner2(null);
    setTierCard(null);
    setSpec(null);
    setOutcome(null);
    setBanner(null);
    setAward(null);
    usePathUi.getState().set({ gain: 0 });
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
    } else if (mode.kind === 'rated') {
      // The rated stream follows the path's ladder, not your rating.
      next = await nextPathSpec(difficulty);
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
  }, [theme, drill, mode, difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const onFinish = async (r: PuzzleResult) => {
    if (!spec) return;
    lastSquare.current = r.square;
    const o = await recordAttempt(spec, r.success, r.hintsUsed, source, { seconds: r.seconds, correctMoves: r.correctMoves, path: pathSource });
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
    if (o.ratingAfter) setRating(o.ratingAfter);
    if (o.path) setAward(o.path);
    const saved = await getPathState();
    setPath(saved);
    const a = o.path;
    const b = board.current;
    if (a && b && r.square) {
      if (!r.success) {
        // A miss: a red ✗ and ring, the friendly "bonk"; the flame goes out. The bar doesn't move.
        boardMark(b, r.square, 'bad');
        boardRing(b, r.square, '#fa412d');
        sfx('fail');
        buzz(40);
        if (a.streakLost) flameOut();
      } else if (a.parts.length) {
        const tk = token();
        tally.current = tk;
        setTallying(true);
        useCelebrate.getState().setHold(true, { queue: true });
        const sq = r.square;
        const natural = await runTally(a, b, sq, tk, { onMark: () => boardMark(b, sq, 'good') });
        if (tally.current === tk) finishTally(a, saved, sq, !natural);
      }
    } else syncUi(saved, a?.total ?? 0);
    const streakNow = a?.streak ?? 0;
    if (r.success && a && isMilestone(streakNow)) setBanner({ id: Date.now(), streak: streakNow });
  };

  /** End the tally where it stands: chips gone, final numbers, the ✓, celebrations released. */
  const finishTally = (a: PathAward, saved: PathState, sq: string, skipped = true) => {
    if (tally.current) tally.current.skip = true;
    tally.current = null;
    setTallying(false);
    const b = board.current;
    if (b) {
      b.el.querySelectorAll('.pp-chip').forEach((e) => e.remove());
      document.querySelectorAll('.pp-orb,.pp-ripple').forEach((e) => e.remove());
      if (!b.el.querySelector('.pp-mark')) boardMark(b, sq, 'good');
    }
    syncUi(saved, a.total);
    barAt(saved.points);
    useCelebrate.getState().setHold(false);
    if (a.levelsCrossed.length) {
      if (reduced()) {
        setBanner2(a.after);
        if (a.boardUp !== undefined) setTimeout(() => setTierCard(a.boardUp!), 900);
      } else setLevelUp({ from: a.before, to: a.after, instant: skipped });
    }
  };
  // The latest award and saved state, for skipping from memoised callbacks (Next).
  const live = useRef<{ award: PathAward | null; path: PathState | null }>({ award: null, path: null });
  live.current = { award, path };
  const skipTally = () => {
    const { award: a, path: p } = live.current;
    if (!tally.current) return;
    if (a && p && lastSquare.current) finishTally(a, p, lastSquare.current);
    else {
      tally.current.skip = true;
      tally.current = null;
      setTallying(false);
      useCelebrate.getState().setHold(false);
    }
  };
  const endTally = () => {
    if (tally.current) skipTally();
  };
  const lastSquare = useRef<string | undefined>(undefined);

  const delta = outcome?.ratingAfter !== undefined && outcome.ratingBefore !== undefined ? outcome.ratingAfter - outcome.ratingBefore : null;
  const title = drill ? `${drill.label} · ${Math.min(drillSolved, drill.count)}/${drill.count}` : course ? `${course.label}${solvedInStep !== null ? ` · ${Math.min(solvedInStep, course.count)}/${course.count}` : ''}` : theme ? themeLabel(theme) : MODE_TITLE[mode.kind] ?? 'Puzzles';
  const streak = path?.streak ?? 0;

  return (
    <div className="flex h-full flex-col">
      <Header
        title={title}
        back
        leading={path ? <LiveCrest size={32} /> : undefined}
        right={
          <div className="flex items-center gap-3 pr-2">
            {pathSource !== 'none' && <LiveDots />}
            <LiveFlame size={20} />
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
            pathMode={pathSource !== 'none'}
            onBoard={onBoard}
            overlay={
              <>
                {banner && <ComboBanner key={banner.id} id={banner.id} streak={banner.streak} />}
                {/* A tap on the board during the tally finishes it. */}
                {tallying && <div className="absolute inset-0 z-40" onClick={skipTally} data-testid="tally-skip" />}
                {banner2 !== null && <LevelBanner points={banner2} onDone={() => setBanner2(null)} />}
              </>
            }
            failOnWrong={rated}
            onNext={(drill && drillSolved >= drill.count) || (mode.kind === 'dailyPuzzle' && (dailyDone || outcome)) ? pop : load}
            nextLabel={drill && drillSolved >= drill.count ? 'Back to practice' : mode.kind === 'dailyPuzzle' ? 'Done' : course && solvedInStep !== null && solvedInStep >= course.count ? 'Keep practising' : 'Next'}
            progress={
              pathSource === 'none' ? (
                <PracticeCard />
              ) : path ? (
                <LivePathCard rating={showRating ? rating : null} ratingDelta={showRating ? delta : null} onTap={tallying ? skipTally : undefined} />
              ) : null
            }
            footer={
              award?.streakLost && award.streakLost >= 3 ? (
                <p className="mt-1.5 text-xs text-stone-500">Streak of {award.streakLost} ended. Start a new one!</p>
              ) : outcome?.newPeak ? (
                <div className="mt-1.5 text-xs"><span className="chip bg-gold-300/50 text-stone-800 dark:bg-gold-500/25 dark:text-gold-300">★ Highest rating</span></div>
              ) : null
            }
          />
        )}
      </div>
      {levelUp && board.current && <LevelUpPanel key={`${levelUp.from}-${levelUp.to}`} from={levelUp.from} to={levelUp.to} board={board.current.el} instant={levelUp.instant} onTierCard={setTierCard} />}
      {tierCard !== null && <TierUpCard board={tierCard} onClose={() => setTierCard(null)} />}
    </div>
  );
}

/** Custom themes and learning mode: you pick the difficulty, so no points (they could be farmed). */
function PracticeCard() {
  const timer = useContext(PuzzleTimer);
  return (
    <div className="flex items-center justify-between px-1 text-[13px] text-stone-500" data-testid="practice-card">
      <span className="font-semibold">Practice · no points</span>
      {timer}
    </div>
  );
}
