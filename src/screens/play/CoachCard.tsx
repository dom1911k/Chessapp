// Coach Sam under the board: the current message (verdict, better move, what it allows) and the
// whole conversation of the game.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { reduced } from '../../lib/motion';
import { BookOpen, Check, CircleHelp, Crosshair, Flag, Lightbulb, MessagesSquare, ScanSearch, ShieldCheck, Undo2, X } from 'lucide-react';
import { formatScore } from '../../lib/chess/evaluation';
import { useSettings } from '../../lib/settings';
import { usePlay } from '../../lib/store/play';
import { CoachBubble, FlagIconButton } from '../../components/Coach';
import { Spinner } from '../../components/ui';
import type { FeedItem, PlyRecord } from '../../lib/store/types';
import { ReviewIcon } from '../../components/ReviewIcon';
import { RC, type ReviewClass } from '../../lib/review';
import { formatLine, lineToSan } from '../../lib/chess/game';
import { playSound } from '../../lib/sound';

const FEED_LABEL: Partial<Record<FeedItem['kind'], { label: string; icon: ReactNode }>> = {
  opening: { label: 'Opening', icon: <BookOpen size={12} /> },
  hint: { label: 'Hint', icon: <Lightbulb size={12} /> },
  threat: { label: 'Threats', icon: <Crosshair size={12} /> },
  takeback: { label: 'Take-back', icon: <Undo2 size={12} /> },
  explain: { label: 'The position', icon: <ScanSearch size={12} /> },
  note: { label: 'Watch out', icon: <ShieldCheck size={12} /> },
  result: { label: 'Game over', icon: <Flag size={12} /> },
};

// Messages already typed out (or already there when the game was opened) appear in full.
const typed = new Set<string>();
const typedGames = new Set<number>();

/** Marks the messages a game already has as read, so only new ones are typed out. */
function useTypedBaseline(startedAt: number, feed: FeedItem[]) {
  if (typedGames.has(startedAt)) return;
  typedGames.add(startedAt);
  for (const it of feed) typed.add(`${startedAt}:${it.id}`);
}

/** Reveals a message word by word with a soft tick; tap to show it all. Returns words shown so far. */
function useTypewriter(key: string, total: number, enabled: boolean) {
  const [fresh] = useState(() => enabled && !typed.has(key) && !reduced());
  const [shown, setShown] = useState(fresh ? 0 : total);
  useEffect(() => {
    typed.add(key);
    if (!fresh) return;
    let n = 0;
    const t = setInterval(() => {
      n++;
      setShown(n);
      if (n % 2 === 1) playSound('type');
      if (n >= total) clearInterval(t);
    }, 55);
    return () => clearInterval(t);
  }, [key, fresh, total]);
  return { shown, skip: () => setShown(total) };
}

/** One coach message (used for the current card and in the conversation sheet). */
function FeedBubble({ it, compact, flag, type }: { it: FeedItem; compact?: boolean; flag?: boolean; type?: boolean }) {
  const g = usePlay((s) => s.game)!;
  const p = it.ply >= 0 ? g.plies[it.ply] : undefined;
  // Sam's line about his own move (Play Coach): "Coach Sam · 6… Ng4".
  const samLabel = it.kind === 'sam' && p ? { label: `Coach Sam · ${Number(p.fenBefore.split(' ')[5]) || Math.floor(it.ply / 2) + 1}${p.color === 'b' ? '…' : '.'} ${p.san}`, icon: undefined } : undefined;
  const words = useMemo(() => it.text.map((t) => t.split(' ')), [it.text]);
  const total = words.reduce((n, w) => n + w.length, 0);
  const gentle = useSettings((st) => st.coachStyle === 'gentle');
  const { shown, skip } = useTypewriter(`${g.startedAt}:${it.id}`, total, !!type);
  const verdict = it.kind === 'comment' && !!p;
  const canFlag = !!flag && !gentle && !compact && it.kind === 'comment' && !!p?.comment && it.classification !== 'best' && it.classification !== 'good';
  let index = 0;
  return (
    // One verdict only: the "Qh6 is a blunder" row when the move is known, else the class chip.
    <CoachBubble
      compact={compact}
      {...(samLabel ?? FEED_LABEL[it.kind])}
      mood={it.mood ?? 'happy'}
      badge={verdict ? undefined : it.classification}
      special={verdict ? undefined : it.special}
      corner={canFlag ? <FlagIconButton fen={p!.fenBefore} uci={p!.uci} comment={p!.comment!} /> : undefined}
      className={canFlag ? '!pr-9' : ''}
    >
      {verdict && <MoveVerdict p={p!} index={it.ply} />}
      <div className="space-y-1" onClick={shown < total ? skip : undefined}>
        {words.map((line, i) => (
          <p key={i} className={it.kind === 'opening' && i === 0 ? 'text-[16px] font-bold' : ''}>
            {/* Every word is laid out from the start (hidden ones invisible) so the card never jumps in size. */}
            {line.map((w, j) => (
              <span key={j} className={`transition-opacity duration-200 ${index++ < shown ? '' : 'opacity-0'}`}>
                {j ? ' ' : ''}
                {w}
              </span>
            ))}
          </p>
        ))}
      </div>
      {it.kind === 'comment' && p && (it.classification === 'mistake' || it.classification === 'blunder') && shown >= total && <MoveLines p={p} />}
    </CoachBubble>
  );
}

