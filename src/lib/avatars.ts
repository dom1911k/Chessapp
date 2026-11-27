// Your own look: an avatar, a frame around it and a title under your name. Avatars are free;
// frames and titles unlock from your progress (same rules as the other cosmetics): your rating
// journey, cups and the Laurel shop. The old account-level titles and frames stay for anyone who
// reached those levels.
import { LEVEL_TITLES } from './progress/xp';
import { MILESTONES } from './rewards/rating';
import { meets, unlockText, type Unlock, type UnlockContext } from './rewards/cosmetics';

const urls = import.meta.glob('../assets/avatars/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const AVATARS: { id: string; url: string }[] = Object.entries(urls)
  .map(([path, url]) => ({ id: path.split('/').pop()!.replace('.webp', ''), url }))
  .sort((a, b) => a.id.localeCompare(b.id));

/** An avatar id that still exists (ids from the earlier, larger set map onto the current ones). */
export function avatarId(id: string): string {
  if (AVATARS.some((a) => a.id === id)) return id;
  const n = Number(/^a(\d+)$/.exec(id)?.[1]);
  return n > 0 && AVATARS.length ? AVATARS[(n - 1) % AVATARS.length].id : (AVATARS[0]?.id ?? id);
}

export const avatarUrl = (id: string) => AVATARS.find((a) => a.id === avatarId(id))?.url ?? '';

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
  { id: 'bronze', name: 'Copper', ring: lg('#eab583', '#8a5a2c', '#d99a63'), unlock: { kind: 'rating', n: 500, was: 3 } },
  { id: 'silver', name: 'Silver', ring: lg('#f4f6f8', '#8d96a0', '#dfe4e9'), unlock: { kind: 'rating', n: 1000, was: 6 } },
  { id: 'gold', name: 'Gold', ring: lg('#fff0a8', '#d19a16', '#ffe07a'), unlock: { kind: 'rating', n: 1500, was: 10 } },
  { id: 'emerald', name: 'Emerald', ring: lg('#8ff5bd', '#12805a', '#5fe0a0'), unlock: { kind: 'rating', n: 1000 } },
  { id: 'royal', name: 'Royal', ring: lg('#d4b0ff', '#5a2bb8', '#b98aff'), unlock: { kind: 'rating', n: 1400 } },
  { id: 'flame', name: 'Flame', ring: lg('#ffd84a', '#f0531c', '#ffb02e'), unlock: { kind: 'gold', n: 1 } },
  { id: 'cup', name: 'Cup winner', ring: 'conic-gradient(from 0deg, #ffe07a, #c98a12, #fff3b8, #d19a16, #ffe07a)', unlock: { kind: 'cup', tier: 'bronze' } },
  { id: 'laurel', name: 'Champion', ring: 'conic-gradient(from 45deg, #7ef0b0, #ffe07a, #12805a, #fff3b8, #7ef0b0)', unlock: { kind: 'cup', tier: 'gold' } },
  { id: 'tier-bronze', name: 'Bronze Cup', ring: lg('#f6c198', '#9a5a2a', '#e8a46a'), unlock: { kind: 'laurel', id: 'frame:bronze' } },
  { id: 'tier-silver', name: 'Silver Cup', ring: lg('#ffffff', '#a8b4c0', '#e6edf4'), unlock: { kind: 'laurel', id: 'frame:silver' } },
  { id: 'tier-gold', name: 'Gold Cup', ring: lg('#fff5b8', '#e0a21a', '#fff0a0'), unlock: { kind: 'laurel', id: 'frame:gold' } },
  { id: 'tier-platinum', name: 'Platinum Cup', ring: lg('#f2fffa', '#7fd8c0', '#e0fff4'), unlock: { kind: 'laurel', id: 'frame:platinum' } },
  { id: 'tier-diamond', name: 'Diamond Cup', ring: 'conic-gradient(from 120deg, #ffd0f4, #9be7ff, #ffffff, #b9a6ff, #ffd0f4)', unlock: { kind: 'laurel', id: 'frame:diamond' } },
  { id: 'hunter', name: 'Quirk Hunter', ring: 'repeating-conic-gradient(from 0deg, #9fd8ff 0 30deg, #3a2a6a 30deg 60deg)', unlock: { kind: 'laurel', id: 'frame:hunter', label: 'Beat every quirk in the Cups codex' } },
  { id: 'grand', name: 'Grand Champion', ring: 'conic-gradient(from 0deg, #ffe07a, #ff8a98, #9fd8ff, #7ef0b0, #ffe07a)', unlock: { kind: 'laurel', id: 'frame:grand', label: 'Earn all 15 Cups stars' } },
  { id: 'diamond', name: 'Diamond', ring: 'conic-gradient(from 210deg, #9be7ff, #ffffff, #b9a6ff, #9be7ff, #e6fbff, #9be7ff)', unlock: { kind: 'rating', n: 1800 } },
];

