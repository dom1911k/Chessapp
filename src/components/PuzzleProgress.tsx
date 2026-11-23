// Puzzle progress pieces still in use: the old rating-level emblem (until the path's badge
// replaces it everywhere), the theme medal, and the solve timer handed to the card.
import { createContext, type ReactNode } from 'react';

/** Emblem colours climb every four levels: bronze, emerald, sapphire, amethyst, ruby, gold, diamond. */
const EMBLEM_TIERS: [string, string, string][] = [
  ['#f6c198', '#c4733f', '#6e3a1c'],
  ['#9af5c0', '#22a56e', '#0d5a3a'],
  ['#a8dcff', '#2f86e0', '#173f7a'],
  ['#dcbcff', '#8a4be0', '#46208a'],
  ['#ffadb2', '#dc3d4e', '#7a1522'],
  ['#fff0a0', '#e6a81c', '#8a5a05'],
  ['#f2fbff', '#8fd0f0', '#3a6f95'],
];
export const emblemTier = (level: number) => Math.min(EMBLEM_TIERS.length - 1, Math.floor((Math.max(1, level) - 1) / 4));

/** The puzzle level emblem: a bevelled shield in the tier's metal, pips for the step in the tier. */
export function LevelBadge({ level, size = 30, className = '', dim = false, tier, pips: pipCount }: { level: number; size?: number; className?: string; dim?: boolean; /** Colour tier (default: from the level). */ tier?: number; /** Pips under the number (default: step within the tier; 0 = none). */ pips?: number }) {
  const tr = Math.min(EMBLEM_TIERS.length - 1, tier ?? emblemTier(level));
  const [hi, mid, lo] = dim ? ['#e7e5e4', '#a8a29e', '#57534e'] : EMBLEM_TIERS[tr];
  const id = `em${dim ? 'd' : tr}`;
  const pips = pipCount ?? ((Math.max(1, level) - 1) % 4) + 1;
  const digits = String(level).length;
  return (
    <svg viewBox="0 0 48 52" width={size} height={size * (52 / 48)} className={`shrink-0 ${dim ? 'opacity-70' : 'drop-shadow-[0_2px_2px_rgba(40,20,0,0.3)]'} ${className}`} role="img" aria-label={`Level ${level}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
      </defs>
      <path d="M24 1.5 L44.5 8.5 V26 C44.5 38.5 35 46.8 24 50.8 C13 46.8 3.5 38.5 3.5 26 V8.5 Z" fill={lo} />
      <path d="M24 4.6 L41.6 10.6 V26 C41.6 36.6 33.6 43.9 24 47.6 C14.4 43.9 6.4 36.6 6.4 26 V10.6 Z" fill={`url(#${id})`} />
      <path d="M24 7.4 L38.8 12.5 V26 C38.8 35 32 41.3 24 44.6 C16 41.3 9.2 35 9.2 26 V12.5 Z" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.1" />
      <path d="M24 4.6 L41.6 10.6 V20 C30 16 18 16 6.4 20 V10.6 Z" fill="#fff" opacity="0.22" />
      <text x="24" y={digits > 1 ? 30.5 : 31.5} textAnchor="middle" fontSize={digits > 1 ? 19 : 22} fontWeight="900" fill="#fff" stroke={lo} strokeWidth="2.6" paintOrder="stroke" strokeLinejoin="round" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
        {level}
      </text>
      {Array.from({ length: pips }, (_, i) => (
        <circle key={i} cx={24 + (i - (pips - 1) / 2) * 5.2} cy="38.4" r="1.7" fill="#fff" stroke={lo} strokeWidth="0.7" />
      ))}
    </svg>
  );
}

/** The solve timer, handed down by the puzzle player so the rating card can show it (top right). */
export const PuzzleTimer = createContext<ReactNode>(null);

const TIER_STYLE = [
  'from-stone-300 to-stone-400 text-stone-700',
  'from-hue-amber-600 to-hue-amber-800 text-hue-amber-50',
  'from-slate-200 to-slate-400 text-slate-800',
  'from-hue-amber-300 to-hue-yellow-500 text-hue-amber-950',
  'from-hue-fuchsia-400 to-hue-violet-600 text-white',
];

/** A small medal for a mastery tier. */
export function TierMedal({ tier, size = 26, className = '' }: { tier: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b font-black shadow-sm ring-2 ring-white/70 dark:ring-black/30 ${TIER_STYLE[tier]} ${className}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {tier === 0 ? '·' : ['I', 'II', 'III', 'IV'][tier - 1]}
    </span>
  );
}
