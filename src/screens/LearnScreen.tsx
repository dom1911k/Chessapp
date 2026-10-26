import { useEffect, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { Header } from '../components/ui';
import { kvGet } from '../lib/db';
import { DRILLS } from '../lib/endgames';
import { useNav } from '../lib/nav';
import { DRILL_KEY, type DrillProgress } from './EndgameScreen';
import { SettingsButton } from './PlayScreen';
import { LESSONS } from '../lib/lessons/data';
import { MATE_PATTERNS } from '../lib/lessons/mates';
import { CoursePath } from '../components/CoursePath';
import { LESSONS_KEY } from './LessonScreen';
import { Medallion } from '../components/Glyph';
import { Check, Target } from 'lucide-react';

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
          <p>Follow the course step by step — lesson, practice, then a game. Everything stays open to replay any time.</p>
        </CoachBubble>
        <CoursePath />
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold text-stone-500">Checkmate patterns</h2>
            <span className="text-xs font-semibold text-stone-500">
              {MATE_PATTERNS.filter((m) => lessonsDone.includes(m.id)).length}/{MATE_PATTERNS.length}
            </span>
          </div>
          <div className="space-y-2">
            {MATE_PATTERNS.map((m, i) => (
              <button key={m.id} className="card flex w-full items-center gap-3 !p-3 text-left active:scale-[0.99]" onClick={() => push({ name: 'lesson', lessonId: m.id })}>
                <Medallion name={m.icon} tint={lessonsDone.includes(m.id) ? 'green' : 'rose'} size={40} />
                <span className="flex-1">
                  <span className="block font-semibold">{i + 1}. {m.title}</span>
                  <span className="block text-xs text-stone-500">{m.summary}</span>
                </span>
                {lessonsDone.includes(m.id) && <Check size={18} strokeWidth={3} className="text-emerald-600" />}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">All lessons</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {LESSONS.map((l) => (
              <button key={l.id} className="card !p-3 text-left" onClick={() => push({ name: 'lesson', lessonId: l.id })}>
                <div className="flex items-center gap-2">
                  <Medallion name={l.icon} size={34} />
                  <span className="font-semibold leading-tight">{l.title}</span>
                </div>
                <div className="mt-1 text-xs text-stone-500">{l.summary}</div>
                {lessonsDone.includes(l.id) && <div className="mt-1 text-xs font-semibold text-emerald-600"><Check size={13} strokeWidth={3} className="mr-0.5 inline -translate-y-px" />Done</div>}
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
                    <Medallion name={d.icon} tint="gold" />
                    <span className="flex-1">
                      <span className="block font-semibold">{d.title}</span>
                      <span className="block text-xs text-stone-500">{d.description}</span>
                      <span className="block text-xs text-stone-500"><Target size={12} className="mr-1 inline -translate-y-px" />{d.goalText}</span>
                    </span>
                    {p?.completed ? (
                      <span className="text-right text-xs text-emerald-600">
                        <Check size={13} strokeWidth={3} className="mr-0.5 inline -translate-y-px" />{p.completed}×
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
            <Medallion name="book" tint="blue" />
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
