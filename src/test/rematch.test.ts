import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { appTc, canRematch, getRematchRecords, leavesBook, recordRematch, rematchInfo, rematchLabel, rematchMove } from '../lib/rematch';

const START = new Chess().fen();
const imp = (sans: string, userColor: 'w' | 'b', o: Record<string, unknown> = {}) =>
  ({ source: 'chess.com', opponentName: 'pawnstar22', userColor, startFen: START, plies: sans.split(' ').map((san) => ({ san })), ...o }) as never;
const fenAfter = (sans: string[]) => { const c = new Chess(); for (const s of sans) c.move(s); return c.fen(); };

describe('rematch a chess.com opponent', () => {
  it('learns their openings with that colour and where they usually leave theory', () => {
    const games = [
      imp('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 a3 a6', 'b'),
      imp('e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 h3 h6', 'b'),
      imp('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 h3 h6', 'b'),
      imp('d4 d5 c4 e6', 'w'), // they had Black here: not used for their White repertoire
      imp('e4 e5 Nf3 Nc6', 'b', { opponentName: 'someone_else' }),
    ];
    const r = rematchInfo(games, 'pawnstar22', 'w');
    expect(r.lines).toHaveLength(3);
    expect(r.bookPlies).toBeGreaterThanOrEqual(6);
    expect(leavesBook('e4 e5 Nf3 Nc6 Bc4 Bc5'.split(' '))).toBe(6);
  });

  it('plays their moves by frequency while the game follows their games, then stops', () => {
    const r = { name: 'pawnstar22', lines: [['e4', 'e5', 'Nf3'], ['e4', 'e5', 'Nf3'], ['e4', 'c5', 'Nf3'], ['d4', 'd5', 'c4']], bookPlies: 6 };
    let e4 = 0;
    for (let i = 0; i < 100; i++) if (rematchMove(r, [], START, () => (i + 0.5) / 100) === 'e2e4') e4++;
    expect(e4).toBe(75);
    expect(rematchMove(r, ['e4', 'e5'], fenAfter(['e4', 'e5']), () => 0.1)).toBe('g1f3');
    // Out of their games, or past where they usually leave theory: normal play takes over.
    expect(rematchMove(r, ['e4', 'd5'], fenAfter(['e4', 'd5']), () => 0.1)).toBeNull();
    expect(rematchMove({ ...r, bookPlies: 2 }, ['e4', 'e5'], fenAfter(['e4', 'e5']), () => 0.1)).toBeNull();
  });

  it('offers a rematch on lost chess.com games with a clock, labelled as a stand-in', () => {
    expect(canRematch({ source: 'chess.com', userResult: 'loss', timeControl: '600', opponentName: 'x' } as never)).toBe(true);
    expect(canRematch({ source: 'chess.com', userResult: 'win', timeControl: '600', opponentName: 'x' } as never)).toBe(false);
    expect(canRematch({ source: 'chess.com', userResult: 'loss', timeControl: 'daily', opponentName: 'x' } as never)).toBe(false);
    expect(appTc('600')).toBe('600+0');
    expect(appTc('180+2')).toBe('180+2');
    expect(rematchLabel('pawnstar22')).toBe('Rematch: pawnstar22 (stand-in)');
  });

  it('keeps results per opponent', async () => {
    await recordRematch('pawnstar22', 'loss');
    await recordRematch('pawnstar22', 'win');
    expect((await getRematchRecords()).pawnstar22).toMatchObject({ w: 1, d: 0, l: 1, last: 'win' });
  });
});
