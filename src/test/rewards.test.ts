import { describe, expect, it } from 'vitest';
import { specialMove, tacticsOfMove } from '../lib/rewards/career';
import { COSMETICS, cosmeticById, isUnlocked } from '../lib/rewards/cosmetics';
import { MILESTONES } from '../lib/rewards/rating';
import { CHALLENGES } from '../lib/people/challenges';
import { OPPONENTS } from '../lib/people';
import { ACHIEVEMENTS } from '../lib/progress/achievements';
import type { AnalysisResult } from '../lib/engine/types';

const analysis = (lines: [string, number][]): AnalysisResult =>
  ({ fen: '', depth: 12, bestMove: lines[0][0], lines: lines.map(([m, cp], i) => ({ multipv: i + 1, depth: 12, score: { type: 'cp', value: cp }, pv: [m] })) }) as unknown as AnalysisResult;

describe('career tactics', () => {
  it('counts a knight fork, and a royal fork', () => {
    // Nc7+ forks king e8 and rook a8.
    const t = tacticsOfMove('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7');
    expect(t.forks).toBe(1);
    // Nf6+ forks king g8 and queen e8? use: knight to c7 hitting king e8 and queen a8
    const r = tacticsOfMove('q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7');
    expect(r.royalForks).toBe(1);
  });
  it('recognises back-rank and smothered mates', () => {
    expect(tacticsOfMove('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'a1a8').backRankMates).toBe(1);
    const s = tacticsOfMove('6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', 'g5f7');
    expect(s.checkmates).toBe(1);
    expect(s.smotheredMates).toBe(1);
  });
});

describe('brilliant and great moves', () => {
  it('a sound sacrifice of the queen is brilliant', () => {
    // Qxh7+?? style: queen goes where a pawn can take it, but the engine says it's best and winning.
    const fen = '6k1/5ppp/8/8/8/8/1Q3PPP/3R2K1 w - - 0 1';
    const before = analysis([['b2g7', 300], ['d1d8', 250]]);
    const after = analysis([['f7g7', 400]]);
    // Not a real mate line: we only check the detector's rules (best + gives material + still good).
    expect(specialMove(fen, 'b2g7', before, after, true)).toBe('brilliant');
    expect(specialMove(fen, 'b2g7', before, after, false)).toBeNull();
  });
  it('the only good move is great', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const before = analysis([['f1b5', 30], ['d2d3', -250]]);
    expect(specialMove(fen, 'f1b5', before, analysis([['a7a6', 30]]), true)).toBe('great');
  });
});

describe('unlockables', () => {
  it('every reward points to a real item and ids are unique', () => {
    const ids = COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MILESTONES) expect(cosmeticById(m.reward), m.reward).toBeTruthy();
    for (const c of CHALLENGES) for (const r of c.rewards) expect(cosmeticById(r), r).toBeTruthy();
    for (const c of COSMETICS) if (c.unlock.kind === 'achievement') expect(ACHIEVEMENTS.some((a) => a.id === (c.unlock as { id: string }).id), c.id).toBe(true);
  });
  it('every opponent has a challenge, and free items are always unlocked', () => {
    for (const o of OPPONENTS) expect(CHALLENGES.some((c) => c.opponentId === o.id)).toBe(true);
    const ctx = { level: 1, peak: 450, achievements: {}, challenges: new Set<string>(), gold: 0 };
    expect(isUnlocked(cosmeticById('board-walnut')!, ctx)).toBe(true);
    expect(isUnlocked(cosmeticById('board-marble')!, ctx)).toBe(false);
    expect(isUnlocked(cosmeticById('board-marble')!, { ...ctx, peak: 500 })).toBe(true);
  });
});
