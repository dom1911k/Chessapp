import { describe, expect, it } from 'vitest';
import {
  boardName, boardTotal, BOARD_TOTALS, drawPrompt, ladderStartFor, ladderTarget, levelAt, levelCosts, newPathState, nextPuzzleSpec,
  PATH_TOTAL, pathBehind, pointsAtLevel, prevDay, promptMix, scoreEvent, scorePuzzle, type PathState, type SolveInput,
} from '../lib/puzzles/path';

const DAY = '2026-11-23';
// A puzzle rated exactly at the target is Medium.
const base = (s: PathState, over: Partial<SolveInput> = {}): SolveInput => ({
  source: 'full', success: true, hintsUsed: 0, correctMoves: 1, seconds: 9, userMoves: 1, ratingAfter: 800,
  puzzleRating: ladderTarget(s.ladderStart, levelAt(s.points), over.setting ?? 'standard', s.ease), promptLevel: 3, today: DAY, ...over,
});
const fresh = (over: Partial<PathState> = {}): PathState => ({ ...newPathState(null), ...over });
/** Points at the start of a board (level 1). */
const at = (board: number, level = 1) => pointsAtLevel(board, level);
const sum = (parts: { points: number }[]) => parts.reduce((a, p) => a + p.points, 0);

describe('boards and levels', () => {
  it('totals and costs add up', () => {
    expect(PATH_TOTAL).toBe(455000);
    BOARD_TOTALS.forEach((t, b) => expect(boardTotal(b)).toBe(t));
    expect(levelCosts(0)[0]).toBe(110);
    expect(levelCosts(0)[19]).toBe(190);
    expect(levelCosts(1)[0]).toBe(410);
    expect(levelCosts(7)[0]).toBe(4690);
    expect(levelCosts(7)[19]).toBe(7810);
  });
  it('levelAt boundaries', () => {
    expect(levelAt(109)).toMatchObject({ board: 0, level: 1, into: 109, cost: 110 });
    expect(levelAt(110)).toMatchObject({ board: 0, level: 2, into: 0 });
    expect(levelAt(3000)).toMatchObject({ board: 1, level: 1, into: 0 });
    expect(levelAt(PATH_TOTAL)).toMatchObject({ board: 8, tier: 7, level: 1 });
  });
  it('Legend II and on: Legend rewards, costs ×1.25', () => {
    expect(boardName(8)).toBe('Legend II');
    expect(boardName(9)).toBe('Legend III');
    expect(boardTotal(8)).toBe(156250);
    expect(levelCosts(8).reduce((a, b) => a + b, 0)).toBe(156250);
  });
});

describe('scoring a clean solve', () => {
  it('Wood, medium, 1 move, 9 s → 12 + 4', () => {
    const s = fresh();
    const { award } = scorePuzzle(s, base(s));
    expect(award.parts.map((p) => [p.kind, p.points])).toEqual([['base', 12], ['speed', 4]]);
    expect(award.total).toBe(16);
  });
  it('streak parts', () => {
    let s = fresh({ streak: 2 });
    expect(scorePuzzle(s, base(s)).award.parts.find((p) => p.kind === 'streak')).toMatchObject({ points: 2, label: 'Streak ×3' });
    s = fresh({ points: at(1), streak: 9 });
    expect(scorePuzzle(s, base(s)).award.parts.find((p) => p.kind === 'streak')?.points).toBe(11);
    s = fresh({ points: at(7), streak: 19, bestStreak: 40 });
    expect(scorePuzzle(s, base(s)).award.parts.find((p) => p.kind === 'streak')?.points).toBe(39);
  });
  it('clues, setting and speed', () => {
    let s = fresh({ points: at(4) });
    expect(scorePuzzle(s, base(s, { promptLevel: 0 })).award.parts.find((p) => p.kind === 'clues')).toMatchObject({ label: 'No clues', points: 8 });
    s = fresh();
    expect(scorePuzzle(s, base(s, { setting: 'hard' })).award.parts[0].points).toBe(16);
    expect(scorePuzzle(s, base(s, { seconds: 3 })).award.parts[1]).toMatchObject({ label: 'Lightning', points: 7 });
    expect(scorePuzzle(s, base(s, { seconds: 60 })).award.parts[1].points).toBe(1);
  });
  it('bands are relative to the target', () => {
    const s = fresh();
    const t = ladderTarget(s.ladderStart, levelAt(0));
    expect(scorePuzzle(s, base(s, { puzzleRating: t - 150 })).award.parts[0]).toMatchObject({ label: 'Easy', points: 8 });
    expect(scorePuzzle(s, base(s, { puzzleRating: t + 200 })).award.parts[0]).toMatchObject({ label: 'Hard', points: 16 });
    expect(scorePuzzle(s, base(s, { puzzleRating: t + 300 })).award.parts[0]).toMatchObject({ label: 'Expert', points: 22 });
  });
});

