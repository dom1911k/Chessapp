// Tiny navigation model: bottom tabs + a stack of pushed screens, plus a stack
// of back handlers (dialogs) so the Android back button does the right thing.
import { create } from 'zustand';
import type { Theme } from './coach/types';

/** 'play' is the Home tab. */
export type Tab = 'play' | 'puzzles' | 'learn' | 'more' | 'run';

export type Screen =
  | { name: 'report'; gameId: number | string }
  | { name: 'review'; gameId: number | string; ply?: number }
  | { name: 'explore'; fen: string; orientation: 'white' | 'black'; title?: string }
  | { name: 'puzzle'; mode: PuzzleMode }
  | { name: 'endgame'; drillId: string }
  | { name: 'openings' }
  | { name: 'rush'; mode?: RushMode }
  | { name: 'customPuzzles' }
  | { name: 'achievements' }
  | { name: 'openingPractice'; index: number; custom?: { name: string; line: string[]; side: 'w' | 'b'; idea?: string } }
  | { name: 'face' }
  | { name: 'mistakes' }
  | { name: 'traps' }
  | { name: 'trap'; trapId: string }
  | { name: 'timeDrill'; kind: 'convert' | 'quick' }
  | { name: 'lesson'; lessonId: string; mode?: 'review' }
  | { name: 'placement' }
  | { name: 'modelGame'; gameId: string }
  | { name: 'library' }
  | { name: 'repertoire' }
  | { name: 'repertoireTrain'; lineId: string }
  | { name: 'repertoireBuild' }
  | { name: 'practice'; theme: Theme }
  | { name: 'journey' }
  | { name: 'skills' }
  | { name: 'collection' }
  | { name: 'settings' }
  | { name: 'daily' }
  | { name: 'profile' }
  | { name: 'insights' }
  | { name: 'vision' }
  | { name: 'history' };

export type RushMode = '3' | '5' | 'survival';

export type PuzzleMode =
  | { kind: 'rated' }
  | { kind: 'theme'; theme: string; difficulty?: number }
  /** Unrated practice near your rating ("learning mode"). */
  | { kind: 'learn' }
  /** Positions from your own games: blunders you could have punished. */
  | { kind: 'yours' }
  /** One puzzle a day (the same all day). */
  | { kind: 'dailyPuzzle' }
  | { kind: 'daily' }
  | { kind: 'course'; theme: string; count: number; stepId: string; label: string }
  /** A short, slightly easier set right after a game ("practise what went wrong"). */
  | { kind: 'drill'; theme: string; count: number; label: string; doneKey: string };

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
