import { describe, expect, it } from 'vitest';
import { annotateLine, explainInDepth, numbered, standing } from '../lib/coach/explain';
import type { AnalysisResult } from '../lib/engine/types';

const res = (fen: string, lines: [string[], number | { mate: number }][]): AnalysisResult => ({
  fen,
  depth: 14,
  bestMove: lines[0]?.[0][0] ?? null,
  lines: lines.map(([pv, s], i) => ({ multipv: i + 1, depth: 14, pv, score: typeof s === 'number' ? { type: 'cp', value: s } : { type: 'mate', value: s.mate } })),
});

describe('explainInDepth', () => {
  const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  const before = res(ITALIAN, [[['f1c4', 'g8f6', 'd2d3'], 30], [['f1b5', 'a7a6'], 25], [['d2d4', 'e5d4'], 22]]);
  const after = res('', [[['d8g5', 'd2d4', 'g5g6'], -310]]);

  it('explains a blunder: the hanging piece, what it costs, what was better, and a lesson', () => {
    const e = explainInDepth({ fenBefore: ITALIAN, uci: 'f3g5', isUser: true, verdict: 'blunder', before, after });
    expect(e.headline).toMatch(/^Ng5 is a blunder — .*knight/);
    const text = e.sections.map((s) => s.title + ': ' + s.points.join(' ')).join('\n');
    expect(text).toMatch(/knight on g5 is left hanging/);
    expect(text).toMatch(/Qxg5/);
    expect(text).toMatch(/Bc4 was best/);
    expect(text).toMatch(/Other good moves: Bb5/);
    expect(e.sections.some((s) => s.title === 'Remember')).toBe(true);
    expect(e.swing.wpBefore).toBeGreaterThan(e.swing.wpAfter);
    expect(e.lines.map((l) => l.id)).toEqual(['played', 'best', 'alt0', 'alt1']);
    expect(e.lines[0].san.slice(0, 2)).toEqual(['Ng5', 'Qxg5']);
  });

  it("on the opponent's mistake, shows how to punish it", () => {
    const e = explainInDepth({ fenBefore: ITALIAN, uci: 'f3g5', isUser: false, verdict: 'blunder', before, after });
    const punish = e.sections.find((s) => s.title === 'How to punish it');
    expect(punish?.points[0]).toMatch(/^Qxg5 is the answer/);
    expect(e.sections.find((s) => s.title === 'What happened')!.points[1]).toMatch(/^Before it, your opponent was/);
  });

  it('spots a mate it allows', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2';
    const e = explainInDepth({
      fenBefore: fen,
      uci: 'g2g4',
      isUser: true,
      verdict: 'blunder',
      before: res(fen, [[['b1c3'], -40]]),
      after: res('', [[['d8h4'], { mate: -1 }]]),
    });
    expect(e.headline).toMatch(/allows mate in 1/);
    expect(e.sections[1].points[0]).toMatch(/forced checkmate in 1: 2… Qh4#/);
  });

  it('explains why a good move works (a fork)', () => {
    const fen = 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
    const e = explainInDepth({
      fenBefore: fen,
      uci: 'd5c7',
      isUser: true,
      verdict: 'best',
      before: res(fen, [[['d5c7', 'e8d7', 'c7a8'], 500]]),
      after: res('', [[['e8d7', 'c7a8'], 500]]),
    });
    const why = e.sections.find((s) => s.title === 'Why it works')!;
    expect(why.points.join(' ')).toMatch(/fork of their king on e8 and their rook on a8/);
    expect(e.sections.some((s) => s.title === 'What was better')).toBe(false);
  });
});

describe('helpers', () => {
  it('numbers lines and describes standings', () => {
    expect(numbered('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1', ['e5', 'Nf3', 'Nc6'])).toBe('1… e5 2. Nf3 Nc6');
    expect(standing({ type: 'cp', value: 250 }, 'w')).toBe('clearly better (+2.5)');
    expect(standing({ type: 'cp', value: 250 }, 'b')).toBe('clearly worse (-2.5)');
    expect(standing({ type: 'mate', value: 3 }, 'w')).toBe('a forced mate in 3');
  });
});

describe('annotateLine (move-by-move follow-up)', () => {
  it('narrates a blunder and its punishment, with material', () => {
    const F = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const n = annotateLine(F, ['f3g5', 'd8g5', 'd2d4'], 'w');
    expect(n.map((x) => x.label)).toEqual(['3. Ng5', '3… Qxg5', '4. d4']);
    expect(n[0].text).toMatch(/your knight on g5 can now be taken/);
    expect(n[1]).toMatchObject({ who: 'they', material: -3 });
    expect(n[1].text).toMatch(/They take your knight on g5 with their queen.*you’re a piece down/);
    expect(n[2].text).toMatch(/uncovers an attack by the bishop on their queen/);
  });
  it('explains how to capitalise: a fork that wins a rook', () => {
    const n = annotateLine('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', ['d5c7', 'e8d7', 'c7a8'], 'w');
    expect(n[0].text).toMatch(/fork of their king on e8 and their rook on a8.*Check/);
    expect(n[2]).toMatchObject({ material: 5 });
    expect(n[2].text).toMatch(/you’re a rook up/);
  });
  it('ends at checkmate', () => {
    const n = annotateLine('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', ['d8h4', 'a2a3'], 'b');
    expect(n).toHaveLength(1);
    expect(n[0].text).toMatch(/Checkmate — you win/);
  });
});
