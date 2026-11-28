import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

describe('round 8 · 1.5 your avatar on the pawn\'s tag', async () => {
  const { frameById, frameMid } = await import('../lib/avatars');
  const { ISO } = await import('../lib/puzzles/world');
  it("the tag's border takes the frame's middle colour (none: white)", () => {
    expect(frameMid(frameById('gold'))).toBe('#d19a16');
    expect(frameMid(frameById('none'))).toBe('');
    // A conic frame: its middle stop.
    expect(frameMid(frameById('cup'))).toBe('#fff3b8');
  });
  it('the tag holds your avatar, clipped to the square with an id per scene; the silhouette only without one', () => {
    const a = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'one', avatar: '/a07.webp', ring: '#d19a16' }).svg as string;
    const b = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'two', avatar: '/a07.webp' }).svg as string;
    expect(a).toContain('<image href="/a07.webp"');
    expect(a).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(a).toContain('clip-path="url(#onextagc)"');
    expect(b).toContain('clip-path="url(#twoxtagc)"');
    expect(a).toContain('fill="#d19a16"');
    expect(a).toContain('data-avatar="1"');
    const none = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'three' }).svg as string;
    expect(none).toContain('data-avatar="0"');
    expect(none).not.toContain('<image');
  });
  it('the tag sits centred over the pawn (no sideways offset)', () => {
    const svg = ISO.build(360, { b: 0, lvl: 3, w0: 0, w1: 1, uid: 'four', avatar: '/a.webp' }).svg as string;
    expect(svg).toMatch(/class="ptag" data-avatar="1" transform="translate\(0,-[\d.]+\)"/);
  });
});

describe('round 8 · 2.3 the first hint skips what the prompt already says', async () => {
  const { hintSteps } = await import('../lib/coach/hints');
  it('prompt level 2 or more (it names the motif): the piece, then the move', () => {
    expect(hintSteps(2)).toEqual([2, 3]);
    expect(hintSteps(3)).toEqual([2, 3]);
  });
  it('levels 0 and 1 (and no prompt level) keep all three: the idea, the piece, the move', () => {
    expect(hintSteps(0)).toEqual([1, 2, 3]);
    expect(hintSteps(1)).toEqual([1, 2, 3]);
    expect(hintSteps(undefined)).toEqual([1, 2, 3]);
  });
});

describe('round 8 · 4.5 each board keeps its own numbers', async () => {
  const P = await import('../lib/puzzles/path');
  const solve = (o: Partial<Parameters<typeof P.scorePuzzle>[1]> = {}) => ({ source: 'full' as const, success: true, hintsUsed: 0, correctMoves: 2, seconds: 8, userMoves: 2, puzzleRating: 800, ratingBefore: 800, ratingAfter: 812, promptLevel: 3 as const, today: '2026-11-20', ...o });
  it('a clean solve counts on the current board and its best streak follows the streak; misses and hints do not', () => {
    let s = P.newPathState(800);
    s = P.scorePuzzle(s, solve()).state;
    expect(s.boards[0]).toEqual({ start: '2026-11-20', solved: 1, bestStreak: 1 });
    s = P.scorePuzzle(s, solve()).state;
    s = P.scorePuzzle(s, solve({ success: false })).state;
    s = P.scorePuzzle(s, solve({ hintsUsed: 1 })).state;
    s = P.scorePuzzle(s, solve()).state;
    expect(s.boards[0].solved).toBe(3);
    expect(s.boards[0].solved).toBe(s.cleanSolved);
    expect(s.boards[0].bestStreak).toBe(2);
  });
  it('crossing into a new board finishes the old one today and starts the new one today', () => {
    const s0 = { ...P.newPathState(800), points: P.pointsAtLevel(1, 1) - 5, boards: [{ start: '2026-10-01', solved: 180, bestStreak: 14 }] };
    const { state, award } = P.scorePuzzle(s0, solve({ today: '2026-11-27' }));
    expect(award.boardUp).toBe(1);
    expect(state.boards[0]).toEqual({ start: '2026-10-01', done: '2026-11-27', solved: 181, bestStreak: 14 });
    expect(state.boards[1]).toEqual({ start: '2026-11-27', solved: 0, bestStreak: 0 });
    expect(P.boardStats(state.boards[0])).toEqual({ done: '2026-11-27', days: 58, puzzles: 181, bestStreak: 14 });
    // Daily training's bonus can cross a board too.
    const e = P.scoreEvent({ ...s0, points: P.pointsAtLevel(1, 1) - 1 }, { event: 'dailyTrainingDone', today: '2026-11-28' }).state;
    expect(e.boards[0].done).toBe('2026-11-28');
    expect(e.boards[1].start).toBe('2026-11-28');
  });
  it('migration, still on Wood: Wood takes your clean solves and best streak, from your first puzzle', () => {
    const old = { ...P.newPathState(800), points: P.pointsAtLevel(0, 9), cleanSolved: 57, bestStreak: 9 } as Partial<ReturnType<typeof P.newPathState>>;
    delete old.boards;
    expect(P.migrateBoards(old as never, '2026-09-14', '2026-11-27')).toEqual([{ start: '2026-09-14', solved: 57, bestStreak: 9 }]);
  });
  it('migration, on a later board: it counts from today; the boards behind show "Finished" with no numbers', () => {
    const old = { ...P.newPathState(800), points: P.pointsAtLevel(2, 4), cleanSolved: 400, bestStreak: 22 } as Partial<ReturnType<typeof P.newPathState>>;
    delete old.boards;
    const b = P.migrateBoards(old as never, '2026-06-01', '2026-11-27');
    expect(b).toEqual([{ start: '', done: '', solved: 0, bestStreak: 0 }, { start: '', done: '', solved: 0, bestStreak: 0 }, { start: '2026-11-27', solved: 0, bestStreak: 0 }]);
    expect(P.boardStats(b[0])).toBeNull();
  });
});

