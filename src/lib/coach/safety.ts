// Safety overlay: which of my pieces are hanging, and what is my opponent threatening?
import { attackersOf, hangingPieces, other, parseFen, see, sqName, type Color } from '../chess/pos';
import { mateThreats } from './tactics';
import type { CoachArrow, CoachHighlight } from './types';

export interface SafetyInfo {
  highlights: CoachHighlight[];
  arrows: CoachArrow[];
  messages: string[];
}

export function safetyInfo(fen: string, me: Color): SafetyInfo {
  const { board } = parseFen(fen);
  const opp = other(me);
  const highlights: CoachHighlight[] = [];
  const arrows: CoachArrow[] = [];
  const messages: string[] = [];

  const hanging = hangingPieces(board, me);
  const hangSet = new Set(hanging.map((h) => h.sq));
  for (const h of hanging) {
    highlights.push({ sq: sqName(h.sq), tone: 'bad' });
    for (const a of attackersOf(board, h.sq, opp)) arrows.push({ from: sqName(a), to: sqName(h.sq), tone: 'bad' });
  }
  // Attacked but adequately defended: show softly.
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.color !== me || p.type === 'k' || hangSet.has(i)) continue;
    if (attackersOf(board, i, opp).length && see(board, i, opp) === 0) highlights.push({ sq: sqName(i), tone: 'info' });
  }
  if (hanging.length) messages.push(hanging.length === 1 ? '1 piece is hanging.' : `${hanging.length} pieces are hanging.`);

  const mates = mateThreats(fen, opp);
  for (const u of mates.slice(0, 2)) arrows.push({ from: u.slice(0, 2), to: u.slice(2, 4), tone: 'bad' });
  if (mates.length) messages.push('Your opponent threatens checkmate!');
  return { highlights, arrows, messages };
}
