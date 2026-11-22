import { describe, expect, it } from 'vitest';
import { namesMove } from '../lib/coach/names';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

describe('namesMove', () => {
  it('spots the SAN on a word boundary', () => {
    expect(namesMove('Nf3 was the natural move.', START, 'g1f3')).toBe(true);
    expect(namesMove('After 2.Nf3 Black is fine.', START, 'g1f3')).toBe(true);
    expect(namesMove('Nf3x was not a move.', START, 'g1f3')).toBe(false);
  });

  it('spots the move written in words', () => {
    expect(namesMove('Moving your knight to f3 was better.', START, 'g1f3')).toBe(true);
  });

  it('ignores a sentence about another move', () => {
    expect(namesMove('Your bishop was loose on c4.', ITALIAN, 'e1g1')).toBe(false);
    expect(namesMove('Nc3 would also do.', START, 'g1f3')).toBe(false);
  });

  it('drops check marks when matching', () => {
    // Bxf7+ in the Italian
    expect(namesMove('Bxf7 would have won a pawn with check.', ITALIAN, 'c4f7')).toBe(true);
  });

  it('is false without a move', () => {
    expect(namesMove('anything', START, undefined)).toBe(false);
  });
});