describe('round 8 · 4.2 / 4.5 the trophy', async () => {
  const { trophyMarkup } = await import('../lib/puzzles/art');
  const { boardName } = await import('../lib/puzzles/path');
  const { ISO } = await import('../lib/puzzles/world');
  it("its ribbon carries the board's name in caps (Legend II and on too)", () => {
    expect(trophyMarkup(0, boardName(0), ISO.TH[0], 'x')).toContain('>WOOD</text>');
    expect(trophyMarkup(7, boardName(8), ISO.TH[7], 'y')).toContain('>LEGEND II</text>');
    expect(trophyMarkup(7, boardName(9), ISO.TH[7], 'z')).toContain('>LEGEND III</text>');
  });
  it('every finished board in view keeps its trophy beside its level 20, never on the path', () => {
    const svg = ISO.build(360, { b: 2, lvl: 4, w0: 0, w1: 3, uid: 'tw' }).svg as string;
    expect(svg).toContain('class="trophy" data-board="0"');
    expect(svg).toContain('class="trophy" data-board="1"');
    expect(svg).not.toContain('data-board="2"');
    for (const w of [0, 1, 2]) {
      const c = ISO.trophyCell(w);
      const onPath = ISO.CELLS.some((x: { gx: number; gy: number }) => x.gx === c.gx && x.gy === c.gy);
      expect(onPath).toBe(false);
    }
  });
});

describe('round 8 · 4.5 the trophy stands clear', async () => {
  const { ISO } = await import('../lib/puzzles/world');
  it("on the opposite side from the path's last step, away from the next board's first tiles", () => {
    for (const w of [0, 1, 2, 3, 4, 5, 6]) {
      const at = (c: { gx: number; gy: number }) => ({ X: c.gx - c.gy, Y: c.gx + c.gy });
      const t = at(ISO.trophyCell(w));
      const c19 = at(ISO.cell(w, 19));
      const c18 = at(ISO.cell(w, 18));
      const lastRight = c19.X > c18.X;
      expect(Math.sign(t.X - c19.X)).toBe(lastRight ? -1 : 1);
      // The next board's first three tiles aren't in the trophy's column (it's ~2 tiles tall).
      for (const i of [0, 1, 2]) {
        const n = at(ISO.cell(w + 1, i));
        expect(Math.abs(n.X - t.X) >= 2 || n.Y - t.Y > 4).toBe(true);
      }
    }
  });
});
