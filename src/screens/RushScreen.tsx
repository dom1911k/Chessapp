import { useEffect, useRef, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { PuzzlePlayer } from '../components/PuzzlePlayer';
import { Header, Segmented, Spinner } from '../components/ui';
import type { RushMode } from '../lib/nav';
import { bumpActivity, kvGet, kvSet } from '../lib/db';
import { nextPuzzle } from '../lib/puzzles/select';
import { fromLichess, type PuzzleSpec } from '../lib/puzzles/spec';
import { progress } from '../lib/progress';

const STRIKES = 3;
const START_RATING = 600;
const STEP = 40;
/** Seconds per mode; Survival has no clock (three strikes only). */
const DURATION: Record<RushMode, number> = { '3': 180, '5': 300, survival: Infinity };
export const RUSH_LABEL: Record<RushMode, string> = { '3': '3 min', '5': '5 min', survival: 'Survival' };
/** The 3-minute best keeps its old key, so old records stay. */
export const rushBestKey = (m: RushMode) => (m === '3' ? 'rushBest' : `rushBest:${m}`);

type Phase = 'intro' | 'running' | 'done';

/** Puzzle Rush: solve as many puzzles as you can in 3 minutes; 3 mistakes end the run. */
export function RushScreen({ mode: initial = '3' }: { mode?: RushMode }) {
  const [mode, setMode] = useState<RushMode>(initial);
  const BEST_KEY = rushBestKey(mode);
  const [phase, setPhase] = useState<Phase>('intro');
  const [spec, setSpec] = useState<PuzzleSpec | null>(null);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(DURATION[mode]);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const rating = useRef(START_RATING);
  const seen = useRef(new Set<string>());
  const ended = useRef(false);

  useEffect(() => {
    void kvGet(BEST_KEY, 0).then(setBest);
  }, [BEST_KEY]);

  useEffect(() => {
    if (phase !== 'running' || mode === 'survival') return;
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
    setLeft(DURATION[mode]);
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
    if (score > 0) await progress({ kind: 'rush', solved: score });
  };

  const mm = String(Math.floor(Math.max(0, left) / 60));
  const ss = String(Math.max(0, left) % 60).padStart(2, '0');

  return (
    <div className="flex h-full flex-col">
      <Header
        title={`Puzzle Rush · ${RUSH_LABEL[mode]}`}
        back
        right={
          phase === 'running' ? (
            <div className="flex items-center gap-3 pr-2 text-sm font-bold">
              <span>{'✗'.repeat(misses)}{'○'.repeat(STRIKES - misses)}</span>
              {mode !== 'survival' && <span className={left <= 20 ? 'text-red-600' : ''}>⏱ {mm}:{ss}</span>}
              <span className="text-brand-600">{score}</span>
            </div>
          ) : null
        }
      />
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-4 land:max-w-6xl">
        {phase === 'intro' && (
          <div className="space-y-4 p-4">
            <Segmented value={mode} onChange={setMode} options={(['3', '5', 'survival'] as RushMode[]).map((m) => ({ value: m, label: RUSH_LABEL[m] }))} />
            <div className="card flex flex-col items-center gap-1 !p-6 text-center">
              <span className="text-5xl">{mode === 'survival' ? '🛡️' : '⚡'}</span>
              <span className="font-display text-2xl font-semibold">Puzzle Rush · {RUSH_LABEL[mode]}</span>
              <span className="text-sm text-stone-500">{mode === 'survival' ? 'No clock. Puzzles get harder and harder — three mistakes and you are out.' : `Solve as many as you can in ${mode} minutes. They start easy and get harder. Three mistakes end the run.`}</span>
              <span className="mt-2 text-sm">Your best: <b className="text-lg">{best}</b></span>
              <button className="btn-primary mt-3 w-full !py-3.5 text-lg" onClick={() => void start()}>Start</button>
            </div>
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
              <p>{newBest ? `New personal best in ${RUSH_LABEL[mode]}!` : `Your best in ${RUSH_LABEL[mode]} is ${best}.`}</p>
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
