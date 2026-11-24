// The top of the Play tab: a greeting that follows the time of day, your level and your streak.
import { useEffect, useState, type ReactNode } from 'react';
import { Flame } from 'lucide-react';
import { getXp, levelFor } from '../lib/progress/xp';
import { weeklyGoal } from '../lib/progress/weekly';
import { currentStreak, trainedToday } from '../lib/stats';
import { useNav } from '../lib/nav';
import { useCelebrate } from '../lib/celebrate';
import { UserAvatar, useMyName, useMyTitle } from './UserAvatar';
import { DeltaChip, useLastSeen } from './Odometer';

type Daypart = 'morning' | 'afternoon' | 'evening' | 'night';

function daypart(h = new Date().getHours()): Daypart {
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

const GREETING: Record<Daypart, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Hello, night owl',
};

export function HomeHero({ right }: { right?: ReactNode }) {
  const part = daypart();
  const burst = useCelebrate((s) => s.burst);
  const [xp, setXp] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [doneToday, setDoneToday] = useState(true);
  const [grew, setGrew] = useState(false);
  const push = useNav((s) => s.push);
  const [week, setWeek] = useState<{ days: number; goal: number } | null>(null);
  // Refreshed when you come back from a game or a screen (the stack empties), as well as on celebrations.
  const depth = useNav((s) => s.stack.length);
  useEffect(() => {
    void getXp().then(setXp);
    void Promise.all([currentStreak(), trainedToday()]).then(([n, done]) => {
      setStreak(n);
      setDoneToday(done);
      // The flame hops once when the streak has grown since you last saw it.
      try {
        const seen = Number(localStorage.getItem('seenStreak') ?? 0);
        if (done && n > seen) setGrew(true);
        localStorage.setItem('seenStreak', String(n));
      } catch {
        /* no storage: no hop */
      }
    });
    void weeklyGoal().then((w) => setWeek({ days: w.days, goal: w.goal }));
  }, [burst, depth]);
  // Numbers change in front of you: back from a game, the XP (and with it the level) rolls up from
  // what you last saw here, with a "+60" chip.
  const seen = useLastSeen('home.xp', xp);
  const l = levelFor(seen.shown ?? 0);
  const name = useMyName();
  const title = useMyTitle();
  const line =
    streak >= 2
      ? `${streak} days in a row — keep the flame going!`
      : streak === 1
        ? 'You trained today. Come back tomorrow for a streak!'
        : 'Play a game or a puzzle to light your streak.';

  return (
    <div className="safe-top shrink-0 bg-stone-100 dark:bg-stone-950">
      {/* A flat header in the page colour: you, your level, your streak. */}
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 pt-3 pb-2">
        <button className="relative shrink-0 active:brightness-95" aria-label="Your profile" onClick={() => push({ name: 'profile' })}>
          <UserAvatar size={40} />
          <span className="absolute -right-1.5 -bottom-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-[#f7c045] px-1 text-[10px] font-extrabold text-[#3a2a00] ring-2 ring-stone-100 tabular-nums dark:ring-stone-950" aria-label={`Level ${l.level}`}>
            {l.level}
          </span>
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] font-medium text-stone-500">{GREETING[part]}</div>
          <div className="truncate text-[18px] font-extrabold tracking-[-0.01em]">{name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-500">
            <span className="truncate font-semibold">{title}</span>
            <span className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-stone-300 dark:bg-stone-800" title={`${l.span - l.into} XP to go`}>
              <span className="absolute inset-y-0 left-0 rounded-full bg-[#f7c045]" style={{ width: `${Math.max(4, (seen.shown === null ? 0 : l.into / l.span) * 100)}%` }} />
            </span>
            {seen.delta && seen.delta.d > 0 && <DeltaChip key={seen.delta.id} d={seen.delta.d} className="!ml-0 text-[11px]" />}
          </div>
        </div>
        {/* The streak chip once there's a streak (a new profile sees no "0"). */}
        {streak >= 1 && (
          <span
            title={line}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold tabular-nums transition-colors ${
              streak && doneToday ? 'bg-hue-orange-500/15 text-hue-orange-600 dark:text-hue-orange-400' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            <Flame
              size={15}
              className={`${streak && doneToday ? 'fill-hue-orange-400 text-hue-orange-500' : streak ? 'fill-hue-orange-300/60 text-hue-orange-400' : ''} ${grew ? 'animate-flame-pop' : streak && !doneToday ? 'animate-flame-breathe' : ''}`}
            />{' '}
            {streak}
          </span>
        )}
        {week && (
          <span className="hidden shrink-0 gap-0.5 min-[420px]:flex" title={`${week.days}/${week.goal} days this week`}>
            {Array.from({ length: week.goal }, (_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < week.days ? 'bg-[#f7c045]' : 'bg-stone-300 dark:bg-stone-700'}`} />
            ))}
          </span>
        )}
        <div className="flex items-center">{right}</div>
      </div>
      {streak > 0 && !doneToday && (
        <button
          className="animate-fade-in mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-md items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-left text-[13px] ring-1 ring-black/[0.06] active:brightness-95 dark:bg-stone-900 dark:ring-0"
          onClick={() => push({ name: 'puzzle', mode: { kind: 'rated' } })}
        >
          <Flame size={16} className="animate-flame-breathe shrink-0 fill-hue-orange-400 text-hue-orange-500" />
          <span className="flex-1">
            Keep your <b>{streak}-day streak</b> going
          </span>
          <span className="rounded-md bg-brand-700 px-2.5 py-0.5 text-xs font-bold text-white">Go</span>
        </button>
      )}
    </div>
  );
}
