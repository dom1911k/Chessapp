import { beforeAll, describe, expect, it } from 'vitest';
import { createNodeEngine } from '../lib/engine/node';
import { explainKeyMove, explainMove, getHint, safetyInfo } from '../lib/coach';
import { tryMove } from '../lib/chess/game';
import type { UciEngine } from '../lib/engine/uci';

let engine: UciEngine;
beforeAll(() => {
  engine = createNodeEngine();
});

async function coach(fen: string, uci: string, history?: string[]) {
  const before = await engine.analyze(fen, { depth: 12, multipv: 3 });
  const after = tryMove(fen, uci)!;
  const afterA = await engine.analyze(after.fen, { depth: 12 });
  const c = explainMove({ fenBefore: fen, uci, before, after: afterA, history });
  console.log(uci, c.classification, c.ruleIds, '\n  ' + c.text.join('\n  '));
  return c;
}

describe('coach', () => {
  it('queen hung to a knight', async () => {
    const c = await coach('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', 'd8g5');
    expect(c.classification).toBe('blunder');
    expect(c.ruleIds[0]).toBe('hangs-moved-piece');
    expect(c.text[0]).toMatch(/queen/);
  }, 60000);

  it('allows a back-rank mate', async () => {
    const c = await coach('r5k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1', 'b1b7');
    expect(c.ruleIds[0]).toBe('allows-mate');
    expect(c.themes).toContain('backRankMate');
  }, 60000);

  it('missed mate in one', async () => {
    const c = await coach('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'g1f1');
    expect(c.ruleIds).toContain('missed-mate');
    expect(c.text.join(' ')).toMatch(/Ra8/);
  }, 60000);

  it('bad trade: queen takes a defended pawn', async () => {
    const c = await coach('rnbqkbnr/ppp2ppp/4p3/3p4/8/8/PPP2PPP/RNBQKBNR w KQkq - 0 4', 'd1d5');
    expect(['mistake', 'blunder']).toContain(c.classification);
    expect(c.ruleIds[0]).toBe('bad-trade');
  }, 60000);

  it('allows a knight fork', async () => {
    const c = await coach('r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4', 'a7a6');
    expect(['mistake', 'blunder']).toContain(c.classification);
  }, 60000);

  it('missed a free piece', async () => {
    // Black knight on e5 hangs; White plays a quiet move instead of Nxe5.
    const c = await coach('rnbqkb1r/pppppppp/8/4n3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 3', 'a2a3');
    expect(c.ruleIds).toContain('missed-free-capture');
  }, 60000);

  it('opening principle: early flank pawn', async () => {
    const c = await coach('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'h2h4', []);
    console.log(c);
  }, 60000);

  it('puzzle key move explanation (fork)', () => {
    // White Nc7+ forks king e8 and rook a8.
    const fen = 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
    const c = explainKeyMove(fen, 'd5c7', ['d5c7', 'e8d7', 'c7a8']);
    console.log(c.text);
    expect(c.themes).toContain('fork');
  });

  it('hint and safety', async () => {
    const fen = 'rnbqkb1r/pppppppp/8/4n3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 3';
    const a = await engine.analyze(fen, { depth: 10 });
    expect(getHint(fen, a.lines[0].pv, 1)!.text).toMatch(/undefended/);
    const s = safetyInfo('rnbqkb1r/pppppppp/8/4n3/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 0 3', 'b');
    expect(s.highlights.some((h) => h.sq === 'e5' && h.tone === 'bad')).toBe(true);
  }, 60000);
});
