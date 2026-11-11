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
import { RANKS, STAGES, checkChapters, courseLevel, courseState, stageProgress, type CourseState } from '../lib/course';
import { LevelBadge } from '../components/PuzzleProgress';
import { Segmented } from '../components/ui';
import { MODEL_GAMES } from '../lib/lessons/games';
import { ALL_LESSONS } from '../lib/lessons/data';
import { CoursePath } from '../components/CoursePath';
import { Medallion } from '../components/Glyph';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/** A row inside a grouped card: icon, title, one line, optional badge. */
function Row({ icon, tint, title, sub, onClick, right }: { icon: string; tint?: 'green' | 'gold' | 'rose' | 'blue' | 'violet' | 'stone'; title: string; sub: string; onClick: () => void; right?: ReactNode }) {
  return (
    <button className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-stone-100 dark:active:bg-white/5" onClick={onClick}>
      <Medallion name={icon} tint={tint} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-stone-500">{sub}</span>
      </span>
      {right}
      <ChevronRight size={17} className="shrink-0 text-stone-400" />
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 section-title">{title}</h2>
      <div className="card divide-y divide-stone-100 overflow-hidden !p-0 dark:divide-white/[0.06]">{children}</div>
    </section>
  );
}

export function LearnScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const stackLen = useNav((s) => s.stack.length);
  const [view, setView] = useState<'course' | 'practice'>('course');
  const [progress, setProgress] = useState<Record<string, DrillProgress>>({});
  const [st, setSt] = useState<CourseState | null>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [due, setDue] = useState<string[]>([]);
  const [placed, setPlaced] = useState(true);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab !== 'learn' || stackLen) return;
    void kvGet(DRILL_KEY, {}).then(setProgress);
    void checkChapters().then(courseState).then(setSt);
    void dueLessonIds().then(setDue);
    void kvGet<boolean>('placementDone', false).then(setPlaced);
  }, [tab, stackLen]);
  const lv = st ? courseLevel(st) : null;
  const cur = lv ? lv.chapter.stage : 0;
  const shown = stage ?? cur;
  // Bring the current stage into view the first time the course loads.
  useEffect(() => {
    if (st && stage === null && view === 'course') strip.current?.querySelector(`[data-stage="${cur}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [st, view]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = [...new Set(DRILLS.map((d) => d.group))];
  const nextStep = lv && st && !lv.finished ? lv.chapter.steps.find((s) => !st.done[s.id]) : undefined;
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
      <div className="mx-auto w-full max-w-xl shrink-0 px-4 pb-1">
        <Segmented value={view} onChange={setView} options={[{ value: 'course', label: 'Course' }, { value: 'practice', label: <>Practice{due.length > 0 && <span className="ml-1 rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white">{due.length}</span>}</> }]} />
      </div>
      {view === 'course' ? (
        <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4 pt-3">
          {/* Where you are: your level, the steps of it you have ticked off, and what is next. */}
          <div className="card overflow-hidden !p-0">
            <div className="flex items-center gap-3.5 bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-4 text-white">
              <LevelBadge level={lv?.level ?? 1} tier={cur} pips={0} size={62} className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold tracking-[0.1em] text-white/70 uppercase">{RANKS[cur]} · level {lv?.level ?? '…'} of {lv?.total ?? '…'}</div>
                <div className="truncate font-display text-[21px] leading-tight font-semibold">{lv ? (lv.finished ? 'Course complete' : lv.chapter.title) : '…'}</div>
                {lv && !lv.finished && (
                  <div className="mt-2 flex items-center gap-1.5">
                    {lv.chapter.steps.map((s) => (
                      <span key={s.id} className={`flex h-[18px] flex-1 items-center justify-center rounded-full ${st!.done[s.id] ? 'bg-amber-300 text-amber-950' : 'bg-black/25'}`} style={{ maxWidth: 34 }}>
                        {st!.done[s.id] && <Check size={12} strokeWidth={4} />}
                      </span>
                    ))}
                    <span className="ml-1 text-xs font-semibold text-white/85 tabular-nums">{lv.stepsDone}/{lv.steps}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold tracking-wider text-stone-500 uppercase">Up next</span>
                <span className="block truncate font-semibold">{nextStep ? nextStep.label : st ? 'Everything is ticked off — well done!' : '…'}</span>
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
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="section-title !px-0">The road to 1800</h2>
              <span className="text-xs font-semibold text-stone-500 tabular-nums">{lv ? `${lv.done} of ${lv.total} levels complete` : ''}</span>
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
        </div>
      ) : (
        <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4 pt-3">
          {due.length > 0 && (
            <button className="card tile flex w-full items-center gap-3 !p-3 text-left ring-2 ring-sky-300 dark:ring-sky-500/40" onClick={() => push({ name: 'lesson', lessonId: due[0], mode: 'review' })}>
              <Medallion name="repeat" tint="blue" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Refresh: {lessonById(due[0])?.title}</span>
                <span className="block text-xs text-stone-500">{due.length === 1 ? 'A two-minute refresh is due today.' : `${due.length} lesson refreshes are due.`}</span>
              </span>
              <span className="chip bg-sky-500 text-white">{due.length}</span>
            </button>
          )}
          <Group title="Openings">
            <Row icon="library" tint="green" title="My repertoire" sub="Choose your openings and train the lines from memory" onClick={() => push({ name: 'repertoire' })} />
            <Row icon="eye" tint="blue" title="What you face" sub="Your chess.com openings: results and where you go wrong" onClick={() => push({ name: 'face' })} />
            <Row icon="swords" tint="rose" title="Traps & tricks" sub={`${TRAPS.length} traps people try — learn them, then refute them`} onClick={() => push({ name: 'traps' })} />
            <Row icon="book" tint="stone" title="Opening names & ideas" sub="The main idea behind the common openings" onClick={() => push({ name: 'openings' })} />
          </Group>
          <section>
            <h2 className="mb-2 section-title">Endgame trainer</h2>
            <div className="card divide-y divide-stone-100 overflow-hidden !p-0 dark:divide-white/[0.06]">
              {groups.map((g) => {
                const ds = DRILLS.filter((d) => d.group === g);
                const n = ds.filter((d) => progress[d.id]?.completed).length;
                const open = openGroup === g;
                return (
                  <div key={g}>
                    <button className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-stone-100 dark:active:bg-white/5" aria-expanded={open} onClick={() => setOpenGroup(open ? null : g)}>
                      <Medallion name={ds[0].icon} tint="gold" size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-tight">{g}</span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${(n / ds.length) * 100}%` }} /></span>
                          <span className="text-xs text-stone-500 tabular-nums">{n}/{ds.length} done</span>
                        </span>
                      </span>
                      <ChevronDown size={18} className={`shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="animate-fade-in bg-stone-50/70 dark:bg-black/15">
                        {ds.map((d) => {
                          const p = progress[d.id];
                          return (
                            <button key={d.id} className="flex w-full items-center gap-3 py-2.5 pr-3.5 pl-5 text-left active:bg-stone-100 dark:active:bg-white/5" onClick={() => push({ name: 'endgame', drillId: d.id })}>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${p?.completed ? 'bg-brand-500 text-white' : 'ring-2 ring-stone-300 dark:ring-stone-600'}`}>{p?.completed ? <Check size={12} strokeWidth={4} /> : null}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-semibold leading-tight">{d.title}</span>
                                <span className="block truncate text-xs text-stone-500">{d.goalText}{p?.bestMoves ? ` · best ${p.bestMoves}` : ''}</span>
                              </span>
                              <ChevronRight size={16} className="shrink-0 text-stone-400" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <Group title="Speed & vision">
            <Row icon="eye" tint="blue" title="Vision" sub="Find squares by name against the clock" onClick={() => push({ name: 'vision' })} />
            <Row icon="lightning" tint="gold" title="Convert on the clock" sub="A won ending, 60 seconds to mate" onClick={() => push({ name: 'timeDrill', kind: 'convert' })} />
            <Row icon="flame" tint="violet" title="Quick decisions" sub="Ten obvious moves, five seconds each" onClick={() => push({ name: 'timeDrill', kind: 'quick' })} />
          </Group>
          <Group title="Library">
            <Row icon="cap" tint="green" title="All lessons" sub={`${ALL_LESSONS.length} lessons, grouped by stage`} onClick={() => push({ name: 'library' })} />
            <Row icon="scroll" tint="gold" title="Model games" sub={`${MODEL_GAMES.length} famous games — guess the key moves`} onClick={() => push({ name: 'library' })} />
          </Group>
        </div>
      )}
    </div>
  );
}
