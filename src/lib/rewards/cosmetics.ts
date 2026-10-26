// Everything you can unlock and equip: boards, piece sets, celebrations, move
// highlights and sound packs. Unlocks are worked out from your progress, so
// nothing can ever be lost.
import { kvGet, kvSet } from '../db';
import { OPPONENTS } from '../people';
import { getOpponentRecords } from '../people/record';
import { CHALLENGES } from '../people/challenges';
import { getXp, levelFor } from '../progress/xp';
import { useSettings, BOARD_THEMES, type Settings } from '../settings';
import { SOUND_PACKS } from '../sound';
import { CELEBRATIONS, HIGHLIGHTS, PIECE_SETS } from './looks';
import { getGameRating, MILESTONES } from './rating';
import { skillStates } from './skills';

export type CosmeticKind = 'board' | 'pieces' | 'fx' | 'hl' | 'snd';

export type Unlock =
  | { kind: 'free' }
  | { kind: 'level'; n: number }
  | { kind: 'rating'; n: number }
  | { kind: 'achievement'; id: string; label: string }
  | { kind: 'challenge'; opponentId: string }
  | { kind: 'gold'; n: number };

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
  pieces: ['wood', 'classic'],
  fx: ['confetti'],
  hl: ['classic'],
  snd: ['wood', 'felt', 'deep', 'clack', 'marble', 'minimal'],
};

const SPECIAL: Record<string, Unlock> = {
  // Levels (XP)
  'hl-sky': { kind: 'level', n: 2 },
  'board-cherry': { kind: 'level', n: 3 },
  'fx-hearts': { kind: 'level', n: 4 },
  'board-forest': { kind: 'level', n: 5 },
  'pieces-shadow': { kind: 'level', n: 6 },
  'hl-lavender': { kind: 'level', n: 7 },
  'board-sandstone': { kind: 'level', n: 8 },
  'fx-snow': { kind: 'level', n: 12 },
  // Achievements
  'hl-rose': { kind: 'achievement', id: 'tac-fork-1', label: 'First fork' },
  'board-ice': { kind: 'achievement', id: 'brill-1', label: 'Brilliant!' },
  'pieces-neon': { kind: 'achievement', id: 'great-10', label: 'Sharp eye' },
  'fx-pieces': { kind: 'achievement', id: 'mate-10', label: 'Mate collector' },
  // Skill tree
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
      return u.n === 1 ? 'Get a skill to gold' : `Get ${u.n} skills to gold`;
  }
}

export interface UnlockContext {
  level: number;
  peak: number;
  achievements: Record<string, number>;
  challenges: Set<string>;
  gold: number;
}

export async function unlockContext(): Promise<UnlockContext> {
  const records = await getOpponentRecords();
  const skills = await skillStates();
  return {
    level: levelFor(await getXp()).level,
    peak: (await getGameRating()).peak,
    achievements: await kvGet<Record<string, number>>('achievements', {}),
    challenges: new Set(Object.entries(records).filter(([, r]) => r.challengeDone).map(([id]) => id)),
    gold: Object.values(skills).filter((s) => s.tier === 3).length,
  };
}

export function isUnlocked(c: Cosmetic, ctx: UnlockContext): boolean {
  const u = c.unlock;
  switch (u.kind) {
    case 'free':
      return true;
    case 'level':
      return ctx.level >= u.n;
    case 'rating':
      return ctx.peak >= u.n;
    case 'achievement':
      return !!ctx.achievements[u.id];
    case 'challenge':
      return ctx.challenges.has(u.opponentId);
    case 'gold':
      return ctx.gold >= u.n;
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

/** Equip an item (sets the matching setting). */
export function equip(c: Cosmetic) {
  useSettings.getState().set({ [KIND_LABEL[c.kind].setting]: c.key } as Partial<Settings>);
}

export function isEquipped(c: Cosmetic, s: Settings): boolean {
  return s[KIND_LABEL[c.kind].setting] === c.key;
}