describe('moments', () => {
  const solveN = (s: PathState, n: number, day = DAY) => {
    const awards = [];
    for (let i = 0; i < n; i++) {
      const r = scorePuzzle(s, base(s, { today: day }));
      s = r.state;
      awards.push(r.award);
    }
    return { s, awards };
  };
  it('Daily Solver on the 3rd clean solve, once; Daily Ten on the 10th; both reset the next day', () => {
    const { s, awards } = solveN(fresh(), 10);
    expect(awards.map((a) => a.moments.map((m) => m.kind).join())).toEqual(['', '', 'daily3', '', '', '', '', '', '', 'daily10']);
    expect(awards[2].moments[0].points).toBe(60);
    const next = solveN(s, 3, '2026-11-24').awards;
    expect(next[2].moments[0].kind).toBe('daily3');
    const legend = solveN(fresh({ points: at(7) }), 3).awards;
    expect(legend[2].moments[0].points).toBe(165);
  });
  it('streak moments at 15, 30, 50, 100, 150 only', () => {
    const hits: number[] = [];
    let s = fresh({ bestStreak: 500, dailyCount: 50, dailyDay: DAY });
    for (let i = 1; i <= 160; i++) {
      const r = scorePuzzle(s, base(s));
      s = r.state;
      if (r.award.moments.some((m) => m.kind === 'streak')) hits.push(i);
    }
    expect(hits).toEqual([15, 30, 50, 100, 150]);
  });
  it('puzzles solved every 100th, ×5 at 1,000', () => {
    let r = scorePuzzle(fresh({ cleanSolved: 99, dailyCount: 50, dailyDay: DAY }), base(fresh()));
    expect(r.award.moments).toEqual([{ kind: 'solved', n: 100, points: 50 }]);
    r = scorePuzzle(fresh({ cleanSolved: 999, dailyCount: 50, dailyDay: DAY }), base(fresh()));
    expect(r.award.moments[0].points).toBe(250);
  });
  it('perfect week on the 7th consecutive day, reset by a missed day', () => {
    let s = fresh();
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    let last;
    for (const d of days) ({ s, awards: last } = solveN(s, 3, d));
    expect(last!.at(-1)!.moments.map((m) => m.kind)).toEqual(['daily3', 'week']);
    expect(s.weekRun).toBe(0);
    // A gap: the run starts again at 1.
    s = fresh({ weekRun: 5, weekDay: '2026-11-01' });
    s = solveN(s, 3, '2026-11-03').s;
    expect(s.weekRun).toBe(1);
  });
  it('three at once: the two rarest stay moments, the third becomes a gold chip, total unchanged', () => {
    const s = fresh({ dailyDay: DAY, dailyCount: 2, weekRun: 6, weekDay: prevDay(DAY), cleanSolved: 99, streak: 14, bestStreak: 30 });
    const { award } = scorePuzzle(s, base(s));
    expect(award.moments.map((m) => m.kind)).toEqual(['solved', 'week']);
    expect(award.parts.filter((p) => p.gold).map((p) => p.label)).toContain('15 in a row');
    expect(award.parts.filter((p) => p.gold).map((p) => p.label)).toContain('Daily Solver');
    expect(award.total).toBe(sum(award.parts) + sum(award.moments));
  });
});

