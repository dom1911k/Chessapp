// The puzzle progression you see while solving (chess.com style): puzzle levels cut from your
// rating, the difficulty of a puzzle for you, the Daily Solver award, and what Coach Sam says.
// Pure helpers; the screen keeps the state.

/** Each puzzle level spans this many rating points (level 8 = 800–899). */
export const LEVEL_SPAN = 100;

export interface PuzzleLevel {
  level: number;
  /** Rating points into the level, and the level's span. */
  into: number;
  span: number;
  /** Rating at which the next level starts. */
  next: number;
  /** 0..1 progress to the next level. */
  pct: number;
}

export function puzzleLevel(rating: number): PuzzleLevel {
  const level = Math.max(1, Math.floor(rating / LEVEL_SPAN));
  const start = level * LEVEL_SPAN;
  const into = Math.max(0, rating - start);
  return { level, into, span: LEVEL_SPAN, next: start + LEVEL_SPAN, pct: Math.min(1, into / LEVEL_SPAN) };
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

/** How hard a puzzle is for you, from its rating against yours. */
export function difficultyFor(puzzleRating: number, yourRating: number): Difficulty {
  const d = puzzleRating - yourRating;
  return d < -150 ? 'easy' : d < 100 ? 'medium' : d < 300 ? 'hard' : 'expert';
}

/** Solve this many rated puzzles in a day for the Daily Solver award. */
export const DAILY_SOLVER_GOAL = 3;
export const DAILY_SOLVER_XP = 30;
export const dailySolverKey = (day: string) => `dailySolver:${day}`;

/** A bonus shown on the solved square after the rating change. */
export interface SolveTag {
  label: string;
  value: string;
  tone: 'gold' | 'sky' | 'orange';
}

export function solveTags(o: { ratingDelta: number | null; puzzleRating?: number; yourRating?: number; speedXp: number; streak: number; streakXp: number }): SolveTag[] {
  const tags: SolveTag[] = [];
  if (o.ratingDelta !== null) {
    const diff = o.puzzleRating && o.yourRating ? DIFFICULTY_LABEL[difficultyFor(o.puzzleRating, o.yourRating)] : 'Solved';
    tags.push({ label: diff, value: `${o.ratingDelta >= 0 ? '+' : ''}${o.ratingDelta}`, tone: 'gold' });
  }
  if (o.speedXp > 0) tags.push({ label: 'Speed', value: `+${o.speedXp}`, tone: 'sky' });
  if (o.streakXp > 0) tags.push({ label: `Streak ×${o.streak}`, value: `+${o.streakXp}`, tone: 'orange' });
  return tags;
}

const pick = <T,>(list: T[], seed: string): T => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

/** What Coach Sam says while you look for the move. */
export function solvePrompt(themes: string[], side: 'White' | 'Black', seed: string): string {
  const mate = themes.some((t) => /mate/i.test(t));
  const material = themes.some((t) => /hanging|fork|pin|skewer|discovered|capturingDefender|deflection|trapped/i.test(t));
  const lines = mate
    ? ['Do you see a way to get to my king?', 'My king is in trouble — find the finish.', 'There’s a checkmate here. Can you see it?']
    : material
      ? ['I just slipped. Can you make me pay for it?', 'Something of mine is loose — find it.', 'There’s a tactic here. Look at every capture and check.']
      : ['You have a great position here… now find the move that wins.', `Find the best move for ${side}.`, 'Take your time — the right move is there.'];
  return pick(lines, seed);
}

/** What Coach Sam says when you solve it. */
export function solvedPrompt(o: { clean: boolean; lightning: boolean; streak: number; seed: string }): string {
  if (!o.clean) return pick(['Solved — now you know the pattern.', 'Got there. Next time, no hints!'], o.seed);
  if (o.lightning) return pick(['Lightning fast!', 'You saw that instantly. Brilliant.', 'That was quick — great eyes.'], o.seed);
  if (o.streak >= 5) return pick(['Unstoppable!', 'Five in a row and counting!', 'You’re on fire — keep it rolling.'], o.seed);
  return pick(['Fantastic!', 'Excellent play! You solved it.', 'Clean and correct. Nice.', 'That’s the move. Well found!'], o.seed);
}
