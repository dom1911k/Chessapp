import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { TRAPS, trapCard, trapFen, trapForLoss, trapsInGame, trapStats, sanToUci, shortLoss } from '../lib/traps';
import { troubleSpot, usualLine, whatYouFace } from '../lib/face';
import { START_FEN } from '../lib/chess/game';
import type { AnyGame, PlyRecord } from '../lib/store/types';
import type { Color } from '../lib/chess/pos';

/** A game from SAN moves, from my side. */
function game(sans: string[], me: Color, over: Partial<AnyGame> = {}, mark: Record<number, Partial<PlyRecord>> = {}): AnyGame {
  const c = new Chess();
  const plies: PlyRecord[] = sans.map((s, i) => {
    const before = c.fen();
    const m = c.move(s);
    return { uci: m.lan, san: m.san, color: m.color as Color, fenBefore: before, fenAfter: c.fen(), isUser: m.color === me, ...mark[i] };
  });
  return {
    id: `cc:${sans.join('')}:${Math.random()}`,
    source: 'chess.com',
    analyzed: true,
    userColor: me,
    elo: 700,
    startFen: START_FEN,
    startedAt: 0,
    endedAt: 1,
    plies,
    takebacks: 0,
    hintsUsed: 0,
    told: [],
    result: '1-0',
    reason: 'checkmate',
    userResult: 'loss',
    summary: { accuracy: 0, counts: { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }, biggestMistakePly: null },
    ...over,
  } as AnyGame;
}

describe('traps library', () => {
  it('has about 15 traps whose lines are legal, with the victim to move at the critical moment', () => {
    expect(TRAPS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(TRAPS.map((t) => t.id)).size).toBe(TRAPS.length);
    for (const t of TRAPS) {
      const c = new Chess();
      for (const s of t.line) expect(() => c.move(s), `${t.id}: ${s}`).not.toThrow();
      const fen = trapFen(t);
      expect(fen.split(' ')[1], t.id).toBe(t.victim);
      expect(t.critical).toBeLessThan(t.line.length);
      for (const g of t.good) expect(() => sanToUci(fen, g), `${t.id} good ${g}`).not.toThrow();
      expect(t.good).not.toContain(t.line[t.critical]);
      expect(t.text.length).toBeGreaterThanOrEqual(2);
    }
    // The mating traps really end in mate.
    for (const id of ['scholar', 'legal', 'caro-smothered', 'kieninger', 'stafford', 'blackburne', 'englund']) {
      const t = TRAPS.find((x) => x.id === id)!;
      const c = new Chess();
      t.line.forEach((s) => c.move(s));
      expect(c.isCheckmate(), id).toBe(true);
    }
  });
  it('spots traps in my games: faced, fell for it, or set them myself (also by transposition)', () => {
    const scholar = TRAPS.find((t) => t.id === 'scholar')!;
    const fell = game(scholar.line, 'b');
    expect(trapsInGame(fell)).toEqual([{ trapId: 'scholar', role: 'faced', fell: true, gameId: fell.id }]);
    const held = game([...scholar.line.slice(0, 5), 'g6'], 'b', { userResult: 'win' });
    expect(trapsInGame(held)[0]).toMatchObject({ trapId: 'scholar', role: 'faced', fell: false });
    const set = game(scholar.line, 'w', { userResult: 'win' });
    expect(trapsInGame(set)[0].role).toBe('set');
    // Same position, other move order: 1.e4 e5 2.Qh5 Nc6 3.Bc4.
    const trans = game(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], 'b');
    expect(trapsInGame(trans)[0]).toMatchObject({ trapId: 'scholar', fell: true });
    expect(trapStats([fell, held, set, trans]).scholar).toEqual({ faced: 3, fell: 2, set: 1 });
  });
  it('links a quick loss to its trap and makes a review card for it', () => {
    const legal = TRAPS.find((t) => t.id === 'legal')!;
    const g = game(legal.line, 'b');
    expect(shortLoss(g)).toBe(true);
    expect(trapForLoss(g)?.id).toBe('legal');
    // A long loss, a win, or an unrelated quick loss: no trap.
    expect(trapForLoss({ ...g, userResult: 'win' })).toBeNull();
    expect(trapForLoss(game(['d4', 'd5', 'Bf4', 'Nf6', 'e3'], 'b'))).toBeNull();
    // Following a trap's line for a while (but not reaching its critical position) still counts.
    const fried = TRAPS.find((t) => t.id === 'fried-liver')!;
    expect(trapForLoss(game(fried.line.slice(0, 7), 'b'))?.id).toBe('fried-liver');
    // Left the line early, or lost on time: not the trap.
    const twoKnights = game(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'O-O', 'd6', 'Bg5', 'h6', 'Bxf6', 'Qxf6', 'Nc3', 'O-O', 'Nd5', 'Qd8', 'c3', 'a6'], 'w');
    expect(trapForLoss(twoKnights)).toBeNull();
    expect(trapForLoss({ ...g, reason: 'time' })).toBeNull();
    const card = trapCard(legal, 1000);
    expect(card).toMatchObject({ id: 't:legal', kind: 'mistake', trapId: 'legal', fen: trapFen(legal), solution: [sanToUci(trapFen(legal), 'dxe5')], playedSan: 'Bxd1' });
    expect(card.label).toBe("Trap: Légal's Mate");
  });
});

describe('what you face', () => {
  it('the usual line follows the common moves until games split', () => {
    const gs = [
      game(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], 'b'),
      game(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 'b'),
      game(['e4', 'e5', 'Nf3', 'Nc6', 'd4'], 'b'),
      game(['e4', 'e5', 'Nf3', 'd6'], 'b'),
    ];
    expect(usualLine(gs)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });
  it('groups my openings by colour with my score, line and trouble spot', () => {
    const bad = { classification: 'mistake' as const, comment: { bestSan: 'g6' } as PlyRecord['comment'] };
    const gs = [
      game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'], 'b', {}, { 5: bad }),
      game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'], 'b', {}, { 5: bad }),
      game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'g6'], 'b', { userResult: 'win' }),
      game(['d4', 'd5', 'c4'], 'w', { userResult: 'draw' }),
      game(['d4', 'd5', 'c4'], 'w', { userResult: 'win' }),
      // App games don't count.
      { ...game(['e4', 'e5', 'Bc4'], 'b'), source: undefined },
    ];
    const list = whatYouFace(gs);
    const black = list.find((o) => o.color === 'b')!;
    expect(black.games).toBe(3);
    expect(black.score).toBe(33);
    // Two of the three games went on with ...Nf6 (half or more): the line keeps going.
    expect(black.line).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
    expect(black.trouble).toMatchObject({ ply: 5, played: 'Nf6', better: 'g6', times: 2 });
    const white = list.find((o) => o.color === 'w')!;
    expect(white).toMatchObject({ games: 2, score: 75, w: 1, d: 1, l: 0 });
    // A single slip isn't a "trouble spot".
    expect(troubleSpot([gs[0]])).toBeUndefined();
  });
});