describe('hints, misses, records', () => {
  it('hint → correctMoves points, streak unchanged; fail → 0, streak 0, streakLost', () => {
    const s = fresh({ streak: 4 });
    const h = scorePuzzle(s, base(s, { hintsUsed: 1, correctMoves: 2 }));
    expect(h.award.parts).toEqual([{ kind: 'hint', label: 'Solved with a hint', points: 2 }]);
    expect(h.state.streak).toBe(4);
    const f = scorePuzzle(s, base(s, { success: false }));
    expect(f.award.total).toBe(0);
    expect(f.state.streak).toBe(0);
    expect(f.award.streakLost).toBe(4);
    expect(f.state.points).toBe(s.points);
  });
  it('new best streak from 5; hardest solved after 20 and by 50+; 50 hard puzzles', () => {
    let s = fresh({ streak: 3, bestStreak: 3 });
    expect(scorePuzzle(s, base(s)).award.parts.some((p) => p.kind === 'bestStreak')).toBe(false);
    s = fresh({ streak: 4, bestStreak: 4 });
    expect(scorePuzzle(s, base(s)).award.parts.find((p) => p.kind === 'bestStreak')?.points).toBe(25);
    s = fresh({ cleanSolved: 19, hardestSolved: 500 });
    expect(scorePuzzle(s, base(s)).award.parts.some((p) => p.kind === 'hardest')).toBe(false);
    // The Wood target is 650: beating 600 by 50 counts, 610 doesn't.
    s = fresh({ cleanSolved: 20, hardestSolved: 600 });
    expect(scorePuzzle(s, base(s)).award.parts.some((p) => p.kind === 'hardest')).toBe(true);
    s = fresh({ cleanSolved: 20, hardestSolved: 610 });
    expect(scorePuzzle(s, base(s)).award.parts.some((p) => p.kind === 'hardest')).toBe(false);
    s = fresh({ cleanSolved: 20, hardestSolved: 640 });
    expect(scorePuzzle(s, base(s)).award.parts.some((p) => p.kind === 'hardest')).toBe(false);
    s = fresh({ hardSolved: 49 });
    const t = ladderTarget(s.ladderStart, levelAt(0));
    expect(scorePuzzle(s, base(s, { puzzleRating: t + 200 })).award.parts.find((p) => p.kind === 'benchmark')?.points).toBe(50);
  });
  it("'full' without ratingAfter scores nothing", () => {
    const s = fresh();
    const r = scorePuzzle(s, base(s, { ratingAfter: undefined }));
    expect(r.award.total).toBe(0);
    expect(r.state.streak).toBe(0);
  });
  it('a board-up mid-puzzle uses the old board numbers; scoring never touches seen', () => {
    const s = fresh({ points: at(1) - 5, seen: 123 });
    const r = scorePuzzle(s, base(s));
    expect(r.award.parts[0].points).toBe(12);
    expect(r.award.boardUp).toBe(1);
    expect(r.award.levelsCrossed).toEqual([{ board: 1, level: 1 }]);
    expect(r.state.seen).toBe(123);
  });
});

describe('flat sources and events', () => {
  it('review, yours, Daily Puzzle once a day; training once a day; rush record', () => {
    const s = fresh({ points: at(1) });
    expect(scorePuzzle(s, base(s, { source: 'review' })).award.parts).toEqual([{ kind: 'flat', label: 'Review', points: 10 }]);
    expect(scorePuzzle(s, base(s, { source: 'yours' })).award.total).toBe(20);
    const d1 = scorePuzzle(s, base(s, { source: 'dailyPuzzle' }));
    expect(d1.award.total).toBe(30);
    expect(scorePuzzle(d1.state, base(s, { source: 'dailyPuzzle' })).award.total).toBe(0);
    expect(d1.state.streak).toBe(s.streak);
    const t1 = scoreEvent(s, { event: 'dailyTrainingDone', today: DAY });
    expect(t1.award.total).toBe(50);
    expect(scoreEvent(t1.state, { event: 'dailyTrainingDone', today: DAY }).award.total).toBe(0);
    expect(scoreEvent(s, { event: 'rushRecord', today: DAY }).award.total).toBe(65);
  });
});

