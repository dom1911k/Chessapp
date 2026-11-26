// Play Coach (round 7, Phase 4): Sam explains his own move in one first-person line, when there's
// something worth saying (about two moves in three). Built from what already describes moves
// (moveMotifs, mateThreats, hanging pieces). Never more than one move deep: what his move does now,
// what it threatens next move — never a plan or a tactic you could find yourself. Pure.
import { Chess } from 'chess.js';
import { applyUci, attackersOf, attacksFrom, hangingPieces, materialBalance, other, parseFen, PIECE_NAME, sqIndex, sqName, VALUE, type Color, type PieceType } from '../chess/pos';
import { mateThreats, moveMotifs } from './tactics';

export interface SamLine {
  text: string;
  /** 'threat': a check, a mate threat or an attack on your pieces (shown even with "Only when it matters"). */
  kind: 'threat' | 'idea';
}

const CENTRE = ['e4', 'd4', 'e5', 'd5', 'c4', 'f4', 'c5', 'f5'];
const name = (t: PieceType | undefined) => PIECE_NAME[t ?? 'p'];
const plural = (t: PieceType) => (t === 'q' ? 'queens' : t === 'r' ? 'rooks' : t === 'b' ? 'bishops' : t === 'n' ? 'knights' : 'pawns');
const up = (n: number) => (n >= 9 ? 'a queen' : n >= 5 ? 'a rook' : n >= 3 ? 'a piece' : n >= 2 ? 'two pawns' : 'a pawn');

