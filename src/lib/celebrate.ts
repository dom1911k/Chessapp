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
  /** Sheets open on screen: toasts wait until the last one closes (they'd cover its header). */
  sheets: number;
  sheetOpen(open: boolean): void;
}

let nextId = 1;
let queueing = false;
let queued: Omit<Toast, 'id'>[] = [];
/** Toasts show one at a time: the rest wait here, deduped by title. */
let pending: Omit<Toast, 'id'>[] = [];
const enqueue = (list: Omit<Toast, 'id'>[], t: Omit<Toast, 'id'>) => (list.some((q) => q.title === t.title) ? list : [...list, t]);

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
      if (flush.length) {
        flush.forEach((t) => (pending = enqueue(pending, t)));
        setTimeout(pump, 300);
      }
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
    pending = enqueue(pending, t).slice(-3);
    pump();
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
    setTimeout(pump, 250);
  },
  sheets: 0,
  sheetOpen: (open) => {
    const n = Math.max(0, get().sheets + (open ? 1 : -1));
    set({ sheets: n });
    if (!n) setTimeout(pump, 350);
  },
}));

/** Shows the next waiting toast when none is on screen and no sheet is open. */
function pump() {
  const st = useCelebrate.getState();
  if (st.toasts.length || st.sheets > 0 || st.hold || !pending.length) return;
  const [t, ...rest] = pending;
  pending = rest;
  const id = nextId++;
  useCelebrate.setState({ toasts: [{ ...t, id }] });
  setTimeout(() => useCelebrate.getState().dismiss(id), 3500);
}

