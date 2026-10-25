import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../lib/lessons/data';
import { taskSolutions } from '../lib/lessons/check';

describe('lessons', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: positions are legal and every task is solvable`, () => {
      for (const step of lesson.steps) {
        expect(() => new Chess(step.fen)).not.toThrow();
        if (!step.task) continue;
        const sols = taskSolutions(step.fen, step.task);
        expect(sols.length, `${lesson.id}: ${step.text.slice(0, 40)}`).toBeGreaterThan(0);
        if (step.task.kind === 'moves') expect(sols.sort(), step.fen).toEqual([...step.task.solutions].sort());
      }
    });
  }
  it('stalemate example is really stalemate; queen mate step has Qc7 as stalemate', () => {
    expect(new Chess('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1').isStalemate()).toBe(true);
    const c = new Chess('k7/8/1K6/8/8/8/8/2Q5 w - - 0 1');
    c.move('Qc7');
    expect(c.isStalemate()).toBe(true);
  });
});
