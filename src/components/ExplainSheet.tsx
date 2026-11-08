// "Explain this move": a full panel over the Game Review. Coach Sam looks deeper with the engine
// (several candidate moves before, the best reply after), then explains in plain words what happened,
// why it was good or bad, what was better and why — with the lines playable on a board.
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, GraduationCap, Microscope, Pause, Play, X } from 'lucide-react';
import { Board } from './Board';
import { CoachAvatar } from './Coach';
import { ReviewIcon } from './ReviewIcon';
import { Segmented, Spinner, useBackHandler } from './ui';
import { getEngine } from '../lib/engine';
import { analysisLimits } from '../lib/engine/speed';
import { annotateLine, explainInDepth, type DeepExplanation, type ExplainLine } from '../lib/coach/explain';
import { parseUci } from '../lib/chess/game';
import { RC, isBad, type ReviewClass } from '../lib/review';
import { useNav } from '../lib/nav';
import { maiaLogits, maiaParams } from '../lib/maia';
import { difficultyOf, difficultySentence, moveShare, DIFFICULTY_LABEL } from '../lib/coach/difficulty';
import { CAUSE_INFO, type MistakeCause } from '../lib/games/causes';
import { CauseIcon } from './Causes';
import type { PlyRecord } from '../lib/store/types';

const OWNER = 'explain';

