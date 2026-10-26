import { useEffect, useState } from 'react';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { CoachBubble } from '../components/Coach';
import { Medallion } from '../components/Glyph';
import { Header } from '../components/ui';
import type { Theme } from '../lib/coach/types';
import { kvGet } from '../lib/db';
import { LESSONS } from '../lib/lessons/data';
import { useNav } from '../lib/nav';
import { THEME_SETS } from '../lib/puzzles/themes';
import { practiceSet, THEMES } from '../lib/themes';
import { LESSONS_KEY } from './LessonScreen';

export const DRILLS_KEY = 'drillsDone';
export const DRILL_COUNT = 3;

/** "Practise what went wrong": a mini-lesson plus a few matching puzzles. */
export function PracticeScreen({ theme }: { theme: Theme }) {
  const push = useNav((s) => s.push);
  const info = THEMES[theme];
  const lesson = LESSONS.find((l) => l.id === info.lessonId);
  const set = practiceSet(theme, THEME_SETS);
  const label = set ? THEME_SETS.find((t) => t.id === set)!.label : info.label;
  const [lessonDone, setLessonDone] = useState(false);
  const [drillDone, setDrillDone] = useState(false);
  const doneKey = `${theme}:${new Date().toDateString()}`;

  useEffect(() => {
    void kvGet<string[]>(LESSONS_KEY, []).then((d) => setLessonDone(!!lesson && d.includes(lesson.id)));
    void kvGet<string[]>(DRILLS_KEY, []).then((d) => setDrillDone(d.includes(doneKey)));
  }, [lesson, doneKey]);

  const all = (!lesson || lessonDone) && (!set || drillDone);
  return (
    <div className="flex h-full flex-col">
      <Header title="Practice" subtitle={info.label} back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto p-4">
        <CoachBubble mood={all ? 'happy' : 'thinking'}>
          {all ? (
            <p>
              All done — nicely practised! Next game, remember: <b>{info.lesson}</b>
            </p>
          ) : (
            <>
              <p className="font-semibold">Let's turn that mistake into a lesson.</p>
              <p>{info.lesson}</p>
              <p className="text-sm text-stone-500">Takes about 2 minutes.</p>
            </>
          )}
        </CoachBubble>
        {lesson && (
          <Step
            n={1}
            icon={lesson.icon}
            title={`Mini-lesson: ${lesson.title}`}
            sub={lessonDone ? 'Done — tap to go through it again' : lesson.summary}
            done={lessonDone}
            onClick={() => push({ name: 'lesson', lessonId: lesson.id })}
          />
        )}
        {set && (
          <Step
            n={lesson ? 2 : 1}
            icon={THEME_SETS.find((t) => t.id === set)!.icon}
            title={`${DRILL_COUNT} ${label.toLowerCase()} puzzles`}
            sub={drillDone ? 'Done — tap for more' : 'A little easier than usual, to build the habit.'}
            done={drillDone}
            onClick={() => push({ name: 'puzzle', mode: { kind: 'drill', theme: set, count: DRILL_COUNT, label, doneKey } })}
          />
        )}
      </div>
    </div>
  );
}

function Step({ n, icon, title, sub, done, onClick }: { n: number; icon: string; title: string; sub: string; done: boolean; onClick: () => void }) {
  return (
    <button className="card flex w-full items-center gap-3 !p-3 text-left active:scale-[0.99]" onClick={onClick}>
      <Medallion name={icon} tint={done ? 'green' : 'gold'} />
      <span className="flex-1">
        <span className="block text-xs font-semibold text-stone-500 uppercase">Step {n}</span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-stone-500">{sub}</span>
      </span>
      {done ? <CircleCheck size={20} className="text-brand-600" /> : <ChevronRight size={20} className="text-stone-400" />}
    </button>
  );
}
