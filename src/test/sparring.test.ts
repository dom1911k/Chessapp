import { describe, expect, it } from 'vitest';
import { afterSparring, newSparring, sparringStep } from '../lib/sparring';

describe('sparring partner', () => {
  it('starts at your rating and moves 25 a game at first', () => {
    const s = newSparring(1012);
    expect(s.rating).toBe(1010);
    expect(afterSparring(s, 'win').rating).toBe(1035);
    expect(afterSparring(s, 'loss').rating).toBe(985);
    expect(afterSparring(s, 'draw')).toMatchObject({ rating: 1010, games: 1, d: 1 });
  });
  it('takes smaller steps after many games, never below 10', () => {
    expect(sparringStep(0)).toBe(25);
    expect(sparringStep(10)).toBe(25);
    expect(sparringStep(40)).toBeLessThan(15);
    expect(sparringStep(1000)).toBe(10);
  });
  it('settles where you score about 50%', () => {
    // A player of true strength 1300 against a partner starting at 800.
    let s = newSparring(800);
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tail: number[] = [];
    for (let i = 0; i < 300; i++) {
      const p = 1 / (1 + 10 ** ((s.rating - 1300) / 400));
      s = afterSparring(s, rnd() < p ? 'win' : 'loss');
      if (i >= 200) tail.push(s.rating);
    }
    const avg = tail.reduce((a, b) => a + b, 0) / tail.length;
    expect(Math.abs(avg - 1300)).toBeLessThan(80);
  });
  it('stays within the bots\' range', () => {
    let s = newSparring(1990);
    for (let i = 0; i < 5; i++) s = afterSparring(s, 'win');
    expect(s.rating).toBe(2000);
  });
});
