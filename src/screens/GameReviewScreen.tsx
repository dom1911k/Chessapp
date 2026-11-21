// Game Review, chess.com style. First a summary (Coach Sam's take, both players' accuracy, the
// move classes, phases, key moments), then a steady step-through: eval bar + board, a move strip,
// a fixed-size coach panel, Best / Retry / Next, and the arrows at the bottom.
import { appTc, canRematch, rematchInfo } from '../lib/rematch';
import { usePlay } from '../lib/store/play';
import { isEligible } from '../lib/turning';
import { CAUSE_LESSON } from '../lib/course';
import { lessonById } from '../lib/lessons/data';
import { GraduationCap, Swords } from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Play, Square, FlipVertical2, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, RotateCcw, Sparkles, TriangleAlert, Lightbulb, MessageCircleQuestion, Microscope } from 'lucide-react';
import { Board } from '../components/Board';
import { EvalGraph } from '../components/Charts';
import { CoachAvatar, CoachBubble, Portrait } from '../components/Coach';
import { EvalBar, FadeScroll, Header, Spinner } from '../components/ui';
import { classInk, ReviewIcon } from '../components/ReviewIcon';
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
import { cpLosses, gameRating, goodWhy, looseWhy, missedThreat, planWhy, repeatedTips, reviewNotes, verdictLine } from '../lib/reviewText';
import { ArrowOverlay, type OverlayArrow } from '../components/ArrowOverlay';
import { isBad, moveNo, punishInfo, punishment, RC, slipCardLine, REVIEW_ORDER, reviewGame, type Review, type ReviewClass } from '../lib/review';
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

