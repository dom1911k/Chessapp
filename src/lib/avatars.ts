// Your own look: an avatar, a frame around it and a title under your name. Avatars are free;
// frames and titles unlock from your progress (same rules as the other cosmetics).
import { LEVEL_TITLES } from './progress/xp';
import { meets, unlockText, type Unlock, type UnlockContext } from './rewards/cosmetics';

const urls = import.meta.glob('../assets/avatars/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const AVATARS: { id: string; url: string }[] = Object.entries(urls)
  .map(([path, url]) => ({ id: path.split('/').pop()!.replace('.svg', ''), url }))
  .sort((a, b) => a.id.localeCompare(b.id));

export const avatarUrl = (id: string) => (AVATARS.find((a) => a.id === id) ?? AVATARS[0])?.url ?? '';

export interface Frame {
  id: string;
  name: string;
  /** CSS background of the ring ('' = no frame). */
  ring: string;
  unlock: Unlock;
}

const lg = (a: string, b: string, c = a) => `linear-gradient(135deg, ${a}, ${b} 55%, ${c})`;

export const FRAMES: Frame[] = [
  { id: 'none', name: 'No frame', ring: '', unlock: { kind: 'free' } },
  { id: 'bronze', name: 'Bronze', ring: lg('#eab583', '#8a5a2c', '#d99a63'), unlock: { kind: 'level', n: 3 } },
  { id: 'silver', name: 'Silver', ring: lg('#f4f6f8', '#8d96a0', '#dfe4e9'), unlock: { kind: 'level', n: 6 } },
  { id: 'gold', name: 'Gold', ring: lg('#fff0a8', '#d19a16', '#ffe07a'), unlock: { kind: 'level', n: 10 } },
  { id: 'emerald', name: 'Emerald', ring: lg('#8ff5bd', '#12805a', '#5fe0a0'), unlock: { kind: 'rating', n: 1000 } },
  { id: 'royal', name: 'Royal', ring: lg('#d4b0ff', '#5a2bb8', '#b98aff'), unlock: { kind: 'rating', n: 1400 } },
  { id: 'flame', name: 'Flame', ring: lg('#ffd84a', '#f0531c', '#ffb02e'), unlock: { kind: 'gold', n: 1 } },
  { id: 'diamond', name: 'Diamond', ring: 'conic-gradient(from 210deg, #9be7ff, #ffffff, #b9a6ff, #9be7ff, #e6fbff, #9be7ff)', unlock: { kind: 'rating', n: 1800 } },
];

export const frameById = (id: string) => FRAMES.find((f) => f.id === id) ?? FRAMES[0];

export interface Title {
  id: string;
  label: string;
  unlock: Unlock;
}

/** Every level title once you've reached that level, plus a few for your rating journey. */
export const TITLES: Title[] = [
  ...LEVEL_TITLES.map((label, i) => ({ id: `lvl${i + 1}`, label, unlock: (i === 0 ? { kind: 'free' } : { kind: 'level', n: i + 1 }) as Unlock })),
  { id: 'rising', label: 'Rising Star', unlock: { kind: 'rating', n: 1000 } },
  { id: 'contender', label: 'Contender', unlock: { kind: 'rating', n: 1400 } },
  { id: 'masterclass', label: 'Master Class', unlock: { kind: 'rating', n: 1800 } },
];

/** The title to show: the chosen one if it is still unlocked, else your level's title. */
export function shownTitle(chosen: string, levelTitle: string, ctx?: UnlockContext): string {
  const t = TITLES.find((x) => x.id === chosen);
  if (!t || (ctx && !meets(t.unlock, ctx))) return levelTitle;
  return t.label;
}

/** The frame to draw: the chosen one if unlocked, else none. */
export function shownFrame(chosen: string, ctx?: UnlockContext): Frame {
  const f = frameById(chosen);
  return ctx && !meets(f.unlock, ctx) ? FRAMES[0] : f;
}

export const lockText = (u: Unlock, ctx: UnlockContext) => (meets(u, ctx) ? '' : unlockText(u));
