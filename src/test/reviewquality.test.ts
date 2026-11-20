import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { floorClass, type Score } from '../lib/chess/evaluation';
import { keyMoments, reviewGame, slipCardLine, theirSlipLine } from '../lib/review';
import { cpLosses, gameRating, planWhy, repeatedTips, reviewNotes, verdictLine } from '../lib/reviewText';
import type { PlyRecord } from '../lib/store/types';

const cp = (value: number): Score => ({ type: 'cp', value });
const comment = (text: string[], ruleIds: string[], extra: object = {}) => ({ comment: { text, ruleIds, themes: [], arrows: [], highlights: [], ...extra }, isUser: true }) as unknown as Pick<PlyRecord, 'comment' | 'isUser'>;

function game(sans: string[], evals: number[], o: Record<string, unknown> = {}, extra: Record<number, object> = {}) {
  const c = new Chess();
  const plies = sans.map((san, i) => {
    const before = c.fen();
    const m = c.move(san);
    return { uci: m.lan, san: m.san, color: m.color, fenBefore: before, fenAfter: c.fen(), isUser: m.color === 'w', evalAfter: cp(evals[i]), ...extra[i] };
  });
  return { plies, userColor: 'w', startFen: new Chess().fen(), summary: { accuracy: 0, counts: {}, biggestMistakePly: null }, userResult: 'loss', reason: 'resignation', ...o } as never;
}
const sans = 'a3 h6 b3 g6 c3 f6 d3 e6 e3 d6 f3 c6 g3 b6 h3 a6'.split(' ');

describe('floor in decided positions', () => {
  it('engine noise between equally hopeless moves is not a mistake; a real collapse still is', () => {
    expect(floorClass(cp(-1500), cp(-1900))).toBeNull(); // 400 cp of noise, already lost
    expect(floorClass(cp(-1500), cp(-2600))).toBe('blunder'); // hanging a rook on top
    expect(floorClass(cp(-600), cp(-950))).toBe('mistake'); // still counts in a merely bad position
    expect(floorClass(cp(40), cp(-300))).toBe('mistake'); // level positions unchanged
  });
});

describe('verdict counts the slips that followed', () => {
  it('names the first big slip and how many followed', () => {
    const evals = [300, 320, 350, 340, 400, 380, 420, 410, 450, 430, -200, -210, -800, -800, -1600, -1600];
    const g = game(sans, evals);
    expect(verdictLine(g, reviewGame(g))).toMatch(/^You were winning until 6\. f3 — that slip in the (opening|middlegame) let them back, and (one more mistake followed|two more mistakes followed|it went downhill from there)\.$/);
  });
});

describe('key moments: opponent slips say what happened', () => {
  // 1. e4 e5 2. Nf3 Qg5?? (hangs the queen) 3. Nxg5 — and the version where you miss it.
  const line = (third: string, bestUci = 'f3g5') => {
    const c = new Chess();
    const ms = ['e4', 'e5', 'Nf3', 'Qg5', third];
    return ms.map((san, i) => {
      const before = c.fen();
      const m = c.move(san);
      return { uci: m.lan, san: m.san, color: m.color, fenBefore: before, fenAfter: c.fen(), isUser: m.color === 'w', evalAfter: cp([30, 30, 30, 900, i === 4 && third === 'Nxg5' ? 900 : 20][i]), comment: i === 4 ? { bestUci, bestSan: 'Nxg5', text: [], themes: [], ruleIds: [] } : undefined } as unknown as PlyRecord;
    });
  };
  it('punished: "hung the queen — you won it with Nxg5"', () => {
    expect(theirSlipLine(line('Nxg5'), 3, 'blunder')).toBe('2… Qg5 hung the queen — you won it with Nxg5.');
  });
  it('missed: "Nxg5 wins it, but you played d4"', () => {
    expect(theirSlipLine(line('d4'), 3, 'blunder')).toBe('2… Qg5 hung the queen — Nxg5 wins it, but you played d4.');
  });
  it('the key-moment card says it in a few words', () => {
    expect(slipCardLine(line('Nxg5'), 3)).toBe('You won the queen with Nxg5');
    expect(slipCardLine(line('d4'), 3)).toBe('Nxg5 wins the queen — missed');
  });
  it('your own key moment says what it allowed, then the better move', () => {
    const evals = [20, 20, 30, 20, -700, -700];
    const g = game(['e4', 'e5', 'Bc4', 'Nc6', 'Bxf7+', 'Kxf7'], evals, {}, { 4: { comment: { bestUci: 'g1f3', bestSan: 'Nf3', replyLine: ['e8f7'], text: [], themes: [], ruleIds: [] } } });
    const m = keyMoments((g as { plies: PlyRecord[] }).plies, reviewGame(g).plies).find((x) => x.ply === 4)!;
    expect(m.text).toBe('3. Bxf7+ was a blunder — it allowed Kxf7. Nf3 was the move.');
  });
});

