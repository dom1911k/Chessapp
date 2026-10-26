import { create } from 'zustand';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
}

export interface CelebrateStore {
  burst: number;
  /** Celebration style for the current burst (default: the equipped one). */
  burstStyle?: string;
  toasts: Toast[];
  /** While a results screen is open, rewards are shown there instead of as toasts. */
  muted: boolean;
  setMuted(m: boolean): void;
  /** A burst of the equipped celebration; `force` ignores mute, `style` previews another one. */
  confetti(opts?: { style?: string; force?: boolean }): void;
  toast(t: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let nextId = 1;

/** Global celebrations: confetti bursts and small reward toasts. */
export const useCelebrate = create<CelebrateStore>((set, get) => ({
  burst: 0,
  toasts: [],
  muted: false,
  setMuted: (muted) => set({ muted }),
  confetti: (opts) => {
    if (get().muted && !opts?.force) return;
    set({ burst: get().burst + 1, burstStyle: opts?.style });
  },
  toast: (t) => {
    if (get().muted) return;
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

