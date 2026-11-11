// Game Review, chess.com style. First a summary (Coach Sam's take, both players' accuracy, the
// move classes, phases, key moments), then a steady step-through: eval bar + board, a move strip,
// a fixed-size coach panel, Best / Retry / Next, and the arrows at the bottom.
import { CAUSE_LESSON } from '../lib/course';
import { lessonById } from '../lib/lessons/data';
import { GraduationCap } from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlipVertical2, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, RotateCcw, Sparkles, TriangleAlert, Lightbulb, MessageCircleQuestion, Microscope } from 'lucide-react';
import { Board } from '../components/Board';
import { EvalGraph } from '../components/Charts';
import { CoachAvatar, Portrait } from '../components/Coach';
import { Header, Spinner } from '../components/ui';
import { ReviewIcon } from '../components/ReviewIcon';
import { ExplainSheet } from '../components/ExplainSheet';
import { CauseBreakdown, CauseIcon } from '../components/Causes';
import { CAUSE_INFO, causeTotals, missedChances, mistakeCauses, type MistakeCause } from '../lib/games/causes';
import { plyTimes } from '../lib/timestats';

/** Seconds per ply, when the game was played with a clock. */
const timesOf = (g: AnyGame) => (g.clocks?.length && g.timeControl && /^\d+(\+\d+)?$/.test(g.timeControl) ? plyTimes(g.plies, g.clocks, g.timeControl) : undefined);
import { ChessComBadge, TimeStatsCard } from '../components/ChessCom';
import { useNav } from '../lib/nav';
import { loadAnyGame } from '../lib/games';
import { opponentById } from '../lib/people';
import { formatDate } from '../lib/store/finish';
import { db } from '../lib/db';
import { getGameRating } from '../lib/rewards/rating';
import { formatLine, lineToSan, tryMove, type MoveInput } from '../lib/chess/game';
import { classify, formatScore, povScore, winPct } from '../lib/chess/evaluation';
import { shortWords } from '../lib/chess/words';
import { getEngine } from '../lib/engine';
import { isBad, moveNo, RC, REVIEW_ORDER, reviewGame, type Review, type ReviewClass } from '../lib/review';
import { PHASES } from '../lib/games/mistakes';
import { THEMES } from '../lib/themes';
import { trapById, trapCard, trapForLoss } from '../lib/traps';
import { playSound } from '../lib/sound';
import type { AnyGame, ImportedGame } from '../lib/store/types';

