import { describe, expect, it } from 'vitest';
import { migrateUiV2 } from '../lib/settings';

describe('uiV2: one-time move to the chess.com-style look', () => {
  it('an old install on the system theme switches to dark, once', () => {
    const s = migrateUiV2({ theme: 'system' });
    expect(s.theme).toBe('dark');
    expect(s.uiV2).toBe(true);
    // Already migrated: a later choice of "system" sticks.
    expect(migrateUiV2({ theme: 'system', uiV2: true }).theme).toBe('system');
  });
  it('a theme picked on purpose is left alone', () => {
    expect(migrateUiV2({ theme: 'light' }).theme).toBe('light');
  });
});
