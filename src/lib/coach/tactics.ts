// Tactical motif detection on raw boards. All functions are pure.
import { Chess } from 'chess.js';
import {
  VALUE, applyUci, attackersOf, attacksFrom, directionsFor, hangingPieces, kingSquare,
  materialBalance, other, parseFen, rankOf, fileOf, ray, see, sqIndex, sqName, type Color, type Piece,
  type PieceType,
} from '../chess/pos';
import { parseUci } from '../chess/game';

type Board = (Piece | null)[];

export interface Fork {
  attacker: number;
  targets: number[];
}
export interface LineMotif {
  pinner: number;
  first: number; // pinned piece / skewered front piece
  behind: number;
  absolute?: boolean; // pin to the king
}
export interface Discovered {
  slider: number;
  target: number;
  check: boolean;
}

const slides = (t: PieceType, df: number, dr: number) =>
  directionsFor(t).some(([a, b]) => a === df && b === dr);

/** Enemy pieces attacked by the piece on `sq` that are worth attacking. */
function valuableTargets(board: Board, sq: number): number[] {
  const p = board[sq];
  if (!p) return [];
  const enemy = other(p.color);
  return attacksFrom(board, sq).filter((t) => {
    const q = board[t];
    if (!q || q.color !== enemy) return false;
    if (q.type === 'k') return true;
    if (VALUE[q.type] > VALUE[p.type]) return true;
    return q.type !== 'p' && attackersOf(board, t, enemy).length === 0;
  });
}

export function forkBy(board: Board, sq: number): Fork | null {
  const targets = valuableTargets(board, sq);
  return targets.length >= 2 ? { attacker: sq, targets } : null;
}

function lineMotifs(board: Board, sq: number, kind: 'pin' | 'skewer'): LineMotif[] {
  const p = board[sq];
  if (!p || !['b', 'r', 'q'].includes(p.type)) return [];
  const enemy = other(p.color);
  const out: LineMotif[] = [];
  for (const [df, dr] of directionsFor(p.type)) {
    const hits = ray(board, sq, df, dr);
    if (hits.length < 2) continue;
    const [a, b] = hits;
    const A = board[a]!;
    const B = board[b]!;
    if (A.color !== enemy || B.color !== enemy) continue;
    if (kind === 'pin') {
      if (A.type === 'k') continue;
      // A piece that slides the same way can just capture the pinner.
      if (slides(A.type, df, dr)) continue;
      if (B.type === 'k') out.push({ pinner: sq, first: a, behind: b, absolute: true });
      else if (VALUE[B.type] > VALUE[A.type] && VALUE[B.type] > VALUE[p.type] - 1)
        out.push({ pinner: sq, first: a, behind: b });
    } else {
      if (VALUE[A.type] <= VALUE[B.type] || B.type === 'p') continue;
      // The front piece can't simply take an undefended skewering piece.
      const defended = attackersOf(board, sq, p.color).length > 0;
      if (slides(A.type, df, dr) && !defended) continue;
      if (A.type === 'k' && Math.max(Math.abs(fileOf(a) - fileOf(sq)), Math.abs(rankOf(a) - rankOf(sq))) === 1 && !defended)
        continue;
      out.push({ pinner: sq, first: a, behind: b });
    }
  }
  return out;
}

export const pinsBy = (board: Board, sq: number) => lineMotifs(board, sq, 'pin');
export const skewersBy = (board: Board, sq: number) => lineMotifs(board, sq, 'skewer');

/** Attacks revealed by moving a piece off a line (excluding the moved piece itself). */
export function discoveredBy(before: Board, after: Board, uci: string): Discovered[] {
  const from = sqIndex(uci.slice(0, 2));
  const to = sqIndex(uci.slice(2, 4));
  const mover = after[to];
  if (!mover) return [];
  const enemy = other(mover.color);
  const out: Discovered[] = [];
  for (let s = 0; s < 64; s++) {
    const S = after[s];
    if (!S || s === to || S.color !== mover.color || !['b', 'r', 'q'].includes(S.type)) continue;
    for (const [df, dr] of directionsFor(S.type)) {
      const firstBefore = ray(before, s, df, dr)[0];
      if (firstBefore !== from) continue;
      const t = ray(after, s, df, dr)[0];
      if (t === undefined) continue;
      const T = after[t]!;
      if (T.color !== enemy) continue;
      const worth = T.type === 'k' || VALUE[T.type] > VALUE[S.type] || (T.type !== 'p' && !attackersOf(after, t, enemy).length);
      if (worth) out.push({ slider: s, target: t, check: T.type === 'k' });
    }
  }
  return out;
}