export function GameReviewScreen({ gameId, ply }: { gameId: number | string; ply?: number }) {
  const [g, setG] = useState<AnyGame | null | undefined>(undefined);
  const [step, setStep] = useState<number | null>(ply ?? null);
  useEffect(() => void loadAnyGame(gameId).then(setG), [gameId]);
  const review = useMemo(() => (g ? reviewGame(g) : null), [g]);
  // A quick chess.com loss to a known trap: make sure that trap is in the daily reviews.
  const trap = g && g.source === 'chess.com' ? trapForLoss(g) : null;
  useEffect(() => {
    if (!trap || !g) return;
    void db.cards.get(`t:${trap.id}`).then(async (c) => {
      if (!c) await db.cards.put(trapCard(trapById(trap.id)!, Date.now(), g as ImportedGame));
    });
  }, [trap?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g || !review) return <div className="flex h-full items-center justify-center">{g === null ? <p className="text-stone-500">Game not found.</p> : <Spinner />}</div>;
  if (step !== null) return <StepView g={g} r={review} start={step} onSummary={() => setStep(null)} />;
  return <SummaryView g={g} r={review} trap={trap?.id} onStart={(i) => setStep(i)} />;
}

const pending = (g: AnyGame) => g.source === 'chess.com' && !(g as ImportedGame).analyzed;
const oppName = (g: AnyGame) => g.opponentName ?? opponentById(g.opponentId)?.name ?? 'Bot';

function PlayerChip({ g, me }: { g: AnyGame; me: boolean }) {
  const o = opponentById(g.opponentId);
  return (
    <span className="flex min-w-0 flex-col items-center gap-1">
      {me ? (
        <UserAvatar size={44} />
      ) : o ? (
        <Portrait id={o.id} size={44} />
      ) : (
        <span className="flex h-11 w-11 items-center justify-center rounded-[30%] bg-[#769656] text-lg font-black text-white">{oppName(g)[0]?.toUpperCase()}</span>
      )}
      <span className="max-w-full truncate text-xs font-semibold">{me ? 'You' : oppName(g)}</span>
    </span>
  );
}

function SummaryView({ g, r, trap, onStart }: { g: AnyGame; r: Review; trap?: string; onStart: (ply: number) => void }) {
  const push = useNav((s) => s.push);
  const meWhite = g.userColor === 'w';
  const resultText = g.userResult === 'win' ? 'You won' : g.userResult === 'loss' ? 'You lost' : 'Draw';
  const lesson = g.summary.pattern?.theme ?? g.summary.lessonTheme;
  const firstBad = r.plies.findIndex((p, i) => g.plies[i].isUser && isBad(p.cls));
  const cls = useMemo(() => r.plies.map((x) => x.cls), [r]);
  const causes = useMemo(() => (pending(g) ? [] : mistakeCauses(g, cls)), [g, cls]);
  const missed = useMemo(() => (pending(g) ? [] : missedChances(g, cls)), [g, cls]);
  const totals = causeTotals(causes);
  const times = useMemo(() => timesOf(g), [g]);
  const topCause = causes.length ? (Object.keys(CAUSE_INFO) as (keyof typeof CAUSE_INFO)[]).filter((k) => k !== 'fast' && k !== 'timeTrouble').reduce((a, b) => (totals[b] > totals[a] ? b : a)) : null;
  const [allRows, setAllRows] = useState(false);
  const rows = REVIEW_ORDER.filter((c) => allRows || r.me.counts[c] + r.them.counts[c] > 0);
  const resultTone = g.userResult === 'win' ? 'bg-emerald-600 text-white' : g.userResult === 'loss' ? 'bg-stone-700 text-white dark:bg-stone-200 dark:text-stone-900' : 'bg-stone-400 text-white';
  const accNum = (acc: number, white: boolean) => (
    <span className={`font-display inline-flex min-w-[78px] justify-center rounded-xl px-3 py-1.5 text-[26px] leading-none font-semibold tabular-nums ${white ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200 dark:ring-transparent' : 'bg-stone-900 text-white ring-1 ring-stone-900 dark:bg-black/40 dark:ring-white/10'}`}>
      {acc.toFixed(1)}
    </span>
  );
  return (
    <div className="flex h-full flex-col">
      <Header title="Game Review" back subtitle={`vs ${oppName(g)} · ${formatDate(g.endedAt)}`} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4 pb-28">
        {/* Hero: result, players and accuracy, and Coach Sam's take */}
        <div className="card overflow-hidden !p-0">
          <div className="flex items-center justify-center gap-2 pt-3.5">
            <span className={`chip !px-3 !py-1 text-[13px] ${resultTone}`}>{resultText}</span>
            <span className="text-[13px] text-stone-500">by {g.reason}</span>
            {g.source === 'chess.com' && <ChessComBadge />}
            {g.match && <span className="chip bg-brand-100 text-[10px] text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">Match</span>}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3 pb-4">
            <div className="flex flex-col items-center gap-2">
              <PlayerChip g={g} me />
              {!pending(g) && accNum(r.me.accuracy, meWhite)}
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">{pending(g) ? 'vs' : 'Accuracy'}</span>
            <div className="flex flex-col items-center gap-2">
              <PlayerChip g={g} me={false} />
              {!pending(g) && accNum(r.them.accuracy, !meWhite)}
            </div>
          </div>
          <div className="flex gap-3 border-t border-stone-100 bg-stone-50/70 px-4 py-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <CoachAvatar mood={g.userResult === 'loss' ? 'concerned' : 'happy'} size={36} />
            <div className="min-w-0 flex-1 text-[14.5px] leading-snug">
              {pending(g) ? <p>I haven't analysed this chess.com game yet — it's in the queue. You can already step through the moves.</p> : r.summary.map((t, i) => <p key={i} className={i ? 'mt-1.5' : ''}>{t}</p>)}
            </div>
          </div>
        </div>

        {trap && (
          <div className="card flex items-center gap-3 !p-3.5 ring-2 !ring-red-400/60">
            <span className="flex-1 text-sm">
              <b>Lost to a known trap: {trapById(trap)!.name}.</b> It's in your daily reviews now.
            </span>
            <button className="btn-secondary !py-1.5 text-sm" onClick={() => push({ name: 'trap', trapId: trap })}>Learn it</button>
          </div>
        )}

        {!pending(g) && (
          <Sec title="Moves">
            <div className="card !px-3 !py-2">
              <div className="divide-y divide-stone-100 dark:divide-white/[0.05]">
                {rows.map((c) => (
                  <div key={c} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center py-1.5 text-[14px]">
                    <span className="text-center font-bold tabular-nums" style={{ color: r.me.counts[c] ? RC[c].color : undefined, opacity: r.me.counts[c] ? 1 : 0.25 }}>{r.me.counts[c]}</span>
                    <span className="flex items-center justify-center gap-2">
                      <ReviewIcon cls={c} size={18} />
                      <span className="w-24">{RC[c].label}</span>
                    </span>
                    <span className="text-center font-bold tabular-nums" style={{ color: r.them.counts[c] ? RC[c].color : undefined, opacity: r.them.counts[c] ? 1 : 0.25 }}>{r.them.counts[c]}</span>
                  </div>
                ))}
              </div>
              {rows.length < REVIEW_ORDER.length || allRows ? (
                <button className="mt-1 w-full py-1.5 text-xs font-semibold text-stone-500 active:text-stone-800" onClick={() => setAllRows(!allRows)}>
                  {allRows ? 'Show fewer' : 'Show all move types'}
                </button>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PHASES.map((ph) => (
                <div key={ph} className="card flex flex-col items-center gap-1 !px-2 !py-2.5">
                  <span className="text-[11px] font-semibold tracking-wide text-stone-500 capitalize">{ph}</span>
                  <span className="flex items-center gap-2">
                    {r.me.phases[ph] ? <ReviewIcon cls={r.me.phases[ph]!.cls} size={22} /> : <span className="w-[22px] text-center text-stone-300">–</span>}
                    <span className="text-[10px] text-stone-400">vs</span>
                    {r.them.phases[ph] ? <ReviewIcon cls={r.them.phases[ph]!.cls} size={18} className="opacity-70" /> : <span className="w-[18px] text-center text-stone-300">–</span>}
                  </span>
                </div>
              ))}
            </div>
          </Sec>
        )}

        {!pending(g) && (
          <Sec title="Evaluation">
            <div className="card !p-3">
              <EvalGraph plies={g.plies} onSelect={onStart} times={times} />
              {times && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#2f9e63]" /> Your time</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#a8a29e]" /> Theirs</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#f59e0b]" /> Longest thinks</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#dc2626]" /> Mistake in under 5 s</span>
                </div>
              )}
            </div>
          </Sec>
        )}

        {r.moments.length > 0 && (
          <Sec title="Key moments">
            <div className="card divide-y divide-stone-100 !p-0 dark:divide-white/[0.05]">
              {r.moments.map((m) => (
                <Row key={m.ply} onClick={() => onStart(m.ply)} icon={<ReviewIcon cls={r.plies[m.ply].cls} size={20} />}>
                  {m.text}
                </Row>
              ))}
            </div>
          </Sec>
        )}

        {causes.length > 0 && (
          <Sec title="Your mistakes">
            <div className="card !p-0">
              <div className="p-3.5 pb-1">
                <CauseBreakdown bare r={{ mistakes: causes.length, totals, top: topCause ? { cause: topCause as MistakeCause['cause'], share: totals[topCause] / causes.length } : null }} />
              </div>
              {topCause && lessonById(CAUSE_LESSON[topCause]) && (
                <button className="mx-3.5 mb-3 flex w-[calc(100%-1.75rem)] items-center gap-3 rounded-2xl bg-brand-50 px-3 py-2.5 text-left ring-1 ring-brand-100 transition active:scale-[0.98] dark:bg-brand-700/15 dark:ring-brand-700/30" onClick={() => push({ name: 'lesson', lessonId: CAUSE_LESSON[topCause] })}>
                  <GraduationCap size={20} className="shrink-0 text-brand-700 dark:text-brand-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold tracking-wider text-brand-700 uppercase dark:text-brand-500">Lesson for this</span>
                    <span className="block truncate font-semibold">{lessonById(CAUSE_LESSON[topCause])!.title}</span>
                  </span>
                  <span className="text-sm font-semibold text-brand-700 dark:text-brand-500">Study</span>
                </button>
              )}
              <div className="divide-y divide-stone-100 border-t border-stone-100 dark:divide-white/[0.05] dark:border-white/[0.05]">
                {causes.map((m) => (
                  <Row key={m.ply} onClick={() => onStart(m.ply)} icon={<ReviewIcon cls={r.plies[m.ply].cls} size={20} />}>
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold">
                      {moveNo(g.plies, m.ply)} {g.plies[m.ply].san}
                      <span className="chip bg-stone-100 !px-2 !text-[11px] font-semibold text-stone-600 dark:bg-white/[0.06] dark:text-stone-300"><CauseIcon c={m.cause} /> {CAUSE_INFO[m.cause].label}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-stone-600 dark:text-stone-300">
                      {m.text}
                      {m.secs !== undefined && <span className={`whitespace-nowrap ${m.fast || m.timeTrouble ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-stone-400'}`}> · {m.secs < 10 ? m.secs.toFixed(1) : Math.round(m.secs)} s{m.timeTrouble ? ', time trouble' : m.fast ? ', fast' : ''}</span>}
                    </span>
                  </Row>
                ))}
              </div>
            </div>
          </Sec>
        )}

        {missed.length > 0 && (
          <Sec title="Missed chances">
            <div className="card divide-y divide-stone-100 !p-0 dark:divide-white/[0.05]">
              {missed.map((m) => (
                <Row key={m.ply} onClick={() => onStart(m.ply)} icon={<span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">!</span>}>
                  <b>{moveNo(g.plies, m.ply)} {m.bestSan}</b> would have {m.what.startsWith('mate') ? `forced ${m.what}` : m.what.replace(/^win/, 'won')}
                  <span className="text-stone-500"> — you played {m.played}</span>
                </Row>
              ))}
            </div>
          </Sec>
        )}

        <TimeStatsCard g={g} onPly={onStart} />

        {lesson && !pending(g) && (
          <div className="card flex items-center gap-3 !p-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Lightbulb size={20} /></span>
            <span className="flex-1 text-sm">
              <span className="block font-semibold">Practise: {THEMES[lesson].label}</span>
              <span className="block text-xs text-stone-500">{g.summary.pattern ? `It came up in ${g.summary.pattern.count} of your last ${g.summary.pattern.of} games.` : '2 minutes on what tripped you up.'}</span>
            </span>
            <button className="btn-secondary !py-1.5 text-sm" onClick={() => push({ name: 'practice', theme: lesson })}>Start</button>
          </div>
        )}
      </div>
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-stone-100 via-stone-100/95 to-transparent px-4 pt-6 pb-3 dark:from-stone-950 dark:via-stone-950/95">
        <div className="mx-auto flex max-w-xl gap-2">
          <button className="btn-primary flex-1 !py-3.5 text-base" onClick={() => onStart(-1)}>
            <Sparkles size={18} /> Start Review
          </button>
          {firstBad >= 0 && !pending(g) && (
            <button className="btn-secondary !py-3.5 text-sm" onClick={() => onStart(firstBad)}>
              <TriangleAlert size={16} /> First mistake
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A titled section of the summary. */
function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="section-title mb-1.5">{title}</h2>
      {children}
    </section>
  );
}

/** A tappable row inside a summary card. */
function Row({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left text-[14px] leading-snug transition-colors active:bg-stone-100 dark:active:bg-white/5" onClick={onClick}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight size={16} className="mt-0.5 shrink-0 text-stone-300 dark:text-stone-600" />
    </button>
  );
}

type Retry = { state: 'try' | 'checking' | 'right' | 'ok' | 'wrong'; fen: string; last?: { from: string; to: string } };

function StepView({ g, r, start, onSummary }: { g: AnyGame; r: Review; start: number; onSummary: () => void }) {
  const [i, setI] = useState(start);
  const [best, setBest] = useState(false);
  const [retry, setRetry] = useState<Retry | null>(null);
  const [explain, setExplain] = useState(false);
  const push = useNav((s) => s.push);
  const stepTimes = useMemo(() => timesOf(g), [g]);
  const causeAt = useMemo(() => new Map(mistakeCauses(g, r.plies.map((x) => x.cls)).map((c) => [c.ply, c])), [g, r]);
  const [myRating, setMyRating] = useState<number | null>(null);
  const history = useMemo(() => [g.startFen, ...g.plies.slice(0, Math.max(0, i)).map((q) => q.fenAfter)], [g, i]);
  useEffect(() => {
    if (g.source === 'chess.com') setMyRating((g as ImportedGame).myRating || null);
    else void getGameRating().then((x) => setMyRating(x.rating));
  }, [g]);
  const strip = useRef<HTMLDivElement>(null);
  const n = g.plies.length;
  const p = i >= 0 ? g.plies[i] : null;
  const rp = i >= 0 ? r.plies[i] : null;
  const [flipped, setFlipped] = useState(false);
  const orientation = (g.userColor === 'w') !== flipped ? 'white' : 'black';
  useEffect(() => {
    setBest(false);
    setRetry(null);
    strip.current?.querySelector(`[data-ply="${i}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [i]);
  useEffect(() => () => getEngine().cancelAll('review'), []);
  const go = (k: number) => setI(Math.max(-1, Math.min(n - 1, k)));
  const nextBad = () => {
    for (let k = i + 1; k < n; k++) if (g.plies[k].isUser && isBad(r.plies[k].cls)) return go(k);
  };
  const canRetry = !!p && p.isUser && !!rp && isBad(rp.cls) && !!p.comment?.bestUci;
  const canBest = !!p?.comment?.bestUci && p.comment.bestUci !== p.uci;

  // What the board shows: the position after the move; before it for Best / Retry.
  const fen = retry ? retry.fen : p ? (best ? p.fenBefore : p.fenAfter) : g.startFen;
  const lastMove = retry ? retry.last ?? null : p && !best ? { from: p.uci.slice(0, 2), to: p.uci.slice(2, 4) } : null;
  const arrows = best && p?.comment?.bestUci ? [{ from: p.comment.bestUci.slice(0, 2), to: p.comment.bestUci.slice(2, 4), tone: 'good' as const }] : [];
  const evalNow = r.curve[i + 1] ?? 50;
  const evalText = p?.evalAfter ? formatScore(p.evalAfter) : '0.0';

  const onRetryMove = (m: MoveInput) => {
    if (!retry || retry.state !== 'try' || !p) return false;
    const res = tryMove(p.fenBefore, m);
    if (!res) return false;
    const uci = res.move.lan;
    setRetry({ state: 'checking', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
    if (uci === p.comment?.bestUci) {
      playSound('success');
      setRetry({ state: 'right', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
      return true;
    }
    void (async () => {
      try {
        const e = getEngine();
        const [b, a] = await Promise.all([e.analyze(p.fenBefore, { depth: 11, owner: 'review' }), e.analyze(res.fen, { depth: 11, owner: 'review' })]);
        const cls = classify(winPct(povScore(b.lines[0].score, p.color)), winPct(povScore(a.lines[0].score, p.color)), uci === b.bestMove);
        const good = cls === 'best' || cls === 'good';
        playSound(good ? 'success' : 'error');
        setRetry({ state: good ? 'ok' : 'wrong', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
      } catch {
        setRetry({ state: 'wrong', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
      }
    })();
    return true;
  };

  return (
    <div className="flex h-full flex-col">
      <Header title="Game Review" back subtitle={`vs ${oppName(g)} · ${formatDate(g.endedAt)}`} right={
        <span className="flex items-center gap-2">
          <button aria-label="Analyse this position" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300" onClick={() => push({ name: 'explore', fen: p ? p.fenAfter : g.startFen, orientation, title: 'Analysis' })}><Microscope size={19} /></button>
          <button aria-label="Flip board" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300" onClick={() => setFlipped((f) => !f)}><FlipVertical2 size={19} /></button>
          <button className="text-sm font-semibold text-brand-700 dark:text-brand-500" onClick={onSummary}>Summary</button>
        </span>
      } />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col land:max-w-6xl land:flex-row land:gap-4 land:px-3">
        <div className="flex gap-1.5 px-1.5 land:w-[min(calc(100dvh-7rem),58vw)] land:shrink-0">
          <ReviewEvalBar wpWhite={evalNow} orientation={orientation} text={evalText} />
          <div className="relative min-w-0 flex-1">
            <Board fen={fen} orientation={orientation} movable={retry?.state === 'try' ? g.userColor : null} onMove={onRetryMove} arrows={arrows} lastMove={lastMove} />
            {p && rp && !best && !retry && <SquareIcon sq={p.uci.slice(2, 4)} cls={rp.cls} orientation={orientation} />}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Move strip */}
          <div ref={strip} className="no-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto px-2 py-1.5">
            {g.plies.map((q, k) => {
              const c = r.plies[k].cls;
              const showIcon = c === 'brilliant' || c === 'great' || isBad(c);
              return (
                <button
                  key={k}
                  data-ply={k}
                  onClick={() => go(k)}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13.5px] whitespace-nowrap transition-colors ${k === i ? 'bg-stone-900 text-white shadow-sm dark:bg-stone-50 dark:text-stone-900' : 'text-stone-700 active:bg-stone-200/70 dark:text-stone-300 dark:active:bg-white/5'}`}
                >
                  {q.color === 'w' && <span className="text-xs text-stone-400">{moveNo(g.plies, k)}</span>}
                  {showIcon && <ReviewIcon cls={c} size={14} />}
                  <span className="font-semibold">{q.san}</span>
                </button>
              );
            })}
          </div>
          {/* Coach panel: fixed height so the screen never jumps. */}
          <div className="mx-3 flex max-h-[42%] min-h-[132px] shrink-0 gap-2.5 overflow-hidden land:max-h-none land:flex-1">
            <CoachAvatar mood={rp && isBad(rp.cls) && p?.isUser ? 'concerned' : 'happy'} size={38} />
            <div className="card min-w-0 flex-1 overflow-y-auto !rounded-[18px] !rounded-tl-md !px-3.5 !py-3 text-[14.5px] leading-snug">
              <CoachText g={g} r={r} i={i} best={best} retry={retry} cause={causeAt.get(i)} />
            </div>
          </div>
          <div className="mt-auto" />
          {/* The graph sits well away from the arrows, so stepping through never jumps by accident. */}
          <div className="mx-3 mt-2 shrink-0">
            <EvalGraph plies={g.plies} current={i} onSelect={go} height={44} times={stepTimes} />
          </div>
          {/* Actions */}
          <div className="mx-3 mt-2 grid shrink-0 grid-cols-4 gap-1.5">
            <ActionButton icon={<MessageCircleQuestion size={16} />} label="Explain" disabled={!p || !rp || !!retry} onClick={() => setExplain(true)} highlight={!!rp && isBad(rp.cls)} />
            <ActionButton icon={<Lightbulb size={16} />} label={best ? 'Hide' : 'Best'} disabled={!canBest || !!retry} onClick={() => setBest(!best)} />
            <ActionButton
              icon={<RotateCcw size={16} />}
              label={retry ? 'Stop' : 'Retry'}
              disabled={!canRetry}
              onClick={() => (retry ? setRetry(null) : (setBest(false), setRetry({ state: 'try', fen: p!.fenBefore })))}
            />
            <ActionButton icon={<TriangleAlert size={16} />} label="Next" disabled={!g.plies.some((q, k) => k > i && q.isUser && isBad(r.plies[k].cls))} onClick={nextBad} />
          </div>
          {/* Arrows */}
          <div className="safe-bottom mt-3 shrink-0 border-t border-stone-200/70 px-3 pt-3 pb-2 dark:border-white/[0.06]">
            <div className="grid grid-cols-[1fr_1.3fr_2.2fr_1fr] gap-2">
              <NavButton onClick={() => go(-1)} disabled={i < 0} label="Start"><ChevronFirst size={22} /></NavButton>
              <NavButton onClick={() => go(i - 1)} disabled={i < 0} label="Back"><ChevronLeft size={26} /></NavButton>
              <NavButton onClick={() => go(i + 1)} disabled={i >= n - 1} label="Forward" primary><ChevronRight size={26} /></NavButton>
              <NavButton onClick={() => go(n - 1)} disabled={i >= n - 1} label="End"><ChevronLast size={22} /></NavButton>
            </div>
          </div>
        </div>
      </div>
      {explain && p && rp && (
        <ExplainSheet
          p={p}
          cls={rp.cls}
          isUser={p.isUser}
          orientation={orientation}
          history={history}
          rating={p.isUser ? myRating : g.elo || null}
          cause={causeAt.get(i)}
          onClose={() => setExplain(false)}
        />
      )}
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled, highlight }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; highlight?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`${highlight ? 'btn-primary' : 'btn-secondary'} !gap-1 !px-1 !py-2 text-sm disabled:opacity-35`}>
      {icon} {label}
    </button>
  );
}

