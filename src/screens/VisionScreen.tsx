// Vision trainer: learn the board's coordinates by heart, like chess.com's Vision. Two modes:
// "Find" — a square's name appears, tap it; "Name" — a square lights up, pick its name. 30 seconds,
// as White or as Black, with your best score per mode and side.
import { useEffect, useRef, useState } from 'react';
import { Eye, Play, RotateCcw, Trophy } from 'lucide-react';
import { Header, Segmented } from '../components/ui';
import { BOARD_THEMES, useSettings } from '../lib/settings';
import { kvGet, kvSet } from '../lib/db';
import { playSound } from '../lib/sound';
import { useCelebrate } from '../lib/celebrate';
import { bestKey, cellOf, nameOptions, nextSquare, ROUND_SECS, squareAt, type VisionMode, type VisionSide } from '../lib/vision';

type Phase = 'ready' | 'playing' | 'done';

export function VisionScreen() {
  const theme = useSettings((s) => BOARD_THEMES[s.boardTheme] ?? BOARD_THEMES.green);
  const [mode, setMode] = useState<VisionMode>('find');
  const [sidePick, setSidePick] = useState<VisionSide | 'random'>('white');
  const [coords, setCoords] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [side, setSide] = useState<VisionSide>('white');
  const [target, setTarget] = useState('e4');
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(ROUND_SECS);
  const [flash, setFlash] = useState<{ sq: string; ok: boolean } | null>(null);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const endsAt = useRef(0);

  const bestSide: VisionSide = sidePick === 'random' ? 'white' : sidePick;
  useEffect(() => void kvGet<number>(bestKey(mode, bestSide), 0).then(setBest), [mode, bestSide, phase]);

  const pickNext = (last?: string) => {
    const sq = nextSquare(Math.random, last);
    setTarget(sq);
    setOptions(nameOptions(sq, Math.random));
  };

  const start = () => {
    setSide(sidePick === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : sidePick);
    setScore(0);
    setMisses(0);
    setNewBest(false);
    setLeft(ROUND_SECS);
    pickNext();
    endsAt.current = Date.now() + ROUND_SECS * 1000;
    setPhase('playing');
  };

  // The round clock.
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      const s = Math.max(0, (endsAt.current - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) setPhase('done');
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  // Round over: save the best (only for a fixed side, so the records stay comparable).
  useEffect(() => {
    if (phase !== 'done') return;
    playSound('gameEnd');
    if (sidePick !== 'random' && score > best) {
      setNewBest(true);
      setBest(score);
      void kvSet(bestKey(mode, sidePick), score);
      if (score >= 5) useCelebrate.getState().confetti({ force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const answer = (sq: string) => {
    if (phase !== 'playing') return;
    const ok = sq === target;
    setFlash({ sq: mode === 'find' ? sq : target, ok });
    setTimeout(() => setFlash(null), 260);
    if (ok) {
      setScore((x) => x + 1);
      playSound('move');
      pickNext(target);
    } else {
      setMisses((x) => x + 1);
      playSound('illegal');
    }
  };

  const shown = phase === 'playing' ? side : sidePick === 'black' ? 'black' : 'white';
  const targetCell = cellOf(target, shown);

  return (
    <div className="flex h-full flex-col">
      <Header title="Vision" back subtitle="Learn the board by heart" />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4">
        {/* Status bar: what to find, score and time */}
        <div className="card flex items-center gap-3 !px-4 !py-3">
          {phase === 'playing' ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold tracking-wider text-stone-500 uppercase">{mode === 'find' ? 'Tap the square' : 'Which square is lit?'}</div>
                {mode === 'find' ? <div key={target} className="font-display animate-pop text-[34px] leading-none font-semibold">{target}</div> : <div className="text-sm text-stone-500">Pick its name below</div>}
              </div>
              <div className="text-right">
                <div className="font-display text-[28px] leading-none font-semibold tabular-nums">{score}</div>
                <div className="text-[11px] text-stone-500">{misses ? `${misses} miss${misses === 1 ? '' : 'es'}` : 'correct'}</div>
              </div>
            </>
          ) : phase === 'done' ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold tracking-wider text-stone-500 uppercase">Time’s up</div>
                <div className="font-display text-[30px] leading-none font-semibold">{score} <span className="text-base font-normal text-stone-500">correct</span></div>
                <div className="mt-0.5 text-xs text-stone-500">{misses ? `${misses} wrong · ${Math.round((score / Math.max(1, score + misses)) * 100)}% right` : 'No mistakes!'}</div>
              </div>
              {newBest ? <span className="chip bg-gold-300/40 text-stone-800 ring-1 ring-gold-400/60 dark:text-gold-300"><Trophy size={13} /> New best</span> : <span className="text-right text-xs text-stone-500">Best<br /><b className="text-base text-stone-800 tabular-nums dark:text-stone-100">{best}</b></span>}
            </>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"><Eye size={22} /></span>
              <div className="min-w-0 flex-1 text-sm leading-snug">
                {mode === 'find' ? 'A square’s name appears — tap it on the board as fast as you can.' : 'A square lights up — pick its name.'} {ROUND_SECS} seconds.
              </div>
              <span className="text-right text-xs text-stone-500">Best<br /><b className="text-base text-stone-800 tabular-nums dark:text-stone-100">{best}</b></span>
            </>
          )}
        </div>
        {phase === 'playing' && (
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
            <div className={`h-full rounded-full transition-[width] duration-100 ease-linear ${left < 6 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${(left / ROUND_SECS) * 100}%` }} />
          </div>
        )}

        {/* The board */}
        <div className="relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden rounded-[8px] shadow-[0_10px_30px_-12px_rgba(40,20,5,0.45)]">
          <div className="grid h-full w-full grid-cols-8 grid-rows-8">
            {Array.from({ length: 64 }, (_, i) => {
              const row = Math.floor(i / 8);
              const col = i % 8;
              const sq = squareAt(row, col, shown);
              const light = (row + col) % 2 === 0;
              const isFlash = flash?.sq === sq;
              const lit = mode === 'name' && phase === 'playing' && row === targetCell.row && col === targetCell.col;
              return (
                <button
                  key={sq}
                  aria-label={sq}
                  disabled={phase !== 'playing' || mode !== 'find'}
                  onPointerDown={() => mode === 'find' && answer(sq)}
                  className="relative"
                  style={{ background: light ? theme.lightBg ?? theme.light : theme.darkBg ?? theme.dark }}
                >
                  {lit && <span className="animate-pop absolute inset-[10%] rounded-md bg-brand-500/80 ring-2 ring-white/80" />}
                  {isFlash && <span className={`absolute inset-0 ${flash!.ok ? 'bg-emerald-500/55' : 'bg-red-500/55'}`} />}
                  {(coords || phase !== 'playing') && (
                    <>
                      {col === 0 && <span className="absolute top-0.5 left-1 text-[10px] font-bold opacity-60" style={{ color: light ? theme.dark : theme.light }}>{sq[1]}</span>}
                      {row === 7 && <span className="absolute right-1 bottom-0 text-[10px] font-bold opacity-60" style={{ color: light ? theme.dark : theme.light }}>{sq[0]}</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Answers for "name the square" */}
        {phase === 'playing' && mode === 'name' && (
          <div className="grid grid-cols-4 gap-2">
            {options.map((o) => (
              <button key={o} className="btn-secondary !py-3 text-lg font-bold tracking-wide" onClick={() => answer(o)}>
                {o}
              </button>
            ))}
          </div>
        )}

        {/* Setup */}
        {phase !== 'playing' && (
          <div className="space-y-2.5">
            <Segmented value={mode} onChange={setMode} options={[{ value: 'find', label: 'Find the square' }, { value: 'name', label: 'Name the square' }]} />
            <Segmented
              value={sidePick}
              onChange={setSidePick}
              options={[
                { value: 'white', label: 'As White' },
                { value: 'black', label: 'As Black' },
                { value: 'random', label: 'Random' },
              ]}
            />
            <label className="flex items-center justify-between px-1 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Show coordinates while playing</span>
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand-600)]" checked={coords} onChange={(e) => setCoords(e.target.checked)} />
            </label>
            <button className="btn-primary w-full !py-3.5 text-base" onClick={start}>
              {phase === 'done' ? <><RotateCcw size={18} /> Play again</> : <><Play size={18} /> Start</>}
            </button>
            {sidePick === 'random' && <p className="text-center text-xs text-stone-500">Random side rounds don’t count towards your best.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
