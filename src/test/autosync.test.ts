import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { RESYNC_MS, shouldAutoSync } from '../lib/chesscom/store';

describe('chess.com auto-sync', () => {
  const on = { ccUsername: 'MyName', ccAutoSync: true };
  it('syncs on open when switched on, linked and online', () => {
    expect(shouldAutoSync(on, true, 1_000_000, 0)).toBe(true);
    expect(shouldAutoSync({ ...on, ccAutoSync: false }, true, 1_000_000, 0)).toBe(false);
    expect(shouldAutoSync({ ...on, ccUsername: '  ' }, true, 1_000_000, 0)).toBe(false);
    expect(shouldAutoSync(on, false, 1_000_000, 0)).toBe(false);
  });
  it('coming back to the app syncs again only after a while', () => {
    expect(shouldAutoSync(on, true, 5 * 60_000, 0 + 60_000)).toBe(false);
    expect(shouldAutoSync(on, true, RESYNC_MS + 60_000, 60_000)).toBe(true);
  });
});
