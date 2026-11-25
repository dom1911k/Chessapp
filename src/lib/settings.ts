// Small settings live in Capacitor Preferences (SharedPreferences on Android,
// localStorage on the web).
import { Preferences } from '@capacitor/preferences';
import { create } from 'zustand';
import { DEFAULT_ELO } from './bot';
import { fromLegacy } from './scale';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  botElo: number;
  /** Opponents play with Maia (human-like). 'stockfish' (Classic) was removed in round 7: stored
   *  values move to 'maia'; Stockfish stays only as the silent fallback if Maia fails. */
  opponentEngine: 'maia' | 'stockfish';
  /** Which Maia plays the human-like opponents: the classic per-rating nets, or Maia-3 (one model, any rating). */
  maiaVersion: 'maia1' | 'maia3';
  /** Chosen opponent, or 'custom' for the strength slider. */
  opponentId: string;
  /** You play: White, Black, Alternate (the opposite of your last game, like chess.com) or Random. */
  colorPref: 'w' | 'b' | 'alternate' | 'random';
  safetyOverlay: boolean;
  showEvalBar: boolean;
  /** Show the move list under the board while playing. */
  showMoveList: boolean;
  pauseOnMistakes: boolean;
  /** Gentle: the coach speaks up only for moves that really hurt and praises now and then. Detailed: every comment.
   * Off: no comments during the game; a move list takes the coach's place (hints still work on request). */
  coachStyle: 'gentle' | 'detailed' | 'off';
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
  /** chess.com username for importing games ('' = none). */
  ccUsername: string;
  /** Sync chess.com games when the app opens (only when online). */
  ccAutoSync: boolean;
  /** Set once the 'Standard' sounds became the default (players still on the old default move over). */
  soundsV2: boolean;
  /** Set once the move strip under the board became the default. */
  moveStripV1: boolean;
  /** Bot strength setting already on the chess.com scale. */
  ccScaleV1: boolean;
  /** Set once chess.com sync on opening the app became the default. */
  ccSyncV1: boolean;
  /** Dots on the squares a selected piece can go to. */
  showLegalMoves: boolean;
  /** Piece animation speed. */
  moveSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  /** Queue a move while the opponent is thinking. */
  premoves: boolean;
  /** Coach level in normal games: full, warnings only, or silent. */
  coachLevel: 'full' | 'warnings' | 'silent';
  /** When the coach level was last changed (wins since then count toward stepping down). */
  coachLevelSince: number;
  /** Step-down suggestion dismissed for this level (until it changes). */
  stepDownDismissed: string;
  /** Start games in Match conditions. */
  matchMode: boolean;
  /** Time control for Match conditions ("600+0"); '' = my most common chess.com one, else 10+0. */
  matchTimeControl: string;
  /** Clock in coached games ('' = off). Before round 7; kept stored. */
  coachedTimeControl: string;
  /** Clock for games against the characters ('' = off; always a real game). */
  charTimeControl: string;
  /** Home's Play card: Quick match or Characters (remembered). */
  playSide: 'quick' | 'characters';
  /** Play Coach: Sam at your rating, 150 below or above. */
  coachStrength: 'easier' | 'your' | 'harder';
  /** Your avatar (id in AVATARS), its frame (id in FRAMES) and your title ('' = your level's title). */
  avatar: string;
  avatarFrame: string;
  avatarTitle: string;
  /** A short buzz on captures and key moves (checks, forks, promotions, mate). */
  haptics: boolean;
  /** Set once the chess.com-style look (dark charcoal, green board, Neo-style pieces) became the default. */
  uiV2: boolean;
  /** Puzzle Path difficulty: the ladder +0 / +150 / +300, points ×1 / ×1.3 / ×1.6. */
  puzzleDifficulty: 'standard' | 'hard' | 'extraHard';
  /** Show the small "Rating 812 (+6)" line while solving. */
  puzzleShowRating: boolean;
  /** The points tally after a solve: normal or 0.6× as long. */
  puzzleTallySpeed: 'normal' | 'fast';
  /** "Reduce animations": follow the phone's setting, or always on / off. */
  reduceAnimations: 'system' | 'on' | 'off';
}

export type BoardTheme = string;

const grain = (tint: string) =>
  `repeating-linear-gradient(97deg, ${tint} 0 1px, transparent 1px 6px), repeating-linear-gradient(88deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 11px)`;

/**
 * Board looks. Coordinates default to the opposite square colour (dark-square colour on light
 * squares and the reverse); textured or unusual themes set `coordOnLight` / `coordOnDark`.
 */
