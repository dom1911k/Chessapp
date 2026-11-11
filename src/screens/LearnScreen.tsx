import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/ui';
import { kvGet } from '../lib/db';
import { DRILLS } from '../lib/endgames';
import { TRAPS } from '../lib/traps';
import { useNav } from '../lib/nav';
import { DRILL_KEY, type DrillProgress } from './EndgameScreen';
import { SettingsButton } from './PlayScreen';
import { lessonById } from '../lib/lessons/data';
import { dueLessonIds } from '../lib/lessons/review';
import { CHAPTERS, STAGES, chapterOpen, checkChapters, courseState, currentStage, stageProgress, type CourseState } from '../lib/course';
import { CoursePath } from '../components/CoursePath';
import { Medallion } from '../components/Glyph';
import { Check, ChevronRight, Target } from 'lucide-react';

export function LearnScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const stackLen = useNav((s) => s.stack.length);
  const [progress, setProgress] = useState<Record<string, DrillProgress>>({});
  const [st, setSt] = useState<CourseState | null>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [due, setDue] = useState<string[]>([]);
  const [placed, setPlaced] = useState(true);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab !== 'learn' || stackLen) return;
    void kvGet(DRILL_KEY, {}).then(setProgress);
    void checkChapters().then(courseState).then(setSt);
    void dueLessonIds().then(setDue);
    void kvGet<boolean>('placementDone', false).then(setPlaced);
  }, [tab, stackLen]);
  const cur = st ? currentStage(st) : 0;
  const shown = stage ?? cur;
  // Bring the current stage into view the first time the course loads.
  useEffect(() => {
    if (st && stage === null) strip.current?.querySelector(`[data-stage="${cur}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = [...new Set(DRILLS.map((d) => d.group))];
  const all = st ? CHAPTERS.flatMap((ch) => ch.steps) : [];
  const allDone = st ? all.filter((s) => st.done[s.id]).length : 0;
  const nextStep = st ? CHAPTERS.filter((ch, k) => ch.stage === cur && chapterOpen(k, st)).flatMap((ch) => ch.steps).find((s) => !st.done[s.id]) : undefined;
  const openNext = () => {
    if (!nextStep) return;
    if (nextStep.kind === 'lesson') push({ name: 'lesson', lessonId: nextStep.lessonId });
    else if (nextStep.kind === 'model') push({ name: 'modelGame', gameId: nextStep.gameId });
    else if (nextStep.kind === 'drill') push({ name: 'endgame', drillId: nextStep.drillId });
    else if (nextStep.kind === 'puzzles') push({ name: 'puzzle', mode: { kind: 'course', theme: nextStep.theme, count: nextStep.count, stepId: nextStep.id, label: nextStep.label.replace(/^\d+ /, '') } });
    else setStage(cur);
  };
  return (
    <div className="flex h-full flex-col">
      <Header title="Learn" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4">
        {/* The road: overall progress and what is next. */}
        <div className="card overflow-hidden !p-0">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-4 pt-3.5 pb-4 text-white">
            <div className="text-[11px] font-bold tracking-[0.1em] text-white/70 uppercase">Your road to 1800</div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="font-display text-[22px] leading-tight font-semibold">Stage {cur + 1} · {STAGES[cur].title}</span>
              <span className="shrink-0 text-xs font-semibold text-white/80 tabular-nums">{allDone}/{all.length || '…'}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-400 transition-[width] duration-700" style={{ width: `${all.length ? Math.max(2, (allDone / all.length) * 100) : 0}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold tracking-wider text-stone-500 uppercase">Up next</span>
              <span className="block truncate font-semibold">{nextStep ? nextStep.label : st ? 'Course complete — well done!' : '…'}</span>
            </span>
            {nextStep && <button className="btn-primary !px-5" onClick={openNext}>{nextStep.kind === 'game' ? 'Show' : 'Continue'}</button>}
          </div>
        </div>
        {!placed && (
          <button className="card tile flex w-full items-center gap-3 !p-3 text-left ring-2 ring-amber-300 dark:ring-amber-500/40" onClick={() => push({ name: 'placement' })}>
            <Medallion name="map" tint="gold" />
            <span className="flex-1">
              <span className="block font-semibold">Not a beginner? Find your level</span>
              <span className="block text-xs text-stone-500">Eight positions, about two minutes. It opens the right stage for you.</span>
            </span>
            <ChevronRight size={18} className="text-stone-400" />
          </button>
        )}
        {due.length > 0 && (
          <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'lesson', lessonId: due[0], mode: 'review' })}>
            <Medallion name="repeat" tint="blue" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Refresh: {lessonById(due[0])?.title}</span>
              <span className="block text-xs text-stone-500">{due.length === 1 ? 'A two-minute refresh is due today.' : `${due.length} lesson refreshes are due.`}</span>
            </span>
            <span className="chip bg-sky-500 text-white">{due.length}</span>
          </button>
        )}
        {/* The map: seven stages; the chapters of the chosen one below. */}
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="section-title">Course map</h2>
            <button className="text-xs font-semibold text-brand-700 dark:text-brand-500" onClick={() => push({ name: 'library' })}>All lessons</button>
          </div>
          <div ref={strip} className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {STAGES.map((sg, k) => {
              const p = st ? stageProgress(k, st) : { done: 0, total: 1 };
              const on = k === shown;
              const complete = p.done >= p.total;
              return (
                <button key={sg.id} data-stage={k} onClick={() => setStage(k)} className={`tile relative w-[132px] shrink-0 snap-center rounded-[18px] p-3 text-left ring-1 transition-colors ${on ? 'bg-brand-600 text-white ring-brand-700 shadow-[0_10px_20px_-12px_rgba(27,90,60,0.9)]' : 'bg-[#fffdf9] ring-stone-200/80 dark:bg-[#1d1915] dark:ring-white/[0.07]'}`}>
                  <span className="flex items-center justify-between">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${complete ? 'bg-amber-400 text-amber-950' : on ? 'bg-white/20' : 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300'}`}>{complete ? <Check size={14} strokeWidth={3.5} /> : k + 1}</span>
                    {k === cur && !complete && <span className={`rounded-full px-1.5 py-px text-[9px] font-bold tracking-wider uppercase ${on ? 'bg-white/20' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'}`}>You</span>}
                  </span>
                  <span className="mt-2 block text-[15px] leading-tight font-semibold">{sg.title}</span>
                  <span className={`block text-[11px] ${on ? 'text-white/75' : 'text-stone-500'}`}>{sg.range}</span>
                  <span className={`mt-2 block h-1.5 overflow-hidden rounded-full ${on ? 'bg-black/25' : 'bg-stone-200 dark:bg-white/10'}`}>
                    <span className={`block h-full rounded-full ${on ? 'bg-amber-300' : 'bg-brand-500'}`} style={{ width: `${(p.done / p.total) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 mb-3 px-1 text-sm text-stone-600 dark:text-stone-400">{STAGES[shown].intro}</p>
          <CoursePath stage={shown} state={st} />
        </section>
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 section-title">{g}</h2>
            <div className="space-y-2">
              {DRILLS.filter((d) => d.group === g).map((d) => {
                const p = progress[d.id];
                return (
                  <button key={d.id} className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'endgame', drillId: d.id })}>
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
          <h2 className="mb-2 section-title">Ready for real opponents</h2>
          <div className="space-y-2">
            <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'cups' })}>
              <Medallion name="trophy" tint="gold" />
              <span className="flex-1">
                <span className="block font-semibold">Cups</span>
                <span className="block text-xs text-stone-500">An eight-player knockout against the bots. Win three matches, lift the trophy.</span>
              </span>
            </button>
            <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'face' })}>
              <Medallion name="eye" tint="green" />
              <span className="flex-1">
                <span className="block font-semibold">What you face</span>
                <span className="block text-xs text-stone-500">Your chess.com openings: your score, the line people play against you, and where you go wrong.</span>
              </span>
            </button>
            <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'traps' })}>
              <Medallion name="swords" tint="rose" />
              <span className="flex-1">
                <span className="block font-semibold">Traps & tricks</span>
                <span className="block text-xs text-stone-500">{TRAPS.length} traps people at 400–900 try — learn them, then refute them against Maia.</span>
              </span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="card tile !p-3 text-left" onClick={() => push({ name: 'timeDrill', kind: 'convert' })}>
                <Medallion name="lightning" tint="gold" size={36} />
                <span className="mt-1.5 block font-semibold">Convert on the clock</span>
                <span className="block text-xs text-stone-500">A won ending, 60 seconds to mate.</span>
              </button>
              <button className="card tile !p-3 text-left" onClick={() => push({ name: 'timeDrill', kind: 'quick' })}>
                <Medallion name="flame" tint="violet" size={36} />
                <span className="mt-1.5 block font-semibold">Quick decisions</span>
                <span className="block text-xs text-stone-500">10 obvious moves, 5 seconds each.</span>
              </button>
              <button className="card tile col-span-2 flex items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'vision' })}>
                <Medallion name="eye" tint="blue" size={36} />
                <span className="flex-1">
                  <span className="block font-semibold">Vision</span>
                  <span className="block text-xs text-stone-500">Find squares by name against the clock — see the board faster.</span>
                </span>
              </button>
            </div>
          </div>
        </section>
        <section>
          <h2 className="mb-2 section-title">Openings</h2>
          <button className="card tile mb-2 flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'repertoire' })}>
            <Medallion name="library" tint="green" />
            <span className="flex-1">
              <span className="block font-semibold">My repertoire</span>
              <span className="block text-xs text-stone-500">Choose your openings, train the lines from memory, record your own.</span>
            </span>
          </button>
          <button className="card tile flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'openings' })}>
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
