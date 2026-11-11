import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './Board';
import { Spinner } from './ui';
import { CoachAvatar } from './Coach';
import { useNav } from '../lib/nav';
import { tryMove, type MoveInput } from '../lib/chess/game';
import { classify, povScore, winPct } from '../lib/chess/evaluation';
import { explainKeyMove, getHint } from '../lib/coach';
import { Dock, DockButton, DockMain } from './Dock';
import type { Hint } from '../lib/coach/hints';
import { getEngine } from '../lib/engine';
import { playSound, playStep } from '../lib/sound';
import { MoveMark, SolveBurst, type SquareMark } from './PuzzleFx';
import { SolveTags } from './PuzzleProgress';
import { solvePrompt, solvedPrompt, type SolveTag } from '../lib/puzzles/level';
import { analysisLimits } from '../lib/engine/speed';
import type { PuzzleSpec } from '../lib/puzzles/spec';
import { themeLabel } from '../lib/puzzles/themes';
import { Check, ChevronRight, Eye, Lightbulb, Microscope, RotateCcw, Timer, X } from 'lucide-react';

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
  /** The progression row (rating, bar, level) under the coach bubble. */
  progress?: React.ReactNode;
  /** Tags that pop on the solved square, one after another ("Hard +8", "Speed +3"). */
  tags?: SolveTag[];
  /** Solved in how many puzzles in a row (for the coach's line). */
  solvedStreak?: number;
  /** Puzzle Rush: no hints or explanations, a wrong move ends the puzzle, auto-advance. */
  fast?: boolean;
  /** Puzzles solved in a row before this one: notes climb higher and the final burst gets bigger. */
  combo?: number;
  /** Extra layer over the board (streak banners…). */
  overlay?: React.ReactNode;
  /** Rated puzzles: the first wrong move ends the attempt (you can still retry to learn). */
  failOnWrong?: boolean;
}

