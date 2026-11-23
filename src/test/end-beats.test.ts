import { describe, expect, it } from 'vitest';
import { END_BEATS, endStinger } from '../lib/endBeats';
import { kingBadges } from '../lib/chess/kingBadges';

describe('the end of a game on the board', () => {
  it('picks the stinger from your side', () => {
    expect(endStinger('1-0', 'w')).toBe('win');
    expect(endStinger('0-1', 'w')).toBe('loss');
    expect(endStinger('0-1', 'b')).toBe('win');
    expect(endStinger('1/2-1/2', 'b')).toBe('draw');
    expect(endStinger('*', 'w')).toBeNull();
  });
  it('marks the kings, then the stinger 160ms later, then the sheet 950ms after that', () => {
    expect(END_BEATS.stinger - END_BEATS.badges).toBe(160);
    expect(END_BEATS.sheet - END_BEATS.stinger).toBe(950);
    expect(kingBadges('1-0', 'checkmate')).toEqual({ w: 'win', b: 'mate' });
    expect(kingBadges('0-1', 'resignation')).toEqual({ w: 'resign', b: 'win' });
    expect(kingBadges('1/2-1/2', 'stalemate')).toEqual({ w: 'draw', b: 'draw' });
  });
});