describe('the ladder', () => {
  it('target from ladderStart to +500, clamped start, setting offsets, floor', () => {
    expect(ladderTarget(650, { board: 0, level: 1 })).toBe(650);
    expect(ladderTarget(650, { board: 7, level: 20 })).toBe(1150);
    expect(ladderStartFor(2000)).toBe(1100);
    expect(ladderStartFor(600)).toBe(500);
    expect(ladderStartFor(null)).toBe(650);
    expect(ladderTarget(650, { board: 0, level: 1 }, 'hard')).toBe(800);
    expect(ladderTarget(650, { board: 0, level: 1 }, 'extraHard')).toBe(950);
    expect(ladderTarget(500, { board: 0, level: 1 }, 'standard', -400)).toBe(400);
    expect(ladderTarget(650, { board: 9, level: 1 })).toBe(1200);
  });
  it('the start never changes after scoring', () => {
    let s = fresh({ ladderStart: 777 });
    for (let i = 0; i < 30; i++) s = scorePuzzle(s, base(s)).state;
    expect(s.ladderStart).toBe(777);
  });
  it('the spec window and puzzle length', () => {
    const s = fresh();
    const spec = nextPuzzleSpec(s, 'standard', () => 0.5);
    expect(spec.band).toBe('medium');
    expect(spec.window).toEqual([550, 750]);
    expect(spec.maxMoves).toBe(2);
    expect(nextPuzzleSpec(fresh({ points: at(3) }), 'standard', () => 0.5).maxMoves).toBe(99);
  });
});

describe('prompts', () => {
  it('the schedule moves linearly across a board', () => {
    const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]));
    close(promptMix({ board: 1, level: 1 }), [1, 0, 0, 0]);
    close(promptMix({ board: 1, level: 20 }), [0.3, 0.7, 0, 0]);
    const mid = promptMix({ board: 4, level: 10.5 });
    mid.forEach((v, i) => expect(v).toBeCloseTo([0, 0.1, 0.55, 0.35][i]));
    close(promptMix({ board: 4, level: 20 }), [0, 0, 0.5, 0.5]);
  });
  it('recovery brings clues back', () => {
    const champion = { board: 6, level: 20 };
    expect(drawPrompt(champion, 0, 0.5)).toBe(0);
    expect(drawPrompt(champion, -150, 0.5)).toBe(1);
    expect(drawPrompt(champion, -300, 0.5)).toBe(2);
    expect(drawPrompt({ board: 0, level: 1 }, -300, 0.5)).toBe(3);
  });
});

describe('recovery', () => {
  it('miss ×3 → −150, a clean solve → −138, hints reset the run, floor −400, points untouched', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = scorePuzzle(s, base(s, { success: false })).state;
    expect(s.ease).toBe(-150);
    const clean = scorePuzzle(s, base(s)).state;
    expect(clean.ease).toBe(-138);
    expect(clean.missesInARow).toBe(0);
    const hint = scorePuzzle(s, base(s, { hintsUsed: 1 })).state;
    expect(hint.ease).toBe(-150);
    expect(hint.missesInARow).toBe(0);
    for (let i = 0; i < 10; i++) s = scorePuzzle(s, base(s, { success: false })).state;
    expect(s.ease).toBe(-400);
    expect(s.points).toBe(0);
  });
});

describe('the green dot', () => {
  it('shows while the Path last showed an earlier level, not for points within the same level', () => {
    expect(pathBehind(0, 50)).toBe(false); // Wood 1 still (level 1 costs 110)
    expect(pathBehind(0, 110)).toBe(true); // Wood 2
    expect(pathBehind(pointsAtLevel(1, 1), pointsAtLevel(1, 1) + 5)).toBe(false);
    expect(pathBehind(2990, 3000)).toBe(true); // into Stone
    expect(pathBehind(3000, 2990)).toBe(false); // never behind when ahead
  });
});
