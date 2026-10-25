import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { DRILLS } from '../lib/endgames';
import { createNodeEngine } from '../lib/engine/node';
import { povScore } from '../lib/chess/evaluation';

describe('endgame drills', () => {
  it('every start position is legal and winning for the side to move', async () => {
    const e = createNodeEngine();
    for (const d of DRILLS) {
      for (const fen of d.fens) {
        const c = new Chess(fen);
        expect(c.isGameOver(), fen).toBe(false);
        const r = await e.analyze(fen, { depth: d.group === 'Rook & queen endings' ? 16 : 22 });
        const s = povScore(r.lines[0].score, c.turn());
        console.log(d.id, fen, JSON.stringify(s));
        // Long mates (rook, bishops) are beyond the lite engine's horizon, but must be clearly winning;
        // "hold" drills must be drawn with best play.
        const ok =
          d.goal === 'hold'
            ? s.type === 'cp' && Math.abs(s.value) < 150
            : s.type === 'mate' ? s.value > 0 && s.value <= d.maxMoves : s.value > 250;
        expect(ok, fen).toBe(true);
      }
    }
  }, 300000);
});