/** The side to move is checkmated with its king trapped on its own back rank. */
export function isBackRankMate(fen: string): boolean {
  const c = new Chess(fen);
  if (!c.isCheckmate()) return false;
  const pos = parseFen(fen);
  const color = pos.turn;
  const k = kingSquare(pos.board, color);
  const back = color === 'w' ? 0 : 7;
  if (rankOf(k) !== back) return false;
  const checkers = attackersOf(pos.board, k, other(color));
  if (!checkers.some((s) => ['r', 'q'].includes(pos.board[s]!.type) && rankOf(s) === back)) return false;
  const front = back + (color === 'w' ? 1 : -1);
  let blocked = 0;
  for (let df = -1; df <= 1; df++) {
    const f = fileOf(k) + df;
    if (f < 0 || f > 7) continue;
    const q = pos.board[front * 8 + f];
    if (q && q.color === color) blocked++;
  }
  return blocked >= 2;
}

/** Mate-in-1 moves `color` would have if it were their turn. */
export function mateThreats(fen: string, color: Color): string[] {
  const parts = fen.split(' ');
  parts[1] = color;
  parts[3] = '-';
  let c: Chess;
  try {
    c = new Chess(parts.join(' '), { skipValidation: true });
  } catch {
    return [];
  }
  // Can't "threaten" if the opponent's king would be capturable (position illegal).
  const out: string[] = [];
  for (const m of c.moves({ verbose: true })) {
    if (m.san.endsWith('#')) out.push(m.lan);
  }
  return out;
}

export type Motif =
  | { kind: 'mate' }
  | { kind: 'check' }
  | { kind: 'freeCapture'; sq: number; piece: PieceType }
  | { kind: 'winningCapture'; sq: number; piece: PieceType }
  | { kind: 'fork'; fork: Fork }
  | { kind: 'pin'; motif: LineMotif }
  | { kind: 'skewer'; motif: LineMotif }
  | { kind: 'discovered'; d: Discovered }
  | { kind: 'promotion' }
  | { kind: 'castle' }
  | { kind: 'escape'; sq: number; piece: PieceType } // moved a hanging piece to safety
  | { kind: 'defend'; sq: number; piece: PieceType }; // protected a hanging piece

/** Motifs created by playing `uci` from `fen` (side to move = the mover). */
export function moveMotifs(fen: string, uci: string): Motif[] {
  const c = new Chess(fen);
  let m;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return [];
  }
  const pos = parseFen(fen);
  const before = pos.board;
  const after = applyUci(before, uci);
  const me = pos.turn;
  const from = sqIndex(m.from);
  const to = sqIndex(m.to);
  const out: Motif[] = [];
  if (m.san.endsWith('#')) out.push({ kind: 'mate' });
  else if (m.san.endsWith('+')) out.push({ kind: 'check' });
  if (m.isKingsideCastle() || m.isQueensideCastle()) out.push({ kind: 'castle' });
  if (m.promotion) out.push({ kind: 'promotion' });
  if (m.captured) {
    const capSq = m.isEnPassant() ? sqIndex(m.to[0] + m.from[1]) : to;
    const defended = attackersOf(before, capSq, other(me)).length > 0;
    const gain = see(before, capSq, me);
    // SEE uses the cheapest capturer; make sure *this* capture doesn't lose the piece back.
    const recapture = see(after, to, other(me));
    const net = VALUE[m.captured] - recapture;
    if (!defended && recapture === 0) out.push({ kind: 'freeCapture', sq: capSq, piece: m.captured });
    else if (gain > 0 && net > 0) out.push({ kind: 'winningCapture', sq: capSq, piece: m.captured });
  }
  const fork = forkBy(after, to);
  if (fork) out.push({ kind: 'fork', fork });
  for (const p of pinsBy(after, to)) {
    if (!pinsBy(before, from).some((q) => q.first === p.first)) out.push({ kind: 'pin', motif: p });
  }
  for (const s of skewersBy(after, to)) out.push({ kind: 'skewer', motif: s });
  for (const d of discoveredBy(before, after, uci)) out.push({ kind: 'discovered', d });
  // Defensive ideas: was something hanging that no longer is?
  const hangBefore = hangingPieces(before, me);
  const hangAfter = new Set(hangingPieces(after, me).map((h) => h.sq));
  for (const h of hangBefore) {
    const piece = before[h.sq]!.type;
    if (h.sq === from && !hangAfter.has(to)) out.push({ kind: 'escape', sq: h.sq, piece });
    else if (h.sq !== from && !hangAfter.has(h.sq) && after[h.sq]) out.push({ kind: 'defend', sq: h.sq, piece });
  }
  return out;
}

