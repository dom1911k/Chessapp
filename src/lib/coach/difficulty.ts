// How hard a move was to find for a human at a given rating, from Maia's move probabilities
// (a network trained on millions of human games). Pure helpers; the screen fetches the logits.

/** Share (0..1) of players Maia expects to play `uci`, from its logits (softmax, temperature 1). */
export function moveShare(logits: Map<string, number>, uci: string): number {
  if (!logits.size || !logits.has(uci)) return 0;
  const max = Math.max(...logits.values());
  let sum = 0;
  for (const v of logits.values()) sum += Math.exp(v - max);
  return Math.exp(logits.get(uci)! - max) / sum;
}

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'veryHard';
export function difficultyOf(share: number): Difficulty {
  return share >= 0.5 ? 'easy' : share >= 0.2 ? 'moderate' : share >= 0.06 ? 'hard' : 'veryHard';
}
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy to find', moderate: 'Findable', hard: 'Hard to find', veryHard: 'Very hard to find' };

/** "about 34%", "fewer than 1 in 50" — rounded the way people read odds. */
export function shareText(share: number): string {
  if (share < 0.02) return 'fewer than 1 in 50';
  if (share < 0.1) return `about ${Math.round(share * 100)}%`;
  return `about ${Math.round(share * 20) * 5}%`;
}

/** The verdict sentence for the best move (and the played one, when different). */
export function difficultySentence(o: { bestSan: string; bestShare: number; playedSan: string; playedShare: number; rating: number; isUser: boolean; same: boolean }): string[] {
  const at = `players around ${o.rating}`;
  const out = [`${o.bestSan}: ${shareText(o.bestShare)} of ${at} find it — ${DIFFICULTY_LABEL[difficultyOf(o.bestShare)].toLowerCase()}.`];
  if (!o.same) out.push(`${o.playedSan}${o.isUser ? ' (your move)' : ' (their move)'}: ${shareText(o.playedShare)} of ${at} would play it.`);
  const d = difficultyOf(o.bestShare);
  if (o.isUser && !o.same)
    out.push(
      d === 'easy' || d === 'moderate'
        ? 'Most players at your level find the right move here — this one is worth drilling.'
        : 'A tough one: most players at your level miss it too. Learn the pattern, but don’t be hard on yourself.',
    );
  return out;
}
