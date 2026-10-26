import { useEffect, useState } from 'react';
import { CHAPTERS, chapterDone, chapterOpen, checkChapters, courseState, type CourseState, type CourseStep } from '../lib/course';
import { lessonById } from '../lib/lessons/data';
import { useNav } from '../lib/nav';
import { opponentById } from '../lib/people';
import { usePlay } from '../lib/store/play';
import { Portrait } from './Coach';
import { Dialog } from './ui';
import { Medallion } from './Glyph';
import { Check, ChevronRight, CircleCheck } from 'lucide-react';

/** The learning path: chapters as a vertical journey, the current one expanded. */
export function CoursePath() {
  const tab = useNav((s) => s.tab);
  const stackLen = useNav((s) => s.stack.length);
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const [st, setSt] = useState<CourseState | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmGame, setConfirmGame] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'learn' || stackLen) return;
    void checkChapters().then(courseState).then(setSt);
  }, [tab, stackLen]);

  if (!st) return null;
  const current = CHAPTERS.findIndex((ch) => !chapterDone(ch, st));
  const expanded = open ?? CHAPTERS[current]?.id ?? null;
  const doneCount = CHAPTERS.filter((ch) => chapterDone(ch, st)).length;

  const startGame = (opponentId: string) => {
    const o = opponentById(opponentId)!;
    const play = usePlay.getState();
    play.newGame(Math.random() < 0.5 ? 'w' : 'b', o.elo, undefined, o.id);
    setTab('play');
  };

  const openStep = (s: CourseStep) => {
    if (s.kind === 'lesson') push({ name: 'lesson', lessonId: s.lessonId });
    else if (s.kind === 'drill') push({ name: 'endgame', drillId: s.drillId });
    else if (s.kind === 'puzzles') push({ name: 'puzzle', mode: { kind: 'course', theme: s.theme, count: s.count, stepId: s.id, label: s.label.replace(/^\d+ /, '') } });
    else {
      const play = usePlay.getState();
      if (play.game && play.phase !== 'over' && play.game.plies.length) setConfirmGame(s.opponentId);
      else startGame(s.opponentId);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold text-stone-500">Your course</h2>
        <span className="text-xs text-stone-500">{doneCount}/{CHAPTERS.length} chapters</span>
      </div>
      <div className="relative space-y-2 pl-5">
        <div className="absolute top-3 bottom-3 left-[13px] w-0.5 bg-stone-200 dark:bg-stone-800" />
        {CHAPTERS.map((ch, i) => {
          const isOpen = chapterOpen(i, st);
          const isDone = chapterDone(ch, st);
          const stepsDone = ch.steps.filter((s) => st.done[s.id]).length;
          const showSteps = expanded === ch.id && isOpen;
          return (
            <div key={ch.id} className="relative">
              <span
                className={`absolute top-3 -left-[17px] flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-stone-100 dark:ring-stone-950 ${
                  isDone ? 'bg-brand-500 text-white' : isOpen ? 'bg-amber-400 text-white' : 'bg-stone-300 text-stone-500 dark:bg-stone-700'
                }`}
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <button
                disabled={!isOpen}
                onClick={() => setOpen(showSteps ? '' : ch.id)}
                className={`card flex w-full items-center gap-3 !p-3 text-left ${isOpen ? '' : 'opacity-50'} ${i === current ? '!ring-2 !ring-amber-400' : ''}`}
              >
                <Medallion name={isOpen ? ch.icon : 'trap'} tint={isDone ? 'green' : 'gold'} muted={!isOpen} />
                <span className="flex-1">
                  <span className="block font-semibold leading-tight">{ch.title}</span>
                  <span className="block text-xs text-stone-500">{isOpen ? ch.intro : 'Finish the chapter before to open this one.'}</span>
                </span>
                <span className="text-xs font-semibold text-stone-500">{stepsDone}/{ch.steps.length}</span>
              </button>
              {showSteps && (
                <div className="mt-1.5 space-y-1.5 pl-3">
                  {ch.steps.map((s) => {
                    const done = st.done[s.id];
                    const o = s.kind === 'game' ? opponentById(s.opponentId) : null;
                    const sub =
                      s.kind === 'puzzles' ? `${Math.min(st.puzzles[s.id] ?? 0, s.count)}/${s.count} solved` : s.kind === 'game' ? 'Play a full game (any result)' : s.kind === 'lesson' ? `${lessonById(s.lessonId)?.steps.length ?? ''} short steps` : 'Reach the goal once';
                    return (
                      <button key={s.id} onClick={() => openStep(s)} className="flex w-full items-center gap-3 rounded-xl bg-white/70 px-3 py-2 text-left ring-1 ring-stone-200 active:scale-[0.99] dark:bg-stone-900/70 dark:ring-stone-800">
                        {o ? <Portrait id={o.id} size={28} /> : <Medallion name={s.kind === 'lesson' ? 'cap' : s.kind === 'puzzles' ? 'sparkles' : 'flag'} size={28} tint={done ? 'green' : 'stone'} />}
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{s.label}</span>
                          <span className="block text-xs text-stone-500">{sub}</span>
                        </span>
                        <span className={done ? 'text-brand-600' : 'text-stone-300'}>{done ? <CircleCheck size={18} /> : <ChevronRight size={18} />}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={!!confirmGame} onClose={() => setConfirmGame(null)} title="Start the course game?">
        <p className="text-sm">Your current game will end (it counts as resigned if you've made a few moves).</p>
        <div className="mt-4 flex gap-2">
          <button
            className="btn-primary flex-1"
            onClick={() => {
              const id = confirmGame!;
              setConfirmGame(null);
              void usePlay.getState().abandon().then(() => startGame(id));
            }}
          >
            Start
          </button>
          <button className="btn-secondary flex-1" onClick={() => setConfirmGame(null)}>Cancel</button>
        </div>
      </Dialog>
    </section>
  );
}
