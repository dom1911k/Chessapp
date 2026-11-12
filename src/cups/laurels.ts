// Laurels and the Laurel shop: lasting unlocks between cups — boons and a charm that join the
// random offers, pixel board and piece skins for the Cups tab, and an avatar frame per cup tier.
// Also the trophy cabinet's records.
import type { CupSummary } from './meta';
import { TIERS, tierInfo, type CupTier, type Place, type Trophies } from './ladder';
import { BOONS, CHARMS } from './boons';
import { BOARD_THEMES, PIECE_SETS } from './pixel/board';
import { TUNING } from './tuning';

const L = TUNING.laurels;

/** Laurels for where you finished a cup. */
export const laurelsFor = (place: Place) => L.earn[place] ?? 0;

export type ShopKind = 'boon' | 'charm' | 'board' | 'pieces' | 'frame';

export interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  text: string;
  glyph: string;
  price: number;
  /** Frames: only once you have won this tier's cup. */
  needsTrophy?: CupTier;
}

const FRAME_TEXT: Record<CupTier, string> = {
  bronze: 'A burnished bronze frame for your avatar.',
  silver: 'A cool silver frame for your avatar.',
  gold: 'A gleaming gold frame for your avatar.',
  platinum: 'A pale platinum frame for your avatar.',
  diamond: 'A sparkling diamond frame for your avatar.',
};

export const LAUREL_SHOP: ShopItem[] = [
  ...(['drawOdds', 'secondChance', 'homePrep', 'longNight'] as const).map((b) => ({ id: b, kind: 'boon' as const, name: BOONS[b].name, text: `Boon: ${BOONS[b].text}`, glyph: BOONS[b].glyph, price: L.prices[b] })),
  { id: 'battlefield', kind: 'charm', name: CHARMS.battlefield.name, text: `Charm: ${CHARMS.battlefield.text}`, glyph: CHARMS.battlefield.glyph, price: L.prices.battlefield },
  ...['bone', 'frost', 'ember'].map((b) => ({ id: `board:${b}`, kind: 'board' as const, name: BOARD_THEMES[b]?.name ?? b, text: 'A pixel board for your cup games.', glyph: 'tower', price: L.prices[`board:${b}`] })),
  ...['runic', 'gilded'].map((p) => ({ id: `pieces:${p}`, kind: 'pieces' as const, name: PIECE_SETS[p]?.name ?? p, text: 'A pixel piece set for your cup games.', glyph: 'king', price: L.prices[`pieces:${p}`] })),
  ...TIERS.map((t) => ({ id: `frame:${t}`, kind: 'frame' as const, name: `${tierInfo(t).name} frame`, text: `${FRAME_TEXT[t]} Win the ${tierInfo(t).name} to buy it.`, glyph: 'crown', price: L.prices[`frame:${t}`], needsTrophy: t })),
];

export const shopItem = (id: string) => LAUREL_SHOP.find((i) => i.id === id);

/** Can this be bought right now? */
export function canBuy(item: ShopItem, laurels: number, owned: string[], trophies: Trophies): { ok: boolean; why?: string } {
  if (owned.includes(item.id)) return { ok: false, why: 'Owned' };
  if (item.needsTrophy && !(trophies[item.needsTrophy] ?? 0)) return { ok: false, why: `Win the ${tierInfo(item.needsTrophy).name} first` };
  if (laurels < item.price) return { ok: false, why: `${item.price} Laurels` };
  return { ok: true };
}

/** Pixel boards and piece sets you may use in the Cups tab. */
export const boardOwned = (owned: string[], id: string) => id === 'crypt' || owned.includes(`board:${id}`);
export const piecesOwned = (owned: string[], id: string) => id === 'board' || owned.includes(`pieces:${id}`);

const RANK: Record<Place, number> = { winner: 4, final: 3, semi: 2, quarter: 1 };

export interface CabinetRow {
  tier: CupTier;
  won: number;
  best: Place | null;
  /** Fewest total moves in a cup you won. */
  fastest: number | null;
  noCharms: boolean;
  secondChance: boolean;
}

/** The trophy cabinet: per tier, from your finished cups (and trophies won before the history existed). */
export function cabinet(history: CupSummary[], trophies: Trophies): CabinetRow[] {
  return TIERS.map((tier) => {
    const cups = history.filter((h) => h.tier === tier);
    const wins = cups.filter((h) => h.place === 'winner');
    const best = cups.reduce<Place | null>((b, h) => (!b || RANK[h.place] > RANK[b] ? h.place : b), (trophies[tier] ?? 0) > 0 ? 'winner' : null);
    return {
      tier,
      won: Math.max(trophies[tier] ?? 0, wins.length),
      best,
      fastest: wins.length ? Math.min(...wins.map((w) => w.moves)) : null,
      noCharms: wins.some((w) => w.charmsUsed === 0),
      secondChance: wins.some((w) => w.secondChance),
    };
  });
}
