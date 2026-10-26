import { describe, expect, it } from 'vitest';
import { lineWords, moveWords, shortWords } from '../lib/chess/words';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('moves in words', () => {
  it('describes quiet moves, captures and castling', () => {
    expect(moveWords(START, 'g1f3', 'you')).toBe('move your knight to f3');
    expect(moveWords(START, 'e2e4', 'you', 'ger')).toBe('pushing your pawn to e4');
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    expect(moveWords(fen, 'f3e5', 'they')).toBe('take your pawn on e5 with their knight');
    expect(moveWords('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1', 'you')).toBe('castle');
    expect(shortWords(fen, 'f3e5')).toBe('Knight takes pawn on e5');
  });
  it('tells a line from both sides and spots take-backs', () => {
    const fen = 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
    expect(lineWords(fen, ['e4d5', 'd8d5'], 2, 'you')).toBe('you take their pawn on d5 with your pawn, then they take back with their queen');
  });
});
