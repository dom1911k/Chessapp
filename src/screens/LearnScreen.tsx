import { useEffect, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { Header } from '../components/ui';
import { kvGet } from '../lib/db';
import { DRILLS } from '../lib/endgames';
import { useNav } from '../lib/nav';
import { DRILL_KEY, type DrillProgress } from './EndgameScreen';
import { SettingsButton } from './PlayScreen';
import { LESSONS } from '../lib/lessons/data';
import { LESSONS_KEY } from './LessonScreen';

export function LearnScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const stackLen = useNav((s) => s.stack.length);
  const [progress, setProgress] = useState<Record<string, DrillProgress>>({});
  const [lessonsDone, setLessonsDone] = useState<string[]>([]);
  useEffect(() => {
    if (tab !== 'learn' || stackLen) return;
    void kvGet(DRILL_KEY, {}).then(setProgress);
    void kvGet<string[]>(LESSONS_KEY, []).then(setLessonsDone);
  }, [tab, stackLen]);
  const groups = [...new Set(DRILLS.map((d) => d.group))];
  return (
    <div className="flex h-full flex-col">
      <Header title="Learn" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4">
        <CoachBubble>
          <p>Start with the short lessons, then practise endgames against the engine until they feel easy!</p>
        </CoachBubble>
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">Lessons</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {LESSONS.map((l) => (
              <button key={l.id} className="card !p-3 text-left" onClick={() => push({ name: 'lesson', lessonId: l.id })}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{l.icon}</span>
                  <span className="font-semibold leading-tight">{l.title}</span>
                </div>
                <div className="mt-1 text-xs text-stone-500">{l.summary}</div>
                {lessonsDone.includes(l.id) && <div className="mt-1 text-xs font-semibold text-emerald-600">✓ Done</div>}
              </button>
            ))}
          </div>
        </section>
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">{g}</h2>
            <div className="space-y-2">
              {DRILLS.filter((d) => d.group === g).map((d) => {
                const p = progress[d.id];
                return (
                  <button key={d.id} className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'endgame', drillId: d.id })}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-2xl dark:bg-brand-700/20">{d.icon}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{d.title}</span>
                      <span className="block text-xs text-stone-500">{d.description}</span>
                      <span className="block text-xs text-stone-500">🎯 {d.goalText}</span>
                    </span>
                    {p?.completed ? (
                      <span className="text-right text-xs text-emerald-600">
                        ✓ {p.completed}×
                        {p.bestMoves ? <span className="block text-stone-500">best: {p.bestMoves}</span> : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">Openings</h2>
          <button className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'openings' })}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-2xl dark:bg-brand-700/20">📖</span>
            <span className="flex-1">
              <span className="block font-semibold">Opening names & ideas</span>
              <span className="block text-xs text-stone-500">The main idea behind common openings, plus the golden rules.</span>
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
