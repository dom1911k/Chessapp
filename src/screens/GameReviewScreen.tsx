// Game Review, chess.com style. First a summary (Coach Sam's take, both players' accuracy, the
// move classes, phases, key moments), then a steady step-through: eval bar + board, a move strip,
// a fixed-size coach panel, Best / Retry / Next, and the arrows at the bottom.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlipVertical2, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, RotateCcw, Sparkles, TriangleAlert, Lightbulb, MessageCircleQuestion } from 'lucide-react';
import { Board } from '../components/Board';
import { EvalGraph } from '../components/Charts';
import { CoachAvatar, Portrait } from '../components/Coach';
import { Header, Spinner } from '../components/ui';
import { ReviewIcon } from '../components/ReviewIcon';
import { ExplainSheet } from '../components/ExplainSheet';
import { CauseBreakdown, CauseIcon } from '../components/Causes';
import { CAUSE_INFO, causeTotals, missedChances, mistakeCauses, type MistakeCause } from '../lib/games/causes';
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
        <span className="flex h-11 w-11 items-center justify-center rounded-[30%] bg-brand-600 text-lg font-black text-white">You</span>
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
  const accBox = (acc: number, white: boolean) => (
    <span className={`rounded-lg px-3 py-1.5 text-xl font-black tabular-nums ${white ? 'bg-white text-stone-900 ring-1 ring-stone-300' : 'bg-stone-800 text-white'}`}>{acc.toFixed(1)}</span>
  );
  const lesson = g.summary.pattern?.theme ?? g.summary.lessonTheme;
  const firstBad = r.plies.findIndex((p, i) => g.plies[i].isUser && isBad(p.cls));
  const cls = useMemo(() => r.plies.map((x) => x.cls), [r]);
  const causes = useMemo(() => (pending(g) ? [] : mistakeCauses(g, cls)), [g, cls]);
  const missed = useMemo(() => (pending(g) ? [] : missedChances(g, cls)), [g, cls]);
  const totals = causeTotals(causes);
  const topCause = causes.length ? (Object.keys(CAUSE_INFO) as (keyof typeof CAUSE_INFO)[]).filter((k) => k !== 'fast' && k !== 'timeTrouble').reduce((a, b) => (totals[b] > totals[a] ? b : a)) : null;
  return (
    <div className="flex h-full flex-col">
      <Header title="Game Review" back subtitle={`${resultText} · ${g.reason} · ${formatDate(g.endedAt)}`} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto p-4 pb-28">
        <div className="flex items-start gap-2.5">
          <CoachAvatar mood={g.userResult === 'loss' ? 'concerned' : 'happy'} size={42} />
          <div className="card flex-1 !rounded-[20px] !rounded-tl-md !p-3.5 text-[15px] leading-snug">
            {pending(g) ? <p>I haven't analysed this chess.com game yet — it's in the queue. You can already step through the moves.</p> : r.summary.map((s, i) => <p key={i} className={i ? 'mt-1.5' : ''}>{s}</p>)}
          </div>
        </div>

        {!pending(g) && (
          <div className="card !p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <PlayerChip g={g} me />
              <span className="text-xs font-semibold text-stone-400">
                {g.source === 'chess.com' && <ChessComBadge />}
                {g.match && <span className="chip bg-brand-100 text-[10px] text-brand-700">Match</span>}
              </span>
              <PlayerChip g={g} me={false} />
              <span className="flex justify-center">{accBox(r.me.accuracy, meWhite)}</span>
              <span className="text-center text-[11px] text-stone-500">Accuracy</span>
              <span className="flex justify-center">{accBox(r.them.accuracy, !meWhite)}</span>
            </div>
            <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
              {REVIEW_ORDER.map((c) => (
                <div key={c} className="grid grid-cols-[1fr_auto_1fr] items-center py-1 text-sm">
                  <span className="text-center font-bold tabular-nums" style={{ color: r.me.counts[c] ? RC[c].color : undefined, opacity: r.me.counts[c] ? 1 : 0.3 }}>{r.me.counts[c]}</span>
                  <span className="flex w-32 items-center gap-2">
                    <ReviewIcon cls={c} size={20} />
                    <span className={r.me.counts[c] + r.them.counts[c] ? '' : 'text-stone-400'}>{RC[c].label}</span>
                  </span>
                  <span className="text-center font-bold tabular-nums" style={{ color: r.them.counts[c] ? RC[c].color : undefined, opacity: r.them.counts[c] ? 1 : 0.3 }}>{r.them.counts[c]}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-stone-100 pt-2 dark:border-stone-800">
              {PHASES.map((ph) => (
                <div key={ph} className="grid grid-cols-[1fr_auto_1fr] items-center py-1 text-sm">
                  <span className="flex justify-center">{r.me.phases[ph] ? <ReviewIcon cls={r.me.phases[ph]!.cls} size={22} /> : <span className="text-stone-300">–</span>}</span>
                  <span className="w-32 capitalize">{ph}</span>
                  <span className="flex justify-center">{r.them.phases[ph] ? <ReviewIcon cls={r.them.phases[ph]!.cls} size={22} /> : <span className="text-stone-300">–</span>}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trap && (
          <div className="card flex items-center gap-3 border-l-4 border-red-500 !p-3">
            <span className="flex-1 text-sm">
              <b>Lost to a known trap: {trapById(trap)!.name}.</b> It's in your daily reviews now.
            </span>
            <button className="btn-secondary !py-1.5 text-sm" onClick={() => push({ name: 'trap', trapId: trap })}>Learn it</button>
          </div>
        )}

        {!pending(g) && (
          <div className="card !p-3">
            <div className="mb-1.5 text-sm font-semibold text-stone-500">Evaluation</div>
            <EvalGraph plies={g.plies} onSelect={onStart} />
          </div>
        )}

        {r.moments.length > 0 && (
          <div className="card !p-3">
            <div className="mb-1 text-sm font-semibold text-stone-500">Key moments</div>
            {r.moments.map((m) => (
              <button key={m.ply} className="flex w-full items-start gap-2.5 py-1.5 text-left text-sm" onClick={() => onStart(m.ply)}>
                <ReviewIcon cls={r.plies[m.ply].cls} size={20} className="mt-0.5" />
                <span className="flex-1">{m.text}</span>
                <ChevronRight size={16} className="mt-0.5 text-stone-400" />
              </button>
            ))}
          </div>
        )}

        {causes.length > 0 && (
          <>
            <CauseBreakdown r={{ mistakes: causes.length, totals, top: topCause ? { cause: topCause as MistakeCause['cause'], share: totals[topCause] / causes.length } : null }} />
            <div className="card !p-0">
              <div className="px-3 pt-3 pb-1 text-sm font-semibold text-stone-500">Your mistakes, one by one</div>
              {causes.map((m) => (
                <button key={m.ply} className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm active:bg-stone-100 dark:active:bg-white/5" onClick={() => onStart(m.ply)}>
                  <ReviewIcon cls={r.plies[m.ply].cls} size={20} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {moveNo(g.plies, m.ply)} {g.plies[m.ply].san}
                      <span className="chip bg-stone-100 !px-2 !text-[11px] text-stone-600 dark:bg-white/[0.06] dark:text-stone-300"><CauseIcon c={m.cause} /> {CAUSE_INFO[m.cause].label}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-stone-600 dark:text-stone-300">
                      {m.text}
                      {m.secs !== undefined && <span className={m.fast || m.timeTrouble ? ' font-semibold text-amber-700 dark:text-amber-400' : ' text-stone-400'}> · {m.secs < 10 ? m.secs.toFixed(1) : Math.round(m.secs)} s{m.timeTrouble ? ', in time trouble' : m.fast ? ', played fast' : ''}</span>}
                    </span>
                  </span>
                  <ChevronRight size={16} className="mt-0.5 text-stone-400" />
                </button>
              ))}
            </div>
          </>
        )}

        {missed.length > 0 && (
          <div className="card !p-0">
            <div className="px-3 pt-3 pb-1 text-sm font-semibold text-stone-500">Missed chances</div>
            {missed.map((m) => (
              <button key={m.ply} className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm active:bg-stone-100 dark:active:bg-white/5" onClick={() => onStart(m.ply)}>
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">!</span>
                <span className="flex-1 leading-snug">
                  <b>{moveNo(g.plies, m.ply)} {m.bestSan}</b> would have {m.what.startsWith('mate') ? `forced ${m.what}` : m.what.replace(/^win/, 'won')}
                  <span className="text-stone-500"> — you played {m.played}</span>
                </span>
                <ChevronRight size={16} className="mt-0.5 text-stone-400" />
              </button>
            ))}
          </div>
        )}

        <TimeStatsCard g={g} onPly={onStart} />

        {lesson && !pending(g) && (
          <div className="card flex items-center gap-3 !p-3">
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

type Retry = { state: 'try' | 'checking' | 'right' | 'ok' | 'wrong'; fen: string; last?: { from: string; to: string } };

function StepView({ g, r, start, onSummary }: { g: AnyGame; r: Review; start: number; onSummary: () => void }) {
  const [i, setI] = useState(start);
  const [best, setBest] = useState(false);
  const [retry, setRetry] = useState<Retry | null>(null);
  const [explain, setExplain] = useState(false);
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
                  className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm whitespace-nowrap ${k === i ? 'bg-stone-800 text-white dark:bg-white dark:text-stone-900' : ''}`}
                >
                  {q.color === 'w' && <span className="text-xs text-stone-400">{moveNo(g.plies, k)}</span>}
                  {showIcon && <ReviewIcon cls={c} size={14} />}
                  <span className="font-semibold">{q.san}</span>
                </button>
              );
            })}
          </div>
          {/* Coach panel: fixed height so the screen never jumps. */}
          <div className="mx-3 flex h-[156px] shrink-0 gap-2.5 overflow-hidden">
            <CoachAvatar mood={rp && isBad(rp.cls) && p?.isUser ? 'concerned' : 'happy'} size={38} />
            <div className="card min-w-0 flex-1 overflow-y-auto !rounded-[18px] !rounded-tl-md !p-3 text-[14.5px] leading-snug">
              <CoachText g={g} r={r} i={i} best={best} retry={retry} cause={causeAt.get(i)} />
            </div>
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
          <div className="mx-3 mt-2 shrink-0">
            <EvalGraph plies={g.plies} current={i} onSelect={go} height={44} />
          </div>
          <div className="mt-auto" />
          {/* Arrows */}
          <div className="safe-bottom shrink-0 px-3 pt-2 pb-2">
            <div className="grid grid-cols-4 gap-1.5">
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
    <button aria-label={label} disabled={disabled} onClick={onClick} className={`flex h-12 items-center justify-center rounded-xl disabled:opacity-30 ${primary ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700'}`}>
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
