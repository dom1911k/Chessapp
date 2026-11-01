// Run mode's own settings (music/sound volume, CRT strength, motion, board theme), kept in
// localStorage so they stay with the experiment.
import { create } from 'zustand';
import type { DiffId } from './tuning';

export interface RunSettings {
  /** 0..1, multiplied with the app's volume. */
  music: number;
  sfx: number;
  /** 0 off, 1 subtle, 2 strong. */
  crt: 0 | 1 | 2;
  reduceMotion: boolean;
  board: string;
  /** Piece set ('board' = match the board). */
  pieces: string;
  /** Difficulty for the next run. */
  difficulty: DiffId;
}

const KEY = 'chesscoach.run.settings';
const DEFAULTS: RunSettings = { music: 0.6, sfx: 0.9, crt: 1, reduceMotion: false, board: 'crypt', pieces: 'board', difficulty: 'apprentice' };

function read(): RunSettings {
  try {
    const old = localStorage.getItem('chesscoach.run.music');
    const base = { ...DEFAULTS, ...(old === '0' ? { music: 0 } : {}) };
    return { ...base, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export const useRunSettings = create<RunSettings & { set(p: Partial<RunSettings>): void }>((set, get) => ({
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