/** Coach Sam's current message only — the conversation so far is one tap away. */
export function CoachCard({ safetyMessages, onHistory }: { safetyMessages: string[]; onHistory: () => void }) {
  const s = usePlay();
  const settings = useSettings();
  const g = s.game!;
  const feed = g.feed ?? [];
  const latest = feed[feed.length - 1];
  const paused = s.phase === 'paused';
  const earlier = feed.length - 1;
  useTypedBaseline(g.startedAt, feed);

  // An older message (2+ moves ago) shrinks, and "Your move" takes the stage.
  const sinceLatest = latest ? g.plies.length - 1 - latest.ply : 0;
  const stale = !!latest && !paused && !s.over && !s.precheck && sinceLatest >= 2;
  const myTurn = s.phase === 'userTurn' && !s.precheck;

  let card: ReactNode;
  if (s.precheck) {
    card = (
      <CoachBubble mood="concerned" label="Before you move" icon={<ShieldCheck size={12} />}>
        <p>{s.precheck.check.ask}</p>
        {s.precheck.revealed && <p className="font-semibold">{s.precheck.check.reveal}</p>}
      </CoachBubble>
    );
  } else if (latest) {
    // A quick question is open: anything longer than Sam's line about his move gets out of its way.
    card = <FeedBubble key={latest.id} it={latest} flag type compact={stale || (!!s.quiz && latest.kind !== 'sam')} />;
  }

  return (
    <div className="space-y-2">
      {stale && myTurn && (
        <p className="flex items-center gap-2 px-1 text-[15px] font-bold" data-testid="your-move">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> Your move
        </p>
      )}
      {card}
      {s.quiz && <QuizBubble />}
      {!s.precheck && safetyMessages.length > 0 && settings.safetyOverlay && (
        <p className="flex items-start gap-1.5 px-1 text-[13px] text-stone-600 dark:text-stone-300">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-700" />
          {safetyMessages.join(' ')}
        </p>
      )}
      <div className="flex items-center justify-between px-1 text-xs text-stone-500">
        <span className="flex items-center gap-1.5">
          {s.phase === 'analyzing' ? (
            <>
              <Spinner className="!h-3 !w-3" /> Coach Sam is looking at your move…
            </>
          ) : myTurn && !stale ? (
            'Your move'
          ) : null}
        </span>
        {earlier > 0 && (
          <button className="flex items-center gap-1 font-semibold text-stone-500 active:text-stone-800" onClick={onHistory}>
            <MessagesSquare size={14} /> {earlier} earlier
          </button>
        )}
      </div>
    </div>
  );
}

