import { describe, expect, it } from 'vitest';
import { stepView, swipeDir } from '../lib/chess/boardfeel';

describe('swipe to step through a live game', () => {
  it('a quick horizontal swipe steps; slow, short or mostly vertical gestures do not', () => {
    expect(swipeDir(80, 5, 200)).toBe(-1); // to the right = back
    expect(swipeDir(-80, 5, 200)).toBe(1); // to the left = forward
    expect(swipeDir(30, 0, 200)).toBe(0); // too short
    expect(swipeDir(80, 70, 200)).toBe(0); // more of a scroll
    expect(swipeDir(80, 0, 600)).toBe(0); // slow: a drawing or a drag
  });
  it('steps back from the live position, forward again, and follows the game at the end', () => {
    expect(stepView(null, 10, -1)).toBe(8);
    expect(stepView(8, 10, -1)).toBe(7);
    expect(stepView(0, 10, -1)).toBe(-1);
    expect(stepView(-1, 10, -1)).toBe(-1);
    expect(stepView(7, 10, 1)).toBe(8);
    expect(stepView(8, 10, 1)).toBeNull();
    expect(stepView(null, 10, 1)).toBeNull();
    expect(stepView(null, 0, -1)).toBeNull();
  });
});
