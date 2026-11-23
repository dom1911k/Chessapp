// The end of a game on the board, chess.com style: the loser's king glows, the king badges pop,
// the stinger, then the results sheet. Pure timings and choices (GameView plays them).

/** ms after the game ends: badges pop (with a knock), the stinger (+160ms), the sheet (+950ms). */
export const END_BEATS = { badges: 260, stinger: 420, sheet: 1370 } as const;
/** Opened later than this after the end: show the final state at once, no sounds. */
export const END_STALE_MS = 1500;

/** Which stinger: your win, your loss or a draw (null for an aborted game). */
export function endStinger(result: string, userColor: 'w' | 'b'): 'win' | 'loss' | 'draw' | null {
  if (result === '1/2-1/2') return 'draw';
  if (result !== '1-0' && result !== '0-1') return null;
  return (result === '1-0') === (userColor === 'w') ? 'win' : 'loss';
}
