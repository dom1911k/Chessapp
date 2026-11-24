// Everything you can unlock and equip: boards, piece sets, celebrations, move
// highlights and sound packs. Unlocks are worked out from your progress, so
// nothing can ever be lost.
import { kvGet, kvSet } from '../db';
import { OPPONENTS } from '../people';
import { getOpponentRecords } from '../people/record';
import { CHALLENGES } from '../people/challenges';
import { getXp, levelFor } from '../progress/xp'; // legacy level: what it unlocked stays unlocked
import { useSettings, BOARD_THEMES, type Settings } from '../settings';
import { SOUND_PACKS } from '../sound';
import { CELEBRATIONS, HIGHLIGHTS, PIECE_SETS } from './looks';
import { getGameRating, KEPT_PEAK_KEY, MILESTONES } from './rating';
import { skillStates } from './skills';

export type CosmeticKind = 'board' | 'pieces' | 'fx' | 'hl' | 'snd';

export type Unlock =
  | { kind: 'free' }
  /** Legacy (account levels are gone): still met by the level your stored XP reached. */
  | { kind: 'level'; n: number }
  /** Reach N on your journey. `was`: the account level that unlocked it before (still counts). */
  | { kind: 'rating'; n: number; was?: number }
  | { kind: 'achievement'; id: string; label: string }
  | { kind: 'challenge'; opponentId: string }
  | { kind: 'gold'; n: number }
  | { kind: 'cup'; tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' }
  /** Bought with Laurels in the Cups tab. */
  | { kind: 'laurel'; id: string; label?: string };

export interface Cosmetic {
  /** `${kind}-${key}` */
  id: string;
  kind: CosmeticKind;
  /** Key in BOARD_THEMES / PIECE_SETS / CELEBRATIONS / HIGHLIGHTS / SOUND_PACKS. */
  key: string;
  name: string;
  unlock: Unlock;
}

export const KIND_LABEL: Record<CosmeticKind, { one: string; many: string; setting: keyof Settings; icon: string }> = {
  board: { one: 'Board', many: 'Boards', setting: 'boardTheme', icon: 'square' },
  pieces: { one: 'Piece set', many: 'Pieces', setting: 'pieceStyle', icon: 'knight' },
  fx: { one: 'Celebration', many: 'Celebrations', setting: 'celebration', icon: 'sparkles' },
  hl: { one: 'Move colour', many: 'Move colours', setting: 'highlight', icon: 'palette' },
  snd: { one: 'Sound', many: 'Sounds', setting: 'soundPack', icon: 'volume' },
};

const FREE: Record<CosmeticKind, string[]> = {
  board: ['walnut', 'green', 'brown', 'blue', 'gray'],
  pieces: ['kaneo', 'wood', 'classic'],
  fx: ['confetti'],
  hl: ['classic'],
  snd: ['standard', 'wood', 'felt', 'deep', 'clack', 'marble', 'minimal'],
};

const SPECIAL: Record<string, Unlock> = {
  // Journey ratings between the milestones (these were account-level rewards; `was` keeps them for
  // anyone who reached that level).
  'hl-sky': { kind: 'rating', n: 300, was: 2 },
  'board-cherry': { kind: 'rating', n: 350, was: 3 },
  'fx-hearts': { kind: 'rating', n: 400, was: 4 },
  'board-forest': { kind: 'rating', n: 450, was: 5 },
  'pieces-shadow': { kind: 'rating', n: 550, was: 6 },
  'hl-lavender': { kind: 'rating', n: 650, was: 7 },
  'board-sandstone': { kind: 'rating', n: 750, was: 8 },
  'fx-snow': { kind: 'rating', n: 1050, was: 12 },
  // Achievements
  'hl-rose': { kind: 'achievement', id: 'tac-fork-1', label: 'First fork' },
  'board-ice': { kind: 'achievement', id: 'brill-1', label: 'Brilliant!' },
  'pieces-neon': { kind: 'achievement', id: 'great-10', label: 'Sharp eye' },
  'fx-pieces': { kind: 'achievement', id: 'mate-10', label: 'Mate collector' },
  // Skills (Insights → Skills)
  'pieces-bronze': { kind: 'gold', n: 1 },
  'fx-leaves': { kind: 'gold', n: 3 },
};

const keysOf: Record<CosmeticKind, () => Record<string, { label: string }>> = {
  board: () => BOARD_THEMES,
  pieces: () => PIECE_SETS,
  fx: () => CELEBRATIONS,
  hl: () => HIGHLIGHTS,
  snd: () => SOUND_PACKS,
};

function unlockFor(id: string, kind: CosmeticKind, key: string): Unlock {
  if (FREE[kind].includes(key)) return { kind: 'free' };
  const m = MILESTONES.find((x) => x.reward === id);
  if (m) return { kind: 'rating', n: m.rating };
  const ch = CHALLENGES.find((c) => c.rewards.includes(id));
  if (ch) return { kind: 'challenge', opponentId: ch.opponentId };
  return SPECIAL[id] ?? { kind: 'free' };
}

export const COSMETICS: Cosmetic[] = (Object.keys(keysOf) as CosmeticKind[]).flatMap((kind) =>
  Object.entries(keysOf[kind]()).map(([key, v]) => {
    const id = `${kind}-${key}`;
    return { id, kind, key, name: v.label, unlock: unlockFor(id, kind, key) };
  }),
);

export const cosmeticById = (id: string) => COSMETICS.find((c) => c.id === id);

/** The looks the Journey gives between its milestones (small reward dots on the map), by rating. */
export const JOURNEY_LOOKS: { rating: number; cosmetic: Cosmetic }[] = COSMETICS.filter((c) => c.unlock.kind === 'rating' && !MILESTONES.some((m) => m.reward === c.id))
  .map((c) => ({ rating: (c.unlock as { n: number }).n, cosmetic: c }))
  .sort((a, b) => a.rating - b.rating);

/** What to add after a name another kind shares: "Marble board", "Marble pieces". */
const KIND_NOUN: Record<CosmeticKind, string> = { board: 'board', pieces: 'pieces', fx: 'celebration', hl: 'move colour', snd: 'sounds' };
const NAME_KINDS = new Map<string, Set<CosmeticKind>>();
for (const c of COSMETICS) NAME_KINDS.set(c.name, (NAME_KINDS.get(c.name) ?? new Set()).add(c.kind));
/** The name to show outside the Collection's own tabs: with its kind when the name alone is ambiguous. */
export const cosmeticTitle = (c: Pick<Cosmetic, 'name' | 'kind'>) => ((NAME_KINDS.get(c.name)?.size ?? 0) > 1 ? `${c.name} ${KIND_NOUN[c.kind]}` : c.name);

export function unlockText(u: Unlock): string {
  switch (u.kind) {
    case 'free':
      return 'Included';
    case 'level':
      return `Reach level ${u.n}`;
    case 'rating':
      return `Reach ${u.n} on your journey`;
    case 'achievement':
      return `Achievement: ${u.label}`;
    case 'challenge': {
      const o = OPPONENTS.find((x) => x.id === u.opponentId);
      return `Complete ${o?.name}'s challenge`;
    }
    case 'gold':
      return `Master ${u.n} skill${u.n === 1 ? '' : 's'} (Insights → Skills)`;
    case 'cup':
      return `Win the ${u.tier[0].toUpperCase()}${u.tier.slice(1)} Cup`;
    case 'laurel':
      return u.label ?? 'Buy it in the Cups Laurel shop';
  }
}

export interface UnlockContext {
  /** The level your stored XP reached (XP is no longer awarded; what it unlocked stays). */
  level: number;
  peak: number;
  /** Peak on the old rating scale (before v1.55): what it earned stays earned. */
  legacyPeak?: number;
  achievements: Record<string, number>;
  challenges: Set<string>;
  gold: number;
  /** Cups won, per tier. */
  cups?: Partial<Record<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond', number>>;
  /** Items bought in the Cups Laurel shop. */
  laurel?: string[];
}

export async function unlockContext(): Promise<UnlockContext> {
  const records = await getOpponentRecords();
  const skills = await skillStates();
  return {
    level: levelFor(await getXp()).level,
    // A restart below your best keeps what your best unlocked.
    peak: Math.max((await getGameRating()).peak, await kvGet<number>(KEPT_PEAK_KEY, 0)),
    legacyPeak: await kvGet<number>('legacyPeak', 0),
    achievements: await kvGet<Record<string, number>>('achievements', {}),
    challenges: new Set(Object.entries(records).filter(([, r]) => r.challengeDone).map(([id]) => id)),
    gold: Object.values(skills).filter((s) => s.tier === 3).length,
    cups: await kvGet<Partial<Record<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond', number>>>('cupTrophies', {}),
    laurel: (await kvGet<{ unlocks?: string[] }>('cupsMeta', {})).unlocks ?? [],
  };
}

export const isUnlocked = (c: Cosmetic, ctx: UnlockContext): boolean => meets(c.unlock, ctx);

/** Whether an unlock rule is met (shared by cosmetics, avatar frames and titles). */
export function meets(u: Unlock, ctx: UnlockContext): boolean {
  switch (u.kind) {
    case 'free':
      return true;
    case 'level':
      return ctx.level >= u.n;
    case 'rating':
      return ctx.peak >= u.n || (ctx.legacyPeak ?? 0) >= u.n || (u.was !== undefined && ctx.level >= u.was);
    case 'achievement':
      return !!ctx.achievements[u.id];
    case 'challenge':
      return ctx.challenges.has(u.opponentId);
    case 'gold':
      return ctx.gold >= u.n;
    case 'cup':
      return (ctx.cups?.[u.tier] ?? 0) > 0;
    case 'laurel':
      return !!ctx.laurel?.includes(u.id);
  }
}

const SEEN = 'cosmeticsSeen';

/** Unlocked items you haven't been told about yet; marks them as seen. */
export async function freshUnlocks(): Promise<Cosmetic[]> {
  const ctx = await unlockContext();
  const seen = new Set(await kvGet<string[]>(SEEN, []));
  const unlocked = COSMETICS.filter((c) => c.unlock.kind !== 'free' && isUnlocked(c, ctx));
  const fresh = unlocked.filter((c) => !seen.has(c.id));
  if (fresh.length) await kvSet(SEEN, unlocked.map((c) => c.id));
  return fresh;
}

/** Marks looks as seen without announcing them (they were told about some other way). */
export async function markLooksSeen(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const seen = await kvGet<string[]>(SEEN, []);
  await kvSet(SEEN, [...new Set([...seen, ...ids])]);
}

/** Equip an item (sets the matching setting). */
export function equip(c: Cosmetic) {
  useSettings.getState().set({ [KIND_LABEL[c.kind].setting]: c.key } as Partial<Settings>);
}

export function isEquipped(c: Cosmetic, s: Settings): boolean {
  return s[KIND_LABEL[c.kind].setting] === c.key;
}
