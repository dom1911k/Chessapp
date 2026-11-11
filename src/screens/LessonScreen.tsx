import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { Header } from '../components/ui';
import { LevelBadge } from '../components/Gamification';
import { tryMove, type MoveInput } from '../lib/chess/game';
import { kvGet, kvSet } from '../lib/db';
import { PLACEMENT, STAGES, START_KEY, placementStage } from '../lib/course';
import { solvesTask, taskSolutions } from '../lib/lessons/check';
import { lessonById, type Lesson, type LessonStep } from '../lib/lessons/data';
import { INTERVALS, markReviewed, refreshSteps, scheduleLesson } from '../lib/lessons/review';
import { useNav } from '../lib/nav';
import { playSound } from '../lib/sound';
import { progress } from '../lib/progress';
import { Check, CircleCheck, GraduationCap, RotateCcw, X } from 'lucide-react';
import { Medallion } from '../components/Glyph';

export const LESSONS_KEY = 'lessonsDone';

/** Renders **bold** and *italic* markers. */
export function Rich({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) =>
    part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part.startsWith('*') && part.length > 2 ? <i key={i}>{part.slice(1, -1)}</i> : <span key={i}>{part}</span>,
  );
}

/** The placement check as a lesson: one exercise from each level, one try each. */
function placementLesson(): Lesson {
  const steps = PLACEMENT.map((p) => lessonById(p.lessonId)?.steps[p.step]).filter((s): s is LessonStep => !!s?.task);
  return { id: 'placement', title: 'Placement check', icon: 'map', summary: 'Eight positions to find where you should start.', steps };
}

