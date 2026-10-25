// Three-level hints: (1) the general idea, (2) which piece, (3) the move.
import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import { hangingPieces, parseFen, PIECE_NAME, sqIndex } from '../chess/pos';
import { describeLine, moveMotifs } from './tactics';
import type { CoachArrow, CoachHighlight } from './types';

export interface Hint {
  level: 1 | 2 | 3;
  text: string;
  arrows: CoachArrow[];
  highlights: CoachHighlight[];
}

/** `line` is the best line starting with the move to hint at. */
export function getHint(fen: string, line: string[], level: 1 | 2 | 3): Hint | null {
  const uci = line[0];
  if (!uci) return null;
  const c = new Chess(fen);
  let san: string;
  let piece: string;
  try {
    const m = c.move(parseUci(uci));
    san = m.san;
    piece = PIECE_NAME[m.piece];
  } catch {
    return null;
  }
  const from = uci.slice(0, 2);
  if (level === 3)
    return { level, text: `The move is ${san}.`, arrows: [{ from, to: uci.slice(2, 4), tone: 'good' }], highlights: [] };
  if (level === 2)
    return { level, text: `Think about your ${piece} on ${from}.`, arrows: [], highlights: [{ sq: from, tone: 'info' }] };
  return { level, text: ideaHint(fen, uci, line), arrows: [], highlights: [] };
}

function ideaHint(fen: string, uci: string, line: string[]): string {
  const info = describeLine(fen, line);
  const motifs = moveMotifs(fen, uci);
  const has = (k: string) => motifs.some((m) => m.kind === k);
  const pos = parseFen(fen);
  if (info.matesIn === 1) return 'There is a checkmate in one move. Look at every check!';
  if (info.matesIn) return `You can force checkmate in ${info.matesIn}. Start with a forcing move.`;
  if (has('escape') || has('defend')) return 'One of your pieces is in danger. Can you keep it safe?';
  if (has('freeCapture')) return "Look for a piece that's undefended.";
  if (has('fork')) return 'One of your pieces can attack two things at once.';
  if (has('skewer') || has('pin')) return 'Look along the lines: is a piece standing in front of a more valuable one?';
  if (has('discovered')) return 'Moving one piece could uncover an attack by another.';
  if (has('winningCapture') || info.materialGain >= 2) return 'You can win material here. Count attackers and defenders.';
  if (has('castle')) return 'Think about the safety of your king.';
  if (has('promotion')) return 'Your pawn is close to becoming a queen!';
  if (has('check')) return 'Checks are worth a look.';
  const hang = hangingPieces(pos.board, pos.turn);
  if (hang.length) return 'Watch out — something of yours is under attack.';
  const fullmove = Number(fen.split(' ')[5] ?? 1);
  if (fullmove <= 10) return 'Bring a new piece into the game, or fight for the center.';
  void sqIndex;
  return 'Look for a move that improves your least active piece.';
}
