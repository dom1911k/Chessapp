import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { accuracyOf, floorClass, moveAccuracy, winPct, type Score } from '../lib/chess/evaluation';
import { classByLoss, keyMoments, punishment, reviewGame } from '../lib/review';
import { explainMove } from '../lib/coach';

const cp = (value: number): Score => ({ type: 'cp', value });
const mate = (value: number): Score => ({ type: 'mate', value });

/** Plies from a start FEN and SAN moves; `evals` are White-POV scores after each ply. */
function game(startFen: string, sans: string[], evals: Score[], userColor: 'w' | 'b', extra: Record<number, object> = {}) {
  const c = new Chess(startFen);
  const plies = sans.map((san, i) => {
    const before = c.fen();
    const m = c.move(san);
    return { uci: m.lan, san: m.san, color: m.color, fenBefore: before, fenAfter: c.fen(), isUser: m.color === userColor, evalAfter: evals[i], ...extra[i] };
  });
  return { plies, userColor, startFen, summary: { accuracy: 0, counts: {}, biggestMistakePly: null }, userResult: 'win', reason: 'checkmate' } as never;
}

// Position 1: Black is already lost (White is a rook and a bishop up). 14…Qb4 hangs the queen to Rxb4.
const QB4_START = '6k1/5ppp/8/q7/8/3B4/4QPPP/1R5K w - - 0 14';
const qb4 = () => game(QB4_START, ['Kg1', 'Qb4', 'Rxb4'], [cp(1100), cp(2000), cp(2000)], 'w', { 2: { comment: { bestUci: 'b1b4', bestSan: 'Rxb4', text: [], themes: [] }, classification: 'best' } });

// Position 2: Black is lost (a rook down); 25…Nc8 shuts the a8 rook off the back rank and Qd8# follows.
const NC8_START = 'r5k1/4nppp/8/8/3Q4/8/5PPP/4R2K w - - 0 25';
const nc8 = () => game(NC8_START, ['Kg1', 'Nc8', 'Qd8#'], [cp(1000), mate(1), mate(1)], 'w', { 2: { comment: { bestUci: 'd4d8', bestSan: 'Qd8#', text: [], themes: [] }, classification: 'best' } });

describe('material floor: win% saturates, the floor does not', () => {
  it('the bug: in a lost position, win% barely moves for a hung queen or walking into mate', () => {
    expect(winPct(cp(-1100)) - winPct(cp(-2000))).toBeLessThan(2.5);
    expect(winPct(cp(-1000)) - winPct(mate(-1))).toBeLessThan(2.5);
  });

  it('a 300+ cp loss is at least a mistake, 500+ a blunder; allowing a forced mate is a blunder', () => {
    expect(floorClass(cp(-1100), cp(-2000))).toBe('blunder');
    expect(floorClass(cp(-1000), mate(-1))).toBe('blunder');
    expect(floorClass(cp(50), cp(-280))).toBe('mistake');
    expect(floorClass(cp(50), cp(-200))).toBeNull();
  });

  it('getting mated sooner when mate was already forced is not; trading down while clearly winning is fine', () => {
    expect(floorClass(mate(-5), mate(-2))).toBeNull();
    expect(floorClass(cp(1600), cp(1100))).toBeNull();
    expect(floorClass(mate(3), cp(1200))).toBeNull();
    // …but giving up material that still leaves you short of clearly winning counts.
    expect(floorClass(cp(900), cp(450))).toBe('mistake');
  });

  it('14…Qb4 (hangs the queen in a lost position) is a blunder, explained by what punishes it', () => {
    const g = qb4();
    const r = reviewGame(g);
    expect(r.plies[1].cls).toBe('blunder');
    expect(r.plies[1].accuracy).toBeLessThan(45);
    expect(punishment((g as { plies: never[] }).plies, 1)).toBe('This hangs the queen — Rxb4 wins it.');
  });

  it('25…Nc8 (blocks the back rank, Qd8# follows) is a blunder: "Allows Qd8#"', () => {
    const g = nc8();
    expect(new Chess((g as { plies: { fenAfter: string }[] }).plies[2].fenAfter).isCheckmate()).toBe(true);
    const r = reviewGame(g);
    expect(r.plies[1].cls).toBe('blunder');
    expect(punishment((g as { plies: never[] }).plies, 1)).toBe('Allows Qd8#.');
  });

  it('these blunders now show up as key moments', () => {
    const g = qb4();
    const r = reviewGame(g);
    const m = keyMoments((g as { plies: never[] }).plies, r.plies);
    expect(m.map((x) => x.ply)).toContain(1);
    expect(m.find((x) => x.ply === 1)!.text).toContain('Rxb4 wins it');
  });

  it('the coach grades your own moves the same way (in-game feedback and stored classification)', () => {
    // You are Black here and play the losing 14…Qb4.
    const fen = '6k1/5ppp/8/q7/8/3B4/4QPPP/1R4K1 b - - 0 14';
    const after = new Chess(fen); after.move('Qb4');
    const before = { fen, depth: 12, bestMove: 'a5e1', lines: [{ score: cp(1100), pv: ['a5e1'], depth: 12, multipv: 1 }] } as never;
    const aft = { fen: after.fen(), depth: 12, bestMove: 'b1b4', lines: [{ score: cp(2000), pv: ['b1b4'], depth: 12, multipv: 1 }] } as never;
    expect(explainMove({ fenBefore: fen, uci: 'a5b4', before, after: aft }).classification).toBe('blunder');
  });
});

describe('normal grading of close positions is unchanged', () => {
  it('small evaluation changes grade exactly by win% loss, as before', () => {
    const evals = [30, 10, 45, -20, 60, -40, 20, 0].map(cp);
    const g = game('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['a3', 'h6', 'b3', 'g6', 'c3', 'f6', 'd3', 'e6'], evals, 'w');
    const r = reviewGame(g);
    let prev = cp(0);
    r.plies.forEach((p, i) => {
      const color = i % 2 ? 'b' : 'w';
      const pov = (s: Score) => (color === 'w' ? s : { ...s, value: -s.value });
      const loss = Math.max(0, winPct(pov(prev)) - winPct(pov(evals[i])));
      expect(p.cls).toBe(classByLoss(loss));
      expect(p.accuracy).toBeCloseTo(moveAccuracy(winPct(pov(prev)), winPct(pov(evals[i]))), 6);
      prev = evals[i];
    });
  });

  it('floor-aware accuracy equals plain accuracy when nothing is floored', () => {
    expect(accuracyOf(cp(40), cp(-30))).toBeCloseTo(moveAccuracy(winPct(cp(40)), winPct(cp(-30))), 6);
    expect(accuracyOf(cp(-1100), cp(-2000))).toBeLessThan(45);
  });
});
