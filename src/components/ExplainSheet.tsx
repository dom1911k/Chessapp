// "Explain this move": a full panel over the Game Review. Coach Sam looks deeper with the engine
// (several candidate moves before, the best reply after), then explains in plain words what happened,
// why it was good or bad, what was better and why — with the lines playable on a board.
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, GraduationCap, Microscope, X } from 'lucide-react';
import { Board } from './Board';
import { CoachAvatar } from './Coach';
import { ReviewIcon } from './ReviewIcon';
import { Spinner, useBackHandler } from './ui';
import { getEngine } from '../lib/engine';
import { analysisLimits } from '../lib/engine/speed';
import { explainInDepth, type DeepExplanation, type ExplainLine } from '../lib/coach/explain';
import { parseUci } from '../lib/chess/game';
import { RC, isBad, type ReviewClass } from '../lib/review';
import { useNav } from '../lib/nav';
import type { PlyRecord } from '../lib/store/types';

const OWNER = 'explain';

export function ExplainSheet({ p, cls, isUser, orientation, onClose }: { p: PlyRecord; cls: ReviewClass; isUser: boolean; orientation: 'white' | 'black'; onClose: () => void }) {
  useBackHandler(onClose, true);
  const push = useNav((s) => s.push);
  const [e, setE] = useState<DeepExplanation | null>(null);
  const [failed, setFailed] = useState(false);
  const [lineId, setLineId] = useState<string>('played');
  const [k, setK] = useState(1);

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

  const line: ExplainLine | undefined = e?.lines.find((l) => l.id === lineId);
  const pick = (id: string) => {
    setLineId(id);
    setK(1);
  };
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

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-stone-100 dark:bg-stone-950">
      <header className="safe-top flex shrink-0 items-center gap-2 px-3 py-2">
        <span className="font-display flex-1 text-lg font-semibold">Move explained</span>
        <button aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 active:bg-stone-200 dark:active:bg-stone-800" onClick={onClose}>
          <X size={22} />
        </button>
      </header>
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-3 pb-6 land:max-w-5xl">
        <div className="land:grid land:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] land:gap-5">
          {/* Board with the selected line */}
          <div className="land:sticky land:top-0 land:self-start">
            <div className="mx-auto max-w-[420px]">
              <Board fen={shown.fen} orientation={orientation} movable={null} onMove={() => false} lastMove={shown.last} />
            </div>
            {e && e.lines.length > 0 && (
              <>
                <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                  {e.lines.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => pick(l.id)}
                      className={`chip shrink-0 !py-1 !text-[13px] ring-1 transition-colors ${
                        l.id === lineId
                          ? l.tone === 'bad'
                            ? 'bg-red-600 text-white ring-red-600'
                            : l.tone === 'good'
                              ? 'bg-emerald-600 text-white ring-emerald-600'
                              : 'bg-stone-800 text-white ring-stone-800 dark:bg-stone-100 dark:text-stone-900'
                          : 'bg-white text-stone-700 ring-stone-200 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/10'
                      }`}
                    >
                      {l.label}
                      {l.score && <span className="opacity-70 tabular-nums">{l.score}</span>}
                    </button>
                  ))}
                </div>
                {line && (
                  <div className="mt-2 flex flex-wrap gap-x-1 gap-y-0.5 text-[13px]">
                    {line.san.map((s, i) => (
                      <button key={i} onClick={() => setK(i + 1)} className={`rounded px-1 font-semibold ${i + 1 === k ? 'bg-brand-600 text-white' : 'text-stone-600 dark:text-stone-300'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <StepBtn label="Start of line" onClick={() => setK(0)} disabled={k <= 0}><ChevronFirst size={20} /></StepBtn>
                  <StepBtn label="Back" onClick={() => setK(Math.max(0, k - 1))} disabled={k <= 0}><ChevronLeft size={22} /></StepBtn>
                  <StepBtn label="Forward" onClick={() => setK(Math.min(n, k + 1))} disabled={k >= n} primary><ChevronRight size={22} /></StepBtn>
                  <StepBtn label="End of line" onClick={() => setK(n)} disabled={k >= n}><ChevronLast size={20} /></StepBtn>
                </div>
              </>
            )}
          </div>

          {/* The explanation */}
          <div className="mt-3 space-y-2.5 land:mt-0">
            {!e && !failed && (
              <div className="card flex items-center gap-3 !p-4">
                <CoachAvatar mood="thinking" size={40} />
                <div>
                  <div className="font-semibold">Coach Sam is looking deeper…</div>
                  <div className="flex items-center gap-1.5 text-sm text-stone-500"><Spinner className="!h-3 !w-3" /> checking the best lines</div>
                </div>
              </div>
            )}
            {failed && <div className="card !p-4 text-sm text-stone-500">The engine couldn’t look at this move right now. Try again in a moment.</div>}
            {e && (
              <>
                <div className="card !p-4">
                  <div className="flex items-start gap-2.5">
                    <ReviewIcon cls={cls} size={26} />
                    <p className="text-[16px] leading-snug font-semibold" style={{ color: bad ? RC[cls].color : undefined }}>{e.headline}</p>
                  </div>
                  <Swing wpBefore={e.swing.wpBefore} wpAfter={e.swing.wpAfter} before={e.swing.before} after={e.swing.after} you={isUser} />
                </div>
                {e.sections.map((s) => (
                  <section key={s.title} className={`card !p-4 ${s.title === 'Remember' ? '!bg-amber-50 !ring-amber-200 dark:!bg-amber-950/30 dark:!ring-amber-900/50' : ''}`}>
                    <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-stone-500 uppercase">{s.title}</h3>
                    <ul className="space-y-1.5 text-[14.5px] leading-snug">
                      {s.points.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </section>
                ))}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className="btn-secondary w-full" onClick={() => (onClose(), push({ name: 'explore', fen: p.fenBefore, orientation, title: 'Try your own moves' }))}>
                    <Microscope size={17} /> Try your own moves from here
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
      </div>
    </div>
  );
}

/** Winning chances before → after, as two bars. */
function Swing({ wpBefore, wpAfter, before, after, you }: { wpBefore: number; wpAfter: number; before: string; after: string; you: boolean }) {
  const drop = wpAfter < wpBefore;
  return (
    <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-stone-500">Before</span>
      <Bar pct={wpBefore} tone="neutral" />
      <span className="w-20 text-right font-semibold tabular-nums">{wpBefore}% · {before}</span>
      <span className="text-stone-500">After</span>
      <Bar pct={wpAfter} tone={Math.abs(wpAfter - wpBefore) < 3 ? 'neutral' : drop ? 'bad' : 'good'} />
      <span className="w-20 text-right font-semibold tabular-nums">{wpAfter}% · {after}</span>
      <span className="col-span-3 text-[11px] text-stone-400">{you ? 'Your' : 'Their'} winning chances</span>
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: 'neutral' | 'bad' | 'good' }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
      <div className={`h-full rounded-full transition-[width] duration-700 ${tone === 'bad' ? 'bg-red-500' : tone === 'good' ? 'bg-emerald-500' : 'bg-stone-400'}`} style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

function StepBtn({ children, onClick, disabled, label, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string; primary?: boolean }) {
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className={`flex h-10 items-center justify-center rounded-xl disabled:opacity-30 ${primary ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-stone-200 dark:bg-white/[0.04] dark:ring-white/10'}`}>
      {children}
    </button>
  );
}
