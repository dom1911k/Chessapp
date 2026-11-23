import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAV, navTrans, tabKey } from '../lib/navMotion';
import { PRESS_HOLD, PRESS_SEL, installPress } from '../lib/press';
import { SHEET, dragOffset, sheetRelease } from '../components/Sheet';
import { SWITCH } from '../components/ui';
import { SNAP } from '../lib/motion';

describe('moving between places', () => {
  const home = { tab: 'play', keys: [] as string[] };
  it('crossfades a tab switch', () => {
    expect(navTrans(home, { tab: 'puzzles' }, 1)).toEqual({ id: 1, kind: 'tab', from: tabKey('play'), to: tabKey('puzzles') });
  });
  it('does nothing when nothing moved, or a tab changes under a pushed screen', () => {
    expect(navTrans(home, { tab: 'play' }, 1)).toBeNull();
    expect(navTrans({ topKey: 's:1', tab: 'play', keys: ['s:1'] }, { topKey: 's:1', tab: 'more' }, 1)).toBeNull();
  });
  it('pushes from a tab, with the tab behind', () => {
    expect(navTrans(home, { topKey: 's:1', tab: 'play' }, 2)).toEqual({ id: 2, kind: 'push', top: 's:1', under: 'tab:play' });
  });
  it('pushes over a screen, with that screen behind', () => {
    expect(navTrans({ topKey: 's:1', tab: 'play', keys: ['s:1'] }, { topKey: 's:2', tab: 'play' }, 3)).toEqual({ id: 3, kind: 'push', top: 's:2', under: 's:1' });
  });
  it('pops back to the screen below, or to the tab', () => {
    expect(navTrans({ topKey: 's:2', tab: 'play', keys: ['s:1', 's:2'] }, { topKey: 's:1', tab: 'play' }, 4)).toEqual({ id: 4, kind: 'pop', leaving: 's:2', under: 's:1' });
    expect(navTrans({ topKey: 's:1', tab: 'more', keys: ['s:1'] }, { tab: 'more' }, 5)).toEqual({ id: 5, kind: 'pop', leaving: 's:1', under: 'tab:more' });
  });
  it('treats a replaced screen as a push over the one it replaces', () => {
    expect(navTrans({ topKey: 's:1', tab: 'play', keys: ['s:1'] }, { topKey: 's:3', tab: 'play' }, 6)).toMatchObject({ kind: 'push', top: 's:3', under: 's:1' });
  });
  it('uses the brief’s timings', () => {
    expect(NAV).toMatchObject({ tabOut: 110, tabIn: 220, tabInDelay: 60, rise: 6, behind: -28, dim: 0.6, pop: 300, stagger: 35, staggerRise: 10 });
  });
});

describe('sheets', () => {
  it('close past 30% of their height or on a downward flick, else snap back', () => {
    expect(sheetRelease(121, 0.1, 400)).toBe('close');
    expect(sheetRelease(119, 0.1, 400)).toBe('snap');
    expect(sheetRelease(40, 0.7, 400)).toBe('close');
    expect(sheetRelease(40, 0.5, 400)).toBe('snap');
    expect(sheetRelease(-50, 0, 400)).toBe('snap');
  });
  it('follow the finger down and resist upward drags at 25%', () => {
    expect(dragOffset(80)).toBe(80);
    expect(dragOffset(-80)).toBe(-20);
  });
  it('use the brief’s timings', () => {
    expect(SHEET).toMatchObject({ backdrop: 220, close: 240, snap: 260, closeAt: 0.3, flick: 0.6, resist: 0.25 });
  });
});

describe('switches', () => {
  it('stretch the thumb 24 → 30px mid-way, over SNAP + 60ms', () => {
    expect(SWITCH.stretch * 24).toBeCloseTo(30);
    expect(SWITCH.d).toBe(SNAP.d + 60);
    expect(SWITCH.travel).toBe(20);
  });
});

// A tiny stand-in for the DOM: elements that know their attributes and their press-able ancestor.
class El {
  attrs = new Map<string, string>();
  constructor(
    public pressable: boolean,
    public parent: El | null = null,
    public disabled = false,
  ) {}
  closest(sel: string): El | null {
    if (sel !== PRESS_SEL) return null;
    for (let n: El | null = this; n; n = n.parent) if (n.pressable) return n;
    return null;
  }
  matches() {
    return this.disabled;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  get down() {
    return this.attrs.has('data-down');
  }
}
// A root that just keeps its listeners, so a test can hand them pointer events directly.
class Root {
  on = new Map<string, (e: unknown) => void>();
  addEventListener(t: string, fn: (e: unknown) => void) {
    this.on.set(t, fn);
  }
  removeEventListener(t: string) {
    this.on.delete(t);
  }
}
const fire = (root: Root, type: string, target: El | null, x = 0, y = 0) => root.on.get(type)?.({ pointerType: 'touch', button: 0, clientX: x, clientY: y, target });

describe('press states', () => {
  afterEach(() => vi.useRealTimers());
  it('hold a quick tap for 80ms after the finger lifts', () => {
    vi.useFakeTimers();
    const root = new Root();
    const off = installPress(root as unknown as Document);
    const row = new El(true);
    const label = new El(false, row);
    fire(root, 'pointerdown', label);
    expect(row.down).toBe(true);
    fire(root, 'pointerup', label);
    expect(row.down).toBe(true);
    vi.advanceTimersByTime(PRESS_HOLD - 1);
    expect(row.down).toBe(true);
    vi.advanceTimersByTime(1);
    expect(row.down).toBe(false);
    off();
  });
  it('drop at once when the touch turns into a scroll, and skip disabled buttons', () => {
    const root = new Root();
    const off = installPress(root as unknown as Document);
    const row = new El(true);
    fire(root, 'pointerdown', row, 10, 10);
    fire(root, 'pointermove', row, 10, 30);
    expect(row.down).toBe(false);
    const btn = new El(true, null, true);
    fire(root, 'pointerdown', btn);
    expect(btn.down).toBe(false);
    off();
  });
});
