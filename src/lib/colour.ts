// Colours like chess.com: Alternate (the default) gives you the opposite of your last finished game
// against the bots, and Rematch swaps. The last colour lives in kv, so Home never scans games.
import { announceChange } from './changes';
import type { Color } from './chess/pos';
import { kvGet, kvSet } from './db';
import { useSettings, type Settings } from './settings';

export type ColourPref = Settings['colorPref'];
/** The colour of your last finished game against the bots (or of the rematch you just started). */
export const LAST_COLOUR_KEY = 'lastColour';
/** Set once the move from the old White default to Alternate has run. */
export const COLOUR_MIGRATED_KEY = 'colourAlternateV1';
/** The one-time line under the chips after that move; gone after the next game. */
export const COLOUR_NEWS_KEY = 'colourNews';

export const getLastColour = () => kvGet<Color | null>(LAST_COLOUR_KEY, null);
export async function setLastColour(c: Color): Promise<void> {
  await kvSet(LAST_COLOUR_KEY, c);
  announceChange('colour');
}

/** The colour of the next game. Alternate: the opposite of the last one, White the first time. */
export function nextColour(pref: ColourPref, last: Color | null, rand: () => number = Math.random): Color {
  if (pref === 'w' || pref === 'b') return pref;
  if (pref === 'random') return rand() < 0.5 ? 'w' : 'b';
  return last === 'w' ? 'b' : 'w';
}

/** Home's colour chip: the next game's colour, a two-tone dot for Alternate. */
export function colourChip(pref: ColourPref, last: Color | null): { label: string; dot: 'w' | 'b' | 'half' | 'random' } {
  if (pref === 'random') return { label: 'Random', dot: 'random' };
  if (pref === 'alternate') return { label: nextColour(pref, last) === 'w' ? 'White' : 'Black', dot: 'half' };
  return { label: pref === 'w' ? 'White' : 'Black', dot: pref };
}

/**
 * Once: White was the default, and a chosen White can't be told from it, so every install on White
 * moves to Alternate (with a one-time line on Home). Black and Random stay. Runs after the settings
 * load; choosing White afterwards sticks.
 */
export async function migrateColour(): Promise<boolean> {
  if (await kvGet<boolean>(COLOUR_MIGRATED_KEY, false)) return false;
  await kvSet(COLOUR_MIGRATED_KEY, true);
  const s = useSettings.getState();
  if (s.colorPref !== 'w') return false;
  s.set({ colorPref: 'alternate' });
  await kvSet(COLOUR_NEWS_KEY, true);
  announceChange('colour');
  return true;
}

/** A finished game: its colour is the last colour, and the one-time line has had its game. */
export async function colourAfterGame(c: Color): Promise<void> {
  await kvSet(COLOUR_NEWS_KEY, false);
  await setLastColour(c);
}
