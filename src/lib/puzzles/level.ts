// Small puzzle helpers: how hard a puzzle is for you, and what Coach Sam says while you solve it.
// (Levels come from the puzzle path now: see path.ts.)

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

/** How hard a puzzle is for you, from its rating against yours. */
export function difficultyFor(puzzleRating: number, yourRating: number): Difficulty {
  const d = puzzleRating - yourRating;
  return d < -150 ? 'easy' : d < 100 ? 'medium' : d < 300 ? 'hard' : 'expert';
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
