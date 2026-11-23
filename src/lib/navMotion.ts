// How the app moves between places (ported from docs/polish-3-prototype.html):
// - tabs crossfade: the old pane fades out (110ms), the new one rises 6px (220ms, after 60ms);
// - a pushed screen slides in from the right (SOFT) with a shadow on its left edge, while the one
//   behind moves to −28% and dims to 60% brightness; popping is the reverse in 300ms (UI_EASE);
// - lists stagger in once per session per tab (rise 10px and fade, 35ms apart, SOFT).
import { SOFT, UI_EASE, animate, reduced, type AnimOpts } from './motion';

export type NavPlace = { topKey?: string; tab: string; keys: string[] };
export type NavTrans =
  | { id: number; kind: 'tab'; from: string; to: string }
  | { id: number; kind: 'push'; top: string; under: string }
  | { id: number; kind: 'pop'; leaving?: string; under: string };

export const tabKey = (t: string) => `tab:${t}`;

/** What moved between two navigation states: a tab switch, a push or a pop (or nothing). */
export function navTrans(prev: NavPlace, cur: { topKey?: string; tab: string }, id: number): NavTrans | null {
  if (prev.topKey === cur.topKey) return prev.tab === cur.tab || cur.topKey ? null : { id, kind: 'tab', from: tabKey(prev.tab), to: tabKey(cur.tab) };
  if (cur.topKey && !prev.keys.includes(cur.topKey)) return { id, kind: 'push', top: cur.topKey, under: prev.topKey ?? tabKey(prev.tab) };
  return { id, kind: 'pop', leaving: prev.topKey, under: cur.topKey ?? tabKey(cur.tab) };
}

export const NAV = {
  tabOut: 110,
  tabIn: 220,
  tabInDelay: 60,
  rise: 6,
  behind: -28,
  dim: 0.6,
  pop: 300,
  stagger: 35,
  staggerRise: 10,
  staggerMax: 14,
} as const;

const ui = (o: AnimOpts): AnimOpts => o;

/** Runs a transition's animations; resolves when they're done. */
export function runNav(t: NavTrans, el: (k: string) => HTMLElement | undefined): Promise<unknown> {
  if (t.kind === 'tab') {
    return Promise.all([
      animate(el(t.from), [{ opacity: 1 }, { opacity: 0 }], ui({ d: NAV.tabOut, e: 'linear', fill: 'forwards' })),
      animate(el(t.to), [{ opacity: 0, transform: `translateY(${NAV.rise}px)` }, { opacity: 1, transform: 'none' }], ui({ d: NAV.tabIn, delay: NAV.tabInDelay, e: UI_EASE, fill: 'backwards' })),
    ]);
  }
  const behind = { transform: `translateX(${NAV.behind}%)`, filter: `brightness(${NAV.dim})` };
  const here = { transform: 'translateX(0)', filter: 'brightness(1)' };
  if (t.kind === 'push') {
    return Promise.all([
      animate(el(t.top), [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { ...SOFT, fill: 'backwards' }),
      animate(el(t.under), [here, behind], { ...SOFT, fill: 'forwards' }),
    ]);
  }
  return Promise.all([
    t.leaving ? animate(el(t.leaving), [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { d: NAV.pop, e: UI_EASE, fill: 'forwards' }) : Promise.resolve(),
    animate(el(t.under), [behind, here], { d: NAV.pop, e: UI_EASE, fill: 'backwards' }),
  ]);
}

/** Ends a transition's leftovers: the screens it moved come to rest (a leaving one stays off-screen). */
export function settleNav(t: NavTrans, el: (k: string) => HTMLElement | undefined) {
  const keys = t.kind === 'tab' ? [t.from, t.to] : t.kind === 'push' ? [t.top, t.under] : [t.under];
  for (const k of keys) el(k)?.getAnimations().forEach((a) => a.cancel());
  if (t.kind === 'pop' && t.leaving) el(t.leaving)?.getAnimations().forEach((a) => a.finish());
}

const staggered = new Set<string>();
/** The rows and cards that stagger in: a list card's rows one by one, other cards whole. */
export function staggerTargets(pane: HTMLElement, viewH: number): HTMLElement[] {
  const blocks = [...pane.querySelectorAll<HTMLElement>('.card, .tile')].filter((b) => !b.parentElement?.closest('.card, .tile'));
  const out: HTMLElement[] = [];
  for (const b of blocks) {
    const rows = [...b.querySelectorAll<HTMLElement>('.press')];
    for (const e of rows.length > 1 ? rows : [b]) {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.top < viewH) out.push(e);
    }
  }
  return out.slice(0, NAV.staggerMax);
}
/** Once per session per tab: its rows and cards rise in, 35ms apart. Coming back shows it at once. */
export function staggerOnce(tab: string, pane: HTMLElement | undefined) {
  if (!pane || staggered.has(tab)) return;
  staggered.add(tab);
  if (reduced()) return;
  staggerTargets(pane, window.innerHeight).forEach((e, k) =>
    void animate(e, [{ opacity: 0, transform: `translateY(${NAV.staggerRise}px)` }, { opacity: 1, transform: 'none' }], { ...SOFT, delay: k * NAV.stagger, fill: 'backwards' }),
  );
}
/** Tests and the harness: forget which tabs already staggered. */
export const resetStagger = () => staggered.clear();
