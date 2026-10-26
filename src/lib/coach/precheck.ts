// "Before you move" check: a quick, engine-free look at the move the player is
// about to make. Catches the two classic beginner slips — leaving a piece
// en prise and walking into mate in one — and asks "are you sure?" first.
import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import { hangingPieces, parseFen, PIECE_NAME, sqIndex, sqName, VALUE } from '../chess/pos';

export interface PreCheck {
  kind: 'mate' | 'hang';
  /** The gentle question asked first. */
  ask: string;
  /** What's wrong, if the player asks to be shown. */
  reveal: string;
  /** Square to highlight when revealed. */
  sq: string;
}

export function preMoveCheck(fen: string, uci: string): PreCheck | null {
  const c = new Chess(fen);
  const me = c.turn();
  let m;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return null;
  }
  if (c.isGameOver()) return null;

  const mate = c.moves({ verbose: true }).find((x) => x.san.endsWith('#'));
  if (mate) {
    const king = parseFen(c.fen()).board.findIndex((p) => p?.type === 'k' && p.color === me);
    return {
      kind: 'mate',
      ask: 'Wait! Are you sure? After this move, take a close look at your king.',
      reveal: `If you play this, they can checkmate you right away with their ${PIECE_NAME[mate.piece]} on ${mate.to}.`,
      sq: sqName(king),
    };
  }

  const before = parseFen(fen).board;
  const after = parseFen(c.fen()).board;
  const to = sqIndex(m.to);
  const wasHanging = new Set(hangingPieces(before, me).map((h) => h.sq));
  const gained = m.captured ? VALUE[m.captured] : 0;
  const hang = hangingPieces(after, me).find((h) => {
    const p = after[h.sq]!;
    if (VALUE[p.type] < 3 || h.loss < 2) return false;
    if (h.sq === to) return h.loss > gained; // the moved piece (an even trade is fine)
    return !wasHanging.has(h.sq);
  });
  if (!hang) return null;
  const p = after[hang.sq]!;
  return {
    kind: 'hang',
    ask: "Hold on! Before you play that — is everything still safe? Check what your opponent could take.",
    reveal: `After this move, your ${PIECE_NAME[p.type]} on ${sqName(hang.sq)} could be taken.`,
    sq: sqName(hang.sq),
  };
}
