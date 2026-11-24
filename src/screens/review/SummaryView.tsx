// Game Review's summary: result, both players' accuracy and game rating, Coach Sam's take, key
// moments, the move-class table, phases, time and mistakes, and the way into the step-through.
import { appTc, canRematch, rematchInfo } from '../../lib/rematch';
import { usePlay } from '../../lib/store/play';
import { isEligible } from '../../lib/turning';
import { CAUSE_LESSON } from '../../lib/course';
import { lessonById } from '../../lib/lessons/data';
import { GraduationCap, Swords } from 'lucide-react';
import { UserAvatar } from '../../components/UserAvatar';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BOUNCE, SOFT, animate, reduced, sleep, token, type Token } from '../../lib/motion';
import { GREENS, centre, emit } from '../../lib/fx';
import { sfx } from '../../lib/sfx';
import { countTo } from '../../lib/numbers';
import { ChevronRight, Crosshair, Sparkles, Lightbulb } from 'lucide-react';
import { Board } from '../../components/Board';
import { EvalGraph } from '../../components/Charts';
import { CoachAvatar, Portrait } from '../../components/Coach';
import { Header } from '../../components/ui';
import { classInk, ReviewIcon } from '../../components/ReviewIcon';
import { CauseBreakdown, CauseIcon } from '../../components/Causes';
import { CAUSE_INFO, causeTotals, missedChances, mistakeCauses, type MistakeCause } from '../../lib/games/causes';
import { ChessComBadge, TimeStatsCard } from '../../components/ChessCom';
import { useNav } from '../../lib/nav';
import { opponentById } from '../../lib/people';
import { shortDate } from '../../lib/store/finish';
import { db } from '../../lib/db';
import { cpLosses, gameRating, verdictLine } from '../../lib/reviewText';
import { moveNo, RC, slipCardLine, REVIEW_ORDER, type Review } from '../../lib/review';
import { PHASES } from '../../lib/games/mistakes';
import { THEMES } from '../../lib/themes';
import { trapById } from '../../lib/traps';
import type { AnyGame } from '../../lib/store/types';
import { SquareIcon, oppName, pending, timesOf } from './shared';

