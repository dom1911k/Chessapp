// Small pieces both Game Review views use.
import { ReviewIcon } from '../../components/ReviewIcon';
import { plyTimes } from '../../lib/timestats';
import { cornerPos } from '../../lib/chess/kingBadges';
import { opponentById } from '../../lib/people';
import { type ReviewClass } from '../../lib/review';
import type { AnyGame, ImportedGame } from '../../lib/store/types';

/** Seconds per ply, when the game was played with a clock. */
export const timesOf = (g: AnyGame) => (g.clocks?.length && g.timeControl && /^\d+(\+\d+)?$/.test(g.timeControl) ? plyTimes(g.plies, g.clocks, g.timeControl) : undefined);
export const pending = (g: AnyGame) => g.source === 'chess.com' && !(g as ImportedGame).analyzed;
export const oppName = (g: AnyGame) => g.opponentName ?? opponentById(g.opponentId)?.name ?? 'Bot';

/**
 * The class icon at the top-right corner of the destination square, like chess.com — kept fully
 * inside the board on the h-file (a-file when flipped) and the top rank.
 */
export function SquareIcon({ sq, cls, orientation, small }: { sq: string; cls: ReviewClass; orientation: 'white' | 'black'; small?: boolean }) {
  const size = small ? 15 : 22;
  return (
    <span className="pointer-events-none absolute z-10" style={cornerPos(sq, orientation, size)} data-testid="square-icon">
      <ReviewIcon cls={cls} size={size} ring />
    </span>
  );
}
