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
  /** While a game is on the board nothing pops over it: toasts and confetti are dropped (the
   * results sheet lists what the game earned). */
  hold: boolean;
  /** `queue`: toasts that arrive during the hold are kept (max 3, deduped by title) and shown
   * 300ms after it ends; confetti is still dropped (a tier-up uses `force`). */
  setHold(h: boolean, opts?: { queue?: boolean }): void;
  /** A burst of the equipped celebration; `force` ignores mute, `style` previews another one. */
  confetti(opts?: { style?: string; force?: boolean }): void;
  toast(t: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let nextId = 1;
let queueing = false;
let queued: Omit<Toast, 'id'>[] = [];

/** Global celebrations: confetti bursts and small reward toasts. */
export const useCelebrate = create<CelebrateStore>((set, get) => ({
  burst: 0,
  toasts: [],
  muted: false,
  setMuted: (muted) => set({ muted }),
  hold: false,
  setHold: (hold, opts) => {
    if (hold) queueing = !!opts?.queue;
    if (get().hold !== hold) set({ hold });
    if (!hold) {
      const flush = queued;
      queued = [];
      queueing = false;
      if (flush.length) setTimeout(() => flush.forEach((t) => get().toast(t)), 300);
    }
  },
  confetti: (opts) => {
    if (get().hold && !(opts?.force && queueing)) return;
    if (get().muted && !opts?.force) return;
    set({ burst: get().burst + 1, burstStyle: opts?.style });
  },
  toast: (t) => {
    if (get().hold && queueing) {
      if (!queued.some((q) => q.title === t.title)) queued = [...queued, t].slice(-3);
      return;
    }
    if (get().muted || get().hold) return;
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

