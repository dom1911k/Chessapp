import { describe, expect, it } from 'vitest';
import { hangingPieces, parseFen, see, sqIndex } from '../lib/chess/pos';
import { describeLine, isBackRankMate, mateThreats, moveMotifs } from '../lib/coach/tactics';
import { explainTakeback } from '../lib/coach';
import { classify, moveAccuracy, winPct } from '../lib/chess/evaluation';
import { reviewCard, newCardDue, type Card } from '../lib/srs';
import { detectOpening } from '../lib/openings';
import { summarize } from '../lib/report';

const kinds = (fen: string, uci: string) => moveMotifs(fen, uci).map((m) => m.kind);

describe('static exchange', () => {
  it('undefended piece is lost', () => {
    const { board } = parseFen('4k3/8/8/4n3/8/5N2/8/4K3 w - - 0 1');
    expect(see(board, sqIndex('e5'), 'w')).toBe(3);
  });
  it('pawn-defended knight attacked by queen is not winnable', () => {
    const { board } = parseFen('4k3/8/3p4/4n3/8/8/4Q3/4K3 w - - 0 1');
    expect(see(board, sqIndex('e5'), 'w')).toBe(0);
  });
  it('rook attacked by a pawn is hanging even if defended', () => {
    const { board } = parseFen('4k3/8/8/4r3/3P4/8/8/4K3 w - - 0 1');
    expect(see(board, sqIndex('e5'), 'w')).toBe(5);
    expect(hangingPieces(board, 'b')[0].sq).toBe(sqIndex('e5'));
  });
});

describe('motifs', () => {
  it('knight fork', () => {
    expect(kinds('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', 'd5c7')).toContain('fork');
  });
  it('absolute pin', () => {
    // Bb5 pins the c6 knight to the e8 king.
    expect(kinds('4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', 'f1b5')).toContain('pin');
  });
  it('skewer', () => {
    // Rook checks the king on e-file with the queen behind.
    expect(kinds('4q3/8/8/4k3/8/8/8/R3K3 w - - 0 1', 'a1a5')).not.toContain('skewer');
    expect(kinds('8/4q3/8/4k3/8/8/8/K6R w - - 0 1', 'h1e1')).toContain('skewer');
  });
  it('discovered attack', () => {
    // Moving the knight from e4 reveals the rook on e1 attacking the queen on e8.
    expect(kinds('4q1k1/8/8/8/4N3/8/8/4R1K1 w - - 0 1', 'e4c5')).toContain('discovered');
  });
  it('free capture', () => {
    expect(kinds('4k3/8/8/4n3/8/5N2/8/4K3 w - - 0 1', 'f3e5')).toContain('freeCapture');
  });
  it('back rank mate', () => {
    expect(isBackRankMate('R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1')).toBe(true);
    expect(mateThreats('6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1', 'w')).toEqual(['a1a8']);
  });
  it('describeLine counts material and mates', () => {
    const info = describeLine('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', ['a1a8']);
    expect(info.matesIn).toBe(1);
    expect(info.endsInBackRankMate).toBe(true);
    const cap = describeLine('4k3/8/8/4n3/8/5N2/8/4K3 w - - 0 1', ['f3e5']);
    expect(cap.materialGain).toBe(3);
    expect(cap.victim).toBe('n');
  });
});

describe('evaluation', () => {
  it('classifies by win% loss', () => {
    expect(classify(50, 50, false)).toBe('best');
    expect(classify(50, 47, false)).toBe('good');
    expect(classify(50, 42, false)).toBe('inaccuracy');
    expect(classify(50, 35, false)).toBe('mistake');
    expect(classify(50, 10, false)).toBe('blunder');
    expect(winPct({ type: 'mate', value: 3 })).toBe(100);
    expect(moveAccuracy(50, 50)).toBeGreaterThan(99);
  });
});

describe('srs', () => {
  it('climbs the ladder and resets on failure', () => {
    const now = new Date(2026, 0, 1, 12).getTime();
    let c: Card = { id: 'x', kind: 'puzzle', fen: '', solution: [], themes: [], label: '', createdAt: now, due: newCardDue(now), step: 0, reps: 0, lapses: 0 };
    const days = (t: number) => Math.round((t - new Date(2026, 0, 1).getTime()) / 864e5);
    expect(days(c.due)).toBe(1);
    c = reviewCard(c, true, now);
    expect(days(c.due)).toBe(3);
    c = reviewCard(c, true, now);
    expect(days(c.due)).toBe(7);
    c = reviewCard(c, false, now);
    expect(days(c.due)).toBe(1);
    expect(c.lapses).toBe(1);
  });
});

describe('misc', () => {
  it('detects openings by longest prefix', () => {
    expect(detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])?.name).toBe('Ruy Lopez: Morphy Defense');
    expect(detectOpening(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3'])?.name).toBe('Sicilian: Najdorf');
    expect(detectOpening(['a3'])).toBeNull();
  });
  it('takeback text', () => {
    expect(explainTakeback({ classification: 'blunder', text: ['Oops.'], themes: [], ruleIds: [], arrows: [], highlights: [] }, 's')).toMatch(/Oops/);
  });
  it('summarizes a game', () => {
    const s = summarize([
      { uci: '', san: '', color: 'w', fenBefore: '', fenAfter: '', isUser: true, classification: 'blunder', accuracy: 20, wpLoss: 40, comment: { text: [], themes: ['fork'], ruleIds: [], arrows: [], highlights: [] } },
      { uci: '', san: '', color: 'b', fenBefore: '', fenAfter: '', isUser: false },
      { uci: '', san: '', color: 'w', fenBefore: '', fenAfter: '', isUser: true, classification: 'best', accuracy: 100, wpLoss: 0 },
    ]);
    expect(s.accuracy).toBe(47);
    expect(s.biggestMistakePly).toBe(0);
    expect(s.lessonTheme).toBe('fork');
  });
});