// The reveal plays the first time a game's review opens (remembered on this device).
const REVEALED = 'reviewsRevealed';
const revealedKey = (g: AnyGame) => `${g.source ?? 'app'}:${g.id ?? g.endedAt}`;
function wasRevealed(k: string) {
  try {
    return (JSON.parse(localStorage.getItem(REVEALED) ?? '[]') as string[]).includes(k);
  } catch {
    return true;
  }
}
function markRevealed(k: string) {
  try {
    const list = JSON.parse(localStorage.getItem(REVEALED) ?? '[]') as string[];
    localStorage.setItem(REVEALED, JSON.stringify([...list.filter((x) => x !== k), k].slice(-300)));
  } catch {
    /* no storage: it will play again */
  }
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

function PlayerChip({ g, me }: { g: AnyGame; me: boolean }) {
  const o = opponentById(g.opponentId);
  return (
    <span className="flex min-w-0 flex-col items-center gap-1">
      {me ? (
        <UserAvatar size={44} />
      ) : o ? (
        <Portrait id={o.id} size={44} />
      ) : (
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-chesscom text-lg font-black text-white">{oppName(g)[0]?.toUpperCase()}</span>
      )}
      <span className="max-w-full truncate text-xs font-semibold">{me ? 'You' : oppName(g)}</span>
    </span>
  );
}

export function SummaryView({ g, r, trap, onStart, fix }: { g: AnyGame; r: Review; trap?: string; onStart: (ply: number) => void; /** "Fix your key moments": how many, whether it already played once, and the way in. */ fix?: { count: number; again: boolean; start: () => void } }) {
  const push = useNav((s) => s.push);
  const meWhite = g.userColor === 'w';
  const resultText = g.userResult === 'win' ? 'You won' : g.userResult === 'loss' ? 'You lost' : 'Draw';
  const lesson = g.summary.pattern?.theme ?? g.summary.lessonTheme;
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
  const resultTone = g.userResult === 'win' ? 'bg-brand-700 text-white' : g.userResult === 'loss' ? 'bg-stone-700 text-white dark:bg-stone-800' : 'bg-stone-500 text-white';
  // chess.com's accuracy boxes: the white player's white, the black player's charcoal.
  // No analysed moves on a side (resigned before moving): "—", no count-up.
  const accShown = (side: { accuracy: number; moves: number }) => (side.moves ? side.accuracy.toFixed(1) : '—');
  const accNum = (white: boolean, mine: boolean) => (
    <span ref={mine ? accMe : accThem} className={`inline-flex w-[84px] justify-center rounded-[6px] py-1.5 text-[24px] leading-none font-extrabold tabular-nums ${white ? 'bg-white text-[#312e2b] ring-1 ring-black/10' : 'bg-[#403d39] text-white'}`} data-testid={mine ? 'review-acc-me' : undefined}>
      {accShown(mine ? r.me : r.them)}
    </span>
  );

  // ---------- The reveal (first open of this game's review) ----------
  // Games played in the app are analysed during play, so the summary is ready at once: no fake wait.
  const rvKey = revealedKey(g);
  const [reveal] = useState(() => !pending(g) && !reduced() && !wasRevealed(rvKey));
  const [rvDone, setRvDone] = useState(!reveal);
  const [typed, setTyped] = useState<number | null>(reveal ? 0 : null);
  const accMe = useRef<HTMLSpanElement>(null);
  const accThem = useRef<HTMLSpanElement>(null);
  const verdictBox = useRef<HTMLDivElement>(null);
  const movesBox = useRef<HTMLDivElement>(null);
  const startBar = useRef<HTMLDivElement>(null);
  const rvTk = useRef<Token>(token());
  const finishReveal = () => {
    rvTk.current.skip = true;
    for (const [el, v] of [[accMe.current, r.me], [accThem.current, r.them]] as const) {
      if (!el) continue;
      el.classList.remove('skel');
      el.textContent = accShown(v);
    }
    [verdictBox.current, movesBox.current, startBar.current].forEach((el) => el?.getAnimations({ subtree: true }).forEach((a) => a.cancel()));
    setTyped(null);
    setRvDone(true);
  };
  useLayoutEffect(() => {
    if (!reveal) return;
    for (const el of [accMe.current, accThem.current]) {
      if (!el) continue;
      el.textContent = '\u00a0';
      el.classList.add('skel');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!reveal) return;
    markRevealed(rvKey);
    const tk = token();
    rvTk.current = tk;
    void (async () => {
      // 1 · A shimmer, then both accuracies count up from 0 and land with a chord.
      await sleep(250, tk);
      if (tk.skip) return;
      accMe.current?.classList.remove('skel');
      accThem.current?.classList.remove('skel');
      await Promise.all([r.me.moves ? countTo(accMe.current, 0, r.me.accuracy, 950, 1, tk) : null, r.them.moves ? countTo(accThem.current, 0, r.them.accuracy, 950, 1, tk) : null]);
      if (tk.skip) return;
      sfx('accLand');
      void animate(accMe.current, [{ transform: 'scale(1.12)' }, { transform: 'none' }], BOUNCE);
      void animate(accThem.current, [{ transform: 'scale(1.05)' }, { transform: 'none' }], BOUNCE);
      if (accMe.current) {
        const c = centre(accMe.current);
        emit({ x: c.x, y: c.y, n: 10, shape: 'star', colors: GREENS.concat(['#ffffff']), speed: [50, 150], life: [0.35, 0.6], size: [2, 4] });
      }
      // 2 · Sam's verdict rises in and types at 60 characters a second.
      void animate(verdictBox.current, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], SOFT);
      for (let i = 1; i <= verdict.length && !tk.skip; i++) {
        setTyped(i);
        await sleep(1000 / 60, tk);
      }
      if (tk.skip) return;
      setTyped(null);
      // 3 · The move-count rows tick in from the left; the Brilliant row gets its moment.
      const rowsEls = [...(movesBox.current?.querySelectorAll<HTMLElement>('[data-rv-row]') ?? [])];
      let k = 0;
      for (const row of rowsEls) {
        if (tk.skip) return;
        void animate(row, [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], SOFT);
        void animate(row.querySelector('.rv-ic'), [{ transform: 'scale(0)' }, { transform: 'scale(1.3)', offset: 0.6 }, { transform: 'none' }], { d: 340, delay: 60, e: 'ease-out' });
        const brilliant = row.dataset.rvRow === 'brilliant' && Number(row.dataset.n) > 0;
        if (brilliant) {
          setTimeout(() => {
            if (tk.skip) return;
            sfx('clsBrilliant');
            void animate(row, [{ backgroundColor: 'rgba(27,172,166,0)' }, { backgroundColor: 'rgba(27,172,166,.18)', offset: 0.3 }, { backgroundColor: 'rgba(27,172,166,.08)' }], { d: 1200, fill: 'forwards' });
            void animate(row.querySelector('.rv-shine'), [{ transform: 'translateX(0) skewX(-20deg)', opacity: 1 }, { transform: 'translateX(700%) skewX(-20deg)', opacity: 1 }], { d: 900, e: 'ease-in-out' });
            const ic = row.querySelector('.rv-ic');
            if (ic) {
              const c = centre(ic);
              emit({ x: c.x, y: c.y, n: 12, shape: 'star', colors: ['#7ff0ea', '#1baca6', '#ffffff'], speed: [60, 200], life: [0.4, 0.8], size: [2.5, 5] });
            }
          }, 120);
        } else if (Number(row.dataset.n) > 0) sfx('land', k);
        k++;
        await sleep(brilliant ? 260 : 110, tk);
      }
      if (tk.skip) return;
      // 4 · Start Review rises in last.
      await animate(startBar.current, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], SOFT);
      if (!tk.skip) finishReveal();
    })();
    return () => {
      tk.skip = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex h-full flex-col">
      <Header title="Game Review" back subtitle={`vs ${oppName(g)} · ${shortDate(g.endedAt)}`} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]" onClick={rvDone ? undefined : finishReveal}>
        {/* Hero: result, players and accuracy, and Coach Sam's take */}
        <div className="card overflow-hidden !p-0">
          <div className="flex items-center justify-center gap-2 pt-3.5">
            <span className={`chip !px-3 !py-1 text-[13px] ${resultTone}`}>{resultText}</span>
            <span className="text-[13px] text-stone-500">by {g.reason}</span>
            {g.source === 'chess.com' && <ChessComBadge />}
            {g.match && <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100">Match</span>}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3 pb-4">
            <div className="flex flex-col items-center gap-2">
              <PlayerChip g={g} me />
              {!pending(g) && accNum(meWhite, true)}
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">{pending(g) ? 'vs' : 'Accuracy'}</span>
            <div className="flex flex-col items-center gap-2">
              <PlayerChip g={g} me={false} />
              {!pending(g) && accNum(!meWhite, false)}
            </div>
            {perf && (
              <>
                {perf.me ? <GameRating value={perf.me} testId="game-rating" /> : <span />}
                <span />
                {perf.them ? <GameRating value={perf.them} /> : <span />}
              </>
            )}
          </div>
          <div className="flex gap-3 border-t border-stone-100 bg-stone-50/70 px-4 py-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <CoachAvatar mood={g.userResult === 'loss' ? 'concerned' : 'happy'} size={36} />
            <div ref={verdictBox} className={`min-w-0 flex-1 text-[14.5px] leading-snug ${rvDone ? '' : 'opacity-0'}`}>
              {pending(g) ? <p>I haven't analysed this chess.com game yet — it's in the queue. You can already step through the moves.</p> : (
                <>
                  <p className="text-[18px] leading-snug font-bold tracking-[-0.01em]" data-testid="verdict">
                    {typed === null ? verdict : <>{verdict.slice(0, typed)}<span className="invisible">{verdict.slice(typed)}</span></>}
                  </p>
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
                  <button key={m.ply} className="card w-[148px] shrink-0 snap-start !p-2 text-left transition-[filter] active:brightness-95" onClick={() => onStart(m.ply)}>
                    <div className="relative">
                      <Board fen={q.fenAfter} orientation={meWhite ? 'white' : 'black'} movable={null} lastMove={{ from: q.uci.slice(0, 2), to: q.uci.slice(2, 4) }} showCoordinates={false} />
                      <SquareIcon sq={q.uci.slice(2, 4)} cls={r.plies[m.ply].cls} orientation={meWhite ? 'white' : 'black'} small />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold">
                      <ReviewIcon cls={r.plies[m.ply].cls} size={15} /> {moveNo(g.plies, m.ply)} {q.san}
                      <span className="ml-auto text-xs font-normal text-stone-500">{q.isUser ? 'you' : 'them'}</span>
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
            <Swords size={20} className="shrink-0 text-brand-700" />
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
          <div className="card flex items-center gap-3 !p-3.5 ring-2 !ring-danger-500/60">
            <span className="flex-1 text-sm">
              <b>Lost to a known trap: {trapById(trap)!.name}.</b> It's in your daily reviews now.
            </span>
            <button className="btn-secondary !py-1.5 text-sm" onClick={() => push({ name: 'trap', trapId: trap })}>Learn it</button>
          </div>
        )}

        {!pending(g) && (
          <Sec title="Moves" fold startOpen remember="reviewMoves" preview={badCounts.length ? badCounts.join(' · ') : 'No mistakes from you'}>
            <div className="card !px-3 !py-2">
              <div ref={movesBox} className="divide-y divide-stone-100 dark:divide-white/[0.05]">
                {rows.map((c) => (
                  <div key={c} data-rv-row={c} data-n={r.me.counts[c] + r.them.counts[c]} className={`relative grid grid-cols-[2.5rem_1fr_2.5rem] items-center overflow-hidden rounded-[6px] py-1.5 text-[14px] ${rvDone ? '' : 'opacity-0'}`}>
                    <span className="rv-shine pointer-events-none absolute inset-y-0 -left-1/4 w-1/6 skew-x-[-20deg] bg-white/40 opacity-0" />
                    <span className={`text-center font-bold tabular-nums ${r.me.counts[c] ? classInk(c).className : 'opacity-25'}`} style={r.me.counts[c] ? classInk(c).style : undefined}>{r.me.counts[c]}</span>
                    <span className="flex items-center justify-center gap-2">
                      <span className="rv-ic inline-flex">
                        <ReviewIcon cls={c} size={18} />
                      </span>
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
                    <span className="text-xs text-stone-500">vs</span>
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
                <button className="mx-3.5 mb-3 flex w-[calc(100%-1.75rem)] items-center gap-3 rounded-[10px] bg-brand-50 px-3 py-2.5 text-left ring-1 ring-brand-100 transition active:scale-[0.98] dark:bg-brand-700/15 dark:ring-brand-700/30" onClick={() => push({ name: 'lesson', lessonId: CAUSE_LESSON[topCause] })}>
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
                      {m.secs !== undefined && <span className={`whitespace-nowrap ${m.fast || m.timeTrouble ? 'font-semibold text-warn-700 dark:text-warn-500' : 'text-stone-500'}`}> · {m.secs < 10 ? m.secs.toFixed(1) : Math.round(m.secs)} s{m.timeTrouble ? ', time trouble' : m.fast ? ', fast' : ''}</span>}
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
                <Row key={m.ply} onClick={() => onStart(m.ply)} icon={<span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-black text-white">!</span>}>
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
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warn-100 text-warn-700 dark:bg-warn-500/15 dark:text-warn-500"><Lightbulb size={20} /></span>
            <span className="flex-1 text-sm">
              <span className="block font-semibold">Practise: {THEMES[lesson].label}</span>
              <span className="block text-xs text-stone-500">{g.summary.pattern ? `It came up in ${g.summary.pattern.count} of your last ${g.summary.pattern.of} games.` : '2 minutes on what tripped you up.'}</span>
            </span>
            <button className="btn-secondary !py-1.5 text-sm" onClick={() => push({ name: 'practice', theme: lesson })}>Start</button>
          </div>
        )}
      </div>
      <div ref={startBar} className={`safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.08] bg-white px-4 pt-2.5 pb-2 dark:border-white/[0.06] dark:bg-stone-900 ${rvDone ? '' : 'opacity-0'}`}>
        <div className="mx-auto flex max-w-xl gap-2">
          <button className="btn-primary !min-h-14 flex-1 text-[17px] !font-extrabold" onClick={() => onStart(-1)}>
            <Sparkles size={18} /> Start Review
          </button>
          {fix && !pending(g) && (
            <button className="btn-secondary !min-h-14 text-[14px]" onClick={fix.start} data-testid="fix-moments">
              <Crosshair size={16} /> {fix.again ? 'Fix moments again' : `Fix ${fix.count} moment${fix.count === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A titled section of the summary; `fold` sections start closed with a one-line preview. */
function Sec({ title, children, fold, preview, startOpen = false, remember }: { title: string; children: ReactNode; fold?: boolean; preview?: string; /** A foldable section that starts open. */ startOpen?: boolean; /** Remember the fold state on this device under this key. */ remember?: string }) {
  const [open, setOpenState] = useState(() => {
    if (!fold) return true;
    try {
      const v = remember ? localStorage.getItem(remember) : null;
      if (v === '1' || v === '0') return v === '1';
    } catch {
      /* no storage */
    }
    return startOpen;
  });
  const setOpen = (o: boolean) => {
    setOpenState(o);
    try {
      if (remember) localStorage.setItem(remember, o ? '1' : '0');
    } catch {
      /* no storage */
    }
  };
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

/** chess.com's per-player "Game rating" under the accuracy box (nothing when too few moves count). */
function GameRating({ value, testId }: { value: number; testId?: string }) {
  return (
    <span className="flex flex-col items-center leading-tight" data-testid={testId}>
      <span className="text-[13px] font-semibold text-stone-500">Game rating</span>
      <span className="text-base font-extrabold tabular-nums">{value}{value >= 2000 ? '+' : ''}</span>
    </span>
  );
}

/** A tappable row inside a summary card. */
function Row({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left text-[14px] leading-snug press" onClick={onClick}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight size={16} className="mt-0.5 shrink-0 text-stone-300 dark:text-stone-600" />
    </button>
  );
}
