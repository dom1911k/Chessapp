import { describe, expect, it } from 'vitest';
import { cornerPos, kingBadges, kingSquares } from '../lib/chess/kingBadges';

describe('king result badges', () => {
  it('crowns the winner and marks how the loser lost', () => {
    expect(kingBadges('1-0', 'checkmate')).toEqual({ w: 'win', b: 'mate' });
    expect(kingBadges('0-1', 'time')).toEqual({ w: 'time', b: 'win' });
    expect(kingBadges('0-1', 'resignation')).toEqual({ w: 'resign', b: 'win' });
    // Other decisive endings use the flag too.
    expect(kingBadges('1-0', 'abandoned')).toEqual({ w: 'win', b: 'resign' });
  });

  it('gives both kings ½ in a draw, nothing for an unfinished game', () => {
    expect(kingBadges('1/2-1/2', 'stalemate')).toEqual({ w: 'draw', b: 'draw' });
    expect(kingBadges('*', '')).toBeNull();
    expect(kingBadges(undefined, undefined)).toBeNull();
  });

  it('finds the kings', () => {
    expect(kingSquares('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toEqual({ w: 'e1', b: 'e8' });
    expect(kingSquares('7k/8/8/8/8/8/8/K7 w - - 0 1')).toEqual({ w: 'a1', b: 'h8' });
  });

  it('keeps the corner inside the board on the edge file and the top rank', () => {
    expect(cornerPos('h8', 'white', 22)).toEqual({ left: 'calc(100% - 23px)', top: '1px' });
    expect(cornerPos('a1', 'black', 22)).toEqual({ left: 'calc(100% - 23px)', top: '1px' });
    expect(cornerPos('e4', 'white', 22).top).toBe('calc(50% - 8.36px)');
  });
});
