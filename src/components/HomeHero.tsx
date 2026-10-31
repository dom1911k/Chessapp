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

/** A circular level meter. */
function LevelRing({ level, pct, size = 64 }: { level: number; pct: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.22)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-gold)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.2,0.8,0.2,1)' }}
        />
        <defs>
          <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none text-white">
        <span className="text-[9px] font-bold tracking-wider uppercase opacity-80">Level</span>
        <span className="text-[22px] font-black">{level}</span>
      </div>
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
      <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full opacity-70 blur-sm" style={{ background: sky.orb }} />
      {part === 'night' &&
        [[12, 18], [28, 64], [44, 30], [70, 12], [82, 52], [58, 74]].map(([x, y], i) => (
          <span key={i} className="pointer-events-none absolute h-1 w-1 animate-pulse rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 300}ms` }} />
        ))}
      <svg viewBox="0 0 45 45" className="pointer-events-none absolute -bottom-6 -left-4 h-36 w-36 opacity-[0.09]" aria-hidden>
        <path fill="#fff" d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3" />
      </svg>

      <div className="relative mx-auto max-w-md px-4 pt-3 pb-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
            {sky.icon} {sky.greeting}
          </span>
          <div className="flex items-center text-white [&_button]:text-white">{right}</div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <LevelRing level={l.level} pct={xp === null ? 0 : l.into / l.span} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[26px] leading-tight font-semibold">Ready to play?</div>
            <div className="text-sm text-white/85">
              {l.title} · {l.span - l.into} XP to level {l.level + 1}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${streak ? 'bg-white text-orange-600 shadow-[0_4px_14px_rgba(255,140,40,0.45)]' : 'bg-white/15 text-white/90'}`}>
            <Flame size={16} className={streak ? 'fill-orange-400 text-orange-500' : ''} /> {streak}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-white/85">{line}</span>
          {week && (
            <span className="flex shrink-0 gap-0.5" title={`${week.days}/${week.goal} days this week`}>
              {Array.from({ length: week.goal }, (_, i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i < week.days ? 'bg-amber-300' : 'bg-white/25'}`} />
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
