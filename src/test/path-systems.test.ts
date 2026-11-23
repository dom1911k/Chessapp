import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, type Stats } from '../lib/progress/achievements';
import { TIERS, skillForThemes } from '../lib/rewards/skills';

describe('skills after a puzzle', () => {
  it('picks the first skill whose themes match the puzzle', () => {
    expect(skillForThemes(['middlegame', 'fork', 'short'])?.id).toBe('forks');
    expect(skillForThemes(['mateIn2', 'backRankMate'])?.id).toBe('backrank');
    expect(skillForThemes(['crushing', 'long'])).toBeUndefined();
  });
  it('names the tiers Solid, Strong, Mastered (Bronze and Silver are puzzle path boards now)', () => {
    expect(TIERS.map((t) => t.name)).toEqual(['Not started', 'Solid', 'Strong', 'Mastered']);
    expect(TIERS.map((t) => t.points)).toEqual([0, 10, 30, 75]);
  });
});

describe('path achievements', () => {
  const at = (pathBoard: number, pathBestStreak: number) => ({ pathBoard, pathBestStreak }) as unknown as Stats;
  const got = (s: Stats) => ACHIEVEMENTS.filter((a) => a.id.startsWith('path-') || a.id.startsWith('streak-')).filter((a) => a.check(s)).map((a) => a.id);
  it('unlocks by board reached and best streak', () => {
    expect(got(at(0, 14))).toEqual([]);
    expect(got(at(1, 15))).toEqual(['path-stone', 'streak-15']);
    expect(got(at(4, 30)).sort()).toEqual(['path-crystal', 'path-silver', 'path-stone', 'streak-15', 'streak-30']);
    expect(got(at(7, 0))).toContain('path-legend');
  });
});
