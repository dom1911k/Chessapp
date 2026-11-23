// What the coach says when a path puzzle opens, from its Lichess themes. Four levels that fade as
// you climb (path.ts decides which): 3 theme and length, 2 theme, 1 goal only, 0 no clues.
//   P3 "Find the checkmate in 2." / "Find the fork in 1 move."
//   P2 "Find the checkmate." / "Find the fork."
//   P1 "Checkmate." / "Win material." / "Defend." / "Get an advantage."
//   P0 nothing beyond "White to move."
import type { PromptLevel } from './path';

type Goal = 'Checkmate.' | 'Win material.' | 'Defend.' | 'Hold the balance.' | 'Get an advantage.' | 'Promote a pawn.';
/** Theme → how to name it ("the fork") and the goal it serves. First match wins. */
const THEMES: [string, string, Goal][] = [
  ['smotheredMate', 'the smothered mate', 'Checkmate.'],
  ['backRankMate', 'the back-rank checkmate', 'Checkmate.'],
  ['mateIn1', 'the checkmate', 'Checkmate.'],
  ['mateIn2', 'the checkmate', 'Checkmate.'],
  ['mateIn3', 'the checkmate', 'Checkmate.'],
  ['mateIn4', 'the checkmate', 'Checkmate.'],
  ['mateIn5', 'the checkmate', 'Checkmate.'],
  ['mate', 'the checkmate', 'Checkmate.'],
  ['equality', 'the saving move', 'Hold the balance.'],
  ['defensiveMove', 'the defence', 'Defend.'],
  ['promotion', 'the promotion', 'Promote a pawn.'],
  ['fork', 'the fork', 'Win material.'],
  ['pin', 'the pin', 'Win material.'],
  ['skewer', 'the skewer', 'Win material.'],
  ['discoveredAttack', 'the discovered attack', 'Win material.'],
  ['doubleCheck', 'the double check', 'Get an advantage.'],
  ['hangingPiece', 'the free piece', 'Win material.'],
  ['trappedPiece', 'the trapped piece', 'Win material.'],
  ['deflection', 'the deflection', 'Win material.'],
  ['attraction', 'the decoy', 'Win material.'],
  ['capturingDefender', 'the capture of the defender', 'Win material.'],
  ['overloading', 'the overloaded piece', 'Win material.'],
  ['interference', 'the interference', 'Win material.'],
  ['clearance', 'the clearance', 'Get an advantage.'],
  ['xRayAttack', 'the x-ray', 'Win material.'],
  ['intermezzo', 'the in-between move', 'Win material.'],
  ['sacrifice', 'the sacrifice', 'Get an advantage.'],
  ['advancedPawn', 'the pawn break', 'Get an advantage.'],
  ['zugzwang', 'the squeeze', 'Get an advantage.'],
  ['quietMove', 'the quiet move', 'Get an advantage.'],
  ['crushing', 'the winning move', 'Win material.'],
  ['advantage', 'the best move', 'Get an advantage.'],
];

const mateLength = (themes: string[]) => {
  const m = themes.map((t) => /^mateIn(\d)$/.exec(t)).find(Boolean);
  return m ? Number(m[1]) : null;
};

/** The clue line for a puzzle at a prompt level (null at P0: just "White to move."). */
export function promptFor(themes: string[], level: PromptLevel, userMoves: number): string | null {
  if (level === 0) return null;
  const hit = THEMES.find(([t]) => themes.includes(t)) ?? ['', 'the best move', 'Get an advantage.'];
  const [, name, goal] = hit;
  if (level === 1) return goal;
  const find = `Find ${name}`;
  if (level === 2) return `${find}.`;
  const mate = mateLength(themes);
  if (mate && goal === 'Checkmate.') return `${find} in ${mate}.`;
  return `${find} in ${userMoves} move${userMoves === 1 ? '' : 's'}.`;
}

/** After three misses in a row the next puzzles are eased; the coach says so gently. */
export const WARM_UP_LINE = "Let's warm up with a few that suit you right now.";
