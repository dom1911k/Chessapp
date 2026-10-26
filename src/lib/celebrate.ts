import { create } from 'zustand';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
}

export interface CelebrateStore {
  burst: number;
  toasts: Toast[];
  confetti(): void;
  toast(t: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let nextId = 1;

/** Global celebrations: confetti bursts and small reward toasts. */
export const useCelebrate = create<CelebrateStore>((set, get) => ({
  burst: 0,
  toasts: [],
  confetti: () => set({ burst: get().burst + 1 }),
  toast: (t) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

