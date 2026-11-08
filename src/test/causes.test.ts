import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { causeTotals, missedChances, mistakeCauses } from '../lib/games/causes';
import { difficultyOf, difficultySentence, moveShare, shareText } from '../lib/coach/difficulty';
import type { PlyRecord } from '../lib/store/types';

function ply(fen: string, uci: string, isUser: boolean, comment?: Partial<NonNullable<PlyRecord['comment']>>): PlyRecord {
  const c = new Chess(fen);
  const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return {
    uci,
    san: m.san,
    color: m.color,
    fenBefore: fen,
    fenAfter: c.fen(),
    isUser,
    comment: comment ? { text: [], themes: [], ruleIds: [], arrows: [], highlights: [], ...comment } : undefined,
  };
}

describe('mistake causes', () => {
  it('a move that leaves a piece loose', () => {
    const p = ply('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3g5', true, { bestUci: 'f1c4', bestSan: 'Bc4', bestLine: ['f1c4', 'g8f6'], replyLine: ['d8g5', 'd2d4'] });
    const [c] = mistakeCauses({ plies: [p], userColor: 'w' }, ['blunder']);
    expect(c.cause).toBe('hungPiece');
    expect(c.text).toBe('Ng5 left your knight on g5 unprotected.');
  });
  it("ignoring their threat (and playing it in two seconds)", () => {
    const p = ply('4k3/3q4/8/8/6B1/8/P7/4K3 w - - 0 1', 'a2a3', true, { bestUci: 'g4e2', bestSan: 'Be2', bestLine: ['g4e2'], replyLine: ['d7g4'] });
    const [c] = mistakeCauses({ plies: [p], userColor: 'w', timeControl: '600+0', clocks: [598] }, ['blunder']);
    expect(c.cause).toBe('missedThreat');
    expect(c.text).toMatch(/attacked your bishop on g4/);
    expect(c).toMatchObject({ secs: 2, fast: true, timeTrouble: false });
  });
  it('a missed winning shot, also listed as a missed chance', () => {
    const p = ply('r3k3/8/8/3N4/8/8/P7/4K3 w - - 0 1', 'a2a3', true, { bestUci: 'd5c7', bestSan: 'Nc7+', bestLine: ['d5c7', 'e8d7', 'c7a8'], replyLine: ['e8d7'] });
    const [c] = mistakeCauses({ plies: [p], userColor: 'w' }, ['mistake']);
    expect(c.cause).toBe('missedTactic');
    expect(c.text).toBe('Nc7+ would have won their rook — you played a3.');
    expect(missedChances({ plies: [p] }, ['mistake'])).toEqual([{ ply: 0, bestSan: 'Nc7+', played: 'a3', what: 'win their rook', gain: 5 }]);
  });
  it('flags time trouble from the clock', () => {
    const a = ply('4k3/3q4/8/8/6B1/8/P7/4K3 w - - 0 1', 'e1f2', true);
    const b = ply(a.fenAfter, 'e8f8', false);
    const c = ply(b.fenAfter, 'a2a3', true, { bestUci: 'g4e2', bestLine: ['g4e2'], replyLine: ['d7g4'] });
    const list = mistakeCauses({ plies: [a, b, c], userColor: 'w', timeControl: '600+0', clocks: [25, 590, 20] }, ['good', 'good', 'blunder']);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ply: 2, timeTrouble: true, fast: false });
    expect(causeTotals(list)).toMatchObject({ missedThreat: 1, timeTrouble: 1 });
  });
  it('ignores good moves and the opponent', () => {
    const p = ply('r3k3/8/8/3N4/8/8/P7/4K3 w - - 0 1', 'a2a3', false);
    expect(mistakeCauses({ plies: [p], userColor: 'b' }, ['blunder'])).toEqual([]);
  });
});

describe('how hard a move was to find', () => {
  it('turns Maia logits into shares and words', () => {
    const l = new Map([['e2e4', 2], ['d2d4', 2], ['a2a3', -4]]);
    expect(moveShare(l, 'e2e4')).toBeCloseTo(0.4994, 3);
    expect(moveShare(l, 'h2h4')).toBe(0);
    expect([0.6, 0.3, 0.1, 0.01].map(difficultyOf)).toEqual(['easy', 'moderate', 'hard', 'veryHard']);
    expect(shareText(0.34)).toBe('about 35%');
    expect(shareText(0.004)).toBe('fewer than 1 in 50');
    const s = difficultySentence({ bestSan: 'Nxe5', bestShare: 0.12, playedSan: 'Qd2', playedShare: 0.3, rating: 1200, isUser: true, same: false });
    expect(s[0]).toBe('Nxe5: about 10% of players around 1200 find it — hard to find.');
    expect(s[1]).toBe('Qd2 (your move): about 30% of players around 1200 would play it.');
    expect(s[2]).toMatch(/most players at your level miss it too/);
  });
});