export function LessonScreen({ lessonId, mode }: { lessonId: string; mode?: 'review' | 'placement' }) {
  const lesson = useMemo(() => (mode === 'placement' ? placementLesson() : lessonById(lessonId)!), [lessonId, mode]);
  const steps = useMemo(() => (mode === 'review' ? refreshSteps(lesson) : lesson.steps), [lesson, mode]);
  const pop = useNav((s) => s.pop);
  const [i, setI] = useState(0);
  const [fen, setFen] = useState(steps[0].fen);
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const [state, setState] = useState<'todo' | 'wrong' | 'done'>('todo');
  const [tries, setTries] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  /** Steps you got wrong at least once (placement: failed). */
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState<{ stage?: number } | null>(null);
  const step = steps[i];
  const isLast = i === steps.length - 1;
  const active = !!(step.task || step.quiz);

  useEffect(() => {
    setFen(step.fen);
    setLast(null);
    setState(step.task || step.quiz ? 'todo' : 'done');
    setTries(0);
    setPicked(null);
  }, [step]);

  const miss = () => setMissed((m) => new Set(m).add(i));

  const onMove = (m: MoveInput) => {
    if (!step.task || state !== 'todo') return false;
    const r = tryMove(step.fen, m);
    if (!r) return false;
    setFen(r.fen);
    setLast({ from: m.from, to: m.to });
    if (solvesTask(step.fen, step.task, r.move.lan)) {
      setState('done');
      playSound('success');
    } else {
      miss();
      setTries((t) => t + 1);
      playSound('error');
      // The placement check gives one try: show the answer and move on.
      setState(mode === 'placement' ? 'done' : 'wrong');
    }
    return true;
  };

  const pick = (k: number) => {
    if (!step.quiz || state === 'done') return;
    setPicked(k);
    if (k === step.quiz.answer) {
      setState('done');
      playSound('success');
    } else {
      miss();
      setState('wrong');
      playSound('error');
    }
  };

  const retry = () => {
    setFen(step.fen);
    setLast(null);
    setPicked(null);
    setState('todo');
  };

  const next = async () => {
    if (!isLast) return setI(i + 1);
    if (mode === 'placement') {
      const stage = placementStage(steps.length - missed.size);
      await kvSet(START_KEY, Math.max(stage, await kvGet<number>(START_KEY, 0)));
      await kvSet('placementDone', true);
      playSound('reward');
      return setFinished({ stage });
    }
    if (mode === 'review') {
      await markReviewed(lesson.id, missed.size === 0);
      void progress({ kind: 'lesson', first: false });
    } else {
      const done = await kvGet<string[]>(LESSONS_KEY, []);
      const first = !done.includes(lesson.id);
      if (first) await kvSet(LESSONS_KEY, [...done, lesson.id]);
      await scheduleLesson(lesson.id);
      void progress({ kind: 'lesson', first });
    }
    playSound('reward');
    setFinished({});
  };

  if (finished) {
    const stage = finished.stage;
    const right = steps.filter((s, k) => (s.task || s.quiz) && !missed.has(k)).length;
    const total = steps.filter((s) => s.task || s.quiz).length;
    return (
      <div className="flex h-full flex-col">
        <Header title={lesson.title} back />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="animate-badge-pop flex h-24 w-24 items-center justify-center rounded-[30%] bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_14px_30px_-12px_rgba(27,90,60,0.8)]">
            {stage !== undefined ? <Medallion name={STAGES[stage].icon} size={64} tint="green" /> : <GraduationCap size={48} />}
          </span>
          {stage !== undefined ? (
            <>
              <h2 className="font-display text-2xl font-semibold">You start at Stage {stage + 1}</h2>
              <p className="text-stone-600 dark:text-stone-300">
                <b>{STAGES[stage].title}</b> ({STAGES[stage].range}). You solved {steps.length - missed.size} of {steps.length}. Everything before it is open too — go back any time.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold">{mode === 'review' ? 'Refreshed!' : 'Lesson complete'}</h2>
              {total > 0 && (
                <p className="text-stone-600 dark:text-stone-300">
                  <b>{right} of {total}</b> right first time{right === total ? ' — perfect.' : '.'}
                </p>
              )}
              <p className="text-sm text-stone-500">
                {mode === 'review'
                  ? missed.size === 0
                    ? 'It will come back later, with a longer gap each time.'
                    : `A few slips — it comes back in ${INTERVALS[0]} days.`
                  : `It comes back in Daily training in ${INTERVALS[0]} days for a quick refresh.`}
              </p>
              <LevelBadge />
            </>
          )}
          <button className="btn-primary mt-2 w-full" onClick={pop}>Continue</button>
        </div>
      </div>
    );
  }

  // After two misses, show the answer as an arrow (at once in the placement check).
  const failedHere = missed.has(i);
  const answer = step.task && ((tries >= 2 && state !== 'done') || (mode === 'placement' && failedHere && state === 'done')) ? taskSolutions(step.fen, step.task)[0] : null;
  const turn = step.fen.split(' ')[1];
  const orientation = step.flip ? 'black' : step.task && turn === 'b' ? 'black' : 'white';
  const placementFail = mode === 'placement' && failedHere && state === 'done';

  return (
    <div className="flex h-full flex-col">
      <Header title={mode === 'review' ? `Refresh: ${lesson.title}` : lesson.title} back />
      <div className="mx-auto mb-1 flex w-full max-w-xl gap-1 px-3 land:max-w-6xl">
        {steps.map((_, k) => (
          <div key={k} className={`h-1.5 flex-1 rounded-full transition-colors ${k < i || (k === i && state === 'done') ? (missed.has(k) && mode === 'placement' ? 'bg-red-400' : 'bg-brand-500') : k === i ? 'bg-stone-400' : 'bg-stone-200 dark:bg-stone-800'}`} />
        ))}
      </div>
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        <div className="board-cell px-1.5">
          <Board
            fen={placementFail ? step.fen : fen}
            orientation={orientation}
            movable={step.task && state === 'todo' ? (turn as 'w' | 'b') : null}
            onMove={onMove}
            lastMove={placementFail ? null : last}
            arrows={[...(step.arrows ?? []), ...(answer ? [{ from: answer.slice(0, 2), to: answer.slice(2, 4), tone: 'good' as const }] : [])]}
            highlights={step.highlights}
          />
        </div>
        <div className="space-y-3 px-3">
          <CoachBubble
            mood={state === 'wrong' || placementFail ? 'concerned' : 'happy'}
            label={step.task ? 'Your move' : step.quiz ? 'Question' : undefined}
            actions={
              state === 'done' ? (
                <button className="btn-primary" onClick={() => void next()}>{isLast ? (mode === 'placement' ? 'See my result' : 'Finish') : 'Next'}</button>
              ) : state === 'wrong' ? (
                <button className="btn-primary" onClick={retry}><RotateCcw size={16} /> Try again</button>
              ) : null
            }
          >
            {step.quiz ? (
              <>
                <p><Rich text={step.text} /></p>
                <div className="mt-2.5 space-y-2">
                  {step.quiz.options.map((o, k) => {
                    const right = state === 'done' && k === step.quiz!.answer;
                    const wrong = picked === k && k !== step.quiz!.answer;
                    return (
                      <button
                        key={k}
                        disabled={state !== 'todo'}
                        onClick={() => pick(k)}
                        className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14.5px] ring-1 transition active:scale-[0.98] ${
                          right
                            ? 'bg-emerald-50 font-semibold text-emerald-900 ring-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200'
                            : wrong
                              ? 'bg-red-50 text-red-900 ring-red-300 dark:bg-red-500/15 dark:text-red-200'
                              : 'bg-stone-50 ring-stone-200 dark:bg-white/[0.04] dark:ring-white/10'
                        } ${state !== 'todo' && !right && !wrong ? 'opacity-55' : ''}`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${right ? 'bg-emerald-500 text-white' : wrong ? 'bg-red-500 text-white' : 'bg-white text-stone-500 ring-1 ring-stone-300 dark:bg-stone-800 dark:ring-stone-600'}`}>
                          {right ? <Check size={14} strokeWidth={3.5} /> : wrong ? <X size={14} strokeWidth={3.5} /> : String.fromCharCode(65 + k)}
                        </span>
                        <span className="flex-1">{o}</span>
                      </button>
                    );
                  })}
                </div>
                {state === 'done' && <p className="mt-2.5 text-[14.5px] text-stone-700 dark:text-stone-200"><Rich text={step.quiz.explain} /></p>}
                {state === 'wrong' && <p className="mt-2.5 text-sm text-stone-500">Not that one — have another think.</p>}
              </>
            ) : placementFail ? (
              <p>Not this time — the green arrow shows the move. No worries, that is what the check is for.</p>
            ) : state === 'done' && step.task ? (
              <p><CircleCheck size={16} className="mr-1 inline -translate-y-px text-brand-600" /><Rich text={step.success ?? 'Correct!'} /></p>
            ) : state === 'wrong' ? (
              <p>Not quite. {tries >= 2 ? 'The green arrow shows the answer.' : step.hint ?? 'Have another look.'}</p>
            ) : (
              <p><Rich text={step.text} /></p>
            )}
          </CoachBubble>
          {mode === 'placement' && i === 0 && state === 'todo' && <p className="px-1 text-xs text-stone-500">One try per position. It gets harder — just do your best.</p>}
          {!active && !isLast && <p className="px-1 text-center text-xs text-stone-400">{i + 1} / {steps.length}</p>}
        </div>
      </div>
    </div>
  );
}