/** Start a rematch against a chess.com opponent's stand-in (same colours and clock). */
async function startRematch(g: AnyGame) {
  const imports = await db.imported.toArray();
  const oppColor = g.userColor === 'w' ? 'b' : 'w';
  const info = rematchInfo(imports, g.opponentName!, oppColor);
  const play = usePlay.getState();
  if (play.game && play.phase !== 'over' && play.phase !== 'setup') await play.abandon();
  play.newGame(g.userColor, g.elo, undefined, undefined, { match: true, timeControl: appTc(g.timeControl), rematch: info });
  const nav = useNav.getState();
  nav.setTab('play');
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
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#769656] text-lg font-black text-white">{oppName(g)[0]?.toUpperCase()}</span>
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
  const [samOpen, setSamOpen] = useState(false);
  const verdict = useMemo(() => verdictLine(g, r), [g, r]);
  // How strongly each side played this game, on the same scale as the bots (needs enough moves).
  const perf = useMemo(() => {
    if (pending(g)) return null;
    const me = gameRating(cpLosses(g, r, true));
    const them = gameRating(cpLosses(g, r, false));
    return me || them ? { me, them } : null;
  }, [g, r]);
  const badCounts = (['blunder', 'miss', 'mistake', 'inaccuracy'] as const).filter((c) => r.me.counts[c]).map((c) => `${r.me.counts[c]} ${RC[c].label.toLowerCase()}${r.me.counts[c] > 1 ? (c === 'miss' ? 'es' : 's') : ''}`);
  const rows = REVIEW_ORDER.filter((c) => allRows || r.me.counts[c] + r.them.counts[c] > 0);
  const resultTone = g.userResult === 'win' ? 'bg-brand-500 text-white' : g.userResult === 'loss' ? 'bg-stone-700 text-white dark:bg-stone-800' : 'bg-stone-500 text-white';
  // chess.com's accuracy boxes: the white player's white, the black player's charcoal.
  const accNum = (acc: number, white: boolean) => (
    <span className={`inline-flex w-[84px] justify-center rounded-[6px] py-1.5 text-[24px] leading-none font-extrabold tabular-nums ${white ? 'bg-white text-[#312e2b] ring-1 ring-black/10' : 'bg-[#403d39] text-white'}`}>
      {acc.toFixed(1)}
    </span>
  );
  return (
    <div className="flex h-full flex-col">
      <Header title="Game Review" back subtitle={`vs ${oppName(g)} · ${formatDate(g.endedAt)}`} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
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
            {perf && (
              <>
                <span className="text-center text-lg font-extrabold tabular-nums" data-testid="game-rating">{perf.me ? `${perf.me}${perf.me >= 2000 ? '+' : ''}` : '—'}</span>
                <span className="text-center text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Game rating</span>
                <span className="text-center text-lg font-extrabold tabular-nums">{perf.them ? `${perf.them}${perf.them >= 2000 ? '+' : ''}` : '—'}</span>
              </>
            )}
          </div>
          <div className="flex gap-3 border-t border-stone-100 bg-stone-50/70 px-4 py-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <CoachAvatar mood={g.userResult === 'loss' ? 'concerned' : 'happy'} size={36} />
            <div className="min-w-0 flex-1 text-[14.5px] leading-snug">
              {pending(g) ? <p>I haven't analysed this chess.com game yet — it's in the queue. You can already step through the moves.</p> : (
                <>
                  <p className="text-[18px] leading-snug font-bold tracking-[-0.01em]" data-testid="verdict">{verdict}</p>
                  {samOpen ? r.summary.map((t, i) => <p key={i} className="mt-1.5 text-stone-600 dark:text-stone-300">{t}</p>) : null}
                  {r.summary.length > 0 && (
                    <button className="mt-1.5 text-[13px] font-bold text-brand-700 dark:text-brand-500" onClick={() => setSamOpen(!samOpen)}>{samOpen ? 'Less' : 'More from Sam'}</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {r.moments.length > 0 && (
          <section>
            <h2 className="section-title mb-1.5">Key moments</h2>
            <div className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1" data-testid="moments-strip">
              {r.moments.map((m) => {
                const q = g.plies[m.ply];
                const line = q.isUser ? (q.comment?.bestSan ? `${q.comment.bestSan} was the move` : RC[r.plies[m.ply].cls].label) : slipCardLine(g.plies, m.ply) ?? RC[r.plies[m.ply].cls].label;
                return (
                  <button key={m.ply} className="card w-[148px] shrink-0 snap-start !p-2 text-left transition active:scale-[0.98]" onClick={() => onStart(m.ply)}>
                    <div className="relative">
                      <Board fen={q.fenAfter} orientation={meWhite ? 'white' : 'black'} movable={null} lastMove={{ from: q.uci.slice(0, 2), to: q.uci.slice(2, 4) }} showCoordinates={false} />
                      <SquareIcon sq={q.uci.slice(2, 4)} cls={r.plies[m.ply].cls} orientation={meWhite ? 'white' : 'black'} small />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold">
                      <ReviewIcon cls={r.plies[m.ply].cls} size={15} /> {moveNo(g.plies, m.ply)} {q.san}
                      <span className="ml-auto text-[10px] font-normal text-stone-400">{q.isUser ? 'you' : 'them'}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-stone-600 dark:text-stone-300">{line}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {canRematch(g) && (
          <button className="card flex w-full items-center gap-3 !p-3.5 text-left" data-testid="rematch" onClick={() => void startRematch(g)}>
            <Swords size={20} className="shrink-0 text-brand-600" />
            <span className="flex-1 text-sm"><b>Rematch {oppName(g)}</b> <span className="block text-stone-500">A stand-in at {g.elo}: opens like they did against you, same clock, Match conditions.</span></span>
            <span className="btn-primary !px-3 !py-1.5 text-sm">Rematch</span>
          </button>
        )}
        {isEligible(g) && (
          <button className="card flex w-full items-center gap-3 !p-3.5 text-left" onClick={() => push({ name: 'turning', gameId: g.id! })} data-testid="turning-entry">
            <span className="flex-1 text-sm"><b>Where did it turn?</b> <span className="text-stone-500">Find the move that lost it yourself first (10 s).</span></span>
            <span className="btn-primary !px-3 !py-1.5 text-sm">Try</span>
          </button>
        )}
        {trap && (
          <div className="card flex items-center gap-3 !p-3.5 ring-2 !ring-red-400/60">
            <span className="flex-1 text-sm">
              <b>Lost to a known trap: {trapById(trap)!.name}.</b> It's in your daily reviews now.
            </span>
            <button className="btn-secondary !py-1.5 text-sm" onClick={() => push({ name: 'trap', trapId: trap })}>Learn it</button>
          </div>
        )}

        {!pending(g) && (
          <Sec title="Moves" fold preview={badCounts.length ? badCounts.join(' · ') : 'No mistakes from you'}>
            <div className="card !px-3 !py-2">
              <div className="divide-y divide-stone-100 dark:divide-white/[0.05]">
                {rows.map((c) => (
                  <div key={c} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center py-1.5 text-[14px]">
                    <span className={`text-center font-bold tabular-nums ${r.me.counts[c] ? classInk(c).className : 'opacity-25'}`} style={r.me.counts[c] ? classInk(c).style : undefined}>{r.me.counts[c]}</span>
                    <span className="flex items-center justify-center gap-2">
                      <ReviewIcon cls={c} size={18} />
                      <span className="w-24">{RC[c].label}</span>
                    </span>
                    <span className={`text-center font-bold tabular-nums ${r.them.counts[c] ? classInk(c).className : 'opacity-25'}`} style={r.them.counts[c] ? classInk(c).style : undefined}>{r.them.counts[c]}</span>
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
          <Sec title="Evaluation" fold preview="Graph of the game, with your time">
            <div className="card !p-3">
              <EvalGraph plies={g.plies} onSelect={onStart} times={times} classes={cls} />
              {times && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#81b64c]" /> Your time</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#989795]" /> Theirs</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#f7c045]" /> Longest thinks</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#fa412d]" /> Mistake in under 5 s</span>
                </div>
              )}
            </div>
          </Sec>
        )}

        {causes.length > 0 && (
          <Sec title="Your mistakes" fold preview={topCause ? `Mostly: ${CAUSE_INFO[topCause].label.toLowerCase()}` : `${causes.length}`}>
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
          <Sec title="Missed chances" fold preview={`${missed.length} chance${missed.length === 1 ? '' : 's'} to punish them`}>
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

        {g.clocks?.length ? <Sec title="Your time" fold preview="Where your clock went"><TimeStatsCard g={g} onPly={onStart} /></Sec> : null}

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
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.08] bg-white px-4 pt-2.5 pb-2 dark:border-white/[0.06] dark:bg-stone-900">
        <div className="mx-auto flex max-w-xl gap-2">
          <button className="btn-primary !min-h-14 flex-1 text-[17px] !font-extrabold" onClick={() => onStart(-1)}>
            <Sparkles size={18} /> Start Review
          </button>
          {firstBad >= 0 && !pending(g) && (
            <button className="btn-secondary !min-h-14 text-[14px]" onClick={() => onStart(firstBad)}>
              <TriangleAlert size={16} /> First mistake
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A titled section of the summary; `fold` sections start closed with a one-line preview. */
function Sec({ title, children, fold, preview }: { title: string; children: ReactNode; fold?: boolean; preview?: string }) {
  const [open, setOpen] = useState(!fold);
  if (!fold) return (
    <section>
      <h2 className="section-title mb-1.5">{title}</h2>
      {children}
    </section>
  );
  return (
    <section>
      <button className="flex w-full items-center gap-2 rounded-xl py-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="section-title">{title}</span>
        {!open && preview && <span className="min-w-0 flex-1 truncate text-[12.5px] text-stone-500">{preview}</span>}
        <ChevronRight size={16} className={`ml-auto shrink-0 text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="mt-1.5">{children}</div>}
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

type Retry = { state: 'try' | 'checking' | 'right' | 'ok' | 'wrong'; fen: string; last?: { from: string; to: string }; reply?: string };

function StepView({ g, r, start, onSummary }: { g: AnyGame; r: Review; start: number; onSummary: () => void }) {
  const [i, setI] = useState(start);
  const [best, setBest] = useState(false);
  const [retry, setRetry] = useState<Retry | null>(null);
  const [explain, setExplain] = useState(false);
  // On a move where you missed their threat: show the threat first, then your move.
  const [threatSeen, setThreatSeen] = useState<number | null>(null);
  // "Play it out": the line being stepped through on the board (index into its frames).
  const [lineK, setLineK] = useState<number | null>(null);
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
    setThreatSeen(null);
    setLineK(null);
    strip.current?.querySelector(`[data-ply="${i}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [i]);
  useEffect(() => () => getEngine().cancelAll('review'), []);
  const go = (k: number) => setI(Math.max(-1, Math.min(n - 1, k)));
  // Swipe on the board to step: left = forward, right = back (not while retrying a move).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = (e: React.TouchEvent) => { swipe.current = retry ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onSwipeEnd = (e: React.TouchEvent) => {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0) return;
    const dx = e.changedTouches[0].clientX - s0.x;
    const dy = e.changedTouches[0].clientY - s0.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? i + 1 : i - 1);
  };
  const nextBad = () => {
    for (let k = i + 1; k < n; k++) if (g.plies[k].isUser && isBad(r.plies[k].cls)) return go(k);
  };
  const canRetry = !!p && p.isUser && !!rp && isBad(rp.cls) && !!p.comment?.bestUci;
  const canBest = !!p?.comment?.bestUci && p.comment.bestUci !== p.uci;

  const cause = causeAt.get(i);
  const threat = useMemo(() => (p && cause?.cause === 'missedThreat' ? missedThreat(p) : null), [p, cause]);
  const threatStage = !!threat && threatSeen !== i && !best && !retry;
  // The line worth playing out here: the best line (Best on), what your mistake allowed, or how
  // to punish their mistake.
  const play = useMemo(() => {
    if (!p || !rp || retry || threatStage) return null;
    const nx = g.plies[i + 1];
    const src = best
      ? p.comment?.bestLine?.length ? { fen: p.fenBefore, line: p.comment.bestLine, label: 'Play the best line' } : null
      : !isBad(rp.cls) ? null
      : p.isUser ? p.comment?.replyLine && p.comment.replyLine.length > 1 && rp.cls !== 'inaccuracy' ? { fen: p.fenAfter, line: p.comment.replyLine, label: 'Play out what it allows' } : null
      : nx?.isUser && nx.comment?.bestLine && nx.comment.bestLine.length > 1 ? { fen: p.fenAfter, line: nx.comment.bestLine, label: 'Play out the punishment' } : null;
    if (!src) return null;
    const frames: { fen: string; last: { from: string; to: string }; san: string }[] = [];
    let f = src.fen;
    for (const u of src.line.slice(0, 6)) {
      const m = tryMove(f, u);
      if (!m) break;
      f = m.fen;
      frames.push({ fen: f, last: { from: m.move.from, to: m.move.to }, san: m.move.san });
    }
    return frames.length > 1 ? { ...src, frames } : null;
  }, [p, rp, retry, threatStage, best, g.plies, i]);
  const frame = play && lineK !== null ? play.frames[Math.min(lineK, play.frames.length - 1)] : null;
  useEffect(() => {
    if (lineK === null || !play || lineK >= play.frames.length - 1) return;
    const t = setTimeout(() => setLineK(lineK + 1), lineK === 0 ? 650 : 900);
    return () => clearTimeout(t);
  }, [lineK, play]);
  useEffect(() => setLineK(null), [best]);
  // What the board shows: the position after the move; before it for Best / Retry / their threat.
  const fen = frame ? frame.fen : retry ? retry.fen : p ? (best || threatStage ? p.fenBefore : p.fenAfter) : g.startFen;
  const lastMove = frame ? frame.last : retry ? retry.last ?? null : p && !best && !threatStage ? { from: p.uci.slice(0, 2), to: p.uci.slice(2, 4) } : null;
  // The same arrows everywhere: green = best move, red = what a move allowed, dotted = a punishing
  // reply to their mistake (or their threat).
  const arr = (uci: string, tone: 'good' | 'bad' | 'info') => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), tone });
  const arrows: { from: string; to: string; tone: 'good' | 'bad' | 'info' }[] = [];
  const dotted: OverlayArrow[] = [];
  if (frame) {
    // Playing a line out: the board speaks for itself.
  } else if (retry) {
    if (retry.state === 'wrong' && retry.reply) arrows.push(arr(retry.reply, 'bad'));
  } else if (threatStage && threat) dotted.push(arr(threat.uci, 'bad'));
  else if (best && p?.comment?.bestUci) arrows.push(arr(p.comment.bestUci, 'good'));
  else if (p && rp && isBad(rp.cls)) {
    if (p.isUser && rp.cls !== 'inaccuracy' && p.comment?.replyLine?.[0]) arrows.push(arr(p.comment.replyLine[0], 'bad'));
    const next = g.plies[i + 1];
    if (!p.isUser && next?.isUser && next.comment?.bestUci) dotted.push(arr(next.comment.bestUci, 'good'));
  }
  const evalNow = r.curve[i + 1] ?? 50;

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
        setRetry({ state: good ? 'ok' : 'wrong', fen: res.fen, last: { from: res.move.from, to: res.move.to }, reply: good ? undefined : a.bestMove ?? undefined });
      } catch {
        setRetry({ state: 'wrong', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
      }
    })();
    return true;
  };

  // The reviewed move's squares in its class colour (for the moves that matter), else yellow.
  const moveTint = p && rp && !best && !retry && !threatStage && !frame && NOTABLE.has(rp.cls) ? hexRgb(RC[rp.cls].color) : undefined;
  return (
    <div className="flex h-full flex-col">
      <Header title="Game Review" back subtitle={`vs ${oppName(g)} · ${formatDate(g.endedAt)}`} right={
        <span className="flex items-center gap-1">
          <button aria-label="Analyse this position" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800" onClick={() => push({ name: 'explore', fen: p ? p.fenAfter : g.startFen, orientation, title: 'Analysis' })}><Microscope size={19} /></button>
          <button aria-label="Flip board" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800" onClick={() => setFlipped((f) => !f)}><FlipVertical2 size={19} /></button>
          <button className="px-2 text-sm font-semibold text-stone-600 active:text-stone-900 dark:text-stone-300 dark:active:text-white" onClick={onSummary}>Summary</button>
        </span>
      } />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col land:max-w-6xl land:flex-row land:gap-4 land:px-3">
        <div className="flex gap-1 land:w-[min(calc(100dvh-7rem),58vw)] land:shrink-0">
          <EvalBar whitePct={evalNow} orientation={orientation} score={p?.evalAfter ?? { type: 'cp', value: 0 }} width={20} />
          <div className="relative min-w-0 flex-1" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} data-testid="review-board">
            <Board fen={fen} orientation={orientation} movable={retry?.state === 'try' ? g.userColor : null} onMove={onRetryMove} arrows={arrows} lastMove={lastMove} lastMoveColor={moveTint} />
            <ArrowOverlay arrows={dotted} orientation={orientation} />
            {moveTint && p && rp && <SquareIcon sq={p.uci.slice(2, 4)} cls={rp.cls} orientation={orientation} />}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Move strip: the same look as the game's. */}
          <div ref={strip} className="no-scrollbar flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto px-2 text-[14px]">
            {g.plies.map((q, k) => {
              const c = r.plies[k].cls;
              const showIcon = c === 'brilliant' || c === 'great' || isBad(c);
              return (
                <button
                  key={k}
                  data-ply={k}
                  onClick={() => go(k)}
                  className={`flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 whitespace-nowrap transition-colors ${k === i ? 'bg-black/[0.08] font-bold text-stone-900 dark:bg-white/[0.12] dark:text-white' : 'font-semibold text-stone-700 active:bg-black/5 dark:text-stone-300 dark:active:bg-white/5'}`}
                >
                  {q.color === 'w' && <span className="text-[12px] font-semibold text-stone-500 tabular-nums">{moveNo(g.plies, k)}</span>}
                  {showIcon && <ReviewIcon cls={c} size={14} />}
                  <span>{q.san}</span>
                </button>
              );
            })}
          </div>
          {/* The eval graph as a scrubber right under the moves. */}
          <div className="mx-3 shrink-0">
            <EvalGraph plies={g.plies} current={i} onSelect={go} height={40} times={stepTimes} classes={r.plies.map((x) => x.cls)} />
          </div>
          {/* Coach Sam on the move, in his speech bubble; takes the remaining height. */}
          <FadeScroll className="px-3 pt-2.5 pb-2" testId="review-coach">
            <CoachBubble mood={rp && isBad(rp.cls) && p?.isUser ? 'concerned' : 'happy'}>
              <CoachText g={g} r={r} i={i} best={best} retry={retry} cause={cause} threat={threatStage ? threat : null} onSeenThreat={() => setThreatSeen(i)} />
              {play && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <button className="chip bg-brand-100 font-semibold text-brand-700" data-testid="play-line" onClick={() => setLineK(lineK === null ? 0 : null)}>
                    {lineK === null ? <><Play size={12} /> {play.label}</> : <><Square size={11} /> Stop</>}
                  </button>
                  {lineK !== null && <span className="font-semibold tabular-nums text-stone-600">{formatLine(play.fen, play.frames.slice(0, lineK + 1).map((x) => x.san))}</span>}
                </div>
              )}
              {p && rp && !retry && (
                <button className="mt-2 flex items-center gap-1 text-[13px] font-bold text-brand-700" onClick={() => setExplain(true)} data-testid="explain">
                  <MessageCircleQuestion size={15} /> Explain this move
                </button>
              )}
            </CoachBubble>
          </FadeScroll>
          {/* Best / Retry / Next mistake */}
          <div className="mx-3 mb-2 grid shrink-0 grid-cols-3 gap-2">
            <ActionButton icon={<Lightbulb size={16} />} label={best ? 'Hide' : 'Best'} disabled={!canBest || !!retry} onClick={() => setBest(!best)} />
            <ActionButton
              icon={<RotateCcw size={16} />}
              label={retry ? 'Stop' : 'Retry'}
              disabled={!canRetry}
              onClick={() => (retry ? setRetry(null) : (setBest(false), setRetry({ state: 'try', fen: p!.fenBefore })))}
            />
            <ActionButton icon={<TriangleAlert size={15} />} label="Next mistake" disabled={!g.plies.some((q, k) => k > i && q.isUser && isBad(r.plies[k].cls))} onClick={nextBad} />
          </div>
          {/* Step through: a flat bar like the Dock. */}
          <div className="safe-bottom shrink-0 border-t border-black/[0.08] bg-white dark:border-white/[0.06] dark:bg-stone-900">
            <div className="mx-auto grid h-14 max-w-md grid-cols-[1fr_2fr_2fr_1fr] gap-1.5 px-2 py-1.5">
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

/** "#fa412d" → "250, 65, 45" (for Board tints). */
const hexRgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)).join(', ');

function ActionButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="btn-secondary !min-h-10 !gap-1 !px-1 !py-1.5 text-[13.5px] whitespace-nowrap disabled:opacity-35">
      {icon} {label}
    </button>
  );
}

function NavButton({ children, onClick, disabled, label, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string; primary?: boolean }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center rounded-[10px] transition duration-75 disabled:opacity-30 ${
        primary
          ? 'bg-brand-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_var(--color-brand-800)] active:translate-y-[2px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_0_var(--color-brand-800)]'
          : 'bg-stone-100 text-stone-800 active:bg-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:active:bg-stone-700'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The class icon at the top-right corner of the destination square, like chess.com — kept fully
 * inside the board on the h-file (a-file when flipped) and the top rank.
 */
function SquareIcon({ sq, cls, orientation, small }: { sq: string; cls: ReviewClass; orientation: 'white' | 'black'; small?: boolean }) {
  const f = sq.charCodeAt(0) - 97;
  const rk = Number(sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - rk : rk;
  const size = small ? 15 : 22;
  const left = col === 7 ? `calc(100% - ${size + 1}px)` : `calc(${((col + 1) / 8) * 100}% - ${size * 0.62}px)`;
  const top = row === 0 ? '1px' : `calc(${(row / 8) * 100}% - ${size * 0.38}px)`;
  return (
    <span className="pointer-events-none absolute z-10" style={{ left, top }} data-testid="square-icon">
      <ReviewIcon cls={cls} size={size} ring />
    </span>
  );
}

/** The evaluation before → after a move ("+0.4 → −3.1"), White's view, like chess.com. */
function EvalDelta({ g, i }: { g: AnyGame; i: number }) {
  const after = g.plies[i].evalAfter;
  const before = i > 0 ? g.plies[i - 1].evalAfter : { type: 'cp' as const, value: 0 };
  if (!after || !before) return null;
  const f = (s: typeof after) => formatScore(s).replace('-', '−');
  return <span className="ml-auto shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-stone-600 dark:bg-white/[0.07] dark:text-stone-300" data-testid="eval-delta">{f(before)} → {f(after)}</span>;
}

/** Classes worth a badge on the board and the move strip; quiet good moves don't get one every turn. */
const NOTABLE = new Set<ReviewClass>(['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']);

/** Coach Sam on the move being viewed: a one-line verdict, why, and the concrete lines. */
function CoachText({ g, r, i, best, retry, cause, threat, onSeenThreat }: { g: AnyGame; r: Review; i: number; best: boolean; retry: Retry | null; cause?: MistakeCause; threat?: { san: string; text: string } | null; onSeenThreat?: () => void }) {
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
  // Their threat first (you missed it), then your move.
  if (threat) {
    return (
      <>
        <p className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400"><TriangleAlert size={16} /> First, their threat</p>
        <p className="mt-1">{threat.text} Can you see it on the board?</p>
        <button className="btn-primary mt-2 !px-3 !py-1.5 text-sm" onClick={onSeenThreat} data-testid="show-my-move">Then you played {p.san} →</button>
      </>
    );
  }
  // Quiet good moves get a plain line; badges and colour are kept for the moves that matter.
  const notable = NOTABLE.has(rp.cls);
  const headline = notable ? (
    <p className="flex items-center gap-1.5 font-semibold">
      <ReviewIcon cls={rp.cls} size={18} />
      <span style={{ color: isBad(rp.cls) ? RC[rp.cls].ink : undefined }}>
        {moveNo(g.plies, i)} {p.san} {RC[rp.cls].verdict}
      </span>
      <EvalDelta g={g} i={i} />
    </p>
  ) : (
    <p className="font-semibold">
      {moveNo(g.plies, i)} {p.san} <span className="font-normal text-stone-500">· {RC[rp.cls].label}</span>
    </p>
  );
  // Why a bad move went wrong, in one plain sentence (a loose piece gets its counts spelled out).
  const why = !cause ? null : cause.cause === 'hungPiece' && cause.sq ? looseWhy(p, cause.sq) ?? cause.text : cause.cause === 'plan' ? planWhy(rp.wpBefore, rp.wpAfter) : cause.text;
  // Why a good move worked: always for brilliant / great, and when there is a real tactic behind a best move.
  const nice = p.isUser && !isBad(rp.cls) && rp.cls !== 'book' ? goodWhy(p) : null;
  const showNice = !!nice && (rp.cls === 'brilliant' || rp.cls === 'great' || !/saves your/.test(nice));
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
        {why && <p className="mt-1" data-testid="why"><span className="font-semibold">Why: </span>{why}</p>}
        {showNice && <p className="mt-1 text-emerald-700 dark:text-emerald-400" data-testid="nice"><span className="font-semibold">Why it works: </span>{nice}</p>}
        {rp.cls === 'book' ? (
          <p className="mt-1">{g.opening ? `A known move in the ${g.opening}.` : 'A known opening move.'}</p>
        ) : (
          reviewNotes(p, rp.cls, cause, why, { nice: showNice, repeatTip: repeatedTips(g.plies).has(i) }).map((t, k) => <p key={k} className="mt-1">{t}</p>)
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
  // The opponent's move: what punishes it (the engine's best reply), and whether you answered it well.
  const punish = rp.cls === 'inaccuracy' ? null : punishment(g.plies, i);
  return (
    <>
      {headline}
      {isBad(rp.cls) && punish ? <p className="mt-1">{punish}</p> : <p className="mt-1">Your opponent played {shortWords(p.fenBefore, p.uci).toLowerCase()}.</p>}
      {isBad(rp.cls) && next && nextR && (() => {
        const x = punishInfo(g.plies, i);
        if (x && next.uci === x.uci) return <p className="mt-1 text-emerald-700 dark:text-emerald-400">You found it.</p>;
        if (!isBad(nextR.cls) && nextR.cls !== 'good') return <p className="mt-1">You found a good answer: <b>{next.san}</b>.</p>;
        return <p className="mt-1">{!punish && next.comment?.bestSan ? <><b className="text-emerald-700 dark:text-emerald-400">{next.comment.bestSan}</b> would have punished it. </> : null}You played {next.san} instead.</p>;
      })()}
      {!isBad(rp.cls) && next?.isUser && nextR && isBad(nextR.cls) && <p className="mt-1 text-stone-500">Careful on the next move — check what this one threatens.</p>}
    </>
  );
}
