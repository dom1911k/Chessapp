import { useEffect, useState, type ReactNode } from 'react';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { Header } from '../components/ui';
import { tryMove, type MoveInput } from '../lib/chess/game';
import { kvGet, kvSet } from '../lib/db';
import { solvesTask, taskSolutions } from '../lib/lessons/check';
import { lessonById } from '../lib/lessons/data';
import { useNav } from '../lib/nav';
import { playSound } from '../lib/sound';
import { progress } from '../lib/progress';

export const LESSONS_KEY = 'lessonsDone';

/** Renders **bold** markers. */
function Rich({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>));
}

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const lesson = lessonById(lessonId)!;
  const pop = useNav((s) => s.pop);
  const [i, setI] = useState(0);
  const [fen, setFen] = useState(lesson.steps[0].fen);
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const [state, setState] = useState<'todo' | 'wrong' | 'done'>('todo');
  const [tries, setTries] = useState(0);
  const step = lesson.steps[i];
  const isLast = i === lesson.steps.length - 1;

  useEffect(() => {
    setFen(step.fen);
    setLast(null);
    setState(step.task ? 'todo' : 'done');
    setTries(0);
  }, [step]);

  const onMove = (m: MoveInput) => {
    if (!step.task || state === 'done') return false;
    const r = tryMove(step.fen, m);
    if (!r) return false;
    setFen(r.fen);
    setLast({ from: m.from, to: m.to });
    if (solvesTask(step.fen, step.task, r.move.lan)) {
      setState('done');
      playSound('success');
    } else {
      setState('wrong');
      setTries((t) => t + 1);
      playSound('error');
    }
    return true;
  };

  const retry = () => {
    setFen(step.fen);
    setLast(null);
    setState('todo');
  };

  const next = async () => {
    if (!isLast) return setI(i + 1);
    const done = await kvGet<string[]>(LESSONS_KEY, []);
    const first = !done.includes(lesson.id);
    if (first) await kvSet(LESSONS_KEY, [...done, lesson.id]);
    pop();
    void progress({ kind: 'lesson', first });
  };

  // After two misses, show the answer as an arrow.
  const answer = step.task && tries >= 2 && state !== 'done' ? taskSolutions(step.fen, step.task)[0] : null;
  const turn = step.fen.split(' ')[1];

  return (
    <div className="flex h-full flex-col">
      <Header title={lesson.title} back />
      <div className="mx-auto mb-1 flex w-full max-w-xl gap-1 px-3">
        {lesson.steps.map((_, k) => (
          <div key={k} className={`h-1.5 flex-1 rounded-full ${k < i || (k === i && state === 'done') ? 'bg-brand-500' : k === i ? 'bg-stone-400' : 'bg-stone-200 dark:bg-stone-800'}`} />
        ))}
      </div>
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4">
        <div className="px-1.5">
          <Board
            fen={fen}
            orientation={turn === 'b' && !step.task ? 'white' : turn === 'w' ? 'white' : 'black'}
            movable={step.task && state === 'todo' ? (turn as 'w' | 'b') : null}
            onMove={onMove}
            lastMove={last}
            arrows={[...(step.arrows ?? []), ...(answer ? [{ from: answer.slice(0, 2), to: answer.slice(2, 4), tone: 'good' as const }] : [])]}
            highlights={step.highlights}
          />
        </div>
        <div className="space-y-3 px-3">
          <CoachBubble
            mood={state === 'wrong' ? 'concerned' : 'happy'}
            actions={
              state === 'done' ? (
                <button className="btn-primary" onClick={() => void next()}>{isLast ? 'Finish lesson' : 'Next'}</button>
              ) : state === 'wrong' ? (
                <button className="btn-primary" onClick={retry}>Try again</button>
              ) : null
            }
          >
            {state === 'done' && step.task ? (
              <p>✅ <Rich text={step.success ?? 'Correct!'} /></p>
            ) : state === 'wrong' ? (
              <p>Not quite. {tries >= 2 ? 'The green arrow shows the answer.' : step.hint ?? 'Have another look.'}</p>
            ) : (
              <p><Rich text={step.text} /></p>
            )}
          </CoachBubble>
        </div>
      </div>
    </div>
  );
}
