// Daily training: due reviews first, then new puzzles from the weakest themes.
import { create } from 'zustand';
import { db, today } from '../db';
import { nextPuzzle, weakestThemes } from '../puzzles/select';
import { fromCard, fromLichess, type PuzzleSpec } from '../puzzles/spec';
import { themeLabel } from '../puzzles/themes';

export const MAX_REVIEWS = 10;
export const SESSION_SIZE = 12;
export const MIN_NEW = 3;

export interface DailyItem {
  spec: PuzzleSpec;
  source: 'review' | 'daily';
  result?: boolean;
}

interface DailyStore {
  day: string | null;
  items: DailyItem[];
  index: number;
  building: boolean;
  build(): Promise<void>;
  markResult(i: number, success: boolean): void;
  next(): void;
  reset(): void;
}

export async function dueCount(): Promise<number> {
  return db.cards.where('due').belowOrEqual(Date.now()).count();
}

export const useDaily = create<DailyStore>((set, get) => ({
  day: null,
  items: [],
  index: 0,
  building: false,
  async build() {
    if (get().building) return;
    set({ building: true });
    const due = await db.cards.where('due').belowOrEqual(Date.now()).sortBy('due');
    const reviews: DailyItem[] = due.slice(0, MAX_REVIEWS).map((c) => ({ spec: fromCard(c), source: 'review' }));
    const nNew = Math.max(MIN_NEW, SESSION_SIZE - reviews.length);
    const themes = await weakestThemes(3);
    const fresh: DailyItem[] = [];
    const used = new Set<string>();
    for (let k = 0; fresh.length < nNew && k < nNew * 3; k++) {
      const theme = themes.length ? themes[k % themes.length] : undefined;
      const p = await nextPuzzle(theme);
      if (!p || used.has(p.id)) continue;
      used.add(p.id);
      fresh.push({ spec: { ...fromLichess(p), label: theme ? `Focus: ${themeLabel(theme)}` : undefined }, source: 'daily' });
    }
    set({ day: today(), items: [...reviews, ...fresh], index: 0, building: false });
  },
  markResult(i, success) {
    set({ items: get().items.map((it, k) => (k === i ? { ...it, result: success } : it)) });
  },
  next() {
    set({ index: get().index + 1 });
  },
  reset() {
    set({ day: null, items: [], index: 0 });
  },
}));
