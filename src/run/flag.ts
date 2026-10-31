// "Experimental: Run mode" toggle. Kept in localStorage (not in the app's settings) so the
// experiment stays self-contained and easy to delete.
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
