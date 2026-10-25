// Tiny navigation model: bottom tabs + a stack of pushed screens, plus a stack
// of back handlers (dialogs) so the Android back button does the right thing.
import { create } from 'zustand';

export type Tab = 'play' | 'puzzles' | 'daily' | 'learn' | 'progress';

export type Screen =
  | { name: 'report'; gameId: number }
  | { name: 'review'; gameId: number; ply?: number }
  | { name: 'explore'; fen: string; orientation: 'white' | 'black'; title?: string }
  | { name: 'puzzle'; mode: PuzzleMode }
  | { name: 'endgame'; drillId: string }
  | { name: 'openings' }
  | { name: 'rush' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'settings' }
  | { name: 'history' };

export type PuzzleMode =
  | { kind: 'rated' }
  | { kind: 'theme'; theme: string }
  | { kind: 'daily' };

interface NavStore {
  tab: Tab;
  stack: Screen[];
  setTab(t: Tab): void;
  push(s: Screen): void;
  pop(): void;
  replace(s: Screen): void;
}

export const useNav = create<NavStore>((set) => ({
  tab: 'play',
  stack: [],
  setTab: (tab) => set({ tab, stack: [] }),
  push: (s) => set((st) => ({ stack: [...st.stack, s] })),
  pop: () => set((st) => ({ stack: st.stack.slice(0, -1) })),
  replace: (s) => set((st) => ({ stack: [...st.stack.slice(0, -1), s] })),
}));

type Handler = () => boolean | void;
const handlers: { id: number; fn: Handler }[] = [];
let nextId = 1;

/** Register a back handler; the most recently registered runs first. Returns unregister. */
export function addBackHandler(fn: Handler): () => void {
  const id = nextId++;
  handlers.push({ id, fn });
  return () => {
    const i = handlers.findIndex((h) => h.id === id);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** Returns true if the back press was handled (app should not exit). */
export function handleBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i].fn() !== false) return true;
  }
  const nav = useNav.getState();
  if (nav.stack.length) {
    nav.pop();
    return true;
  }
  if (nav.tab !== 'play') {
    nav.setTab('play');
    return true;
  }
  return false;
}
