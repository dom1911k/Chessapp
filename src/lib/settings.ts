// Small settings live in Capacitor Preferences (SharedPreferences on Android,
// localStorage on the web).
import { Preferences } from '@capacitor/preferences';
import { create } from 'zustand';
import { DEFAULT_ELO } from './bot';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  botElo: number;
  /** Chosen opponent, or 'custom' for the strength slider. */
  opponentId: string;
  colorPref: 'w' | 'b' | 'random';
  safetyOverlay: boolean;
  showEvalBar: boolean;
  pauseOnMistakes: boolean;
  /** Ask "are you sure?" before a move that leaves a piece hanging or allows mate. */
  checkBeforeMove: boolean;
  showCoordinates: boolean;
  sound: boolean;
  /** 0..1 */
  soundVolume: number;
  /** Key of SOUND_PACKS. */
  soundPack: string;
  /** Piece set id (see PIECE_SETS). */
  pieceStyle: string;
  /** Celebration effect id (confetti style). */
  celebration: string;
  /** Last-move highlight colour id. */
  highlight: string;
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

export type BoardTheme = string;

const grain = (tint: string) =>
  `repeating-linear-gradient(97deg, ${tint} 0 1px, transparent 1px 6px), repeating-linear-gradient(88deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 11px)`;

export const BOARD_THEMES: Record<BoardTheme, { label: string; light: string; dark: string; lightBg?: string; darkBg?: string }> = {
  walnut: {
    label: 'Wood',
    light: '#e6c495',
    dark: '#b07848',
    lightBg: `${grain('rgba(130,80,30,0.07)')}, linear-gradient(135deg, #ecca9c, #dfba88)`,
    darkBg: `${grain('rgba(60,30,10,0.10)')}, linear-gradient(135deg, #b77d4b, #a66f3f)`,
  },
  green: { label: 'Green', light: '#eeeed2', dark: '#7c9a6a' },
  brown: { label: 'Classic', light: '#f0d9b5', dark: '#b58863' },
  blue: { label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  gray: { label: 'Gray', light: '#e8e8e8', dark: '#a0a0a0' },
  // ---- Unlockable boards (see lib/rewards/cosmetics) ----
  marble: {
    label: 'Marble',
    light: '#ece9e3',
    dark: '#9aa0a6',
    lightBg: 'linear-gradient(125deg, transparent 40%, rgba(150,150,160,0.18) 46%, transparent 52%), linear-gradient(160deg, #f4f2ee, #e2ded6)',
    darkBg: 'linear-gradient(125deg, transparent 38%, rgba(255,255,255,0.22) 45%, transparent 52%), linear-gradient(160deg, #a7adb3, #8a9097)',
  },
  ocean: { label: 'Ocean', light: '#d7ecf5', dark: '#4f8fb3', darkBg: 'linear-gradient(160deg, #5a9bc0, #437fa3)' },
  tournament: { label: 'Tournament', light: '#f1f0e6', dark: '#4b8a57' },
  midnight: { label: 'Midnight', light: '#c9cdeb', dark: '#3d4178', darkBg: 'linear-gradient(160deg, #474c8a, #33376a)' },
  royal: { label: 'Royal', light: '#f6e8c9', dark: '#7d2232', darkBg: 'linear-gradient(160deg, #8b2a3b, #6b1a29)' },
  cherry: { label: 'Cherry blossom', light: '#fde8ee', dark: '#d98aa3' },
  forest: { label: 'Forest', light: '#e6edd6', dark: '#6b8f4e', darkBg: 'linear-gradient(160deg, #75995a, #5f8245)' },
  sandstone: { label: 'Sandstone', light: '#f4e2bf', dark: '#c49a63', darkBg: 'linear-gradient(160deg, #cda46e, #b88d57)' },
  ice: {
    label: 'Ice',
    light: '#eef7fc',
    dark: '#9cc6dd',
    lightBg: 'linear-gradient(135deg, rgba(255,255,255,0.7), transparent 60%), linear-gradient(#eef7fc, #e3f0f8)',
    darkBg: 'linear-gradient(135deg, rgba(255,255,255,0.35), transparent 55%), linear-gradient(#a5cde2, #8dbbd4)',
  },
  candy: { label: "Lily's candy", light: '#fff0f6', dark: '#f2a7c6' },
  park: { label: "Tom's park", light: '#eaf2d8', dark: '#7a9b55', darkBg: `${grain('rgba(40,60,10,0.08)')}, linear-gradient(135deg, #82a35c, #6e8f4a)` },
  cafe: { label: "Jonas's café", light: '#f0e2cb', dark: '#6e4b36', darkBg: `${grain('rgba(20,10,5,0.12)')}, linear-gradient(135deg, #775240, #5f3f2d)` },
  library: { label: "Priya's library", light: '#f1e8d3', dark: '#8a6b4b', lightBg: 'repeating-linear-gradient(0deg, rgba(120,90,50,0.06) 0 1px, transparent 1px 4px), linear-gradient(#f3ead6, #ece0c6)' },
  neon: {
    label: "Marcus's stream",
    light: '#2a2650',
    dark: '#17142f',
    lightBg: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.25), transparent 70%), linear-gradient(#2b2752, #241f47)',
    darkBg: 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.12), transparent 70%), linear-gradient(#171430, #120f27)',
  },
  hall: { label: "Sofia's tournament hall", light: '#f4f4ef', dark: '#5d6873' },
  oldclub: { label: "Viktor's old club", light: '#d8b88e', dark: '#4e2c1a', lightBg: `${grain('rgba(110,60,20,0.1)')}, linear-gradient(135deg, #dcbd93, #cfac80)`, darkBg: `${grain('rgba(0,0,0,0.15)')}, linear-gradient(135deg, #573221, #432616)` },
  jade: { label: "Mei's jade", light: '#eef3e6', dark: '#4f8a6b', darkBg: 'linear-gradient(135deg, rgba(255,255,255,0.18), transparent 50%), linear-gradient(#5a9576, #437a5d)' },
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  botElo: DEFAULT_ELO,
  opponentId: 'tom',
  colorPref: 'w',
  safetyOverlay: false,
  showEvalBar: false,
  pauseOnMistakes: true,
  checkBeforeMove: true,
  showCoordinates: true,
  sound: true,
  soundVolume: 0.7,
  soundPack: 'wood',
  pieceStyle: 'wood',
  celebration: 'confetti',
  highlight: 'classic',
  botNotes: true,
  confirmMoves: false,
  boardTheme: 'walnut',
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
