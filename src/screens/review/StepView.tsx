// Game Review's step-through: eval bar + board, the move strip, Coach Sam on the move shown,
// Best / Retry / Next mistake, and the step arrows. With `fix`, the short "Fix your key moments"
// mode: Retry already on at each of your key mistakes in turn ("Find a better move for White."),
// Show me or Skip, the puzzle marks on the board, a strip of the moments, "Next moment ›", and a
// done card with one row per moment.
import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChartLine, Play, Square, FlipVertical2, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, RotateCcw, TriangleAlert, Lightbulb, MessageCircleQuestion, Microscope, Check, Eye, Minus, ArrowRight, SkipForward } from 'lucide-react';
import { MoveMark, type SquareMark } from '../../components/PuzzleFx';
import { Board } from '../../components/Board';
import { EvalGraph } from '../../components/Charts';
import { CoachBubble } from '../../components/Coach';
import { EvalBar, FadeScroll, Header } from '../../components/ui';
import { ReviewIcon } from '../../components/ReviewIcon';
import { namesMove } from '../../lib/coach/names';
import { ExplainSheet } from '../../components/ExplainSheet';
import { CauseIcon } from '../../components/Causes';
import { CAUSE_INFO, mistakeCauses, type MistakeCause } from '../../lib/games/causes';
import { useNav } from '../../lib/nav';
import { kingBadges, kingSquares } from '../../lib/chess/kingBadges';
import { getGameRating } from '../../lib/rewards/rating';
import { formatLine, lineToSan, tryMove, type MoveInput } from '../../lib/chess/game';
import { classify, formatScore, povScore, winPct } from '../../lib/chess/evaluation';
import { shortWords } from '../../lib/chess/words';
import { getEngine } from '../../lib/engine';
import { goodWhy, looseWhy, missedThreat, planWhy, repeatedTips, reviewNotes } from '../../lib/reviewText';
import { ArrowOverlay, type OverlayArrow } from '../../components/ArrowOverlay';
import { isBad, moveNo, punishInfo, punishment, RC, type Review, type ReviewClass } from '../../lib/review';
import { sfx, sfxCls } from '../../lib/sfx';
import { POP, SOFT, animate, haptic, reduced } from '../../lib/motion';
import { practiseMoment } from '../../lib/upNext';
import { useCelebrate } from '../../lib/celebrate';
import type { AnyGame, ImportedGame } from '../../lib/store/types';
import { SquareFlash, SquareIcon, oppName, timesOf } from './shared';

/** 'shown': Show me played the better move for you (fix mode). */
type Retry = { state: 'try' | 'checking' | 'right' | 'ok' | 'wrong' | 'shown'; fen: string; last?: { from: string; to: string }; reply?: string };
/** Fix mode: the plies of your key mistakes, in order; `onDone` when the last one is settled (saved
 *  first), `onFinish` for the done card's button (back where the flow started). */
export interface FixMode {
  plies: number[];
  onDone: () => void;
  onFinish: () => void;
}
/** How a moment ended: found it, after Show me, or skipped. */
type FixResult = 'fixed' | 'shown' | 'skipped';