/** Play Coach's quick question under Sam's line: the question with Skip, then how it went. */
function QuizBubble() {
  const q = usePlay((s) => s.quiz)!;
  const skip = usePlay((s) => s.skipQuiz);
  const res = q.result;
  const box = useRef<HTMLDivElement>(null);
  // Keep the question (and then its answer) in view in the panel under the board.
  // (Braces: newer browsers return a promise from scrollIntoView, which mustn't become the cleanup.)
  useEffect(() => {
    box.current?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }, [q.prompt, res]);
  return (
    <div ref={box} className="surface-light ml-[50px] rounded-[10px] bg-[#eef6e6] px-3.5 py-3 text-[15px] leading-snug text-[#312e2b] ring-1 ring-brand-500/50 animate-pop" data-testid="quiz" data-state={res ? (res.ok ? 'right' : 'wrong') : 'open'}>
      <div className="mb-1 flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] text-brand-700 uppercase">
        <CircleHelp size={12} /> Quick question
      </div>
      <p>{q.prompt}</p>
      {res ? (
        <p className="mt-1.5 flex items-start gap-1.5 font-semibold" data-testid="quiz-result">
          {res.ok ? <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-brand-700" /> : <X size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-danger-600" />}
          <span>{res.ok ? 'Right. ' : 'Not quite. '}{q.why}</span>
        </p>
      ) : (
        <div className="mt-2 flex justify-end">
          <button className="rounded-[8px] bg-brand-500/15 px-3 py-1.5 text-[13px] font-bold text-brand-700 press" onClick={skip} data-testid="quiz-skip">Skip</button>
        </div>
      )}
    </div>
  );
}

/** The whole conversation of this game (newest at the bottom). */
export function CoachHistory() {
  const g = usePlay((s) => s.game)!;
  const feed = g.feed ?? [];
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, []);
  return (
    <div className="space-y-2.5">
      {feed.map((it, k) => (
        <FeedBubble key={it.id} it={it} compact={k < feed.length - 1} />
      ))}
      <div ref={end} />
    </div>
  );
}

/** Gentle coach: amber and orange instead of the harsher red (readable on the white bubble). */
const GENTLE_INK: Partial<Record<ReviewClass, string>> = { mistake: '#9a6c07', blunder: '#bf5600', miss: '#bf5600' };

/** "Qh6 is a blunder" with the class icon (like Game Review) and the evaluation before → after. */
function MoveVerdict({ p, index }: { p: PlyRecord; index: number }) {
  const g = usePlay((s) => s.game)!;
  const gentle = useSettings((st) => st.coachStyle === 'gentle');
  const cls: ReviewClass = p.special ?? (p.classification === 'good' ? ((p.wpLoss ?? 0) <= 2.5 ? 'excellent' : 'good') : (p.classification ?? 'good'));
  const ink = (gentle && GENTLE_INK[cls]) || RC[cls].ink;
  const before = index > 0 ? g.plies[index - 1]?.evalAfter : { type: 'cp' as const, value: 0 };
  const after = p.evalAfter;
  const fmt = (x: NonNullable<PlyRecord['evalAfter']>) => formatScore(x).replace('-', '−');
  return (
    <p className="mb-1 flex items-center gap-1.5 text-[15px] font-bold">
      <ReviewIcon cls={cls} size={20} />
      <span className="min-w-0 flex-1">
        {p.san} <span style={{ color: ink }}>{RC[cls].verdict}</span>
      </span>
      {before && after && <span className="shrink-0 rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[11px] font-semibold text-stone-600 tabular-nums">{fmt(before)} → {fmt(after)}</span>}
    </p>
  );
}

/** After a mistake: the better move and what yours allows (the opponent's best reply). */
function MoveLines({ p }: { p: PlyRecord }) {
  const c = p.comment;
  const reply = c?.replyLine?.length ? formatLine(p.fenAfter, lineToSan(p.fenAfter, c.replyLine, 3)) : null;
  // The text already names the better move: don't say it twice.
  const better = c?.bestSan && !c.namesBest ? c.bestSan : null;
  if (!better && !reply) return null;
  return (
    <div className="mt-1.5 space-y-0.5 rounded-[8px] bg-black/[0.04] px-2.5 py-1.5 text-[13px]">
      {better && c?.bestSan && (
        <p>
          <span className="text-stone-500">Better:</span> <b style={{ color: RC.best.ink }}>{c.bestSan}</b>
        </p>
      )}
      {reply && (
        <p>
          <span className="text-stone-500">It allows:</span> <b>{reply}</b>
        </p>
      )}
    </div>
  );
}
