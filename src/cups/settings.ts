// The Cups tab's own look-and-feel settings (music/sound volume, CRT strength, motion, board),
// kept in localStorage. The key is the old Run mode one, so existing choices carry over.
import { create } from 'zustand';

export interface CupsSettings {
  /** 0..1, multiplied with the app's volume. */
  music: number;
  sfx: number;
  /** 0 off, 1 subtle, 2 strong. */
  crt: 0 | 1 | 2;
  reduceMotion: boolean;
  board: string;
  /** Piece set ('board' = match the board). */
  pieces: string;
  /** Speed of tallies and other animations (1, 1.5, 2 or 3). */
  speed: number;
}

const KEY = 'chesscoach.run.settings';
const DEFAULTS: CupsSettings = { music: 0.6, sfx: 0.9, crt: 1, reduceMotion: false, board: 'crypt', pieces: 'board', speed: 1 };

function read(): CupsSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<CupsSettings> & Record<string, unknown>;
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS) as (keyof CupsSettings)[]) if (saved[k] !== undefined) (out as Record<string, unknown>)[k] = saved[k];
    return out;
  } catch {
    return DEFAULTS;
  }
}

export const useRunSettings = create<CupsSettings & { set(p: Partial<CupsSettings>): void }>((set, get) => ({
  ...read(),
  set: (p) => {
    set(p);
    try {
      const { set: _s, ...rest } = { ...get(), ...p };
      void _s;
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  },
}));

/** True when animations should be minimal (setting or OS preference). */
export const reducedMotion = () => useRunSettings.getState().reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