export const BOARD_THEMES: Record<BoardTheme, { label: string; light: string; dark: string; lightBg?: string; darkBg?: string; coordOnLight?: string; coordOnDark?: string }> = {
  // chess.com's current green, the default.
  green: { label: 'Green', light: '#ebecd0', dark: '#739552' },
  walnut: {
    label: 'Wood',
    light: '#e6c495',
    dark: '#b07848',
    lightBg: `${grain('rgba(130,80,30,0.07)')}, linear-gradient(135deg, #ecca9c, #dfba88)`,
    darkBg: `${grain('rgba(60,30,10,0.10)')}, linear-gradient(135deg, #b77d4b, #a66f3f)`,
    coordOnLight: '#9a6436',
    coordOnDark: '#f1d7ae',
  },
  brown: { label: 'Classic', light: '#f0d9b5', dark: '#b58863' },
  blue: { label: 'Blue', light: '#dee3e6', dark: '#8ca2ad', coordOnLight: '#62808f', coordOnDark: '#ffffff' },
  gray: { label: 'Gray', light: '#e8e8e8', dark: '#a0a0a0', coordOnLight: '#737373', coordOnDark: '#ffffff' },
  // ---- Unlockable boards (see lib/rewards/cosmetics) ----
  marble: {
    label: 'Marble',
    light: '#ece9e3',
    dark: '#9aa0a6',
    lightBg: 'linear-gradient(125deg, transparent 40%, rgba(150,150,160,0.18) 46%, transparent 52%), linear-gradient(160deg, #f4f2ee, #e2ded6)',
    darkBg: 'linear-gradient(125deg, transparent 38%, rgba(255,255,255,0.22) 45%, transparent 52%), linear-gradient(160deg, #a7adb3, #8a9097)',
    coordOnLight: '#7e858c',
    coordOnDark: '#f4f2ee',
  },
  ocean: { label: 'Ocean', light: '#d7ecf5', dark: '#4f8fb3', darkBg: 'linear-gradient(160deg, #5a9bc0, #437fa3)' },
  tournament: { label: 'Tournament', light: '#f1f0e6', dark: '#4b8a57' },
  midnight: { label: 'Midnight', light: '#c9cdeb', dark: '#3d4178', darkBg: 'linear-gradient(160deg, #474c8a, #33376a)' },
  royal: { label: 'Royal', light: '#f6e8c9', dark: '#7d2232', darkBg: 'linear-gradient(160deg, #8b2a3b, #6b1a29)' },
  cherry: { label: 'Cherry blossom', light: '#fde8ee', dark: '#d98aa3', coordOnLight: '#ad5571', coordOnDark: '#ffffff' },
  forest: { label: 'Forest', light: '#e6edd6', dark: '#6b8f4e', darkBg: 'linear-gradient(160deg, #75995a, #5f8245)' },
  sandstone: { label: 'Sandstone', light: '#f4e2bf', dark: '#c49a63', darkBg: 'linear-gradient(160deg, #cda46e, #b88d57)', coordOnLight: '#8c6634', coordOnDark: '#5e4220' },
  ice: {
    label: 'Ice',
    light: '#eef7fc',
    dark: '#9cc6dd',
    lightBg: 'linear-gradient(135deg, rgba(255,255,255,0.7), transparent 60%), linear-gradient(#eef7fc, #e3f0f8)',
    darkBg: 'linear-gradient(135deg, rgba(255,255,255,0.35), transparent 55%), linear-gradient(#a5cde2, #8dbbd4)',
    coordOnLight: '#4f86a5',
    coordOnDark: '#2f6584',
  },
  candy: { label: "Lily's candy", light: '#fff0f6', dark: '#f2a7c6', coordOnLight: '#b7557f', coordOnDark: '#7d2e52' },
  park: { label: "Tom's park", light: '#eaf2d8', dark: '#7a9b55', darkBg: `${grain('rgba(40,60,10,0.08)')}, linear-gradient(135deg, #82a35c, #6e8f4a)` },
  cafe: { label: "Jonas's café", light: '#f0e2cb', dark: '#6e4b36', darkBg: `${grain('rgba(20,10,5,0.12)')}, linear-gradient(135deg, #775240, #5f3f2d)` },
  library: { label: "Priya's library", light: '#f1e8d3', dark: '#8a6b4b', lightBg: 'repeating-linear-gradient(0deg, rgba(120,90,50,0.06) 0 1px, transparent 1px 4px), linear-gradient(#f3ead6, #ece0c6)', coordOnLight: '#8a6b4b' },
  neon: {
    label: "Marcus's stream",
    light: '#2a2650',
    dark: '#17142f',
    lightBg: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.25), transparent 70%), linear-gradient(#2b2752, #241f47)',
    darkBg: 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.12), transparent 70%), linear-gradient(#171430, #120f27)',
    coordOnLight: '#a99cf0',
    coordOnDark: '#67e8f9',
  },
  hall: { label: "Sofia's tournament hall", light: '#f4f4ef', dark: '#5d6873' },
  oldclub: { label: "Viktor's old club", light: '#d8b88e', dark: '#4e2c1a', lightBg: `${grain('rgba(110,60,20,0.1)')}, linear-gradient(135deg, #dcbd93, #cfac80)`, darkBg: `${grain('rgba(0,0,0,0.15)')}, linear-gradient(135deg, #573221, #432616)`, coordOnLight: '#5a3420', coordOnDark: '#e0c39c' },
  jade: { label: "Mei's jade", light: '#eef3e6', dark: '#4f8a6b', darkBg: 'linear-gradient(135deg, rgba(255,255,255,0.18), transparent 50%), linear-gradient(#5a9576, #437a5d)' },
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  botElo: DEFAULT_ELO,
  opponentEngine: 'maia',
  maiaVersion: 'maia3',
  opponentId: 'tom',
  colorPref: 'alternate',
  safetyOverlay: false,
  showEvalBar: false,
  showMoveList: true,
  pauseOnMistakes: true,
  coachStyle: 'gentle',
  checkBeforeMove: true,
  showCoordinates: true,
  sound: true,
  soundVolume: 0.7,
  soundPack: 'standard',
  pieceStyle: 'kaneo',
  celebration: 'confetti',
  highlight: 'classic',
  botNotes: true,
  confirmMoves: false,
  boardTheme: 'green',
  largePieces: false,
  reminderEnabled: false,
  reminderTime: '18:00',
  ccUsername: '',
  ccAutoSync: true,
  soundsV2: true,
  moveStripV1: true,
  ccScaleV1: true,
  ccSyncV1: true,
  showLegalMoves: true,
  moveSpeed: 'normal',
  premoves: true,
  coachLevel: 'full',
  coachLevelSince: 0,
  stepDownDismissed: '',
  matchMode: false,
  matchTimeControl: '',
  coachedTimeControl: '',
  charTimeControl: '600+0',
  playSide: 'characters',
  coachStrength: 'your',
  avatar: 'a01',
  avatarFrame: 'none',
  avatarTitle: '',
  haptics: true,
  uiV2: true,
  puzzleDifficulty: 'standard',
  puzzleShowRating: true,
  puzzleTallySpeed: 'normal',
  reduceAnimations: 'system',
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
      if (value) {
        const saved = JSON.parse(value);
        // One-time move to the new Standard sounds for anyone still on the old default.
        if (!saved.soundsV2) {
          if (!saved.soundPack || saved.soundPack === 'wood') saved.soundPack = 'standard';
          saved.soundsV2 = true;
        }
        // One-time: the move strip under the board is on by default now.
        // One-time: chess.com games sync automatically when the app opens.
        if (!saved.ccSyncV1) {
          saved.ccAutoSync = true;
          saved.ccSyncV1 = true;
        }
        if (!saved.moveStripV1) {
          saved.showMoveList = true;
          saved.moveStripV1 = true;
        }
        // One-time: bot ratings are chess.com ratings now (v1.55).
        if (!saved.ccScaleV1) {
          if (typeof saved.botElo === 'number') saved.botElo = fromLegacy(saved.botElo);
          saved.ccScaleV1 = true;
        }
        // One-time (round 7): Coached and Match became one kind of real game; its clock is the one
        // you used: Match's when you played Match, else the coached one (Off included).
        // One-time (round 7): Classic (Stockfish with noise) is no longer an opponent style.
        if (saved.opponentEngine === 'stockfish') saved.opponentEngine = 'maia';
        if (!saved.playModesV1) {
          saved.charTimeControl = saved.matchMode ? saved.matchTimeControl || '600+0' : saved.coachedTimeControl ?? '';
          saved.playModesV1 = true;
        }
        migrateUiV2(saved);
        set({ ...DEFAULT_SETTINGS, ...saved });
      }
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

/**
 * One-time move to the chess.com-style look: players still on the old defaults (theme following
 * the system, wooden board, wooden pieces) switch to dark, green and the Neo-style pieces. A look
 * someone picked on purpose is left alone.
 */
export function migrateUiV2(saved: Partial<Settings>): Partial<Settings> {
  if (saved.uiV2) return saved;
  if (saved.theme === 'system' || !saved.theme) saved.theme = 'dark';
  if (saved.boardTheme === 'walnut' || !saved.boardTheme) saved.boardTheme = 'green';
  if (saved.pieceStyle === 'wood' || !saved.pieceStyle) saved.pieceStyle = 'kaneo';
  saved.uiV2 = true;
  return saved;
}

export function pickSettings(s: Settings): Settings {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = (s as unknown as Record<string, unknown>)[k];
  return out as unknown as Settings;
}

export async function replaceSettings(s: Partial<Settings>) {
  useSettings.getState().set({ ...DEFAULT_SETTINGS, ...s });
}
