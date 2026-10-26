import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { REPERTOIRES, bookMove } from '../lib/people/openings';
import { ECO } from '../lib/openings';

describe('repertoires', () => {
  it('every line is legal', () => {
    for (const [id, rep] of Object.entries(REPERTOIRES))
      for (const line of rep.lines) {
        const c = new Chess();
        for (const m of line.split(' ')) expect(() => c.move(m), `${id}: ${line} @ ${m}`).not.toThrow();
      }
  });
  it('every ECO entry is legal', () => {
    for (const o of ECO) {
      const c = new Chess();
      for (const m of o.moves.split(' ')) expect(() => c.move(m), `${o.name} @ ${m}`).not.toThrow();
    }
  });
  it('book follows the game', () => {
    expect(bookMove('jonas', [], () => 0)).toBe('e2e4');
    expect(bookMove('jonas', ['e4', 'e5'], () => 0)).toBe('f2f4');
    expect(bookMove('jonas', ['e4', 'e5', 'Nc3'])).toBeNull();
    expect(bookMove('lily', [])).toBeNull();
  });
});
