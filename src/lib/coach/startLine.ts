// The colour line in the message that opens a game. "Tap a piece, then a square." only for your
// first three games; after that, just the colour.
import type { Color } from '../chess/pos';

export const TAP_HINT_GAMES = 3;

/** `gamesDone`: your finished games so far (null while it's being read: the hint shows). */
export function colourLine(color: Color, opponentName: string | undefined, gamesDone: number | null): string {
  const tap = (gamesDone ?? 0) < TAP_HINT_GAMES;
  if (color === 'w') return tap ? 'You have the white pieces, so you move first. Tap a piece, then a square.' : 'You have the white pieces.';
  const first = opponentName ? `${opponentName.split(' ').pop()} moves first` : 'your opponent moves first';
  return `You have the black pieces — ${first}.${tap ? ' Tap a piece, then a square.' : ''}`;
}