export const frameById = (id: string) => FRAMES.find((f) => f.id === id) ?? FRAMES[0];
/** A frame's middle colour (the pawn's tag on the Puzzle Path uses it for its border); '' for no frame. */
export function frameMid(f: Frame): string {
  const stops = f.ring.match(/#[0-9a-fA-F]{6}/g) ?? [];
  return stops[Math.floor(stops.length / 2)] ?? '';
}

export interface Title {
  id: string;
  label: string;
  unlock: Unlock;
  /** An old account-level title: only listed once earned (anyone using one keeps it). */
  legacy?: boolean;
}

const OTHER_TITLES: Title[] = [
  { id: 'rising', label: 'Rising Star', unlock: { kind: 'rating', n: 1000 } },
  { id: 'contender', label: 'Contender', unlock: { kind: 'rating', n: 1400 } },
  { id: 'masterclass', label: 'Master Class', unlock: { kind: 'rating', n: 1800 } },
  { id: 'cupwinner', label: 'Cup Winner', unlock: { kind: 'cup', tier: 'bronze' } },
  { id: 'silvercup', label: 'Silver Cup Holder', unlock: { kind: 'cup', tier: 'silver' } },
  { id: 'champion', label: 'Champion', unlock: { kind: 'cup', tier: 'gold' } },
  { id: 'platinumcup', label: 'Platinum Cup Holder', unlock: { kind: 'cup', tier: 'platinum' } },
  { id: 'diamondcup', label: 'Diamond Champion', unlock: { kind: 'cup', tier: 'diamond' } },
  { id: 'hunter', label: 'Quirk Hunter', unlock: { kind: 'laurel', id: 'title:hunter', label: 'Beat every quirk in the Cups codex' } },
  { id: 'grand', label: 'Grand Champion', unlock: { kind: 'laurel', id: 'title:grand', label: 'Earn all 15 Cups stars' } },
];

/**
 * "Newcomer" to start, then the Journey's milestone titles you've reached ("Park Rookie", "Park
 * Player", "Café Regular" …), the rating, cup and Cups titles, and the old level titles you earned.
 */
export const TITLES: Title[] = [
  { id: 'lvl1', label: LEVEL_TITLES[0], unlock: { kind: 'free' } },
  ...MILESTONES.filter((m) => !OTHER_TITLES.some((t) => t.label === m.title)).map((m): Title => ({ id: `ms${m.rating}`, label: m.title, unlock: { kind: 'rating', n: m.rating } })),
  ...OTHER_TITLES,
  ...LEVEL_TITLES.slice(1).map((label, i): Title => ({ id: `lvl${i + 2}`, label, unlock: { kind: 'level', n: i + 2 }, legacy: true })),
];

/** The title to show: the chosen one if it is still unlocked, else `fallback` (your latest Journey title). */
export function shownTitle(chosen: string, fallback: string, ctx?: UnlockContext): string {
  const t = TITLES.find((x) => x.id === chosen);
  if (!t || (ctx && !meets(t.unlock, ctx))) return fallback;
  return t.label;
}

/** The frame to draw: the chosen one if unlocked, else none. */
export function shownFrame(chosen: string, ctx?: UnlockContext): Frame {
  const f = frameById(chosen);
  return ctx && !meets(f.unlock, ctx) ? FRAMES[0] : f;
}

export const lockText = (u: Unlock, ctx: UnlockContext) => (meets(u, ctx) ? '' : unlockText(u));
