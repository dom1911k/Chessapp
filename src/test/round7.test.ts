import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    },
  };
});

describe('round 7 · 0.2 toasts come one at a time, and wait for sheets and done cards', async () => {
  const { useCelebrate } = await import('../lib/celebrate');
  beforeEach(() => {
    vi.useFakeTimers();
    useCelebrate.setState({ toasts: [], hold: false, muted: false, sheets: 0 });
  });
  afterEach(() => {
    // Drain what's left between tests (the queue lives in the module).
    useCelebrate.setState({ sheets: 0, hold: false });
    vi.advanceTimersByTime(30000);
    vi.useRealTimers();
  });
  it('one at a time, the next after the first goes', () => {
    const c = useCelebrate.getState();
    c.toast({ icon: 'a', title: 'Achievement: Puzzler' });
    c.toast({ icon: 'b', title: 'Achievement: Daily trainer' });
    expect(useCelebrate.getState().toasts.map((t) => t.title)).toEqual(['Achievement: Puzzler']);
    vi.advanceTimersByTime(3500 + 300);
    expect(useCelebrate.getState().toasts.map((t) => t.title)).toEqual(['Achievement: Daily trainer']);
    vi.advanceTimersByTime(3800);
    expect(useCelebrate.getState().toasts).toEqual([]);
  });
  it('a done card holds them until it has settled', () => {
    const c = useCelebrate.getState();
    c.setHold(true, { queue: true });
    c.toast({ icon: 'a', title: 'Achievement: Puzzler' });
    c.toast({ icon: 'b', title: 'Achievement: Daily trainer' });
    expect(useCelebrate.getState().toasts).toEqual([]);
    c.setHold(false);
    vi.advanceTimersByTime(350);
    expect(useCelebrate.getState().toasts).toHaveLength(1);
  });
  it('an open sheet holds them until it closes', () => {
    const c = useCelebrate.getState();
    c.sheetOpen(true);
    c.toast({ icon: 'a', title: 'Weekly goal reached!' });
    vi.advanceTimersByTime(1000);
    expect(useCelebrate.getState().toasts).toEqual([]);
    c.sheetOpen(false);
    vi.advanceTimersByTime(400);
    expect(useCelebrate.getState().toasts.map((t) => t.title)).toEqual(['Weekly goal reached!']);
  });
});
