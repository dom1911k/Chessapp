import { describe, expect, it } from 'vitest';
import { HAPTIC, UI_EASE } from '../lib/motion';
import { fmtNum } from '../lib/numbers';
import { CLS_SFX } from '../lib/sfx';

describe('the feel kit', () => {
  it('has one UI easing with no overshoot', () => {
    expect(UI_EASE).toBe('cubic-bezier(.2,.8,.3,1)');
    const [, y1, , y2] = UI_EASE.match(/[\d.]+/g)!.map(Number);
    expect(y1).toBeLessThanOrEqual(1);
    expect(y2).toBeLessThanOrEqual(1);
  });
  it('has the four haptics', () => {
    expect(HAPTIC).toEqual({ select: 6, success: 12, warn: [10, 40, 10], big: [30, 40, 60] });
  });
  it('formats numbers for the odometer and count-ups', () => {
    expect(fmtNum(1240)).toBe('1,240');
    expect(fmtNum(92.44, 1)).toBe('92.4');
    expect(fmtNum(0, 1)).toBe('0.0');
  });
  it('gives every move class a sound on the sfx bus', () => {
    for (const c of ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder']) expect(CLS_SFX[c]).toBe(`cls${c[0].toUpperCase()}${c.slice(1)}`);
  });
});