describe('review notes: say each thing once', () => {
  it('a loose piece: the "Why" line replaces the hang sentence; the idea is shown as Best', () => {
    const p = comment(['Nothing defends your queen on h6, so they can simply take it.', 'Your queen on h5 needed help. You could move your queen to g5 to keep it safe.'], ['hangs-moved-piece', 'save-piece'], { bestSan: 'Qg5' });
    expect(reviewNotes(p, 'blunder', { cause: 'hungPiece', sq: 'h6' }, 'Your queen on h6 had no defender, and they attack it with the knight.')).toEqual([]);
  });
  it('a positional slip: no worded multi-move line, no repeat of Best', () => {
    const p = comment(['This lets them push their pawn to e5 (they push their pawn to e5, you push your pawn to f4, then they move their knight to c6) — from there they are much better.', 'Pushing your pawn to d4 would have been safer.'], ['strong-reply', 'engine-prefers'], { bestSan: 'd4' });
    expect(reviewNotes(p, 'mistake', null, null)).toEqual(['This lets them push their pawn to e5 — from there they are much better.']);
    expect(reviewNotes(p, 'mistake', { cause: 'plan' }, planWhy(50, 30))).toEqual([]); // the Why line and Best say it
  });
  it('quiet good moves: no filler praise, no opening nag on a best move; real praise stays', () => {
    expect(reviewNotes(comment(['Exactly right.'], ['praise-generic']), 'best')).toEqual([]);
    expect(reviewNotes(comment(['Your king is still in the middle. Castling soon tucks it away safely.'], ['no-castle']), 'best')).toEqual([]);
    expect(reviewNotes(comment(['Your king is still in the middle. Castling soon tucks it away safely.'], ['no-castle']), 'good')).toHaveLength(1);
    expect(reviewNotes(comment(['A clean fork.'], ['praise-tactic']), 'best')).toEqual(['A clean fork.']);
    expect(reviewNotes(comment(['A clean fork.'], ['praise-tactic']), 'best', null, null, { nice: true })).toEqual([]);
  });
});

describe('review notes: routine moves stay quiet, tips are said once', () => {
  it('retreating an attacked piece is not praised; "try X next time" never repeats Best', () => {
    expect(reviewNotes(comment(['Good — you got your bishop out of danger.'], ['praise-escape']), 'best')).toEqual([]);
    expect(reviewNotes(comment(['Try pushing your pawn to d4 next time — it keeps things a bit better.'], ['engine-prefers'], { bestSan: 'd4' }), 'inaccuracy')).toEqual([]);
  });
  it('a mate line spelled out in words is cut to the point (the SAN line is shown below)', () => {
    const p = comment(['This allows checkmate: they push their pawn to d5, you push your pawn to a3, they move their rook to c2 (check), then they move their bishop to f5 (check).'], ['allows-mate'], { bestSan: 'Kd3' });
    expect(reviewNotes(p, 'blunder', null, null)).toEqual(['This allows checkmate.']);
    const q = comment(["Here's the problem: they move their queen to d4, you push your pawn to f4, then they take your knight on c3. That costs you a knight."], ['loses-material'], { bestSan: 'Nd5' });
    expect(reviewNotes(q, 'mistake', null, null)).toEqual(['That costs you a knight.']);
  });
  it('an opening tip shows the first time only', () => {
    const tip = comment(['Think about castling — a king in the middle can get into trouble fast.'], ['no-castle']);
    const plies = [tip, { isUser: false }, tip, { isUser: false }, comment(['Out this early, your queen becomes a target.'], ['early-queen'])] as never;
    expect([...repeatedTips(plies)]).toEqual([2]);
    expect(reviewNotes(tip, 'good', null, null, { repeatTip: true })).toEqual([]);
  });
});

