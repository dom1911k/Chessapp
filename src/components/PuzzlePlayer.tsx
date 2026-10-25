import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './Board';
import { CoachBubble } from './Coach';
import { Spinner } from './ui';
import { PlayFromHere } from './PlayFromHere';
import { tryMove, type MoveInput } from '../lib/chess/game';
import { classify, povScore, winPct } from '../lib/chess/evaluation';
import { explainKeyMove, getHint } from '../lib/coach';
import type { Hint } from '../lib/coach/hints';
import { getEngine } from '../lib/engine';
import { playSound } from '../lib/sound';
import { analysisLimits } from '../lib/engine/speed';
import type { PuzzleSpec } from '../lib/puzzles/spec';
import { themeLabel } from '../lib/puzzles/themes';

type State = 'intro' | 'solving' | 'wrong' | 'checking' | 'solved' | 'failed';

export interface PuzzleResult {
  success: boolean;
  hintsUsed: number;
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
}

export function PuzzlePlayer({ spec, onFinish, onNext, nextLabel = 'Next puzzle', footer, fast = false }: Props) {
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
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__puzzle = spec;

  useEffect(() => {
    if (!spec.setup) return;
    const t = setTimeout(() => {
      setFen(startFen);
      setLast({ from: spec.setup!.slice(0, 2), to: spec.setup!.slice(2, 4) });
      setState('solving');
    }, fast ? 350 : 700);
    return () => clearTimeout(t);
  }, [spec, startFen]);

  const finish = (success: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onFinish({ success: success && !failed, hintsUsed: hints });
  };

  const advance = (afterFen: string, uci: string, nextIdx: number) => {
    setFen(afterFen);
    setLast({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    setHint(null);
    if (nextIdx >= spec.solution.length) {
      playSound('success');
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
    if (fast) {
      if (!finished.current) {
        finished.current = true;
        onFinish({ success: false, hintsUsed: 0 });
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
          playSound('success');
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

  return (
    <div className="space-y-3">
      <div className="px-1.5">
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
      {fast ? (
        <div className="px-3 text-center text-sm font-semibold text-stone-500">
          {state === 'solving' ? `${userColor === 'w' ? 'White' : 'Black'} to move` : state === 'wrong' ? '✗ Missed' : state === 'solved' ? '✓ Solved' : '…'}
        </div>
      ) : (
      <div className="space-y-3 px-3">
        {state === 'intro' && <CoachBubble mood="thinking"><p>Watch your opponent's move…</p></CoachBubble>}
        {state === 'solving' && (
          <CoachBubble mood={hint ? 'thinking' : 'happy'}>
            <p className="font-semibold">{userColor === 'w' ? 'White' : 'Black'} to move.</p>
            <p>{hint ? hint.text : spec.kind === 'mistake' ? `In your game you played ${spec.playedSan}. Find a better move!` : 'Find the best move.'}</p>
          </CoachBubble>
        )}
        {state === 'checking' && (
          <CoachBubble mood="thinking">
            <p className="flex items-center gap-2"><Spinner /> Hmm, let me check that move…</p>
          </CoachBubble>
        )}
        {state === 'wrong' && (
          <CoachBubble
            mood="concerned"
            actions={
              <>
                <button className="btn-primary" onClick={retry}>Try again</button>
                <button className="btn-secondary" onClick={showSolution}>Show solution</button>
              </>
            }
          >
            <p>Not quite — that's not the strongest move here.</p>
          </CoachBubble>
        )}
        {done && explanation && (
          <CoachBubble
            mood={state === 'solved' ? 'happy' : 'concerned'}
            actions={
              <>
                {onNext && <button className="btn-primary" onClick={onNext}>{nextLabel}</button>}
                <PlayFromHere fen={startFen} color={userColor} label="▶ Play it out" />
              </>
            }
          >
            <p className="font-semibold">{state === 'solved' ? (failed || hints ? 'Solved — with a little help.' : 'Correct! 🎉') : "Here's the solution."}</p>
            {note && <p>{note}</p>}
            {explanation.text.map((t, i) => <p key={i}>{t}</p>)}
            {spec.kind === 'mistake' && spec.explanation?.length ? (
              <p className="text-sm text-stone-500">In the game: {spec.explanation[0]}</p>
            ) : null}
            {footer}
          </CoachBubble>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {state === 'solving' && (
            <button className="btn-secondary" disabled={hint?.level === 3} onClick={askHint}>
              💡 {hint ? `Hint ${hint.level}/3` : 'Hint'}
            </button>
          )}
          {state === 'solving' && (
            <button className="btn-ghost" onClick={showSolution}>Give up</button>
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-1">
            {spec.label && <span className="chip bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">{spec.label}</span>}
            {done && spec.rating ? <span className="chip bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Rating {spec.rating}</span> : null}
            {done && spec.themes.filter((t) => themeLabel(t) !== t).slice(0, 3).map((t) => (
              <span key={t} className="chip bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100">{themeLabel(t)}</span>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
