import { describe, expect, it } from 'vitest';
import { promptFor } from '../lib/puzzles/prompts';

describe('path prompts', () => {
  it('fade from theme and length to no clues', () => {
    expect(promptFor(['mateIn2', 'short'], 3, 2)).toBe('Find the checkmate in 2.');
    expect(promptFor(['mateIn2'], 2, 2)).toBe('Find the checkmate.');
    expect(promptFor(['mateIn2'], 1, 2)).toBe('Checkmate.');
    expect(promptFor(['mateIn2'], 0, 2)).toBeNull();
    expect(promptFor(['fork', 'middlegame'], 3, 1)).toBe('Find the fork in 1 move.');
    expect(promptFor(['fork'], 2, 1)).toBe('Find the fork.');
    expect(promptFor(['fork'], 1, 1)).toBe('Win material.');
    expect(promptFor(['defensiveMove'], 1, 1)).toBe('Defend.');
    expect(promptFor(['equality'], 1, 2)).toBe('Hold the balance.');
    expect(promptFor(['endgame'], 1, 2)).toBe('Get an advantage.');
  });
});
