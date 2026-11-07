// The top of the Play tab: a greeting that follows the time of day, your level ring and streak.
import { useEffect, useState, type ReactNode } from 'react';
import { Flame, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import { getXp, levelFor } from '../lib/progress/xp';
import { weeklyGoal } from '../lib/progress/weekly';
import { currentStreak } from '../lib/stats';
import { useCelebrate } from '../lib/celebrate';

type Daypart = 'morning' | 'afternoon' | 'evening' | 'night';

function daypart(h = new Date().getHours()): Daypart {
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

const SKY: Record<Daypart, { bg: string; orb: string; greeting: string; icon: ReactNode }> = {
  morning: {
    bg: 'linear-gradient(150deg, #f6c58a 0%, #e9926b 45%, #b0607a 100%)',
    orb: 'radial-gradient(circle, rgba(255,240,200,0.95), rgba(255,210,140,0) 70%)',
    greeting: 'Good morning',
    icon: <Sunrise size={15} />,
  },
  afternoon: {
    bg: 'linear-gradient(150deg, #3aa872 0%, #1f7a4c 55%, #12553a 100%)',
    orb: 'radial-gradient(circle, rgba(255,250,220,0.9), rgba(255,240,180,0) 70%)',
    greeting: 'Good afternoon',
    icon: <Sun size={15} />,
  },
  evening: {
    bg: 'linear-gradient(150deg, #e08a5a 0%, #9c4f6e 50%, #3b3363 100%)',
    orb: 'radial-gradient(circle, rgba(255,215,160,0.9), rgba(255,160,120,0) 70%)',
    greeting: 'Good evening',
    icon: <Sunset size={15} />,
  },
  night: {
    bg: 'linear-gradient(150deg, #2b3566 0%, #1b1f3d 55%, #0f1124 100%)',
    orb: 'radial-gradient(circle, rgba(235,240,255,0.85), rgba(200,210,255,0) 70%)',
    greeting: 'Hello, night owl',
    icon: <Moon size={15} />,
  },
};

/** A circular level meter: the level number sits inside the ring with room to spare. */
function LevelRing({ level, pct, size = 64 }: { level: number; pct: number; size?: number }) {
  const stroke = Math.max(3.5, size / 13);
  const r = size / 2 - stroke / 2 - 0.5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Level ${level}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.02, pct))}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.2,0.8,0.2,1)' }}
        />
        <defs>
          <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-black text-white tabular-nums" style={{ fontSize: Math.round(size * (level >= 10 ? 0.36 : 0.42)) }}>
        {level}
      </span>
    </div>
  );
}

export function HomeHero({ right }: { right?: ReactNode }) {
  const part = daypart();
  const sky = SKY[part];
  const burst = useCelebrate((s) => s.burst);
  const [xp, setXp] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [week, setWeek] = useState<{ days: number; goal: number } | null>(null);
  useEffect(() => {
    void getXp().then(setXp);
    void currentStreak().then(setStreak);
    void weeklyGoal().then((w) => setWeek({ days: w.days, goal: w.goal }));
  }, [burst]);
  const l = levelFor(xp ?? 0);
  const line =
    streak >= 2
      ? `${streak} days in a row — keep the flame going!`
      : streak === 1
        ? 'You trained today. Come back tomorrow for a streak!'
        : 'Play a game or a puzzle to light your streak.';

  return (
    <div className="safe-top relative shrink-0 overflow-hidden text-white" style={{ background: sky.bg }}>
      {/* Sun or moon glow, a few stars at night, and a faint knight in the corner. */}
      <div className="pointer-events-none absolute -top-20 -right-10 h-44 w-44 rounded-full opacity-60 blur-sm" style={{ background: sky.orb }} />
      {part === 'night' &&
        [[12, 18], [28, 64], [44, 30], [70, 12], [82, 52], [58, 74]].map(([x, y], i) => (
          <span key={i} className="pointer-events-none absolute h-1 w-1 animate-pulse rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 300}ms` }} />
        ))}
      <svg viewBox="0 0 45 45" className="pointer-events-none absolute -bottom-6 -left-2 h-20 w-20 opacity-[0.08]" aria-hidden>
        <path fill="#fff" d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3" />
      </svg>

      <div className="relative mx-auto flex max-w-md items-center gap-3 px-4 pt-2 pb-3">
        <LevelRing level={l.level} pct={xp === null ? 0 : l.into / l.span} size={44} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-display text-[19px] font-semibold">{sky.greeting}</div>
          <div className="mt-0.5 truncate text-xs text-white/85">
            <b className="font-semibold text-white">{l.title}</b> · {l.span - l.into} XP to go
          </div>
        </div>
        <span title={line} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${streak ? 'bg-white text-orange-600' : 'bg-white/15 text-white/90'}`}>
          <Flame size={15} className={streak ? 'fill-orange-400 text-orange-500' : ''} /> {streak}
        </span>
        {week && (
          <span className="hidden shrink-0 gap-0.5 min-[420px]:flex" title={`${week.days}/${week.goal} days this week`}>
            {Array.from({ length: week.goal }, (_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < week.days ? 'bg-amber-300' : 'bg-white/25'}`} />
            ))}
          </span>
        )}
        <div className="flex items-center text-white [&_button]:text-white">{right}</div>
      </div>
    </div>
  );
}
