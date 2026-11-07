import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './Board';
import { Spinner } from './ui';
import { PlayFromHere } from './PlayFromHere';
import { tryMove, type MoveInput } from '../lib/chess/game';
import { classify, povScore, winPct } from '../lib/chess/evaluation';
import { explainKeyMove, getHint } from '../lib/coach';
import type { Hint } from '../lib/coach/hints';
import { getEngine } from '../lib/engine';
import { playSound, playStep } from '../lib/sound';
import { MoveMark, SolveBurst, type SquareMark } from './PuzzleFx';
import { analysisLimits } from '../lib/engine/speed';
import type { PuzzleSpec } from '../lib/puzzles/spec';
import { themeLabel } from '../lib/puzzles/themes';
import { Check, ChevronRight, Lightbulb, RotateCcw, X } from 'lucide-react';

type State = 'intro' | 'solving' | 'wrong' | 'checking' | 'solved' | 'failed';

export interface PuzzleResult {
  success: boolean;
  hintsUsed: number;
  /** Seconds from the first possible move to the last correct one. */
  seconds: number;
}

interface Props {
  spec: PuzzleSpec;
  onFinish: (r: PuzzleResult) => void;
  onNext?: () => void;
  nextLabel?: string;
  /** Extra content under the coach bubble when finished (rating change…). */
  footer?: React.ReactNode;
  /** Puzzle Rush: no hints or explanations, a wrong move ends the puzzle, auto-advance. */
  fast?: boolean;
  /** Puzzles solved in a row before this one: notes climb higher and the final burst gets bigger. */
  combo?: number;
  /** Extra layer over the board (streak banners…). */
  overlay?: React.ReactNode;
  /** Rated puzzles: the first wrong move ends the attempt (you can still retry to learn). */
  failOnWrong?: boolean;
}

