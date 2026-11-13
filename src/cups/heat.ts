// Heat: optional challenges you switch on when entering a cup you have won before. Each adds heat;
// heat adds Laurels at the end of the cup, and every tier remembers the highest heat you won at.
import type { Place } from './ladder';
import { TUNING } from './tuning';

const H = TUNING.heat;

export type HeatId = 'sharper' | 'shortClock' | 'noShop' | 'stingy' | 'fewerBoons' | 'doubleQuirk' | 'noDrawOdds';

export interface HeatInfo {
  id: HeatId;
  name: string;
  text: string;
  glyph: string;
  heat: number;
}

const m = H.mods;
export const HEATS: HeatInfo[] = [
  { id: 'sharper', name: 'Sharper Field', text: `Every opponent plays ${m.sharper.elo} rating points stronger.`, glyph: 'swords', heat: m.sharper.heat },
  { id: 'shortClock', name: 'Short Clock', text: `Your clock starts at ${(m.shortClock.ms ?? 0) / 60_000}:00 instead of 10:00.`, glyph: 'hourglass', heat: m.shortClock.heat },
  { id: 'noShop', name: 'Closed Shop', text: 'No shop between rounds: no charms this cup.', glyph: 'lock', heat: m.noShop.heat },
  { id: 'stingy', name: 'Stingy Purse', text: 'Games pay half the gold.', glyph: 'coin', heat: m.stingy.heat },
  { id: 'fewerBoons', name: 'Lean Deck', text: `At most ${m.fewerBoons.maxBoons} boons (no free pick before the quarter-final).`, glyph: 'cards', heat: m.fewerBoons.heat },
  { id: 'doubleQuirk', name: 'Two-Faced', text: 'Every opponent has a hidden second quirk, not just the finalist.', glyph: 'question', heat: m.doubleQuirk.heat },
  { id: 'noDrawOdds', name: 'No Draw Odds', text: 'A draw with Black no longer sends you through (the Draw Odds boon still does).', glyph: 'scale', heat: m.noDrawOdds.heat },
];

export const heatInfo = (id: HeatId) => HEATS.find((h) => h.id === id)!;
/** Total heat of a set of challenges. */
export const heatOf = (ids: readonly string[] = []) => ids.reduce((n, id) => n + (H.mods[id]?.heat ?? 0), 0);
/** Bonus Laurels for heat at a finish. */
export const heatLaurels = (heat: number, place: Place) => Math.floor(heat * (H.laurelsPerHeat[place] ?? 0));
/** Heat is offered once you have won the tier. */
export const heatOpen = (won: number) => won > 0;