export function StepView({ g, r, start, onSummary, fix }: { g: AnyGame; r: Review; start: number; onSummary: () => void; fix?: FixMode }) {
  const [i, setI] = useState(start);
  const [best, setBest] = useState(false);
  const [retry, setRetry] = useState<Retry | null>(() => (fix ? { state: 'try', fen: g.plies[fix.plies[0]].fenBefore } : null));
  // Fix mode: which moment, how each ended ('fixed' found it, 'shown' after Show me), wrong tries
  // on this one, and the done card.
  const [fk, setFk] = useState(0);
  const [fixRes, setFixRes] = useState<FixResult[]>([]);
  // The puzzle mark on the square you moved to: a green check for the right move, a red cross for a wrong one.
  const [mark, setMark] = useState<SquareMark | null>(null);
  const [fixDone, setFixDone] = useState(false);
  const wrongTries = useRef(0);
  const [explain, setExplain] = useState(false);
  // On a move where you missed their threat: show the threat first, then your move.
  const [threatSeen, setThreatSeen] = useState<number | null>(null);
  // The eval graph under the moves: open on tall screens, folded away on short ones so the coach has
  // room; your choice is remembered on this device.
  const [graphOpen, setGraphOpen] = useState(() => {
    try {
      const v = localStorage.getItem('reviewGraph');
      if (v === '1' || v === '0') return v === '1';
    } catch {
      /* no storage */
    }
    return typeof window === 'undefined' || window.innerHeight >= 780;
  });
  const toggleGraph = () =>
    setGraphOpen((o) => {
      try {
        localStorage.setItem('reviewGraph', o ? '0' : '1');
      } catch {
        /* no storage */
      }
      return !o;
    });
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
  // Stepping forward one move plays its moment (the class sound, a badge popping, a flare); going
  // back or jumping just sets the position.
  const prevI = useRef(i);
  const fwdStep = i === prevI.current + 1;
  useEffect(() => {
    const fwd = i === prevI.current + 1;
    prevI.current = i;
    setBest(false);
    // Fix mode lands on each moment with Retry already on.
    setRetry(fix && fix.plies[fk] === i ? { state: 'try', fen: g.plies[i].fenBefore } : null);
    setMark(null);
    setThreatSeen(null);
    setLineK(null);
    strip.current?.querySelector(`[data-ply="${i}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    // The coach card swaps with a short crossfade.
    void animate(document.querySelector('[data-testid="review-coach"] > *'), [{ opacity: 0.3, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { d: 200, e: 'ease-out' });
    const c = i >= 0 ? r.plies[i]?.cls : undefined;
    if (!fwd || !c || fix) return;
    sfxCls(c);
    if (c === 'brilliant') haptic('success');
    if (c === 'blunder') haptic('warn');
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // Trying a fix: their last move stays highlighted for context.
  const prevMove = fix && i > 0 ? { from: g.plies[i - 1].uci.slice(0, 2), to: g.plies[i - 1].uci.slice(2, 4) } : null;
  // What the board shows: the position after the move; before it for Best / Retry / their threat.
  const fen = frame ? frame.fen : retry ? retry.fen : p ? (best || threatStage ? p.fenBefore : p.fenAfter) : g.startFen;
  const lastMove = frame ? frame.last : retry ? retry.last ?? prevMove : p && !best && !threatStage ? { from: p.uci.slice(0, 2), to: p.uci.slice(2, 4) } : null;
  // The same arrows everywhere: green = best move, red = what a move allowed, dotted = a punishing
  // reply to their mistake (or their threat).
  const arr = (uci: string, tone: 'good' | 'bad' | 'info') => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), tone });
  const arrows: { from: string; to: string; tone: 'good' | 'bad' | 'info' }[] = [];
  const dotted: OverlayArrow[] = [];
  if (frame) {
    // Playing a line out: the board speaks for itself.
  } else if (retry) {
    if (retry.state === 'wrong' && retry.reply) arrows.push(arr(retry.reply, 'bad'));
    if (retry.state === 'shown' && p?.comment?.bestUci) arrows.push(arr(p.comment.bestUci, 'good'));
  } else if (threatStage && threat) dotted.push(arr(threat.uci, 'bad'));
  else if (best && p?.comment?.bestUci) arrows.push(arr(p.comment.bestUci, 'good'));
  else if (p && rp && isBad(rp.cls)) {
    if (p.isUser && rp.cls !== 'inaccuracy' && p.comment?.replyLine?.[0]) arrows.push(arr(p.comment.replyLine[0], 'bad'));
    const next = g.plies[i + 1];
    if (!p.isUser && next?.isUser && next.comment?.bestUci) dotted.push(arr(next.comment.bestUci, 'good'));
  }
  // Fix mode shows the position before your move, so the bar does too (no spoiler).
  const evalNow = (fix ? r.curve[i] : r.curve[i + 1]) ?? 50;
  const evalScore = fix ? (i > 0 ? g.plies[i - 1].evalAfter : undefined) : p?.evalAfter;


  const onRetryMove = (m: MoveInput) => {
    if (!retry || retry.state !== 'try' || !p) return false;
    const res = tryMove(p.fenBefore, m);
    if (!res) return false;
    const uci = res.move.lan;
    setRetry({ state: 'checking', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
    if (uci === p.comment?.bestUci) {
      sfx('correct');
      setRetry({ state: 'right', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
      if (fix) setMark({ id: Date.now(), sq: res.move.to, ok: true, stay: true });
      resolveMoment('fixed');
      return true;
    }
    void (async () => {
      try {
        const e = getEngine();
        const [b, a] = await Promise.all([e.analyze(p.fenBefore, { depth: 11, owner: 'review' }), e.analyze(res.fen, { depth: 11, owner: 'review' })]);
        const cls = classify(winPct(povScore(b.lines[0].score, p.color)), winPct(povScore(a.lines[0].score, p.color)), uci === b.bestMove);
        const good = cls === 'best' || cls === 'good';
        sfx(good ? 'correct' : 'fail');
        setRetry({ state: good ? 'ok' : 'wrong', fen: res.fen, last: { from: res.move.from, to: res.move.to }, reply: good ? undefined : a.bestMove ?? undefined });
        // The mark stays while the reply's arrow shows (and until Try again).
        if (fix) setMark({ id: Date.now(), sq: res.move.to, ok: good, stay: true });
        if (good) resolveMoment('fixed');
        else wrongTries.current++;
      } catch {
        setRetry({ state: 'wrong', fen: res.fen, last: { from: res.move.from, to: res.move.to } });
        if (fix) setMark({ id: Date.now(), sq: res.move.to, ok: false, stay: true });
        wrongTries.current++;
      }
    })();
    return true;
  };

  // ---------- Fix mode ----------
  const fixMode = !!fix && !!p && fix.plies[fk] === i;
  const lastMoment = !!fix && fk === fix.plies.length - 1;
  /** A moment is settled once: save the practice first, then the line and "Next moment ›" show.
   *  A skipped one isn't practice, so nothing is recorded for it. */
  function resolveMoment(kind: FixResult) {
    if (!fix || fixRes[fk]) return;
    setFixRes((x) => Object.assign([...x], { [fk]: kind }));
    if (kind !== 'skipped') void practiseMoment(g, i, kind === 'fixed', wrongTries.current + (kind === 'shown' ? 1 : 0));
  }
  const showMe = () => {
    const u = p?.comment?.bestUci;
    const m = u ? tryMove(p!.fenBefore, u) : null;
    if (!m) return;
    sfx('move');
    setMark(null);
    setRetry({ state: 'shown', fen: m.fen, last: { from: m.move.from, to: m.move.to } });
    resolveMoment('shown');
  };
  const nextMoment = () => {
    if (!fix) return;
    wrongTries.current = 0;
    setMark(null);
    if (lastMoment) {
      setFixDone(true);
      fix.onDone();
      return;
    }
    setFk(fk + 1);
    setI(fix.plies[fk + 1]);
  };
  /** Skip: on to the next moment; this one counts as not fixed. */
  const skipMoment = () => {
    resolveMoment('skipped');
    nextMoment();
  };
  // Nothing pops over a moment: toasts (an achievement from the practice) wait for the done card.
  useEffect(() => {
    if (!fix) return;
    useCelebrate.getState().setHold(true, { queue: true });
    return () => useCelebrate.getState().setHold(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (fixDone) useCelebrate.getState().setHold(false);
  }, [fixDone]);
  const fixedCount = fixRes.filter((x) => x === 'fixed').length;
  const allFixed = !!fix && fixedCount === fix.plies.length;
  const doneCard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fixDone) return;
    void animate(doneCard.current, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], SOFT);
    // Every moment found: one chord and the check pops (POP; no confetti, no pop with reduced animations).
    if (allFixed) {
      sfx('accLand');
      if (!reduced()) void animate(doneCard.current?.querySelector('[data-done-icon]'), [{ transform: 'scale(0.4)' }, { transform: 'none' }], POP);
    }
  }, [fixDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // The reviewed move's squares in its class colour (for the moves that matter), else yellow.
  const moveTint = p && rp && !best && !retry && !threatStage && !frame && NOTABLE.has(rp.cls) ? hexRgb(RC[rp.cls].color) : undefined;
  // On the final move, the result on each king (crown, flag, #, clock or ½), like chess.com.
  const endBadges = p && i === g.plies.length - 1 && fen === p.fenAfter && !retry && !frame ? kingBadges(g.result, g.reason) : null;
  return (
    <div className="flex h-full flex-col">
      {/* No date here: with three header buttons it would truncate (the summary shows it). */}
      <Header title={fix ? 'Key moments' : 'Game Review'} back subtitle={fix ? `Moment ${Math.min(fk + 1, fix.plies.length)} of ${fix.plies.length} · vs ${oppName(g)}` : `vs ${oppName(g)}`} right={
        fix ? (
          <button className="px-2 text-sm font-semibold text-stone-600 active:text-stone-900 dark:text-stone-300 dark:active:text-white" onClick={onSummary}>Summary</button>
        ) : (
        <span className="flex items-center gap-1">
          <button aria-label="Analyse this position" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800" onClick={() => push({ name: 'explore', fen: p ? p.fenAfter : g.startFen, orientation, title: 'Analysis' })}><Microscope size={19} /></button>
          <button aria-label="Flip board" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600 active:bg-stone-200 dark:text-stone-300 dark:active:bg-stone-800" onClick={() => setFlipped((f) => !f)}><FlipVertical2 size={19} /></button>
          <button className="px-2 text-sm font-semibold text-stone-600 active:text-stone-900 dark:text-stone-300 dark:active:text-white" onClick={onSummary}>Summary</button>
        </span>
        )
      } />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col land:max-w-6xl land:flex-row land:gap-4 land:px-3">
        <div className="flex gap-1 land:w-[min(calc(100dvh-7rem),58vw)] land:shrink-0 land:self-start">
          <EvalBar whitePct={evalNow} orientation={orientation} score={evalScore ?? { type: 'cp', value: 0 }} width={20} />
          <div className="relative min-w-0 flex-1" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} data-testid="review-board">
            <Board fen={fen} orientation={orientation} movable={retry?.state === 'try' ? g.userColor : null} onMove={onRetryMove} arrows={arrows} lastMove={lastMove} lastMoveColor={moveTint} kingBadges={endBadges} quiet={!retry && !frame && !(fwdStep && rp?.cls === 'book')} />
            {fwdStep && p && rp && !best && !retry && !frame && FLASH[rp.cls] && <SquareFlash key={`f${i}`} sq={p.uci.slice(2, 4)} orientation={orientation} color={FLASH[rp.cls]!.color} stars={FLASH[rp.cls]!.stars} />}
            <ArrowOverlay arrows={dotted} orientation={orientation} />
            {moveTint && p && rp && !(endBadges && Object.values(kingSquares(fen)).includes(p.uci.slice(2, 4))) && <SquareIcon key={i} sq={p.uci.slice(2, 4)} cls={rp.cls} orientation={orientation} pop={fwdStep} />}
            {fix && mark && <MoveMark key={`m${mark.id}`} mark={mark} orientation={orientation} />}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Move strip: the same look as the game's, with the graph toggle at its end. */}
          <div className="flex shrink-0 items-center">
          <div ref={strip} className={`no-scrollbar flex h-9 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-2 text-[14px] ${fix ? 'pointer-events-none' : ''}`}>
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
          {!fix && <button
            aria-label={graphOpen ? 'Hide the evaluation graph' : 'Show the evaluation graph'}
            aria-expanded={graphOpen}
            className={`mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${graphOpen ? 'bg-black/[0.06] text-stone-700 dark:bg-white/[0.08] dark:text-stone-200' : 'text-stone-500'}`}
            onClick={toggleGraph}
            data-testid="graph-toggle"
          >
            <ChartLine size={18} />
          </button>}
          </div>
          {/* The eval graph as a scrubber right under the moves. */}
          {graphOpen && !fix && (
            <div className="mx-3 shrink-0">
              <EvalGraph plies={g.plies} current={i} onSelect={go} height={40} times={stepTimes} classes={r.plies.map((x) => x.cls)} />
            </div>
          )}
          {/* Coach Sam on the move, in his speech bubble; takes the remaining height. */}
          {fix ? (
            <FadeScroll className="px-3 pt-2.5 pb-2" testId="review-coach">
              {fixDone ? (
                <FixDone ref={doneCard} g={g} plies={fix.plies} results={fixRes} allFixed={allFixed} onFinish={fix.onFinish} />
              ) : (
                <>
                  <CoachBubble mood={retry?.state === 'wrong' ? 'concerned' : 'happy'}>
                    <FixText g={g} i={i} retry={retry} />
                  </CoachBubble>
                  <FixStrip g={g} plies={fix.plies} results={fixRes} current={fk} />
                </>
              )}
            </FadeScroll>
          ) : (
          <FadeScroll className="px-3 pt-2.5 pb-2" testId="review-coach">
            <CoachBubble mood={rp && isBad(rp.cls) && p?.isUser ? 'concerned' : 'happy'}>
              <CoachText g={g} r={r} i={i} best={best} retry={retry} cause={cause} threat={threatStage ? threat : null} onSeenThreat={() => setThreatSeen(i)} />
              {/* While a line plays, it's spelled out under the text. */}
              {play && lineK !== null && <p className="mt-2 text-[13px] font-semibold tabular-nums text-stone-600" data-testid="play-line-text">{formatLine(play.fen, play.frames.slice(0, lineK + 1).map((x) => x.san))}</p>}
            </CoachBubble>
          </FadeScroll>
          )}
          {/* The step's two actions sit outside the scrolling text, pinned just above the buttons, so
              a small phone never hides them under the fade. */}
          {!fix && (play || (p && rp && !retry)) && (
            <div className="mx-3 mb-2 flex shrink-0 items-center gap-2" data-testid="step-tools">
              {play && (
                <button className="btn-secondary !min-h-8 !gap-1 !px-3 !py-1 text-[13px]" data-testid="play-line" title={play.label} onClick={() => setLineK(lineK === null ? 0 : null)}>
                  {lineK === null ? <><Play size={13} /> Play it out</> : <><Square size={12} /> Stop</>}
                </button>
              )}
              {p && rp && !retry && (
                <button className="btn-secondary !min-h-8 !gap-1 !px-3 !py-1 text-[13px]" onClick={() => setExplain(true)} data-testid="explain">
                  <MessageCircleQuestion size={14} /> Explain
                </button>
              )}
            </div>
          )}
          {/* Fix mode: Show me / Try again, then "Next moment ›" (nothing once the done card shows). */}
          {fix ? (
            !fixDone && (
              <div className="safe-bottom shrink-0 border-t border-black/[0.08] bg-white dark:border-white/[0.06] dark:bg-stone-900">
                <div className="mx-auto flex h-14 max-w-md gap-2 px-3 py-1.5" data-testid="fix-actions">
                  {fixMode && fixRes[fk] ? (
                    <button className="btn-primary flex-1 !min-h-11 text-[16px] !font-extrabold" onClick={nextMoment} data-testid="fix-next">
                      {lastMoment ? 'Finish' : 'Next moment'} <ChevronRight size={18} />
                    </button>
                  ) : (
                    <>
                      <button className="btn-secondary flex-1 !min-h-11" disabled={!fixMode || retry?.state === 'checking'} onClick={showMe} data-testid="fix-show">
                        <Lightbulb size={16} /> Show me
                      </button>
                      {/* Before a try: Skip (no dead button); after a wrong try: Try again. */}
                      {retry?.state === 'wrong' ? (
                        <button className="btn-secondary flex-1 !min-h-11" onClick={() => (setMark(null), setRetry({ state: 'try', fen: p!.fenBefore }))} data-testid="fix-again">
                          <RotateCcw size={16} /> Try again
                        </button>
                      ) : (
                        <button className="btn-secondary flex-1 !min-h-11" disabled={!fixMode || retry?.state === 'checking'} onClick={skipMoment} data-testid="fix-skip">
                          <SkipForward size={16} /> Skip
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          ) : (
          <>
          {/* Best / Retry / Next mistake */}
          {/* The longest label gets the widest column, so nothing pushes the row past a 360px screen. */}
          <div className="mx-3 mb-2 grid shrink-0 grid-cols-[1fr_1fr_1.3fr] gap-2">
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
          </>
          )}
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
    <button disabled={disabled} onClick={onClick} className="btn-secondary !min-h-10 min-w-0 !gap-1 !px-1 !py-1.5 text-[13.5px] whitespace-nowrap disabled:opacity-35">
      {icon} <span className="truncate">{label}</span>
    </button>
  );
}

function NavButton({ children, onClick, disabled, label, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string; primary?: boolean }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      data-lip
      className={`mb-[3px] flex items-center justify-center rounded-[10px] transition duration-[60ms] disabled:opacity-30 ${
        primary
          ? 'bg-brand-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_3px_0_var(--color-brand-800)] enabled:active:translate-y-[2px] enabled:active:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_0_var(--color-brand-800)] enabled:data-[down]:translate-y-[2px] enabled:data-[down]:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_0_var(--color-brand-800)]'
          : 'bg-stone-100 text-stone-800 shadow-[0_3px_0_rgba(0,0,0,0.12)] enabled:active:translate-y-[2px] enabled:active:shadow-[0_1px_0_rgba(0,0,0,0.12)] enabled:data-[down]:translate-y-[2px] enabled:data-[down]:shadow-[0_1px_0_rgba(0,0,0,0.12)] dark:bg-stone-800 dark:text-stone-100 dark:shadow-[0_3px_0_rgba(0,0,0,0.4)] dark:enabled:active:shadow-[0_1px_0_rgba(0,0,0,0.4)] dark:enabled:data-[down]:shadow-[0_1px_0_rgba(0,0,0,0.4)]'
      }`}
    >
      {children}
    </button>
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
/** Stepping onto these, the square flares: teal (with stars) for a brilliant, red for a blunder, orange for a mistake or miss. */
const FLASH: Partial<Record<ReviewClass, { color: string; stars?: string[] }>> = {
  brilliant: { color: 'rgba(27,172,166,.75)', stars: ['#7ff0ea', '#1baca6', '#ffffff'] },
  blunder: { color: 'rgba(250,65,45,.6)' },
  mistake: { color: 'rgba(255,164,89,.55)' },
  miss: { color: 'rgba(255,164,89,.55)' },
};

/** "4…g6": a move with its number (no space after the dots). */
const moveLabel = (g: AnyGame, ply: number) => `${moveNo(g.plies, ply)}${g.plies[ply].san}`;

const CHIP: Record<FixResult | 'current' | 'next', string> = {
  current: 'ring-[1.5px] ring-stone-400 text-stone-800 dark:ring-stone-500 dark:text-stone-100',
  fixed: 'bg-brand-500/15 text-brand-700 ring-1 ring-brand-500 dark:text-brand-400',
  shown: 'bg-stone-200 text-stone-600 dark:bg-white/10 dark:text-stone-300',
  skipped: 'bg-stone-200 text-stone-600 dark:bg-white/10 dark:text-stone-300',
  next: 'bg-stone-100 text-stone-500 dark:bg-white/[0.05] dark:text-stone-400',
};
const CHIP_ICON: Partial<Record<FixResult, ReactNode>> = { fixed: <Check size={13} strokeWidth={3} />, shown: <Eye size={13} />, skipped: <Minus size={13} strokeWidth={3} /> };

/** The moments as a row of chips under the coach: current outlined, found green, shown or skipped grey, the rest muted. */
function FixStrip({ g, plies, results, current }: { g: AnyGame; plies: number[]; results: FixResult[]; current: number }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 pl-[52px]" data-testid="fix-strip">
      {plies.map((ply, k) => {
        const res = results[k];
        const state = res ?? (k === current ? 'current' : 'next');
        return (
          <span key={ply} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ${CHIP[state]}`} data-state={state}>
            {res && CHIP_ICON[res]}
            {moveLabel(g, ply)}
          </span>
        );
      })}
    </div>
  );
}

