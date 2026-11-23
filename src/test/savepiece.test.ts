import { describe, expect, it } from 'vitest';
import { CoachContext } from '../lib/coach/context';
import { ideaRules } from '../lib/coach/rules/ideas';

// The save-piece idea with a hand-made engine line (no engine needed): `best` is the engine's move.
function savePiece(fenBefore: string, uci: string, best: string) {
  const c = new CoachContext({ fenBefore, uci, before: { bestMove: best, lines: [{ pv: [best], score: { type: 'cp', value: 0 } }] } } as never);
  return ideaRules.find((r) => r.id === 'save-piece')!.detect(c);
}

describe('save-piece wording', () => {
  it('a defending move keeps the piece where it is', () => {
    // The bishop on d5 hangs to the knight; c4 would have defended it.
    const r = savePiece('4k3/8/5n2/3B4/8/8/P1P5/4K3 w - - 0 1', 'a2a3', 'c2c4');
    expect(r?.text).toMatch(/kept your bishop on d5 safe|bishop on d5 needed help/);
  });

  it('an escape moves the piece out of danger (never "kept on" its old square)', () => {
    // The knight on c3 is attacked by the b4 pawn; you played h3 instead of moving it.
    const r = savePiece('r1bqkbnr/pppp1ppp/2n5/4p3/1p2P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 5', 'h2h3', 'c3d5');
    expect(r?.text).toMatch(/out of danger|needed a safe square/);
    expect(r?.text).not.toMatch(/kept your knight/);
  });

  it('when you moved that piece into danger, it points at the safe square instead', () => {
    // 1.e4 c6 2.Qh5 g6: the queen must move; 3.Qh6 walks into the f8 bishop, Qh4 was safe.
    const r = savePiece('rnbqkbnr/pp1ppp1p/2p3p1/7Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3', 'h5h6', 'h5h4');
    expect(r?.text).toBe('Your queen had a safe square on h4 instead.');
  });

  it('the escape sentences count as naming the better move (no "Better:" under them); defending does not', () => {
    expect(savePiece('rnbqkbnr/pp1ppp1p/2p3p1/7Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3', 'h5h6', 'h5h4')?.namesBest).toBe(true);
    expect(savePiece('r1bqkbnr/pppp1ppp/2n5/4p3/1p2P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 5', 'h2h3', 'c3d5')?.namesBest).toBe(true);
    expect(savePiece('4k3/8/5n2/3B4/8/8/P1P5/4K3 w - - 0 1', 'a2a3', 'c2c4')?.namesBest).toBeUndefined();
  });
});