function NavButton({ children, onClick, disabled, label, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string; primary?: boolean }) {
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className={`flex h-14 items-center justify-center rounded-2xl transition-transform duration-75 active:scale-[0.97] disabled:opacity-30 ${primary ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700'}`}>
      {children}
    </button>
  );
}

/** A vertical eval bar with the number at the winning end. */
function ReviewEvalBar({ wpWhite, orientation, text }: { wpWhite: number; orientation: 'white' | 'black'; text: string }) {
  const pct = Math.max(3, Math.min(97, wpWhite));
  const whiteAhead = wpWhite >= 50;
  return (
    <div className={`relative flex w-5 shrink-0 overflow-hidden rounded bg-stone-800 ${orientation === 'white' ? 'flex-col-reverse' : 'flex-col'}`}>
      <div className="bg-stone-100 transition-all duration-500" style={{ height: `${pct}%` }} />
      <span
        className={`absolute inset-x-0 text-center text-[8px] font-black ${whiteAhead ? 'text-stone-800' : 'text-white'}`}
        style={{ [whiteAhead === (orientation === 'white') ? 'bottom' : 'top']: 2 }}
      >
        {text.replace('+', '')}
      </span>
    </div>
  );
}

/** The class icon on the destination square, like chess.com. */
function SquareIcon({ sq, cls, orientation }: { sq: string; cls: ReviewClass; orientation: 'white' | 'black' }) {
  const f = sq.charCodeAt(0) - 97;
  const rk = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - rk : rk;
  return (
    <span className="pointer-events-none absolute z-10" style={{ left: `calc(${((col + 1) / 8) * 100}% - 13px)`, top: `calc(${(row / 8) * 100}% - 7px)` }}>
      <ReviewIcon cls={cls} size={22} className="ring-2 ring-white" />
    </span>
  );
}

