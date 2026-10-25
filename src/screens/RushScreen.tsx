import { useEffect, useRef, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { PuzzlePlayer } from '../components/PuzzlePlayer';
import { Header, Spinner } from '../components/ui';
import { bumpActivity, kvGet, kvSet } from '../lib/db';
import { nextPuzzle } from '../lib/puzzles/select';
import { fromLichess, type PuzzleSpec } from '../lib/puzzles/spec';

const DURATION = 180;
const STRIKES = 3;
const START_RATING = 600;
const STEP = 40;
const BEST_KEY = 'rushBest';

type Phase = 'intro' | 'running' | 'done';

/** Puzzle Rush: solve as many puzzles as you can in 3 minutes; 3 mistakes end the run. */
export function RushScreen() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [spec, setSpec] = useState<PuzzleSpec | null>(null);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const rating = useRef(START_RATING);
  const seen = useRef(new Set<string>());
  const ended = useRef(false);

  useEffect(() => {
    void kvGet(BEST_KEY, 0).then(setBest);
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'running' && (left <= 0 || misses >= STRIKES)) void end();
  });

  const load = async () => {
    for (let k = 0; k < 5; k++) {
      const p = await nextPuzzle(undefined, rating.current);
      if (p && !seen.current.has(p.id)) {
        seen.current.add(p.id);
        setSpec(fromLichess(p));
        setN((x) => x + 1);
        return;
      }
    }
  };

  const start = async () => {
    rating.current = START_RATING;
    seen.current.clear();
    setScore(0);
    setMisses(0);
    setLeft(DURATION);
    setNewBest(false);
    ended.current = false;
    await load();
    setPhase('running');
  };

  const end = async () => {
    if (ended.current) return;
    ended.current = true;
    setPhase('done');
    if (score > 0) await bumpActivity('puzzles', score);
    if (score > best) {
      setBest(score);
      setNewBest(true);
      await kvSet(BEST_KEY, score);
    }
  };

  const mm = String(Math.floor(Math.max(0, left) / 60));
  const ss = String(Math.max(0, left) % 60).padStart(2, '0');

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Puzzle Rush"
        back
        right={
          phase === 'running' ? (
            <div className="flex items-center gap-3 pr-2 text-sm font-bold">
              <span>{'✗'.repeat(misses)}{'○'.repeat(STRIKES - misses)}</span>
              <span className={left <= 20 ? 'text-red-600' : ''}>⏱ {mm}:{ss}</span>
              <span className="text-brand-600">{score}</span>
            </div>
          ) : null
        }
      />
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-4">
        {phase === 'intro' && (
          <div className="space-y-4 p-4">
            <CoachBubble actions={<button className="btn-primary !px-6 !py-3 text-base" onClick={() => void start()}>Start</button>}>
              <p className="font-semibold">⚡ Solve as many puzzles as you can in 3 minutes.</p>
              <p>They start easy and get harder. Three mistakes and the run is over. No hints — trust your eyes!</p>
              <p className="text-sm text-stone-500">Your best: {best}</p>
            </CoachBubble>
          </div>
        )}
        {phase === 'running' &&
          (spec ? (
            <PuzzlePlayer
              key={spec.id + n}
              spec={spec}
              fast
              onFinish={(r) => {
                if (r.success) {
                  setScore((x) => x + 1);
                  rating.current += STEP;
                } else setMisses((x) => x + 1);
              }}
              onNext={() => void load()}
            />
          ) : (
            <div className="flex justify-center p-10"><Spinner /></div>
          ))}
        {phase === 'done' && (
          <div className="space-y-4 p-4">
            <CoachBubble actions={<button className="btn-primary" onClick={() => void start()}>Try again</button>}>
              <p className="text-2xl font-bold">{score} solved</p>
              <p>{newBest ? '🎉 New personal best!' : `Your best is ${best}.`}</p>
              <p className="text-sm text-stone-500">
                {misses >= STRIKES ? 'Three mistakes ended the run. ' : "Time's up. "}
                Speed comes from recognising patterns — the more puzzles you solve, the faster you get.
              </p>
            </CoachBubble>
          </div>
        )}
      </div>
    </div>
  );
}