export function PuzzlePlayer({ spec, onFinish, onNext, nextLabel = 'Next puzzle', footer, fast = false, combo = 0, overlay, failOnWrong = false }: Props) {
  const startFen = useMemo(() => (spec.setup ? tryMove(spec.fen, spec.setup)!.fen : spec.fen), [spec]);
  const userColor = startFen.split(' ')[1] as 'w' | 'b';
  const [fen, setFen] = useState(spec.setup ? spec.fen : startFen);
  const [idx, setIdx] = useState(0); // index into solution of the next expected user move
  const [state, setState] = useState<State>(spec.setup ? 'intro' : 'solving');
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hints, setHints] = useState(0);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const finished = useRef(false);
  const [mark, setMark] = useState<SquareMark | null>(null);
  const [burst, setBurst] = useState<{ id: number; sq: string } | null>(null);
  const [shake, setShake] = useState(0);
  const boardBox = useRef<HTMLDivElement>(null);
  // A wrong move gives the board a little shake.
  useEffect(() => {
    if (!shake) return;
    boardBox.current?.animate(
      [{ transform: 'none' }, { transform: 'translateX(-9px) rotate(-0.6deg)' }, { transform: 'translateX(8px) rotate(0.5deg)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }],
      { duration: 450, easing: 'ease-out' },
    );
  }, [shake]);
  const startedAt = useRef(spec.setup ? 0 : Date.now());
  const correct = useRef(0);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__puzzle = spec;

  useEffect(() => {
    if (!spec.setup) return;
    const t = setTimeout(() => {
      setFen(startFen);
      setLast({ from: spec.setup!.slice(0, 2), to: spec.setup!.slice(2, 4) });
      setState('solving');
      startedAt.current = Date.now();
    }, fast ? 350 : 700);
    return () => clearTimeout(t);
  }, [spec, startFen]);

  const finish = (success: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onFinish({ success: success && !failed, hintsUsed: hints, seconds: Math.round((Date.now() - (startedAt.current || Date.now())) / 1000) });
  };

  const solvedFx = (sq: string) => {
    setBurst({ id: Date.now(), sq });
    playSound(combo >= 2 ? 'combo' : 'success');
  };

  const advance = (afterFen: string, uci: string, nextIdx: number) => {
    setFen(afterFen);
    setLast({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    setHint(null);
    setMark({ id: Date.now(), sq: uci.slice(2, 4), ok: true });
    playStep(correct.current++ + Math.min(combo, 6));
    if (nextIdx >= spec.solution.length) {
      solvedFx(uci.slice(2, 4));
      setState('solved');
      finish(true);
      if (fast) setTimeout(() => onNext?.(), 450);
      return;
    }
    // Opponent reply.
    const reply = spec.solution[nextIdx];
    setTimeout(() => {
      const r = tryMove(afterFen, reply);
      if (!r) return;
      setFen(r.fen);
      setLast({ from: reply.slice(0, 2), to: reply.slice(2, 4) });
      setIdx(nextIdx + 1);
    }, 450);
  };

  const onMove = (m: MoveInput): boolean => {
    if (state !== 'solving') return false;
    const r = tryMove(fen, m);
    if (!r) return false;
    const expected = spec.solution[idx];
    const uci = r.move.lan;
    const isLast = idx === spec.solution.length - 1;
    if (uci === expected || (isLast && r.move.san.endsWith('#'))) {
      advance(r.fen, uci, idx + 1);
      return true;
    }
    if (spec.acceptGoodAlternatives) {
      setFen(r.fen);
      setLast({ from: m.from, to: m.to });
      setState('checking');
      void checkAlternative(fen, uci, r.fen);
      return true;
    }
    wrong(r.fen, m);
    return true;
  };

  const wrong = (badFen: string, m: MoveInput) => {
    setFen(badFen);
    setLast({ from: m.from, to: m.to });
    setFailed(true);
    setState('wrong');
    playSound('error');
    setMark({ id: Date.now(), sq: m.to, ok: false });
    setShake((n) => n + 1);
    if (failOnWrong && !fast) finish(false);
    if (fast) {
      if (!finished.current) {
        finished.current = true;
        onFinish({ success: false, hintsUsed: 0, seconds: 0 });
      }
      setTimeout(() => onNext?.(), 700);
    }
  };

  const checkAlternative = async (beforeFen: string, uci: string, afterFen: string) => {
    try {
      const e = getEngine();
      const before = await e.analyze(beforeFen, { ...analysisLimits(), multipv: 3, owner: 'puzzle' });
      const after = await e.analyze(afterFen, { ...analysisLimits(), owner: 'puzzle' });
      const s0 = before.lines[0]?.score;
      const s1 = after.lines[0]?.score;
      if (s0 && s1) {
        const cls = classify(winPct(povScore(s0, userColor)), winPct(povScore(s1, userColor)), before.bestMove === uci);
        if (cls === 'best' || cls === 'good') {
          setNote('That works too! It is just as good as the move I had in mind.');
          setMark({ id: Date.now(), sq: uci.slice(2, 4), ok: true });
          solvedFx(uci.slice(2, 4));
          setState('solved');
          finish(true);
          return;
        }
      }
    } catch {
      /* fall through to wrong */
    }
    setFailed(true);
    setState('wrong');
  };

  const retry = () => {
    setFen(currentPuzzleFen());
    setLast(null);
    setState('solving');
  };

  // Position before the wrong move (replay the solution up to idx).
  const currentPuzzleFen = () => {
    let f = startFen;
    for (let i = 0; i < idx; i++) f = tryMove(f, spec.solution[i])!.fen;
    return f;
  };

  const showSolution = () => {
    setFailed(true);
    let f = currentPuzzleFen();
    const moves = spec.solution.slice(idx);
    setFen(f);
    setState('failed');
    finish(false);
    moves.forEach((u, i) => {
      setTimeout(() => {
        const r = tryMove(f, u);
        if (!r) return;
        f = r.fen;
        setFen(r.fen);
        setLast({ from: u.slice(0, 2), to: u.slice(2, 4) });
      }, 500 * (i + 1));
    });
  };

  const askHint = () => {
    const level = Math.min(3, (hint?.level ?? 0) + 1) as 1 | 2 | 3;
    const h = getHint(currentPuzzleFen(), spec.solution.slice(idx), level);
    if (h) {
      setHint(h);
      setHints((n) => n + 1);
    }
  };

  const explanation = useMemo(
    () => (state === 'solved' || state === 'failed' ? explainKeyMove(startFen, spec.solution[0], spec.solution) : null),
    [state, startFen, spec],
  );
  const done = state === 'solved' || state === 'failed';

  const side = userColor === 'w' ? 'White' : 'Black';
  const [why, setWhy] = useState(false);
  return (
    <div className="board-split">
      <div className="board-cell px-1.5">
        {!fast && (
          <div
            className={`mb-1.5 flex h-9 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${
              state === 'solved' ? 'bg-emerald-600 text-white' : state === 'wrong' || state === 'failed' ? 'bg-red-500 text-white' : userColor === 'w' ? 'bg-white text-stone-900 ring-1 ring-stone-200 dark:ring-stone-700' : 'bg-stone-900 text-white dark:bg-black'
            }`}
          >
            {state === 'solved' ? <><Check size={18} strokeWidth={3} /> Correct</> : state === 'wrong' ? <><X size={18} strokeWidth={3} /> Incorrect</> : state === 'failed' ? 'Solution' : state === 'intro' ? 'Watch the move…' : <><span className={`h-3.5 w-3.5 rounded-full shadow-sm ring-1 ${userColor === 'w' ? 'bg-white ring-stone-300' : 'bg-stone-900 ring-stone-500'}`} /> {side} to move</>}
          </div>
        )}
        <div ref={boardBox} className="relative">
        {mark && <MoveMark key={mark.id} mark={mark} orientation={userColor === 'w' ? 'white' : 'black'} />}
        {burst && <SolveBurst key={burst.id} id={burst.id} sq={burst.sq} power={combo + 1} orientation={userColor === 'w' ? 'white' : 'black'} />}
        {overlay}
        <Board
          fen={fen}
          orientation={userColor === 'w' ? 'white' : 'black'}
          movable={state === 'solving' ? userColor : null}
          onMove={onMove}
          lastMove={last}
          arrows={done ? [] : (hint?.arrows ?? [])}
          highlights={hint?.highlights ?? []}
        />
        </div>
      </div>
      {fast ? (
        <div className="px-3 pt-2 text-center text-sm font-semibold text-stone-500">
          {state === 'solving' ? `${side} to move` : state === 'wrong' ? 'Missed' : state === 'solved' ? 'Solved' : '…'}
        </div>
      ) : (
      <div className="space-y-2 px-3 pt-2">
        {/* Status panel: steady height, the result lands here. */}
        <div className={`card min-h-[104px] !p-3 ${state === 'solved' ? 'ring-2 ring-emerald-500/60' : state === 'wrong' || state === 'failed' ? 'ring-2 ring-red-400/60' : ''}`}>
          {state === 'intro' && <p className="text-stone-500">Your opponent moves first…</p>}
          {state === 'solving' && (
            <>
              <p className="font-semibold">Your turn</p>
              <p className="text-[15px] text-stone-600 dark:text-stone-300">{hint ? hint.text : spec.kind === 'mistake' ? `In your game you played ${spec.playedSan}. Find a better move for ${side}.` : `Find the best move for ${side}.`}</p>
            </>
          )}
          {state === 'checking' && <p className="flex items-center gap-2"><Spinner /> Checking that move…</p>}
          {state === 'wrong' && (
            <>
              <p className="flex items-center gap-2 text-lg font-bold text-red-600"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white"><X size={17} strokeWidth={3} /></span> Incorrect</p>
              <p className="mt-1 text-[15px]">That's not the best move. {failOnWrong ? 'Retry to learn it, or see the solution.' : 'Try again!'}</p>
              {footer}
            </>
          )}
          {done && (
            <>
              <p className={`flex items-center gap-2 text-lg font-bold ${state === 'solved' ? 'text-emerald-600' : 'text-red-600'}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${state === 'solved' ? 'bg-emerald-600' : 'bg-red-500'}`}>{state === 'solved' ? <Check size={17} strokeWidth={3} /> : <X size={17} strokeWidth={3} />}</span>
                {state === 'solved' ? (failed || hints ? 'Solved, with help' : 'Correct!') : 'Solution'}
              </p>
              {note && <p className="mt-1 text-[15px]">{note}</p>}
              {footer}
              {explanation && (
                <button className="mt-1.5 text-left text-sm text-stone-600 dark:text-stone-300" onClick={() => setWhy(!why)}>
                  {why ? explanation.text.join(' ') : <><span className="font-semibold text-brand-700 dark:text-brand-500">Why it works ›</span> <span className="text-stone-400">{explanation.text[0]?.slice(0, 60)}…</span></>}
                </button>
              )}
              {why && spec.kind === 'mistake' && spec.explanation?.length ? <p className="mt-1 text-sm text-stone-500">In the game: {spec.explanation[0]}</p> : null}
            </>
          )}
        </div>
        {/* Actions */}
        <div className="flex gap-2">
          {state === 'solving' && (
            <>
              <button className="btn-secondary flex-1" disabled={hint?.level === 3} onClick={askHint}>
                <Lightbulb size={16} /> {hint ? `Hint ${hint.level}/3` : 'Hint'}
              </button>
              <button className="btn-secondary flex-1" onClick={showSolution}>Solution</button>
            </>
          )}
          {state === 'wrong' && (
            <>
              <button className="btn-primary flex-1" onClick={retry}><RotateCcw size={16} /> Retry</button>
              <button className="btn-secondary flex-1" onClick={showSolution}>Solution</button>
              {failOnWrong && onNext && <button className="btn-secondary flex-1" onClick={onNext}>Next</button>}
            </>
          )}
          {done && (
            <>
              <PlayFromHere fen={startFen} color={userColor} label="Play it out" />
              {onNext && <button className="btn-primary flex-1 !py-3 text-base" onClick={onNext}>{nextLabel} <ChevronRight size={18} /></button>}
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {spec.label && <span className="chip bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">{spec.label}</span>}
          {done && spec.rating ? <span className="chip bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Puzzle {spec.rating}</span> : null}
          {done && spec.themes.filter((t) => themeLabel(t) !== t).slice(0, 3).map((t) => (
            <span key={t} className="chip bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100">{themeLabel(t)}</span>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
