import { useEffect, useRef, useState } from 'react';
import { Check, Lock, MapPin, Star } from 'lucide-react';
import { CoachBubble } from '../components/Coach';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { Glyph } from '../components/Glyph';
import { Header } from '../components/ui';
import { cosmeticById } from '../lib/rewards/cosmetics';
import { getGameRating, MILESTONES, REGIONS, START_RATING, titleFor, type GameRating } from '../lib/rewards/rating';

const ROW = 128;
const PAD = 70;

interface Node {
  rating: number;
  title: string;
  reward?: string;
  x: number; // percent
  y: number; // px
}

/** Point on the S-shaped curve between two nodes (same shape the path uses). */
function curve(a: Node, b: Node, t: number) {
  const my = (a.y + b.y) / 2;
  const p = [
    [a.x, a.y],
    [a.x, my],
    [b.x, my],
    [b.x, b.y],
  ];
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: p.reduce((s, q, i) => s + q[0] * w[i], 0), y: p.reduce((s, q, i) => s + q[1] * w[i], 0) };
}

/** The rating journey: from the park to the championship, one milestone at a time. */
export function JourneyScreen() {
  const [r, setR] = useState<GameRating | null>(null);
  const player = useRef<HTMLDivElement>(null);
  useEffect(() => void getGameRating().then(setR), []);
  useEffect(() => {
    if (r) setTimeout(() => player.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  }, [r]);
  if (!r) return null;

  // Top of the map = the championship; the start is at the bottom.
  const list = [...MILESTONES].reverse();
  const nodes: Node[] = [...list.map((m) => ({ rating: m.rating, title: m.title, reward: m.reward })), { rating: START_RATING, title: 'Start', reward: undefined }].map(
    (m, i) => ({ ...m, x: 50 + 27 * Math.sin(i * 1.15), y: PAD + i * ROW }),
  );
  const H = PAD * 2 + (nodes.length - 1) * ROW;
  const peak = r.peak;
  const next = MILESTONES.find((m) => m.rating > peak);

  // Where the player stands: between the last reached node and the next one.
  const below = nodes.findIndex((n) => n.rating <= peak); // first reached node from the top
  let pos = { x: nodes[nodes.length - 1].x, y: nodes[nodes.length - 1].y };
  if (below > 0) {
    const lo = nodes[below];
    const hi = nodes[below - 1];
    // Kept to the middle of the path so it never covers a milestone's label.
    pos = curve(lo, hi, 0.3 + Math.min(1, (peak - lo.rating) / (hi.rating - lo.rating)) * 0.3);
  } else if (below === 0) pos = { x: nodes[0].x, y: nodes[0].y };

  const d = nodes
    .slice(1)
    .map((b, i) => {
      const a = nodes[i];
      const my = (a.y + b.y) / 2;
      return `${i === 0 ? `M ${a.x} ${a.y} ` : ''}C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
    })
    .join(' ');

  const regionOf = (rating: number) => [...REGIONS].reverse().find((g) => rating >= g.from)!;
  const bands = REGIONS.map((g) => {
    const idx = nodes.map((n, i) => (regionOf(n.rating) === g ? i : -1)).filter((i) => i >= 0);
    const top = idx.length ? nodes[idx[0]].y - ROW / 2 : 0;
    const bottom = idx.length ? nodes[idx[idx.length - 1]].y + ROW / 2 : 0;
    return { g, top: Math.max(0, top), bottom: Math.min(H, bottom + (idx[idx.length - 1] === nodes.length - 1 ? PAD : 0)) };
  }).filter((b) => b.bottom > b.top);

  const min = Math.min(...r.history.map((h) => h.rating), START_RATING);
  const max = Math.max(...r.history.map((h) => h.rating), START_RATING + 50);
  const spark = r.history.length > 1 ? r.history.map((h, i) => `${(i / (r.history.length - 1)) * 100},${30 - ((h.rating - min) / (max - min)) * 28}`).join(' ') : '';

  return (
    <div className="flex h-full flex-col">
      <Header title="Your journey" back />
      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto pb-6">
        <div className="px-4 pt-1">
          <div className="card relative overflow-hidden !p-4">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gold-300/30 blur-2xl" />
            <div className="relative flex items-end justify-between gap-3">
              <div>
                <div className="text-xs font-bold tracking-wider text-stone-500 uppercase">Game rating</div>
                <div className="font-display text-5xl leading-none font-semibold">{r.rating}</div>
                <div className="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-500">{titleFor(peak)}</div>
              </div>
              <div className="text-right text-xs text-stone-500">
                <div>Best: <b className="text-stone-700 dark:text-stone-200">{peak}</b></div>
                <div>{r.games} rated games</div>
                {spark && (
                  <svg viewBox="0 0 100 32" className="mt-1 h-8 w-28" preserveAspectRatio="none">
                    <polyline points={spark} fill="none" stroke="#1f7a4c" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            {next && (
              <div className="relative mt-3">
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span>Next: {next.title}</span>
                  <span className="text-stone-500">{next.rating - peak} to go</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-gold-400"
                    style={{ width: `${Math.max(4, ((peak - (MILESTONES[MILESTONES.indexOf(next) - 1]?.rating ?? START_RATING)) / (next.rating - (MILESTONES[MILESTONES.indexOf(next) - 1]?.rating ?? START_RATING))) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-3">
            <CoachBubble>
              <p>
                {r.games === 0
                  ? 'Play a game against any opponent to start your journey. Your rating moves with every game — and milestones you reach stay yours forever.'
                  : next
                    ? `Beat opponents around your level to climb. ${next.title} is waiting at ${next.rating}!`
                    : 'You have walked the whole journey. Champion!'}
              </p>
            </CoachBubble>
          </div>
        </div>

        <div className="relative mx-auto mt-4 w-full max-w-md" style={{ height: H }}>
          {bands.map(({ g, top, bottom }) => (
            <div key={g.name} className="absolute inset-x-2" style={{ top, height: bottom - top }}>
              <div className="absolute inset-0 rounded-[28px] opacity-90 dark:opacity-20" style={{ background: `linear-gradient(180deg, ${g.colors[0]}, ${g.colors[1]})` }} />
              <div className="relative flex items-center gap-1.5 px-4 pt-2.5 text-xs font-bold tracking-wider text-stone-600 uppercase dark:text-stone-300">
                <Glyph name={g.icon} size={14} /> {g.name}
              </div>
            </div>
          ))}
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
            <defs>
              <clipPath id="walked">
                <rect x="0" y={pos.y} width="100" height={H} />
              </clipPath>
            </defs>
            <path d={d} fill="none" stroke="rgba(120,100,80,0.35)" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke="#fffdf9" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke="url(#goldline)" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath="url(#walked)" />
            <linearGradient id="goldline" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#1f7a4c" />
              <stop offset="1" stopColor="#eab308" />
            </linearGradient>
          </svg>
          {nodes.map((n, i) => {
            const reached = peak >= n.rating;
            const isNext = next?.rating === n.rating;
            const reward = n.reward ? cosmeticById(n.reward) : undefined;
            const right = n.x < 50;
            return (
              <div key={n.rating} className="absolute" style={{ left: `${n.x}%`, top: n.y, transform: 'translate(-50%, -50%)' }}>
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full ring-4 ${
                    reached
                      ? 'bg-gradient-to-b from-gold-300 to-gold-500 text-white shadow-[0_4px_14px_rgba(180,130,10,0.45)] ring-white dark:ring-stone-900'
                      : isNext
                        ? 'bg-white text-brand-700 ring-brand-500 dark:bg-stone-800'
                        : 'bg-stone-200 text-stone-400 ring-white dark:bg-stone-800 dark:ring-stone-900'
                  }`}
                >
                  {isNext && <span className="absolute inset-0 animate-ping rounded-full ring-4 ring-brand-400/50" />}
                  {i === nodes.length - 1 ? <MapPin size={22} /> : reached ? <Star size={24} className="fill-white" /> : isNext ? <span className="text-sm font-black">{n.rating}</span> : <Lock size={18} />}
                </div>
                <div className={`absolute top-1/2 w-36 -translate-y-1/2 ${right ? 'left-[66px]' : 'right-[66px] text-right'}`}>
                  <div className={`text-[11px] font-bold ${reached ? 'text-gold-500' : 'text-stone-500'}`}>{i === nodes.length - 1 ? `${START_RATING}` : n.rating}</div>
                  <div className={`text-sm leading-tight font-semibold ${reached || isNext ? '' : 'text-stone-500'}`}>{n.title}</div>
                  {reward && (
                    <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/80 py-0.5 pr-2 pl-0.5 text-[11px] font-semibold shadow-sm dark:bg-stone-800/80 ${right ? '' : 'flex-row-reverse pr-0.5 pl-2'}`}>
                      <CosmeticPreview c={reward} size={22} />
                      <span className="truncate">{reward.name}</span>
                      {reached && <Check size={12} className="text-brand-600" strokeWidth={3} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={player} className="absolute z-10" style={{ left: `${pos.x}%`, top: pos.y, transform: 'translate(-50%, -50%)' }}>
            <div className="animate-bounce-soft relative flex items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-brand-500 dark:bg-stone-800">
                <Glyph name="pawn" size={20} className="text-brand-700 dark:text-brand-100" />
              </span>
              <span className={`absolute rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-white shadow-md ${pos.x < 50 ? 'left-11' : 'right-11'}`}>You · {r.rating}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
