import { describe, expect, it } from 'vitest';
import { preMoveCheck } from '../lib/coach/precheck';

describe('before-you-move check', () => {
  it('stays quiet for normal moves', () => {
    expect(preMoveCheck('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4')).toBeNull();
    // An even trade is fine.
    expect(preMoveCheck('rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3', 'c3d5')).toBeNull();
  });
  it('catches a piece left hanging', () => {
    const c = preMoveCheck('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'f1a6');
    expect(c?.kind).toBe('hang');
    expect(c?.sq).toBe('a6');
  });
  it('catches walking into mate in one', () => {
    const c = preMoveCheck('rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2', 'g2g4');
    expect(c?.kind).toBe('mate');
    expect(c?.reveal).toMatch(/queen on h4/);
  });
});
