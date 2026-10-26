import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { humanMove } from '../lib/bot';

const legal = (fen: string) => new Chess(fen).moves({ verbose: true });

describe('human-like bot moves', () => {
  // Black can grab a pawn on e4 with the queen, but it's defended by the knight on c3.
  const fen = 'rnb1kbnr/pppp1ppp/8/4p3/3qP3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 3 4';
  it('a careless beginner grabs material without checking', () => {
    const picks = new Set(Array.from({ length: 20 }, (_, i) => humanMove(fen, legal(fen), 'balanced', false, () => ((i * 7919) % 100) / 100)));
    expect([...picks].some((m) => m && new Chess(fen).move(m).captured)).toBe(true);
  });
  it('a careful player does not leave the queen hanging', () => {
    for (let i = 0; i < 20; i++) {
      const m = humanMove(fen, legal(fen), 'balanced', true, () => ((i * 7919) % 100) / 100)!;
      const c = new Chess(fen);
      c.move(m);
      // The queen must not end up where a minor piece or pawn can simply take it.
      const takes = c.moves({ verbose: true }).filter((x) => x.captured === 'q' && x.piece !== 'q');
      expect(takes).toHaveLength(0);
    }
  });
  it('always plays mate in one', () => {
    const f = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    expect(humanMove(f, legal(f), 'balanced', false)).toBe('a1a8');
  });
});