export function PuzzlePlayer({ spec, onFinish, onNext, nextLabel = 'Next puzzle', footer, progress, tags = [], solvedStreak = 0, fast = false, combo = 0, overlay, failOnWrong = false }: Props) {
  const push = useNav((n) => n.push);
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
  // Live timer while solving; frozen once done.
  const [secs, setSecs] = useState(0);
  const [lightning, setLightning] = useState(false);
  useEffect(() => {
    if (state !== 'solving' && state !== 'wrong' && state !== 'checking') return;
    const t = setInterval(() => startedAt.current && setSecs(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [state]);
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
    const seconds = Math.round((Date.now() - (startedAt.current || Date.now())) / 1000);
    const userMoves = Math.ceil(spec.solution.length / 2);
    setLightning(success && !failed && hints === 0 && seconds > 0 && seconds <= 8 + 6 * (userMoves - 1));
    onFinish({ success: success && !failed, hintsUsed: hints, seconds });
  };

  const solvedFx = (sq: string) => {
    setBurst({ id: Date.now(), sq });
    playSound(combo >= 2 ? 'combo' : 'success');
  };

  const advance = (afterFen: string, uci: string, nextIdx: number) => {
    setFen(afterFen);
    setLast({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    setHint(null);
    const final = nextIdx >= spec.solution.length;
    setMark({ id: Date.now(), sq: uci.slice(2, 4), ok: true, stay: final });
    playStep(correct.current++ + Math.min(combo, 6));
    if (final) {
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
          setMark({ id: Date.now(), sq: uci.slice(2, 4), ok: true, stay: true });
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

  const again = () => {
    setFailed(false); setHints(0); setHint(null); setMark(null); setBurst(null); setIdx(0); setFen(startFen); setLast(null); setWhy(false);
    startedAt.current = Date.now(); setSecs(0); setState('solving');
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
  const clean = !failed && hints === 0;
  const solvedSq = state === 'solved' && mark?.ok ? mark.sq : null;
  const tagMs = state === 'solved' ? tags.length * 1050 : 0;
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const orientation = userColor === 'w' ? 'white' : 'black';

  const bubble = (() => {
    if (state === 'intro') return { head: 'Watch the move…', text: 'Your opponent moves first.', tone: 'neutral' as const };
    if (state === 'checking') return { head: 'Checking…', text: 'Let me look at that move.', tone: 'neutral' as const };
    if (state === 'solving')
      return {
        head: `${side} to move`,
        text: hint ? hint.text : spec.kind === 'mistake' ? `In your game you played ${spec.playedSan}. Find a better move.` : solvePrompt(spec.themes, side, spec.id),
        tone: 'neutral' as const,
      };
    if (state === 'wrong') return { head: 'Not quite', text: failOnWrong ? 'That isn’t it. Retry to learn it, or see the solution.' : 'That’s not the best move. Try again!', tone: 'bad' as const };
    if (state === 'failed') return { head: 'Solution', text: 'Watch how it goes — then it’s yours.', tone: 'bad' as const };
    return { head: 'Solved', text: note ?? solvedPrompt({ clean, lightning, streak: solvedStreak, seed: spec.id }), tone: 'good' as const };
  })();

  return (
    <div className="board-split flex min-h-full flex-col">
      <div className="board-cell px-1.5">
        <div ref={boardBox} className="relative rounded-[6px]">
          {mark && <MoveMark key={mark.id} mark={mark} orientation={orientation} delayMs={mark.stay ? tagMs : 0} />}
          {burst && <SolveBurst key={burst.id} id={burst.id} sq={burst.sq} power={combo + 1} orientation={orientation} />}
          {solvedSq && tags.length > 0 && <SolveTags key={`t${burst?.id ?? 0}`} id={burst?.id ?? 0} sq={solvedSq} orientation={orientation} tags={tags} />}
          {overlay}
          <Board
            fen={fen}
            orientation={orientation}
            movable={state === 'solving' ? userColor : null}
            onMove={onMove}
            lastMove={last}
            arrows={done ? [] : (hint?.arrows ?? [])}
            highlights={hint?.highlights ?? []}
          />
        </div>
      </div>
      {fast ? (
        <div className="px-3 pt-2 text-center section-title">
          {state === 'solving' ? `${side} to move` : state === 'wrong' ? 'Missed' : state === 'solved' ? 'Solved' : '…'}
        </div>
      ) : (
        <div className="space-y-2.5 px-3 pt-2.5">
          {/* Coach Sam: whose move, then the verdict. Steady height so nothing jumps. */}
          <div className="flex items-start gap-2.5">
            <CoachAvatar mood={bubble.tone === 'bad' ? 'concerned' : bubble.tone === 'neutral' && state !== 'solving' ? 'thinking' : 'happy'} size={38} />
            <div key={bubble.head} className={`card animate-pop min-h-[72px] min-w-0 flex-1 !rounded-[18px] !rounded-tl-md !px-3.5 !py-2.5 transition-shadow ${bubble.tone === 'good' ? 'ring-emerald-500/50' : bubble.tone === 'bad' ? 'ring-red-400/50' : ''}`}>
              <p className="flex items-center gap-2 font-semibold">
                {bubble.tone === 'good' ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={13} strokeWidth={3.5} /></span>
                ) : bubble.tone === 'bad' ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"><X size={13} strokeWidth={3.5} /></span>
                ) : state === 'checking' ? (
                  <Spinner className="!h-4 !w-4" />
                ) : (
                  <span className={`h-4 w-4 rounded-[4px] ring-1 ${userColor === 'w' ? 'bg-white ring-stone-400' : 'bg-stone-900 ring-stone-500'}`} />
                )}
                <span className={bubble.tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : bubble.tone === 'bad' ? 'text-red-600' : ''}>{bubble.head}</span>
                {hint && state === 'solving' && <span className="ml-auto text-xs font-semibold text-amber-600">Hint {hint.level}/3</span>}
              </p>
              <p className="mt-0.5 text-[14.5px] leading-snug text-stone-700 dark:text-stone-200">{bubble.text}</p>
              {done && explanation && (
                <button className="mt-1.5 block text-left text-[13px] leading-snug text-stone-600 dark:text-stone-300" onClick={() => setWhy(!why)}>
                  {why ? explanation.text.join(' ') : <><span className="font-semibold text-brand-700 dark:text-brand-500">Why it works ›</span> <span className="text-stone-400">{explanation.text[0]?.slice(0, 48)}…</span></>}
                </button>
              )}
              {why && spec.kind === 'mistake' && spec.explanation?.length ? <p className="mt-1 text-[13px] text-stone-500">In the game: {spec.explanation[0]}</p> : null}
              {footer}
            </div>
          </div>

          {/* Rating, bar and level */}
          {progress}

          {/* Timer */}
          <div className={`flex items-center gap-1 pl-1 text-sm font-semibold tabular-nums ${done && lightning ? 'text-sky-600' : 'text-stone-500'}`}>
            <Timer size={15} /> {fmt(secs)}
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
      {!fast && (
        <Dock sticky>
          {state === 'solving' && (
            <>
              <DockButton label={hint ? `Hint ${hint.level}/3` : 'Hint'} icon={<Lightbulb size={22} />} primary disabled={hint?.level === 3} onClick={askHint} />
              <DockMain quiet onClick={showSolution}><Eye size={17} /> Solution</DockMain>
            </>
          )}
          {state === 'checking' && <DockMain disabled onClick={() => {}}>…</DockMain>}
          {state === 'wrong' && (
            <>
              <DockButton label="Solution" icon={<Eye size={22} />} onClick={showSolution} />
              {failOnWrong && onNext && <DockButton label="Skip" icon={<ChevronRight size={22} />} onClick={onNext} />}
              <DockMain onClick={retry}><RotateCcw size={17} /> Retry</DockMain>
            </>
          )}
          {done && (
            <>
              <DockButton label="Again" ariaLabel="Try the puzzle again" icon={<RotateCcw size={22} />} onClick={again} />
              <DockButton label="Analyse" ariaLabel="Analyse this position" icon={<Microscope size={22} />} onClick={() => push({ name: 'explore', fen: startFen, orientation, title: 'Puzzle analysis' })} />
              {onNext && <DockMain onClick={onNext}>{nextLabel} <ChevronRight size={18} /></DockMain>}
            </>
          )}
        </Dock>
      )}
    </div>
  );
}
