import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { CURRICULUM_LESSONS } from '../lib/lessons/curriculum';
import { ALL_LESSONS } from '../lib/lessons/data';
import { taskSolutions } from '../lib/lessons/check';
import { MODEL_GAMES, guessStars, modelPlies } from '../lib/lessons/games';

describe('curriculum lessons', () => {
  it('has unique ids and enough lessons', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CURRICULUM_LESSONS.length).toBeGreaterThanOrEqual(60);
  });
  for (const l of CURRICULUM_LESSONS)
    it(`${l.id}: positions are legal, tasks solvable, quizzes well-formed`, () => {
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of l.steps) {
        expect(() => new Chess(s.fen), s.fen).not.toThrow();
        expect(!(s.task && s.quiz)).toBe(true);
        if (s.task) {
          expect(taskSolutions(s.fen, s.task).length, s.text).toBeGreaterThan(0);
          expect(s.hint && s.success, s.text).toBeTruthy();
        }
        if (s.quiz) {
          expect(s.quiz.options.length).toBeGreaterThanOrEqual(2);
          expect(s.quiz.answer).toBeLessThan(s.quiz.options.length);
          expect(s.quiz.explain.length).toBeGreaterThan(20);
        }
        for (const a of s.arrows ?? []) expect(a.from + a.to).toMatch(/^[a-h][1-8][a-h][1-8]$/);
      }
    });
});

describe('model games', () => {
  for (const g of MODEL_GAMES)
    it(`${g.id}: every move is legal and the guesses are the hero's moves`, () => {
      const plies = modelPlies(g);
      expect(plies.length).toBeGreaterThan(15);
      for (const n of g.guess) {
        expect(n).toBeLessThanOrEqual(plies.length);
        expect(n % 2 === 1 ? 'w' : 'b', `${g.id} ply ${n}`).toBe(g.hero);
      }
      for (const n of Object.keys(g.notes)) expect(Number(n)).toBeLessThanOrEqual(plies.length);
    });
  it('the mating games end in checkmate', () => {
    for (const id of ['opera', 'greco', 'reti', 'lasker', 'immortal', 'century']) {
      const g = MODEL_GAMES.find((x) => x.id === id)!;
      const last = modelPlies(g).at(-1)!;
      expect(new Chess(last.fenAfter).isCheckmate(), id).toBe(true);
    }
  });
  it('scores a guess run in stars', () => {
    expect(guessStars(8, 8)).toBe(3);
    expect(guessStars(5, 8)).toBe(2);
    expect(guessStars(3, 8)).toBe(1);
    expect(guessStars(0, 8)).toBe(0);
  });
});

import { CAUSE_LESSON, CHAPTERS, PLACEMENT, STAGES, chapterOpen, currentStage, placementStage, stageProgress, type CourseState } from '../lib/course';
import { lessonById } from '../lib/lessons/data';
import { modelGameById } from '../lib/lessons/games';
import { DRILLS } from '../lib/endgames';
import { THEME_SETS } from '../lib/puzzles/themes';
import { INTERVALS, addDays, dueLessons, refreshSteps, reviewed, schedule } from '../lib/lessons/review';

describe('course structure', () => {
  const steps = CHAPTERS.flatMap((ch) => ch.steps);
  it('every step points at something that exists, with unique ids', () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    for (const s of steps) {
      if (s.kind === 'lesson') expect(lessonById(s.lessonId), s.lessonId).toBeTruthy();
      if (s.kind === 'model') expect(modelGameById(s.gameId), s.gameId).toBeTruthy();
      if (s.kind === 'drill') expect(DRILLS.some((d) => d.id === s.drillId), s.drillId).toBe(true);
      if (s.kind === 'puzzles') expect(THEME_SETS.some((t) => t.id === s.theme), s.theme).toBe(true);
    }
  });
  it('uses every curriculum lesson and model game, stages in order', () => {
    const used = new Set(steps.flatMap((s) => (s.kind === 'lesson' ? [s.lessonId] : [])));
    for (const l of CURRICULUM_LESSONS) expect(used.has(l.id), l.id).toBe(true);
    for (const g of MODEL_GAMES) expect(steps.some((s) => s.kind === 'model' && s.gameId === g.id), g.id).toBe(true);
    for (let i = 1; i < CHAPTERS.length; i++) expect(CHAPTERS[i].stage).toBeGreaterThanOrEqual(CHAPTERS[i - 1].stage);
    expect(CHAPTERS.at(-1)!.stage).toBe(STAGES.length - 1);
  });
  it('the placement check opens stages and its positions exist', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(placementStage)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 4]);
    for (const p of PLACEMENT) expect(lessonById(p.lessonId)?.steps[p.step]?.task, p.lessonId).toBeTruthy();
    const st: CourseState = { done: {}, puzzles: {}, chapters: {}, start: 2 };
    const firstOf = (stage: number) => CHAPTERS.findIndex((c) => c.stage === stage);
    expect(chapterOpen(firstOf(2), st)).toBe(true);
    expect(chapterOpen(firstOf(3), st)).toBe(false);
    expect(currentStage(st)).toBe(2);
    expect(stageProgress(0, st).done).toBe(0);
    for (const id of Object.values(CAUSE_LESSON)) expect(lessonById(id), id).toBeTruthy();
  });
});

describe('lesson refresh', () => {
  it('schedules, lengthens the gap after a clean run and resets after slips', () => {
    let book = schedule({}, 'forks', '2026-01-01');
    expect(book.forks).toEqual({ due: '2026-01-03', step: 0 });
    expect(schedule(book, 'forks', '2026-02-01')).toBe(book);
    expect(dueLessons(book, '2026-01-02')).toEqual([]);
    expect(dueLessons(book, '2026-01-03')).toEqual(['forks']);
    book = reviewed(book, 'forks', '2026-01-03', true);
    expect(book.forks).toEqual({ due: addDays('2026-01-03', INTERVALS[1]), step: 1 });
    book = reviewed(book, 'forks', '2026-01-08', false);
    expect(book.forks.step).toBe(0);
    expect(addDays('2026-01-30', 5)).toBe('2026-02-04');
  });
  it('a refresh shows only questions and exercises', () => {
    const l = lessonById('s2-discovered')!;
    expect(refreshSteps(l).every((s) => s.task || s.quiz)).toBe(true);
    expect(refreshSteps(l).length).toBeLessThan(l.steps.length);
  });
});

import { RANKS, courseLevel } from '../lib/course';
describe('course levels', () => {
  it('each chapter is a level; you stand on the first open, unfinished one', () => {
    const empty: CourseState = { done: {}, puzzles: {}, chapters: {}, start: 0 };
    expect(courseLevel(empty)).toMatchObject({ level: 1, stepsDone: 0, done: 0, total: CHAPTERS.length, finished: false });
    const done: Record<string, boolean> = {};
    for (const s of CHAPTERS[0].steps) done[s.id] = true;
    done[CHAPTERS[1].steps[0].id] = true;
    const st = { ...empty, done };
    expect(courseLevel(st)).toMatchObject({ level: 2, stepsDone: 1, done: 1 });
    // Placed at stage 3: you stand on that stage's first level.
    expect(courseLevel({ ...empty, start: 2 }).chapter.stage).toBe(2);
    const all: Record<string, boolean> = {};
    for (const ch of CHAPTERS) for (const s of ch.steps) all[s.id] = true;
    expect(courseLevel({ ...empty, done: all })).toMatchObject({ finished: true, done: CHAPTERS.length });
    expect(RANKS.length).toBe(STAGES.length);
  });
});
