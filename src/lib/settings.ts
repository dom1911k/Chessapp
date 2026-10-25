// Small settings live in Capacitor Preferences (SharedPreferences on Android,
// localStorage on the web).
import { Preferences } from '@capacitor/preferences';
import { create } from 'zustand';
import { DEFAULT_ELO } from './bot';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  botElo: number;
  colorPref: 'w' | 'b' | 'random';
  safetyOverlay: boolean;
  showEvalBar: boolean;
  pauseOnMistakes: boolean;
  showCoordinates: boolean;
  sound: boolean;
  /** Point out threats created by the bot's moves. */
  botNotes: boolean;
  /** Ask for a confirmation tap before a move is played (prevents slips). */
  confirmMoves: boolean;
  boardTheme: BoardTheme;
  largePieces: boolean;
  reminderEnabled: boolean;
  /** HH:MM, local time. */
  reminderTime: string;
}

export type BoardTheme = 'green' | 'brown' | 'blue' | 'gray';

export const BOARD_THEMES: Record<BoardTheme, { label: string; light: string; dark: string }> = {
  green: { label: 'Green', light: '#eeeed2', dark: '#7c9a6a' },
  brown: { label: 'Wood', light: '#f0d9b5', dark: '#b58863' },
  blue: { label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  gray: { label: 'Gray', light: '#e8e8e8', dark: '#a0a0a0' },
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  botElo: DEFAULT_ELO,
  colorPref: 'w',
  safetyOverlay: false,
  showEvalBar: false,
  pauseOnMistakes: true,
  showCoordinates: true,
  sound: true,
  botNotes: true,
  confirmMoves: false,
  boardTheme: 'green',
  largePieces: false,
  reminderEnabled: false,
  reminderTime: '18:00',
};

const KEY = 'settings';

interface SettingsStore extends Settings {
  loaded: boolean;
  load(): Promise<void>;
  set(patch: Partial<Settings>): void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    try {
      const { value } = await Preferences.get({ key: KEY });
      if (value) set({ ...DEFAULT_SETTINGS, ...JSON.parse(value) });
    } catch {
      /* first run */
    }
    set({ loaded: true });
  },
  set(patch) {
    set(patch);
    void Preferences.set({ key: KEY, value: JSON.stringify(pickSettings(get())) });
  },
}));

export function pickSettings(s: Settings): Settings {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = (s as unknown as Record<string, unknown>)[k];
  return out as unknown as Settings;
}

export async function replaceSettings(s: Partial<Settings>) {
  useSettings.getState().set({ ...DEFAULT_SETTINGS, ...s });
}
