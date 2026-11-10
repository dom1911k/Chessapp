import { useEffect, useRef, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { PuzzlePlayer } from '../components/PuzzlePlayer';
import { Header, Segmented, Spinner } from '../components/ui';
import type { RushMode } from '../lib/nav';
import { bumpActivity, kvGet, kvSet } from '../lib/db';
import { nextPuzzle } from '../lib/puzzles/select';
import { fromLichess, type PuzzleSpec } from '../lib/puzzles/spec';
import { progress } from '../lib/progress';
import { CountUp, FillBar } from '../components/Reward';
import { useCelebrate } from '../lib/celebrate';
import { playSound } from '../lib/sound';
import { Trophy } from 'lucide-react';

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
  const [prevBest, setPrevBest] = useState(0);
  const [plus, setPlus] = useState(0);
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
    setPrevBest(best);
    if (score > best) {
      setBest(score);
      setNewBest(true);
      await kvSet(BEST_KEY, score);
      setTimeout(() => {
        playSound('reward');
        useCelebrate.getState().confetti({ force: true });
      }, 1100);
    }
    if (score > 0) await progress({ kind: 'rush', solved: score });
  };

  const mm = String(Math.floor(Math.max(0, left) / 60));
  const ss = String(Math.max(0, left) % 60).padStart(2, '0');

  return (
    <div className="flex h-full flex-col">
      <Header
        title={phase === 'running' ? 'Rush' : `Puzzle Rush · ${RUSH_LABEL[mode]}`}
        back
        right={
          phase === 'running' ? (
            <div className="flex items-center gap-3 pr-2 text-sm font-bold">
              <span className="flex gap-1" aria-label={`${misses} of ${STRIKES} mistakes`}>
                {Array.from({ length: STRIKES }, (_, k) => (
                  <span key={k + (k < misses ? 'x' : 'o')} className={`h-3 w-3 rounded-full ${k < misses ? 'animate-count-pop bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.25)]' : 'bg-stone-300 dark:bg-stone-700'}`} />
                ))}
              </span>
              {mode !== 'survival' && <span className={`tabular-nums ${left <= 10 ? 'animate-urgent text-red-600' : left <= 20 ? 'text-red-600' : ''}`}>{mm}:{ss}</span>}
              <span className="relative">
                <span key={score} className="animate-count-pop font-display inline-block min-w-[1.6ch] text-center text-xl text-brand-600 tabular-nums dark:text-brand-500">{score}</span>
                {plus > 0 && <span key={plus} className="animate-float-up pointer-events-none absolute -top-4 -right-3 text-[11px] font-black text-emerald-500">+1</span>}
              </span>
            </div>
          ) : null
        }
      />
      {phase === 'running' && mode !== 'survival' && (
        <div className="mx-auto w-full max-w-xl px-3 pb-1.5 land:max-w-6xl">
          <div className={`h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10 ${left <= 10 ? 'animate-urgent' : ''}`}>
            <div
              className={`h-full origin-left rounded-full transition-[transform,background-color] duration-1000 ease-linear ${left <= 10 ? 'bg-red-500' : left <= 30 ? 'bg-amber-500' : 'bg-brand-500'}`}
              style={{ transform: `scaleX(${Math.max(0, left) / DURATION[mode]})` }}
            />
          </div>
        </div>
      )}
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
                  setPlus((x) => x + 1);
                  rating.current += STEP;
                } else setMisses((x) => x + 1);
              }}
              onNext={() => void load()}
            />
          ) : (
            <div className="flex justify-center p-10"><Spinner /></div>
          ))}
        {phase === 'done' && (
          <div className="space-y-3 p-4">
            <div className={`card flex flex-col items-center !p-6 text-center ${newBest ? 'ring-2 !ring-gold-400/70' : ''}`}>
              <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase">{misses >= STRIKES ? 'Three strikes' : "Time's up"}</span>
              <CountUp from={0} to={score} ms={Math.min(1400, 300 + score * 60)} delay={200} className={`font-display mt-1 text-[64px] leading-none font-semibold ${newBest ? 'text-gold-500' : ''}`} />
              <span className="text-sm text-stone-500">puzzles solved</span>
              <div className="mt-4 w-full">
                <div className="mb-1 flex justify-between text-xs text-stone-500">
                  <span>Best {prevBest}</span>
                  {newBest && <span className="animate-reveal flex items-center gap-1 font-bold text-gold-500" style={{ animationDelay: '1100ms' }}><Trophy size={13} /> New best!</span>}
                </div>
                <FillBar from={0} to={Math.min(1, score / Math.max(1, prevBest, score))} delay={200} ms={1100} className="h-2.5" fill={newBest ? 'bg-gradient-to-r from-amber-300 to-gold-500' : 'bg-gradient-to-r from-lime-400 to-emerald-500'} />
              </div>
            </div>
            <CoachBubble actions={<button className="btn-primary" onClick={() => void start()}>Try again</button>}>
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {newBest ? `A new personal best in ${RUSH_LABEL[mode]} — ${score - prevBest} more than before.` : prevBest - score <= 2 ? `So close — ${prevBest - score === 0 ? 'you tied' : `${prevBest - score} short of`} your best.` : `Your best in ${RUSH_LABEL[mode]} is ${best}.`} Speed comes from recognising patterns — the more you solve, the faster you get.
              </p>
            </CoachBubble>
          </div>
        )}
      </div>
    </div>
  );
}