/** Coach Sam on the move being viewed: a one-line verdict, why, and the concrete lines. */
function CoachText({ g, r, i, best, retry, cause }: { g: AnyGame; r: Review; i: number; best: boolean; retry: Retry | null; cause?: MistakeCause }) {
  if (i < 0) {
    return (
      <>
        <p className="font-semibold">Let's go through the game.</p>
        <p className="mt-1 text-stone-600 dark:text-stone-300">Use the arrows, tap a move above, or jump straight to your next mistake. On a mistake, tap Retry to find the better move yourself.</p>
      </>
    );
  }
  const p = g.plies[i];
  const rp = r.plies[i];
  const c = p.comment;
  const next = g.plies[i + 1];
  const nextR = r.plies[i + 1];
  if (retry) {
    const msg = { try: 'Your move — find something better than ' + p.san + '.', checking: 'Checking…', right: `Yes! ${c?.bestSan} is the best move.`, ok: 'That works too — a good alternative.', wrong: 'Not quite. Tap Retry to try again, or Best to see it.' }[retry.state];
    return <p className={`font-semibold ${retry.state === 'right' || retry.state === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : retry.state === 'wrong' ? 'text-red-600' : ''}`}>{msg}</p>;
  }
  const headline = (
    <p className="flex items-center gap-1.5 font-semibold">
      <ReviewIcon cls={rp.cls} size={18} />
      <span style={{ color: isBad(rp.cls) ? RC[rp.cls].color : undefined }}>
        {moveNo(g.plies, i)} {p.san} {RC[rp.cls].verdict}
      </span>
    </p>
  );
  const sanLine = (fen: string, line?: string[], k = 4) => (line?.length ? formatLine(fen, lineToSan(fen, line, k)) : null);
  if (p.isUser) {
    const reply = sanLine(p.fenAfter, c?.replyLine, 3);
    const bestLine = sanLine(p.fenBefore, c?.bestLine, 4);
    return (
      <>
        {headline}
        {cause && (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-[12.5px] text-stone-600 dark:text-stone-300">
            <span className="chip bg-stone-100 !px-2 !text-[11px] dark:bg-white/[0.06]"><CauseIcon c={cause.cause} /> {CAUSE_INFO[cause.cause].label}</span>
            {cause.secs !== undefined && <span className={cause.fast || cause.timeTrouble ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}>{cause.secs < 10 ? cause.secs.toFixed(1) : Math.round(cause.secs)} s{cause.timeTrouble ? ' · time trouble' : cause.fast ? ' · played fast' : ''}</span>}
          </p>
        )}
        {rp.cls === 'book' ? (
          <p className="mt-1">{g.opening ? `A known move in the ${g.opening}.` : 'A known opening move.'}</p>
        ) : (
          c?.text.slice(0, 2).map((t, k) => <p key={k} className="mt-1">{t}</p>)
        )}
        {isBad(rp.cls) && (
          <div className="mt-1.5 space-y-0.5 text-[13px]">
            {reply && rp.cls !== 'inaccuracy' && <p><span className="text-stone-500">What it allows:</span> <b>{reply}</b></p>}
            {c?.bestSan && <p><span className="text-stone-500">{best ? 'Best line:' : 'Best was:'}</span> <b className="text-emerald-700 dark:text-emerald-400">{best && bestLine ? bestLine : c.bestSan}</b></p>}
          </div>
        )}
      </>
    );
  }
  // The opponent's move: what it did, and whether you answered it well.
  return (
    <>
      {headline}
      <p className="mt-1">Your opponent played {shortWords(p.fenBefore, p.uci).toLowerCase()}.</p>
      {isBad(rp.cls) && next && nextR && (
        <p className="mt-1">
          {isBad(nextR.cls) || nextR.cls === 'good'
            ? <>That gave you a chance{next.comment?.bestSan ? <> — <b className="text-emerald-700 dark:text-emerald-400">{next.comment.bestSan}</b> would have punished it</> : ''}. You played {next.san}.</>
            : <>You found the right answer: <b>{next.san}</b>.</>}
        </p>
      )}
      {!isBad(rp.cls) && next?.isUser && nextR && isBad(nextR.cls) && <p className="mt-1 text-stone-500">Careful on the next move — check what this one threatens.</p>}
    </>
  );
}