describe('game rating estimate', () => {
  it('maps average centipawn loss onto the human benchmark scale', () => {
    expect(gameRating(Array(20).fill(178))).toBe(200);
    expect(gameRating(Array(20).fill(72))).toBe(1200);
    expect(gameRating(Array(20).fill(52))).toBe(1800);
    expect(gameRating(Array(20).fill(5))).toBe(2000);
    expect(gameRating(Array(10).fill(72))).toBeNull(); // too few moves
    const a = gameRating(Array(20).fill(100))!;
    expect(a).toBeGreaterThan(600);
    expect(a).toBeLessThan(800);
  });
  it('counts each side’s losses, skipping book moves and decided positions', () => {
    const evals = [20, 30, -100, -90, -90, -1500, -1600, -1700];
    const g = game(sans.slice(0, 8), evals);
    const r = reviewGame(g);
    const mine = cpLosses(g, r, true);
    expect(mine).toContain(130); // 30 → -100 for White
    expect(cpLosses(g, r, false).every((x) => x >= 0)).toBe(true);
    expect(mine.length).toBeLessThan(4); // the move played at -1500 is skipped
  });
});

describe('mistake cause: the bigger loose piece wins', () => {
  it('a bishop was attacked, but the move walks the queen into a free capture: the queen is the story', async () => {
    const { mistakeCauses } = await import('../lib/games/causes');
    const fenBefore = '4k3/8/5n2/8/5p2/4B3/8/3QK3 w - - 0 30';
    const c0 = new Chess(fenBefore);
    const m = c0.move('Qg4');
    const ply = { uci: m.lan, san: m.san, color: 'w', fenBefore, fenAfter: c0.fen(), isUser: true, evalAfter: cp(-900), comment: { text: [], themes: [], ruleIds: [], bestUci: 'e3d4', bestSan: 'Bd4', replyLine: ['f6g4'] } };
    const [c] = mistakeCauses({ plies: [ply], userColor: 'w' } as never, ['blunder']);
    expect(c.cause).toBe('hungPiece');
    expect(c.sq).toBe('g4');
  });
  it('an even queen trade is not "hung the queen"', () => {
    // 32. Qg4 Qxg4+ 33. hxg4 — the trade drops the e3 bishop's defender; the queen itself was not free.
    const fenBefore = '2r3k1/p7/1p4qp/1b1p4/1n1P1p2/1Nr1BQ1P/P4P2/2RR2K1 w - - 0 32';
    const c0 = new Chess(fenBefore);
    const a = c0.move('Qg4');
    const fenA = c0.fen();
    const b = c0.move('Qxg4+');
    const ps = [
      { uci: a.lan, san: a.san, color: 'w', fenBefore, fenAfter: fenA, isUser: false, evalAfter: cp(-709) },
      { uci: b.lan, san: b.san, color: 'b', fenBefore: fenA, fenAfter: c0.fen(), isUser: true, evalAfter: cp(-700), comment: { text: [], themes: [], ruleIds: [], bestUci: 'g6g4', bestSan: 'Qxg4+' } },
    ] as unknown as PlyRecord[];
    expect(theirSlipLine(ps, 0, 'blunder')).toBe('32. Qg4 was a blunder — you punished it with Qxg4+.');
  });
});
