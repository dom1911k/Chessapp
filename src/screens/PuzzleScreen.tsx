import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async () => {
    setSpec(null);
    setOutcome(null);
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
    setStreak((s) => (r.success ? s + 1 : 0));
  };

  const delta = outcome?.ratingAfter !== undefined && outcome.ratingBefore !== undefined ? outcome.ratingAfter - outcome.ratingBefore : null;

  return (
    <div className="flex h-full flex-col">
      <Header
        title={drill ? `${drill.label} · ${Math.min(drillSolved, drill.count)}/${drill.count}` : course ? `${course.label}${solvedInStep !== null ? ` · ${Math.min(solvedInStep, course.count)}/${course.count}` : ''}` : theme ? themeLabel(theme) : 'Rated puzzles'}
        back
        right={
          <div className="pr-2 text-right text-sm leading-tight">
            <div className="font-bold">{rating ?? '…'}</div>
            <div className="text-xs text-stone-500">{streak > 1 ? `${streak} in a row` : 'your rating'}</div>
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
            onNext={drill && drillSolved >= drill.count ? pop : load}
            nextLabel={drill && drillSolved >= drill.count ? 'Back to practice' : course && solvedInStep !== null && solvedInStep >= course.count ? 'Keep practising' : 'Next puzzle'}
            footer={
              <p className="text-sm font-semibold">
                {delta !== null && (
                  <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    Rating {delta >= 0 ? '+' : ''}
                    {delta} → {outcome!.ratingAfter}
                  </span>
                )}
                {outcome?.xp ? <span className="ml-2 text-amber-600">+{outcome.xp} XP</span> : null}
              </p>
            }
          />
        )}
      </div>
    </div>
  );
}
