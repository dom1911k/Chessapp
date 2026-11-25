// Daily training: due reviews first, then new puzzles from the weakest themes.
import { create } from 'zustand';
import { db, today } from '../db';
import { nextPathSpec, weakestThemes } from '../puzzles/select';
import { useSettings } from '../settings';
import { fromCard, type PuzzleSpec } from '../puzzles/spec';
import { themeLabel } from '../puzzles/themes';

export const MAX_REVIEWS = 10;
export const SESSION_SIZE = 12;
export const MIN_NEW = 3;
/** On a day you finished a game, today's plan is a short set (that game and its fix were the session). */
export const SHORT_SIZE = 6;
export const SHORT_REVIEWS = 5;

/** Whether you finished a game against the bots today. */
export async function gameToday(now = Date.now()): Promise<boolean> {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return (await db.games.where('endedAt').aboveOrEqual(d.getTime()).count()) > 0;
}

/** Today's plan: due reviews first, then new puzzles; 6 in all after a game (at most 5 reviews), else 12. */
export function planFor(short: boolean, due: number): { reviews: number; fresh: number; total: number; minutes: string } {
  const reviews = Math.min(due, short ? SHORT_REVIEWS : MAX_REVIEWS);
  const fresh = short ? SHORT_SIZE - reviews : Math.max(MIN_NEW, SESSION_SIZE - reviews);
  return { reviews, fresh, total: reviews + fresh, minutes: short ? '~5 min' : '~10–15 min' };
}

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
  /** Today's set is the short one (a game was finished today). */
  short: boolean;
  build(): Promise<void>;
  /** "Keep going": 6 more (due reviews not yet in the set first, then new puzzles). */
  more(): Promise<void>;
  markResult(i: number, success: boolean): void;
  next(): void;
  reset(): void;
}

export async function dueCount(): Promise<number> {
  return db.cards.where('due').belowOrEqual(Date.now()).count();
}

/** The first `nReviews` due cards, then `nNew` new puzzles from the Puzzle Path's ladder (with the focus theme from your games). */
async function pickItems(due: Parameters<typeof fromCard>[0][], nReviews: number, nNew: number, used: Set<string>): Promise<DailyItem[]> {
  const reviews: DailyItem[] = due.slice(0, nReviews).map((c) => ({ spec: fromCard(c), source: 'review' }));
  const themes = await weakestThemes(3);
  const fresh: DailyItem[] = [];
  for (let k = 0; fresh.length < nNew && k < nNew * 3; k++) {
    const theme = themes.length ? themes[k % themes.length] : undefined;
    const p = await nextPathSpec(useSettings.getState().puzzleDifficulty ?? 'standard', theme);
    if (!p || used.has(p.id)) continue;
    used.add(p.id);
    fresh.push({ spec: { ...p, label: theme ? `Focus: ${themeLabel(theme)}` : undefined }, source: 'daily' });
  }
  return [...reviews, ...fresh];
}

export const useDaily = create<DailyStore>((set, get) => ({
  day: null,
  items: [],
  index: 0,
  building: false,
  short: false,
  async build() {
    if (get().building) return;
    set({ building: true });
    const short = await gameToday();
    const due = await db.cards.where('due').belowOrEqual(Date.now()).sortBy('due');
    const plan = planFor(short, due.length);
    const items = await pickItems(due, plan.reviews, plan.fresh, new Set());
    set({ day: today(), items, index: 0, building: false, short });
  },
  async more() {
    if (get().building) return;
    set({ building: true });
    const have = new Set(get().items.map((x) => x.spec.id));
    const due = (await db.cards.where('due').belowOrEqual(Date.now()).sortBy('due')).filter((c) => !have.has(fromCard(c).id));
    const reviews = Math.min(due.length, SHORT_REVIEWS);
    const extra = await pickItems(due, reviews, SHORT_SIZE - reviews, have);
    set({ items: [...get().items, ...extra], building: false });
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
