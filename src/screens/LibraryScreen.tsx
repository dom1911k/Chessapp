// Every lesson and model game in one place, grouped by stage — for looking something up or
// repeating a lesson outside the course order.
import { useEffect, useState } from 'react';
import { Check, Star } from 'lucide-react';
import { Medallion } from '../components/Glyph';
import { Header } from '../components/ui';
import { CHAPTERS, STAGES } from '../lib/course';
import { kvGet } from '../lib/db';
import { lessonById } from '../lib/lessons/data';
import { MODEL_DONE_KEY, modelGameById } from '../lib/lessons/games';
import { useNav } from '../lib/nav';
import { LESSONS_KEY } from './LessonScreen';

export function LibraryScreen() {
  const push = useNav((s) => s.push);
  const onTop = useNav((s) => s.stack[s.stack.length - 1]?.name === 'library');
  const [done, setDone] = useState<string[]>([]);
  const [models, setModels] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!onTop) return;
    void kvGet<string[]>(LESSONS_KEY, []).then(setDone);
    void kvGet<Record<string, number>>(MODEL_DONE_KEY, {}).then(setModels);
  }, [onTop]);
  return (
    <div className="flex h-full flex-col">
      <Header title="Lesson library" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4">
        {STAGES.map((st, si) => {
          const steps = CHAPTERS.filter((ch) => ch.stage === si).flatMap((ch) => ch.steps);
          const lessons = steps.flatMap((s) => (s.kind === 'lesson' ? [lessonById(s.lessonId)!] : [])).filter(Boolean);
          const games = steps.flatMap((s) => (s.kind === 'model' ? [modelGameById(s.gameId)!] : [])).filter(Boolean);
          return (
            <section key={st.id}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="section-title">Stage {si + 1} · {st.title}</h2>
                <span className="text-xs font-semibold text-stone-500">{lessons.filter((l) => done.includes(l.id)).length}/{lessons.length}</span>
              </div>
              <div className="card divide-y divide-stone-100 !p-0 dark:divide-white/[0.06]">
                {lessons.map((l) => (
                  <button key={l.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-stone-100 dark:active:bg-white/5" onClick={() => push({ name: 'lesson', lessonId: l.id })}>
                    <Medallion name={l.icon} size={34} tint={done.includes(l.id) ? 'green' : 'stone'} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.title}</span>
                      <span className="block truncate text-xs text-stone-500">{l.summary}</span>
                    </span>
                    {done.includes(l.id) && <Check size={17} strokeWidth={3} className="text-emerald-600" />}
                  </button>
                ))}
                {games.map((g) => (
                  <button key={g.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-stone-100 dark:active:bg-white/5" onClick={() => push({ name: 'modelGame', gameId: g.id })}>
                    <Medallion name={g.icon} size={34} tint="gold" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{g.title}</span>
                      <span className="block truncate text-xs text-stone-500">Model game · {g.theme}</span>
                    </span>
                    {g.id in models && (
                      <span className="flex">
                        {[1, 2, 3].map((k) => <Star key={k} size={13} className={k <= models[g.id] ? 'fill-gold-400 text-gold-500' : 'text-stone-300 dark:text-stone-700'} />)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