export function ExplainSheet({ p, cls, isUser, orientation, onClose, history, rating, cause }: { p: PlyRecord; cls: ReviewClass; isUser: boolean; orientation: 'white' | 'black'; onClose: () => void; history?: string[]; rating?: number | null; cause?: MistakeCause }) {
  useBackHandler(onClose, true);
  const push = useNav((s) => s.push);
  const [e, setE] = useState<DeepExplanation | null>(null);
  const [failed, setFailed] = useState(false);
  const [lineId, setLineId] = useState<string>('played');
  const [k, setK] = useState(1);
  const [playing, setPlaying] = useState(false);
  // Your colour: the mover's if this was your move, otherwise the other side's.
  const mover = p.fenBefore.split(' ')[1] as 'w' | 'b';
  const you = isUser ? mover : mover === 'w' ? 'b' : 'w';

  useEffect(() => {
    let live = true;
    const eng = getEngine();
    const depth = Math.max(12, analysisLimits().depth + 2);
    void Promise.all([eng.analyze(p.fenBefore, { depth, multipv: 3, owner: OWNER }), eng.analyze(p.fenAfter, { depth, owner: OWNER })])
      .then(([before, after]) => {
        if (!live) return;
        const x = explainInDepth({ fenBefore: p.fenBefore, uci: p.uci, isUser, verdict: cls, before, after });
        setE(x);
        setLineId(x.lines[0]?.id ?? 'played');
        setK(1);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      eng.cancelAll(OWNER);
    };
  }, [p, cls, isUser]);

  // How hard was it? Maia's estimate of how many players at this rating find each move.
  const [hard, setHard] = useState<{ best: number; played: number; bestSan: string; same: boolean; rating: number } | null>(null);
  useEffect(() => {
    if (!e || !rating || !history?.length) return;
    let live = true;
    const best = e.lines.find((l) => l.id === 'best');
    const bestUci = best?.uci[0] ?? p.uci;
    const bestSan = best?.san[0] ?? p.san;
    maiaLogits(history, rating)
      .then((logits) => {
        if (live && logits.size) setHard({ best: moveShare(logits, bestUci), played: moveShare(logits, p.uci), bestSan, same: bestUci === p.uci, rating: maiaParams(rating).rating });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [e, rating, history, p]);

  const line: ExplainLine | undefined = e?.lines.find((l) => l.id === lineId);
  const notes = useMemo(() => (line ? annotateLine(line.fen, line.uci, you) : []), [line, you]);
  const pick = (id: string) => {
    setLineId(id);
    setK(1);
    setPlaying(false);
  };
  // Auto-play: one move every 1.8 s, stopping at the end of the line.
  useEffect(() => {
    if (!playing) return;
    if (k >= notes.length) return setPlaying(false);
    const t = setTimeout(() => setK((x) => x + 1), 1800);
    return () => clearTimeout(t);
  }, [playing, k, notes.length]);
  const note = k > 0 ? notes[k - 1] : null;
  // The board position k moves into the selected line.
  const shown = (() => {
    if (!line) return { fen: p.fenAfter, last: { from: p.uci.slice(0, 2), to: p.uci.slice(2, 4) } };
    const c = new Chess(line.fen);
    let last: { from: string; to: string } | null = null;
    for (const u of line.uci.slice(0, k)) {
      try {
        const m = c.move(parseUci(u));
        last = { from: m.from, to: m.to };
      } catch {
        break;
      }
    }
    return { fen: c.fen(), last };
  })();
  const n = line?.san.length ?? 0;
  const bad = isBad(cls);

  const [tab, setTab] = useState<'why' | 'moves' | 'better'>('why');
  const sec = (t: string) => e?.sections.find((x) => x.title === t || x.title.startsWith(t));
  const whySec = e?.sections.find((x) => x.title.startsWith('Why it'));
  const punish = sec('How to punish');
  const better = e?.sections.find((x) => x.title === 'What was better' || x.title === 'What they should have played');
  const others = sec('Other good moves');
  const remember = sec('Remember');
  const tone = bad ? RC[cls].color : undefined;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-stone-100 dark:bg-stone-950">
      <header className="safe-top flex shrink-0 items-center gap-3 border-b border-stone-200/70 px-3 py-2 dark:border-white/[0.06]">
        <ReviewIcon cls={cls} size={28} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display truncate text-[17px] font-semibold">{p.san} <span className="font-sans text-sm font-semibold" style={{ color: tone }}>· {RC[cls].label}</span></div>
          <div className="text-xs text-stone-500">{isUser ? 'Your move' : 'Their move'} explained</div>
        </div>
        <button aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 active:bg-stone-200 dark:active:bg-stone-800" onClick={onClose}>
          <X size={22} />
        </button>
      </header>
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-3 pt-3 pb-8 land:max-w-5xl">
        <div className="land:grid land:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] land:gap-5">
          {/* Verdict, board and the line player */}
          <div className="land:sticky land:top-0 land:self-start">
            {e ? (
              <div className="mb-3 flex items-start gap-3">
                <CoachAvatar mood={bad && isUser ? 'concerned' : 'happy'} size={40} />
                <div className="card min-w-0 flex-1 !rounded-[18px] !rounded-tl-md !px-3.5 !py-3">
                  <p className="text-[15px] leading-snug font-semibold" style={{ color: tone }}>{e.headline}</p>
                  <Swing wpBefore={e.swing.wpBefore} wpAfter={e.swing.wpAfter} before={e.swing.before} after={e.swing.after} you={isUser} />
                </div>
              </div>
            ) : !failed ? (
              <div className="mb-3 flex items-center gap-3">
                <CoachAvatar mood="thinking" size={40} />
                <div className="card flex-1 !rounded-[18px] !rounded-tl-md !px-3.5 !py-3">
                  <div className="font-semibold">Coach Sam is looking deeper…</div>
                  <div className="flex items-center gap-1.5 text-sm text-stone-500"><Spinner className="!h-3 !w-3" /> checking the best lines</div>
                </div>
              </div>
            ) : (
              <div className="card mb-3 !p-4 text-sm text-stone-500">The engine couldn’t look at this move right now. Try again in a moment.</div>
            )}

            <div className="mx-auto max-w-[440px] overflow-hidden rounded-[10px] shadow-[0_10px_30px_-12px_rgba(40,20,5,0.45)]">
              <Board fen={shown.fen} orientation={orientation} movable={null} onMove={() => false} lastMove={shown.last} />
            </div>

            {e && e.lines.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
                  {e.lines.map((l) => {
                    const on = l.id === lineId;
                    const dot = l.tone === 'bad' ? 'bg-red-500' : l.tone === 'good' ? 'bg-emerald-500' : 'bg-stone-400';
                    return (
                      <button
                        key={l.id}
                        onClick={() => pick(l.id)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition-colors ${
                          on ? 'bg-stone-900 text-white ring-stone-900 dark:bg-stone-50 dark:text-stone-900 dark:ring-stone-50' : 'bg-white text-stone-700 ring-stone-200 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/10'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${dot}`} />
                        {l.label}
                        {l.score && <span className="font-medium tabular-nums opacity-60">{l.score}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Transport */}
                <div className="flex items-center gap-1.5">
                  <StepBtn label="Start of line" onClick={() => (setPlaying(false), setK(0))} disabled={k <= 0}><ChevronFirst size={19} /></StepBtn>
                  <StepBtn label="Back" onClick={() => (setPlaying(false), setK(Math.max(0, k - 1)))} disabled={k <= 0}><ChevronLeft size={21} /></StepBtn>
                  <button
                    aria-label={playing ? 'Pause' : 'Play the line'}
                    onClick={() => (k >= n ? (setK(0), setPlaying(true)) : setPlaying(!playing))}
                    className="flex h-10 flex-[1.6] items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-[0_6px_14px_-8px_rgba(27,90,60,0.8)] active:scale-[0.98]"
                  >
                    {playing ? <><Pause size={17} /> Pause</> : <><Play size={17} /> {k >= n ? 'Replay' : 'Play line'}</>}
                  </button>
                  <StepBtn label="Forward" onClick={() => (setPlaying(false), setK(Math.min(n, k + 1)))} disabled={k >= n}><ChevronRight size={21} /></StepBtn>
                  <StepBtn label="End of line" onClick={() => (setPlaying(false), setK(n))} disabled={k >= n}><ChevronLast size={19} /></StepBtn>
                </div>

                {/* Commentary on the move on the board (chess.com's follow-up) */}
                <div key={`${lineId}:${k}`} className="animate-pop card min-h-[92px] !p-3.5">
                  {note ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <span className={`h-2 w-2 rounded-full ${note.who === 'you' ? 'bg-brand-500' : 'bg-stone-400'}`} />
                          {note.label}
                          <span className="text-xs font-semibold text-stone-400">{note.who === 'you' ? 'You' : 'Them'} · {k}/{n}</span>
                        </span>
                        {note.material !== 0 && (
                          <span className={`chip tabular-nums ${note.material > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'}`}>
                            {note.material > 0 ? '+' : '−'}{Math.abs(note.material)} material
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[14.5px] leading-snug">{note.text}</p>
                    </>
                  ) : (
                    <p className="text-[14px] leading-snug text-stone-500">
                      {line?.id === 'played' ? 'The position before the move.' : 'The start of the line.'} Press <b className="text-stone-700 dark:text-stone-200">Play line</b> to watch it unfold — each move is explained here.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* The explanation, in three tabs */}
          {e && (
            <div className="mt-4 land:mt-0">
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'why', label: 'Why' },
                  { value: 'moves', label: 'Moves' },
                  { value: 'better', label: isUser || !bad ? 'Better' : 'Punish' },
                ]}
              />
              <div className="card mt-2.5 divide-y divide-stone-100 !p-0 dark:divide-white/[0.06]">
                {tab === 'why' && (
                  <>
                    {whySec && (
                      <Block title={whySec.title}>
                        <Points list={whySec.points} />
                      </Block>
                    )}
                    {cause && isUser && (
                      <Block title="Why it happened" icon={<CauseIcon c={cause.cause} />} right={<span className="chip bg-stone-100 text-stone-600 dark:bg-white/[0.06] dark:text-stone-300">{CAUSE_INFO[cause.cause].label}</span>}>
                        <p>{cause.text}</p>
                        {cause.secs !== undefined && (
                          <p className={`mt-1 text-[13px] ${cause.fast || cause.timeTrouble ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-stone-500'}`}>
                            {cause.secs < 10 ? cause.secs.toFixed(1) : Math.round(cause.secs)} seconds on the clock{cause.timeTrouble ? ' — with very little time left.' : cause.fast ? ' — a quick safety check would likely have caught it.' : '.'}
                          </p>
                        )}
                        <p className="mt-1.5 text-[13px] text-stone-500">{CAUSE_INFO[cause.cause].tip}</p>
                      </Block>
                    )}
                    {hard && (
                      <Block
                        title="How hard was it to find?"
                        right={
                          <span className={`chip ${difficultyOf(hard.best) === 'easy' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : difficultyOf(hard.best) === 'moderate' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
                            {DIFFICULTY_LABEL[difficultyOf(hard.best)]}
                          </span>
                        }
                      >
                        <div className="mb-2.5 flex items-center gap-2.5">
                          <span className="font-display w-14 text-2xl leading-none font-semibold tabular-nums">{Math.round(hard.best * 100)}%</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.max(2, hard.best * 100)}%` }} />
                          </div>
                        </div>
                        <Points list={difficultySentence({ bestSan: hard.bestSan, bestShare: hard.best, playedSan: p.san, playedShare: hard.played, rating: hard.rating, isUser, same: hard.same })} />
                        <p className="mt-1.5 text-[11px] text-stone-400">Estimated with Maia, trained on millions of human games.</p>
                      </Block>
                    )}
                    {remember && (
                      <Block title="Remember">
                        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] leading-snug text-amber-950 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/20">{remember.points[0]}</p>
                      </Block>
                    )}
                  </>
                )}
                {tab === 'moves' && line && (
                  <Block title={line.label} right={<span className="text-xs text-stone-400">tap a move to jump there</span>}>
                    <ol className="-mx-1.5 space-y-0.5">
                      {notes.map((x, i) => (
                        <li key={i}>
                          <button
                            onClick={() => (setPlaying(false), setK(i + 1))}
                            className={`flex w-full gap-2.5 rounded-xl px-1.5 py-1.5 text-left text-[13.5px] leading-snug transition-colors ${i + 1 === k ? 'bg-brand-50 ring-1 ring-brand-500/30 dark:bg-brand-500/10' : 'active:bg-stone-100 dark:active:bg-white/5'}`}
                          >
                            <span className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${x.who === 'you' ? 'bg-brand-500' : 'bg-stone-400'}`} />
                            <span>
                              <b>{x.label}</b> <span className="text-stone-700 dark:text-stone-200">{x.text}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </Block>
                )}
                {tab === 'better' && (
                  <>
                    {punish && <Block title={punish.title}><Points list={punish.points} /></Block>}
                    {better && <Block title={better.title}><Points list={better.points} /></Block>}
                    {others && <Block title="Other good moves"><Points list={others.points} /></Block>}
                    {!punish && !better && !others && <Block title="Better moves"><p className="text-stone-500">This was already the best move — nothing better here.</p></Block>}
                    <div className="grid gap-2 p-3.5 sm:grid-cols-2">
                      <button className="btn-secondary w-full" onClick={() => (onClose(), push({ name: 'explore', fen: p.fenBefore, orientation, title: 'Try your own moves' }))}>
                        <Microscope size={17} /> Try your own moves
                      </button>
                      {e.lesson && (
                        <button className="btn-secondary w-full" onClick={() => (onClose(), push({ name: 'practice', theme: e.lesson!.theme }))}>
                          <GraduationCap size={17} /> Practise this pattern
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A titled section inside the explanation card. */
function Block({ title, icon, right, children }: { title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-4 py-3.5 text-[14.5px] leading-snug">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-stone-500 uppercase">
          {icon}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Points({ list }: { list: string[] }) {
  return (
    <ul className="space-y-1.5">
      {list.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300 dark:bg-stone-600" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** Winning chances before → after: one bar with the old level as a ghost and the new one solid. */
function Swing({ wpBefore, wpAfter, before, after, you }: { wpBefore: number; wpAfter: number; before: string; after: string; you: boolean }) {
  const delta = wpAfter - wpBefore;
  const color = Math.abs(delta) < 3 ? 'bg-stone-400' : delta < 0 ? 'bg-red-500' : 'bg-emerald-500';
  return (
    <div className="mt-2.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-stone-500">{you ? 'Your' : 'Their'} winning chances</span>
        <span className="font-semibold tabular-nums">
          <span className="text-stone-400">{wpBefore}%</span> → <span style={{ color: Math.abs(delta) < 3 ? undefined : delta < 0 ? '#dc2626' : '#059669' }}>{wpAfter}%</span>
          <span className="ml-1.5 font-medium text-stone-400">({before} → {after})</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full bg-stone-400/40" style={{ width: `${Math.max(2, wpBefore)}%` }} />
        <div className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ${color}`} style={{ width: `${Math.max(2, wpAfter)}%` }} />
      </div>
    </div>
  );
}

function StepBtn({ children, onClick, disabled, label, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; primary?: boolean }) {
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className={`flex h-10 flex-1 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-30 ${primary ? 'bg-brand-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/10'}`}>
      {children}
    </button>
  );
}
