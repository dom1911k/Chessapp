// What the Puzzle Path's header and card show right now. The tally moves these on its own beats
// (the level flips when the bar crosses, the flame when the streak chip lands, a dot as the solve
// lands), so they're kept apart from the saved state, which is already final before anything
// animates. The per-frame parts (the odometer, the bar's width, "170 / 175") go straight to the
// elements registered here.
import { create } from 'zustand';

export interface PathUi {
  /** Points the level badges and labels describe. */
  points: number;
  streak: number;
  daily: number;
  /** This puzzle's "+N" beside the total (0 hides it). */
  gain: number;
  /** The pawn has tiles to walk on the Path (a green dot on its entry points). */
  behind: boolean;
  set(p: Partial<Omit<PathUi, 'set'>>): void;
}
export const usePathUi = create<PathUi>((set) => ({ points: 0, streak: 0, daily: 0, gain: 0, behind: false, set: (p) => set(p) }));

/** Elements the tally drives directly (registered by PathCard and the puzzle header). */
export const pathEls: Partial<Record<'total' | 'gain' | 'fill' | 'track' | 'sweep' | 'tonext' | 'crest' | 'endBadge' | 'flame' | 'cardFlame' | 'dots', HTMLElement | null>> = {};
export const reg = (k: keyof typeof pathEls) => (el: HTMLElement | null) => {
  pathEls[k] = el;
};

/** Rolling digits: each digit is a 0–9 strip that slides (same markup every time, so it's cheap). */
export function odo(el: HTMLElement | null | undefined, val: number) {
  if (!el) return;
  const s = Math.round(val).toLocaleString('en-US');
  if (el.dataset.v === s) return;
  const fmt = s.replace(/\d/g, '0');
  if (el.dataset.fmt !== fmt) {
    el.dataset.fmt = fmt;
    el.innerHTML = [...s].map((ch) => (/\d/.test(ch) ? `<span class="dg"><span class="st">${'0123456789'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>` : `<span>${ch}</span>`)).join('');
  }
  el.dataset.v = s;
  [...s].forEach((ch, i) => {
    if (/\d/.test(ch)) ((el.children[i] as HTMLElement).firstChild as HTMLElement).style.transform = `translateY(${-Number(ch)}em)`;
  });
}