/** SAN of `uci` in `fen` with `color` to move (for a threat: the move Sam would play next). */
function sanFor(fen: string, uci: string, color: Color): string | null {
  const parts = fen.split(' ');
  parts[1] = color;
  parts[3] = '-';
  try {
    const c = new Chess(parts.join(' '), { skipValidation: true });
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

export interface SamOpts {
  /** "Only when it matters": threats only. */
  threatsOnly?: boolean;
  /** A quick question asks about the threat: don't give it away. */
  hideThreat?: boolean;
  /** Your last move (UCI), to tell a recapture. */
  lastUci?: string;
}

/** Sam's line about his move `uci` from `fen` (Sam to move), or null when there's nothing to say. */
export function samLine(fen: string, uci: string, o: SamOpts = {}): SamLine | null {
  const c = new Chess(fen);
  let m;
  try {
    m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
  if (c.isGameOver()) return null;
  const sam = m.color as Color;
  const you = other(sam);
  const before = parseFen(fen).board;
  const after = applyUci(before, uci);
  const to = sqIndex(m.to);
  const piece = name(m.piece as PieceType);
  const moveNo = Number(fen.split(' ')[5]) || 1;
  const motifs = moveMotifs(fen, uci);
  const plain = `${piece[0].toUpperCase()}${piece.slice(1)} to ${m.to}.`;

  // 1. Threats (one move deep): mate next move, check, a fork or a new attack on your pieces.
  const mates = mateThreats(c.fen(), sam);
  if (!c.inCheck() && mates.length) {
    if (o.hideThreat) return { text: `${plain} Look closely at what I'm threatening.`, kind: 'threat' };
    const san = sanFor(c.fen(), mates[0], sam);
    return { text: san ? `Now I'm threatening ${san.replace('#', '')} mate. Can you stop it?` : "Now I'm threatening mate. Can you stop it?", kind: 'threat' };
  }
  if (c.inCheck()) return { text: `Check — your king has to deal with my ${piece} first.`, kind: 'threat' };
  // A capture is about the capture (a trade, taking back, winning material), not what it now eyes.
  if (!o.threatsOnly && !o.hideThreat) {
    if (m.captured) {
      const lead = materialBalance(before, sam);
      const even = VALUE[m.captured as PieceType] === VALUE[m.piece as PieceType] && m.piece !== 'p';
      if (o.lastUci && o.lastUci.slice(2, 4) === m.to) return { text: `Taking back on ${m.to}.`, kind: 'idea' };
      if (even && lead >= 1) return { text: `I'm ${up(lead)} up, so I'm happy to trade ${plural(m.piece as PieceType)}.`, kind: 'idea' };
      if (motifs.some((x) => x.kind === 'freeCapture')) return { text: `I'll take your ${name(m.captured as PieceType)} — it wasn't defended.`, kind: 'idea' };
      if (motifs.some((x) => x.kind === 'winningCapture')) return { text: `Taking your ${name(m.captured as PieceType)} wins material.`, kind: 'idea' };
      if (even) return { text: `Trading ${plural(m.piece as PieceType)}.`, kind: 'idea' };
    }
  }
  const fork = motifs.find((x) => x.kind === 'fork');
  if (fork && fork.kind === 'fork') {
    if (o.hideThreat) return { text: `${plain} Look closely at what I'm threatening.`, kind: 'threat' };
    const [a, b] = fork.fork.targets.map((s) => name(after[s]?.type));
    return { text: `My ${piece} attacks your ${a} and your ${b} at once.`, kind: 'threat' };
  }
  // (A pawn under attack isn't worth announcing; pieces are.)
  const wasHanging = new Set(hangingPieces(before, you).map((h) => h.sq));
  const fresh = hangingPieces(after, you).filter((h) => !wasHanging.has(h.sq) && after[h.sq]?.type !== 'p');
  if (fresh.length) {
    if (o.hideThreat) return { text: `${plain} Look closely at what I'm threatening.`, kind: 'threat' };
    const h = fresh[0];
    const byMe = attackersOf(after, h.sq, sam).includes(to);
    const target = name(after[h.sq]?.type);
    return { text: byMe ? `My ${piece} now attacks your ${target} on ${sqName(h.sq)}.` : `Your ${target} on ${sqName(h.sq)} is under attack now.`, kind: 'threat' };
  }
  const pin = motifs.find((x) => x.kind === 'pin' && after[x.motif.first]?.type !== 'p');
  if (pin && pin.kind === 'pin') return { text: `My ${piece} pins your ${name(after[pin.motif.first]?.type)} to your ${name(after[pin.motif.behind]?.type)}.`, kind: 'threat' };
  if (o.threatsOnly) return null;

  // 2. What the move does.
  if (m.promotion) return { text: `My pawn becomes a ${name(m.promotion as PieceType)}.`, kind: 'idea' };
  if (m.isKingsideCastle() || m.isQueensideCastle()) return { text: 'Castling, so my king is safe and my rook joins in.', kind: 'idea' };
  const escape = motifs.find((x) => x.kind === 'escape' && x.piece !== 'p');
  if (escape && escape.kind === 'escape') return { text: `Moving my ${name(escape.piece)} out of danger.`, kind: 'idea' };
  const defend = motifs.find((x) => x.kind === 'defend' && x.piece !== 'p');
  if (defend && defend.kind === 'defend') return { text: `Protecting my ${name(defend.piece)} on ${sqName(defend.sq)}.`, kind: 'idea' };
  const home = sam === 'w' ? '1' : '8';
  if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === home && moveNo <= 14) {
    const eyes = attacksFrom(after, to).map(sqName).filter((s) => CENTRE.includes(s)).sort((x, y) => CENTRE.indexOf(x) - CENTRE.indexOf(y)).slice(0, 2);
    return { text: eyes.length ? `Developing my ${piece} — it eyes ${eyes.join(' and ')}.` : `Developing my ${piece}.`, kind: 'idea' };
  }
  if (m.piece === 'p' && moveNo <= 4 && 'de'.includes(m.to[0])) return { text: 'A pawn in the centre — it gives my pieces room.', kind: 'idea' };
  if (m.piece === 'r' && !after.some((p, i) => p?.type === 'p' && (i & 7) === (to & 7))) return { text: `My rook takes the open ${m.to[0]}-file.`, kind: 'idea' };
  const pieces = after.filter((p) => p && p.type !== 'p' && p.type !== 'k').length;
  if (m.piece === 'k' && pieces <= 2 && centreDistance(to) < centreDistance(sqIndex(m.from))) return { text: 'My king steps up — in the endgame it fights too.', kind: 'idea' };
  if (m.piece === 'p' && pieces <= 4 && passed(after, to, sam) && (sam === 'w' ? Number(m.to[1]) >= 5 : Number(m.to[1]) <= 4)) return { text: 'Pushing my passed pawn towards queening.', kind: 'idea' };
  if (m.piece === 'q' && moveNo <= 8) return { text: 'Bringing my queen out early.', kind: 'idea' };
  return null;
}

/** No enemy pawn in front of this pawn on its file or the files next to it. */
function passed(board: ReturnType<typeof parseFen>['board'], sq: number, color: Color): boolean {
  const f = sq & 7;
  const r = sq >> 3;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.type !== 'p' || p.color === color || Math.abs((i & 7) - f) > 1) continue;
    if (color === 'w' ? i >> 3 > r : i >> 3 < r) return false;
  }
  return true;
}

/** How far a square is from the centre (0 for d4/e4/d5/e5). */
function centreDistance(sq: number): number {
  const f = sq & 7;
  const r = sq >> 3;
  return Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5)) - 0.5;
}
