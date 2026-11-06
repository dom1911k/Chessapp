import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { classByLoss, gradeOf, isBook, keyMoments, reviewGame } from '../lib/review';
import type { Classification, Score } from '../lib/chess/evaluation';
import type { AnyGame, PlyRecord } from '../lib/store/types';
import type { Color } from '../lib/chess/pos';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A game from SAN moves; `ev` = White-POV centipawns after each ply; `cls` = the coach's class of my moves. */
function game(sans: string[], me: Color, ev: number[], cls: Record<number, Classification> = {}, extra: Record<number, Partial<PlyRecord>> = {}): AnyGame {
  const c = new Chess();
  const plies: PlyRecord[] = sans.map((s, i) => {
    const before = c.fen();
    const m = c.move(s);
    const isUser = m.color === me;
    return {
      uci: m.lan, san: m.san, color: m.color as Color, fenBefore: before, fenAfter: c.fen(), isUser,
      evalAfter: { type: 'cp', value: ev[i] } as Score,
      classification: isUser ? (cls[i] ?? 'best') : undefined,
      comment: isUser ? ({ text: ['A short reason.'], themes: [], ruleIds: [], arrows: [], highlights: [], bestSan: 'Nf3' } as PlyRecord['comment']) : undefined,
      ...extra[i],
    };
  });
  return { userColor: me, elo: 700, startFen: START, startedAt: 0, plies, takebacks: 0, hintsUsed: 0, told: [], endedAt: 1, result: '0-1', reason: 'checkmate', userResult: 'loss', summary: { accuracy: 0, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null } } as AnyGame;
}

describe('game review', () => {
  it('book moves, loss-based classes and phase grades', () => {
    expect(isBook(['e4', 'e5', 'Nf3'], 2)).toBe(true);
    expect(isBook(['e4', 'e5', 'Ke2'], 2)).toBe(false);
    expect(classByLoss(0.5)).toBe('best');
    expect(classByLoss(2)).toBe('excellent');
    expect(classByLoss(4)).toBe('good');
    expect(classByLoss(12)).toBe('mistake');
    expect(classByLoss(30)).toBe('blunder');
    expect(gradeOf(95)).toBe('best');
    expect(gradeOf(40)).toBe('blunder');
  });
  it('classifies both players, finds a miss, and sums it up', () => {
    // 1.e4 e5 2.Nf3 (book) Nc6 (book) 3.Bc4 Nd4?? (opponent blunder) 4.a3? (my miss: Nxd4/Nxe5 wins) Nxf3+ 5.Qxf3
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'a3', 'Nxf3+', 'Qxf3'];
    const ev = [30, 30, 30, 30, 30, 300, 40, 40, 40];
    const g = game(sans, 'w', ev, { 6: 'mistake' });
    const r = reviewGame(g);
    expect(r.plies.slice(0, 4).map((p) => p.cls)).toEqual(['book', 'book', 'book', 'book']);
    expect(r.plies[5].cls).toBe('blunder');
    expect(r.plies[6].cls).toBe('miss');
    expect(r.me.counts.miss).toBe(1);
    expect(r.them.counts.blunder).toBe(1);
    expect(r.me.accuracy).toBeGreaterThan(0);
    expect(r.me.phases.opening).not.toBeNull();
    expect(r.summary.join(' ')).toMatch(/missed a chance/);
    // Key moments: their blunder and my miss, in move order.
    const km = keyMoments(g.plies, r.plies);
    expect(km.map((m) => [m.ply, m.by])).toEqual([[5, 'them'], [6, 'you']]);
    expect(km[0].text).toMatch(/but you let it go/);
  });
  it('a brilliant move keeps its class, and the summary names the turning point', () => {
    const sans = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
    const g = game(sans, 'b', [30, 30, 30, 30, 30, 9999, 9999], { 5: 'blunder' }, { 3: { special: 'great' } });
    const r = reviewGame(g);
    expect(r.plies[3].cls).toBe('great');
    expect(r.plies[5].cls).toBe('blunder');
    expect(r.summary.join(' ')).toMatch(/turned on 3… Nf6, a blunder \(Nf3 was the move\)/);
    const g2 = game(['d4', 'Nf6', 'Bg5', 'Ne4'], 'w', [20, 20, 20, 20], {}, { 2: { special: 'brilliant' } });
    expect(reviewGame(g2).plies[2].cls).toBe('brilliant');
  });
});
