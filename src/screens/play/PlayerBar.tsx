// A player bar above or below the board (avatar, name, rating, material, clock) and its clock.
import { rematchLabel } from '../../lib/rematch';
import { UserAvatar, useMyName } from '../../components/UserAvatar';
import { useEffect, useState } from 'react';
import { Clock as ClockIcon, Bot } from 'lucide-react';
import { getPlayerRating } from '../../lib/playerRating';
import { povScore, scoreToCp } from '../../lib/chess/evaluation';
import { currentFen, turnOf, usePlay } from '../../lib/store/play';
import { Portrait } from '../../components/Coach';
import { opponentById, type Mood } from '../../lib/people';
import { Captured } from '../../components/Captured';
import { fmtClock, lowTime, timeLeft } from '../../lib/clock';
import { ChatBubble } from './ChatBubble';

/** Opponent's mood: their latest chat line, otherwise how the game is going for them. */
function useOpponentMood(): Mood {
  const s = usePlay();
  const g = s.game!;
  const lastEval = [...g.plies].reverse().find((p) => p.evalAfter)?.evalAfter;
  const botCp = lastEval ? scoreToCp(povScore(lastEval, g.userColor === 'w' ? 'b' : 'w')) : 0;
  const recent = s.chat && s.chat.ply >= g.plies.length - 1 ? s.chat : null;
  return recent ? recent.mood : botCp > 150 ? 'happy' : botCp < -150 ? 'worried' : 'neutral';
}

/** A player bar above or below the board, chess.com style: avatar, name (rating), material, clock. */
export function PlayerBar({ me }: { me: boolean }) {
  const s = usePlay();
  const g = s.game!;
  const o = opponentById(g.opponentId);
  const mood = useOpponentMood();
  const side = me ? g.userColor : g.userColor === 'w' ? 'b' : 'w';
  const thinking = !me && s.phase === 'botThinking';
  const myName = useMyName();
  const rating = me ? getPlayerRating() : g.elo;
  return (
    <div className="relative flex h-11 items-center gap-2 px-2">
      {!me && <ChatBubble />}
      <span className="relative">
        {me ? (
          <UserAvatar size={36} />
        ) : o ? (
          <Portrait id={o.id} mood={mood} size={36} />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-stone-200 text-stone-600 dark:bg-stone-800"><Bot size={18} /></span>
        )}
        {thinking && (
          <span className="absolute -right-1 -bottom-1 flex h-3.5 items-center gap-0.5 rounded-[4px] bg-white px-1 shadow-[0_1px_2px_rgba(0,0,0,0.25)] dark:bg-stone-800" aria-label="Thinking">
            {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-stone-500 dark:bg-stone-300" style={{ animationDelay: `${i * 120}ms` }} />)}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[14px] font-bold">
          {me ? myName : o ? o.name : g.rematch ? rematchLabel(g.rematch.name) : g.sparring ? 'Sparring partner' : 'Bot'}{' '}
          <span className="text-[13px] font-medium text-stone-500 tabular-nums">({rating})</span>
        </div>
        <Captured fen={currentFen(g)} startFen={g.startFen} side={side} />
      </div>
      {g.clock && <ClockFace side={side} />}
    </div>
  );
}

/**
 * A chess clock for one side, chess.com style: its colour is the piece colour (white or charcoal),
 * the running one fully opaque with a small clock glyph, the idle one faded; red when time is low,
 * pulsing in the final 10 seconds.
 */
function ClockFace({ side, className = '' }: { side: 'w' | 'b'; className?: string }) {
  const g = usePlay((s) => s.game);
  const over = usePlay((s) => s.phase === 'over');
  const [, setTick] = useState(0);
  const toMove = g ? turnOf(currentFen(g)) : 'w';
  const running = !!g?.clock && !over && toMove === side;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 100);
    return () => clearInterval(t);
  }, [running]);
  if (!g?.clock || !g.timeControl) return null;
  const ms = timeLeft(g.clock, side, over ? (side === 'w' ? 'b' : 'w') : toMove, Date.now());
  const low = lowTime(ms, g.timeControl) || ms < 20_000;
  const critical = running && ms < 10_000;
  const face = side === 'w' ? 'bg-white text-[#262421] ring-1 ring-black/10' : 'bg-stone-800 text-white dark:bg-[#262421]';
  const tone = low ? (running ? 'bg-[#e02f2f] text-white' : `${face} !text-[#e02f2f]`) : face;
  return (
    <span
      className={`inline-flex h-9 w-[92px] shrink-0 items-center justify-end gap-1.5 rounded-[6px] px-2.5 text-[20px] font-extrabold tracking-tight tabular-nums transition-[background-color,color,opacity] duration-150 ${tone} ${running ? '' : 'opacity-55'} ${critical ? 'animate-pulse' : ''} ${className}`}
      aria-label={`${side === g.userColor ? 'Your' : "Opponent's"} clock ${fmtClock(ms)}`}
    >
      {running && <ClockIcon size={14} strokeWidth={2.6} className="shrink-0" />}
      {fmtClock(ms)}
    </span>
  );
}