export interface LineInfo {
  san: string[];
  /** Number of moves (of the line's first mover) until mate, if the line ends in mate. */
  matesIn: number | null;
  endsInBackRankMate: boolean;
  /** Material gained by the first mover over the (quiescent) line. */
  materialGain: number;
  /** Most valuable piece type the *second* side loses along the line. */
  victim: PieceType | null;
  plies: number;
}

/** Plays out a PV and summarises what happens. */
export function describeLine(fen: string, pv: string[], maxPlies = 8): LineInfo {
  const c = new Chess(fen);
  const me = c.turn();
  const start = materialBalance(parseFen(fen).board, me);
  const san: string[] = [];
  let lastCapture = false;
  let plies = 0;
  let matesIn: number | null = null;
  let backRank = false;
  for (let i = 0; i < pv.length; i++) {
    if (i >= maxPlies && !lastCapture) break;
    if (i >= maxPlies + 4) break;
    let m;
    try {
      m = c.move(parseUci(pv[i]));
    } catch {
      break;
    }
    san.push(m.san);
    plies++;
    lastCapture = !!m.captured;
    if (c.isCheckmate()) {
      if (i % 2 === 0) {
        matesIn = i / 2 + 1;
        backRank = isBackRankMate(c.fen());
      }
      break;
    }
  }
  // Material is counted at an even ply where possible, so a capture's recapture is included.
  const end = parseFen(c.fen()).board;
  const startBoard = parseFen(fen).board;
  const gain = materialBalance(end, me) - start;
  let victim: PieceType | null = null;
  const count = (b: Board, color: Color, t: PieceType) => b.filter((p) => p?.color === color && p.type === t).length;
  for (const t of ['q', 'r', 'b', 'n', 'p'] as PieceType[]) {
    if (count(end, other(me), t) < count(startBoard, other(me), t)) {
      victim = t;
      break;
    }
  }
  return { san, matesIn, endsInBackRankMate: backRank, materialGain: gain, victim, plies };
}

/**
 * Pieces of the side to move (worth 3+) that are attacked and have no safe square:
 * every move either lands where it can be won, or there are no moves at all.
 */
export function trappedPieces(fen: string): { sq: number; piece: PieceType }[] {
  const c = new Chess(fen);
  const me = c.turn();
  const { board } = parseFen(fen);
  const out: { sq: number; piece: PieceType }[] = [];
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!p || p.color !== me || p.type === 'k' || VALUE[p.type] < 3) continue;
    if (see(board, s, other(me)) <= 0) continue; // not in danger where it stands
    const moves = c.moves({ square: sqName(s) as never, verbose: true });
    const safe = moves.some((m) => {
      if (m.captured && VALUE[m.captured] >= VALUE[p.type]) return true;
      const after = applyUci(board, m.lan);
      return see(after, sqIndex(m.to), other(me)) === 0;
    });
    if (!safe) out.push({ sq: s, piece: p.type });
  }
  return out;
}

/** For a capture on `target`: other pieces that the captured piece was defending. */
export function defendedBy(board: Board, defenderSq: number): number[] {
  const d = board[defenderSq];
  if (!d) return [];
  return attacksFrom(board, defenderSq).filter((t) => board[t]?.color === d.color && board[t]!.type !== 'k');
}
