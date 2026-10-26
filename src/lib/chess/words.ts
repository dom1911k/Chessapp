// Moves in plain words ("move your rook to e1") instead of chess notation ("Re1"),
// so beginners can follow what the coach and opponents talk about.
import { Chess, type Move } from 'chess.js';
import { parseUci } from './game';
import { PIECE_NAME } from './pos';

/** Whose move it is from the reader's point of view. */
export type Who = 'you' | 'they';
export type MoveForm = 'inf' | 'ger';

const GERUND: Record<string, string> = { move: 'moving', take: 'taking', push: 'pushing', castle: 'castling' };

/** A move as an infinitive ("take their knight on f6 with your bishop") or gerund ("taking …"). */
export function describeMove(m: Move, who: Who, form: MoveForm = 'inf', opts: { prev?: Move; suffix?: boolean } = {}): string {
  const mine = who === 'you' ? 'your' : 'their';
  const theirs = who === 'you' ? 'their' : 'your';
  const piece = PIECE_NAME[m.piece];
  let s: string;
  if (m.isKingsideCastle() || m.isQueensideCastle()) s = 'castle';
  else if (m.isEnPassant()) s = `take ${theirs} pawn en passant`;
  else if (m.captured && opts.prev && opts.prev.to === m.to) s = `take back with ${mine} ${piece}`;
  else if (m.captured) s = `take ${theirs} ${PIECE_NAME[m.captured]} on ${m.to} with ${mine} ${piece}`;
  else if (m.piece === 'p') s = `push ${mine} pawn to ${m.to}`;
  else s = `move ${mine} ${piece} to ${m.to}`;
  if (m.promotion) s += ` and turn it into a ${PIECE_NAME[m.promotion]}`;
  if (opts.suffix !== false) {
    if (m.san.endsWith('#')) s += ' for checkmate';
    else if (m.san.endsWith('+')) s += m.captured && form === 'inf' ? ', giving check' : ' with check';
  }
  if (form === 'ger') {
    const [first, ...rest] = s.split(' ');
    s = [GERUND[first] ?? first, ...rest].join(' ');
  }
  return s;
}

/** Describes one UCI move in a position; falls back to the UCI text. */
export function moveWords(fen: string, uci: string, who: Who, form: MoveForm = 'inf', suffix = true): string {
  try {
    return describeMove(new Chess(fen).move(parseUci(uci)), who, form, { suffix });
  } catch {
    return uci;
  }
}

/** A short line in words: "you take their pawn on e5 with your knight, they take back with their queen, and …". */
export function lineWords(fen: string, pv: string[], plies = 3, first: Who = 'you'): string {
  const c = new Chess(fen);
  const parts: string[] = [];
  let who = first;
  let prev: Move | undefined;
  for (const u of pv.slice(0, Math.max(1, plies))) {
    let m: Move;
    try {
      m = c.move(parseUci(u));
    } catch {
      break;
    }
    let s = `${who} ${describeMove(m, who, 'inf', { prev, suffix: false })}`;
    if (m.san.endsWith('#')) s += " — and that's checkmate";
    else if (m.san.endsWith('+')) s += ' (check)';
    parts.push(s);
    prev = m;
    who = who === 'you' ? 'they' : 'you';
  }
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')}, then ${parts[parts.length - 1]}`;
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A compact label: "Queen to h5", "Knight takes bishop", "Castles", "Pawn to e8 = queen". */
export function shortWords(fen: string, uci: string): string {
  try {
    const m = new Chess(fen).move(parseUci(uci));
    if (m.isKingsideCastle() || m.isQueensideCastle()) return 'Castles';
    let s = cap(PIECE_NAME[m.piece]);
    s += m.captured ? ` takes ${PIECE_NAME[m.captured]} on ${m.to}` : ` to ${m.to}`;
    if (m.promotion) s += `, becomes a ${PIECE_NAME[m.promotion]}`;
    if (m.san.endsWith('#')) s += ' — checkmate';
    else if (m.san.endsWith('+')) s += ', check';
    return s;
  } catch {
    return uci;
  }
}

/** Same as shortWords, from SAN. */
export function shortWordsSan(fen: string, san: string): string {
  try {
    const m = new Chess(fen).move(san);
    return shortWords(fen, m.lan);
  } catch {
    return san;
  }
}
