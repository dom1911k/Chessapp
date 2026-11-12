// Show or hide the Cups tab (Settings). Kept in localStorage under the old Run mode key, so the
// choice carries over.
import { create } from 'zustand';

const KEY = 'chesscoach.runMode';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export const useRunFlag = create<{ enabled: boolean; set(v: boolean): void }>((set) => ({
  enabled: read(),
  set: (v) => {
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ enabled: v });
  },
}));