/** The done card: "1 of 2 fixed" (or "Both fixed"), one row per moment, and Done. */
const FixDone = forwardRef<HTMLDivElement, { g: AnyGame; plies: number[]; results: FixResult[]; allFixed: boolean; onFinish: () => void }>(function FixDone({ g, plies, results, allFixed, onFinish }, ref) {
  const n = plies.length;
  const found = results.filter((x) => x === 'fixed').length;
  const head = allFixed ? (n === 1 ? 'Fixed' : n === 2 ? 'Both fixed' : `All ${n} fixed`) : `${found} of ${n} fixed`;
  const LABEL: Record<FixResult, string> = { fixed: 'Found it', shown: 'Shown', skipped: 'Skipped' };
  return (
    <div ref={ref} className="card !px-4 !py-4" data-testid="fix-done" data-all={allFixed || undefined}>
      <div className="flex flex-col items-center gap-2">
        <span data-done-icon className={`flex h-11 w-11 items-center justify-center rounded-full ${allFixed ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600 dark:bg-white/[0.08] dark:text-stone-300'}`}>
          <Check size={24} strokeWidth={3} />
        </span>
        <p className="text-[18px] font-extrabold tracking-[-0.01em]">{head}</p>
      </div>
      <div className="mt-3 divide-y divide-stone-100 border-t border-stone-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
        {plies.map((ply, k) => {
          const res = results[k] ?? 'skipped';
          return (
            <div key={ply} className="flex items-center gap-2.5 py-2.5 text-[14px]" data-testid="fix-done-row" data-state={res}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${res === 'fixed' ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-500 dark:bg-white/[0.08] dark:text-stone-400'}`}>{CHIP_ICON[res]}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="text-stone-500 dark:text-stone-400">{moveLabel(g, ply)}</span>
                <ArrowRight size={13} className="mx-1 inline align-[-1px] text-stone-400" />
                <b>{g.plies[ply].comment?.bestSan}</b>
              </span>
              <span className={`shrink-0 text-[13px] font-semibold ${res === 'fixed' ? 'text-brand-700 dark:text-brand-400' : 'text-stone-500 dark:text-stone-400'}`}>{LABEL[res]}</span>
            </div>
          );
        })}
      </div>
      <button className="btn-primary mt-3 !min-h-11 w-full" onClick={onFinish} data-testid="fix-finish">Done</button>
    </div>
  );
});

/** Fix mode's coach line: the task, then one short line once it's found or shown. */
function FixText({ g, i, retry }: { g: AnyGame; i: number; retry: Retry | null }) {
  const p = g.plies[i];
  const c = p.comment;
  const side = p.color === 'w' ? 'White' : 'Black';
  const reply = c?.replyLine?.[0] ? lineToSan(p.fenAfter, c.replyLine.slice(0, 1))[0] : undefined;
  // What the game move cost, in one short line.
  const gameLine = reply ? `In the game, ${p.san} allowed ${reply}.` : `In the game you played ${p.san}.`;
  const st = retry?.state ?? 'try';
  if (st === 'try' || st === 'checking') {
    return (
      <>
        <p className="font-semibold" data-testid="fix-task">{st === 'checking' ? 'Checking…' : `Find a better move for ${side}.`}</p>
        <p className="mt-1 text-[13px] text-stone-600 dark:text-stone-300">You played {p.san} here in the game.</p>
      </>
    );
  }
  if (st === 'wrong') {
    const theirs = retry?.reply ? lineToSan(retry.fen, [retry.reply])[0] : undefined;
    return (
      <>
        <p className="font-semibold text-danger-700 dark:text-danger-300">Not quite{theirs ? ` — ${theirs} answers that` : ''}.</p>
        <p className="mt-1 text-[13px] text-stone-600 dark:text-stone-300">Try again, or tap Show me.</p>
      </>
    );
  }
  const head = st === 'right' ? <>Yes! <b>{c?.bestSan}</b> is the best move.</> : st === 'ok' ? <>That works too. <b>{c?.bestSan}</b> was the engine's choice.</> : <><b>{c?.bestSan}</b> was the move.</>;
  return (
    <>
      <p className={`font-semibold ${st === 'shown' ? '' : 'text-brand-700 dark:text-brand-500'}`} data-testid="fix-line">{head}</p>
      <p className="mt-1 text-[13px] text-stone-600 dark:text-stone-300">{gameLine}</p>
    </>
  );
}

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
    const msg = { try: 'Your move — find something better than ' + p.san + '.', checking: 'Checking…', right: `Yes! ${c?.bestSan} is the best move.`, ok: 'That works too — a good alternative.', wrong: 'Not quite. Tap Retry to try again, or Best to see it.', shown: `${c?.bestSan} was the move.` }[retry.state];
    return <p className={`font-semibold ${retry.state === 'right' || retry.state === 'ok' ? 'text-brand-700 dark:text-brand-500' : retry.state === 'wrong' ? 'text-danger-700' : ''}`}>{msg}</p>;
  }
  // Their threat first (you missed it), then your move.
  if (threat) {
    return (
      <>
        <p className="flex items-center gap-1.5 font-semibold text-danger-700 dark:text-danger-300"><TriangleAlert size={16} /> First, their threat</p>
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
    const notes = rp.cls === 'book' ? [] : reviewNotes(p, rp.cls, cause, why, { nice: showNice, repeatTip: repeatedTips(g.plies).has(i) });
    // Say the better move once: no "Best was:" when a sentence above already names it.
    const bestNamed = [why ?? '', ...notes].some((t) => namesMove(t, p.fenBefore, c?.bestUci));
    const bestLine = sanLine(p.fenBefore, c?.bestLine, 4);
    return (
      <>
        {headline}
        {cause && (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-[12.5px] text-stone-600 dark:text-stone-300">
            <span className="chip bg-stone-100 !px-2 !text-[11px] dark:bg-white/[0.06]"><CauseIcon c={cause.cause} /> {CAUSE_INFO[cause.cause].label}</span>
            {cause.secs !== undefined && <span className={cause.fast || cause.timeTrouble ? 'font-semibold text-warn-700 dark:text-warn-500' : ''}>{cause.secs < 10 ? cause.secs.toFixed(1) : Math.round(cause.secs)} s{cause.timeTrouble ? ' · time trouble' : cause.fast ? ' · played fast' : ''}</span>}
          </p>
        )}
        {why && <p className="mt-1" data-testid="why"><span className="font-semibold">Why: </span>{why}</p>}
        {showNice && <p className="mt-1 text-brand-700 dark:text-brand-500" data-testid="nice"><span className="font-semibold">Why it works: </span>{nice}</p>}
        {rp.cls === 'book' ? (
          <p className="mt-1">{g.opening ? `A known move in the ${g.opening}.` : 'A known opening move.'}</p>
        ) : (
          notes.map((t, k) => <p key={k} className="mt-1">{t}</p>)
        )}
        {isBad(rp.cls) && (
          <div className="mt-1.5 space-y-0.5 text-[13px]">
            {reply && rp.cls !== 'inaccuracy' && <p><span className="text-stone-500">What it allows:</span> <b>{reply}</b></p>}
            {c?.bestSan && (best || !bestNamed) && <p><span className="text-stone-500">{best ? 'Best line:' : 'Best was:'}</span> <b className="text-brand-700 dark:text-brand-500">{best && bestLine ? bestLine : c.bestSan}</b></p>}
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
        if (x && next.uci === x.uci) return <p className="mt-1 text-brand-700 dark:text-brand-500">You found it.</p>;
        if (!isBad(nextR.cls) && nextR.cls !== 'good') return <p className="mt-1">You found a good answer: <b>{next.san}</b>.</p>;
        return <p className="mt-1">{!punish && next.comment?.bestSan ? <><b className="text-brand-700 dark:text-brand-500">{next.comment.bestSan}</b> would have punished it. </> : null}You played {next.san} instead.</p>;
      })()}
      {!isBad(rp.cls) && next?.isUser && nextR && isBad(nextR.cls) && <p className="mt-1 text-stone-500">Careful on the next move — check what this one threatens.</p>}
    </>
  );
}
