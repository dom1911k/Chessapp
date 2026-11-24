// Home's one "Up next" row (see src/lib/upNext.ts for the rules): a 36px icon, a title, one muted
// line and a chevron. It recomputes whenever Home shows again.
import { useEffect, useState } from 'react';
import { BookOpen, CalendarCheck, ChevronRight, Crosshair, Puzzle } from 'lucide-react';
import { loadUpNext, upNextText, type UpNext } from '../lib/upNext';
import { useNav } from '../lib/nav';
import type { CourseStep } from '../lib/course';

const ICON = {
  review: { el: <Crosshair size={20} />, tint: 'bg-brand-100 text-brand-700 dark:bg-brand-700/25 dark:text-brand-100' },
  daily: { el: <CalendarCheck size={20} />, tint: 'bg-hue-sky-100 text-hue-sky-700 dark:bg-hue-sky-900/40 dark:text-hue-sky-200' },
  course: { el: <BookOpen size={20} />, tint: 'bg-gold-300/45 text-[#8a6416] dark:bg-gold-500/20 dark:text-gold-300' },
  puzzles: { el: <Puzzle size={20} />, tint: 'bg-hue-orange-100 text-hue-orange-700 dark:bg-hue-orange-900/40 dark:text-hue-orange-200' },
} as const;

export function UpNextCard() {
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const tab = useNav((s) => s.tab);
  const depth = useNav((s) => s.stack.length);
  const [u, setU] = useState<UpNext | null>(null);
  // Recomputed each time Home is in front again (after a review, a puzzle, a lesson…).
  useEffect(() => {
    if (tab !== 'play' || depth) return;
    let alive = true;
    void loadUpNext().then((x) => alive && setU(x));
    return () => {
      alive = false;
    };
  }, [tab, depth]);
  if (!u) return null;

  const openStep = (s: CourseStep) => {
    if (s.kind === 'lesson') push({ name: 'lesson', lessonId: s.lessonId });
    else if (s.kind === 'drill') push({ name: 'endgame', drillId: s.drillId });
    else if (s.kind === 'model') push({ name: 'modelGame', gameId: s.gameId });
    else if (s.kind === 'puzzles') push({ name: 'puzzle', mode: { kind: 'course', theme: s.theme, count: s.count, stepId: s.id, label: s.label.replace(/^\d+ /, '') } });
    else setTab('learn'); // a course game: the Learn tab has the opponent and the confirm
  };
  const go = () => {
    if (u.kind === 'review') push({ name: 'report', gameId: u.gameId });
    else if (u.kind === 'daily') push({ name: 'daily' });
    else if (u.kind === 'course') openStep(u.step);
    else push({ name: 'puzzlePath' });
  };
  const t = upNextText(u);
  const ic = ICON[u.kind];
  return (
    <section>
      <h2 className="mb-1.5 section-title">Up next</h2>
      <div className="card overflow-hidden !p-0">
        <button className="press flex w-full items-center gap-3 px-3.5 py-3 text-left" onClick={go} data-testid="up-next" data-kind={u.kind}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ${ic.tint}`}>{ic.el}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15px] font-bold">{t.title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-stone-500 dark:text-stone-400">{t.detail}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-stone-400" />
        </button>
      </div>
    </section>
  );
}
