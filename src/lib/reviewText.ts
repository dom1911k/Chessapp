// Plain-language lines for Game Review (pure): the one-line verdict on the game, the threat you
// missed, why a piece was loose, and why a good move worked.
import { Chess } from 'chess.js';
import { attackersOf, other, parseFen, sqIndex, sqName, VALUE, type Color, type PieceType } from './chess/pos';
import { mateThreats, moveMotifs } from './coach/tactics';
import { isBad, moveNo, type Review } from './review';
import type { AnyGame, PlyRecord } from './store/types';

const NAME: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const PHASE_WORD = { opening: 'the opening', middlegame: 'the middlegame', endgame: 'the endgame' } as const;

/**
 * One headline for the whole game, e.g. "You were winning until 18. Nxe5 — one slip in the
 * endgame cost it." Built from the win% curve, the result and the biggest swing of yours.
 */
export function verdictLine(g: Pick<AnyGame, 'plies' | 'userColor' | 'userResult' | 'reason'>, r: Review): string {
  const mine = (wpWhite: number) => (g.userColor === 'w' ? wpWhite : 100 - wpWhite);
  const curve = r.curve.map(mine);
  // Your worst move: the biggest (floored) loss among your bad moves.
  let worst = -1;
  r.plies.forEach((p, i) => {
    if (g.plies[i].isUser && isBad(p.cls) && (worst < 0 || (p.effLoss ?? 0) > (r.plies[worst].effLoss ?? 0))) worst = i;
  });
  const at = (i: number) => `${moveNo(g.plies, i)} ${g.plies[i].san}`;
  const before = worst >= 0 ? curve[worst] : 50;
  const phase = worst >= 0 ? PHASE_WORD[r.plies[worst].phase] : '';
  const peak = Math.max(...curve);
  const low = Math.min(...curve);
  if (g.userResult === 'win') {
    if (low <= 25) return 'You were in trouble but turned it around — a fighting win.';
    if (worst < 0 || (r.plies[worst].effLoss ?? 0) < 10) return 'A clean win — no real slips from you.';
    return `A win, though ${at(worst)} let them back in for a while.`;
  }
  if (g.userResult === 'draw') {
    if (peak >= 75 && worst >= 0) return `You were winning until ${at(worst)} — it slipped to a draw.`;
    if (low <= 25) return 'You were in trouble and saved a draw — well held.';
    return 'Level most of the way — a fair draw.';
  }
  // A loss.
  if (worst >= 0 && before >= 65) return `You were winning until ${at(worst)} — one slip in ${phase} cost it.`;
  if (worst >= 0 && before >= 40) return `It was level until ${at(worst)} — that slip in ${phase} decided it.`;
  if (g.reason === 'time') return 'You ran out of time — the position was still a fight.';
  if (peak < 40) return 'They were better from early on — no single big slip, just steady pressure.';
  return worst >= 0 ? `It went wrong at ${at(worst)}, in ${phase}.` : 'A tough game — step through it to see where it slipped.';
}

/** Their threat you missed: the move they were threatening before your move, and what it does. */
export function missedThreat(p: Pick<PlyRecord, 'fenBefore' | 'uci' | 'color'>): { uci: string; san: string; text: string } | null {
  const me = p.color as Color;
  const them = other(me);
  // Mate first.
  const mates = mateThreats(p.fenBefore, them);
  if (mates.length) {
    const san = sanFor(p.fenBefore, mates[0], them);
    return san ? { uci: mates[0], san, text: `They were threatening ${san} — checkmate.` } : null;
  }
  // Else something of yours attacked more times than it is defended (or worth more than its attacker).
  const board = parseFen(p.fenBefore).board;
  let pick: { sq: number; from: number; gain: number } | null = null;
  board.forEach((pc, sq) => {
    if (!pc || pc.color !== me || pc.type === 'k') return;
    const att = attackersOf(board, sq, them);
    if (!att.length) return;
    const def = attackersOf(board, sq, me);
    const cheapest = att.reduce((a, b) => (VALUE[board[a]!.type] <= VALUE[board[b]!.type] ? a : b));
    const loose = !def.length || VALUE[board[cheapest]!.type] < VALUE[pc.type] || att.length > def.length;
    if (loose && (!pick || VALUE[pc.type] > pick.gain)) pick = { sq, from: cheapest, gain: VALUE[pc.type] };
  });
  if (!pick) return null;
  const pk: { sq: number; from: number } = pick;
  const uci = sqName(pk.from) + sqName(pk.sq);
  const san = sanFor(p.fenBefore, uci, them);
  if (!san) return null;
  return { uci, san, text: `They were threatening ${san}, winning your ${NAME[board[pk.sq]!.type]} on ${sqName(pk.sq)}.` };
}

/** "Your bishop on c4 was defended once but attacked twice." for a piece your move left loose. */
export function looseWhy(p: Pick<PlyRecord, 'fenAfter' | 'color'>, square: string): string | null {
  const me = p.color as Color;
  const board = parseFen(p.fenAfter).board;
  const sq = sqIndex(square);
  const pc = board[sq];
  if (!pc) return null;
  const att = attackersOf(board, sq, other(me));
  const def = attackersOf(board, sq, me);
  if (!att.length) return null;
  const who = `Your ${NAME[pc.type]} on ${square}`;
  if (!def.length) return `${who} had no defender, and they attack it with the ${NAME[board[att[0]]!.type]}.`;
  if (att.length > def.length) return `${who} was defended ${times(def.length)} but attacked ${times(att.length)}.`;
  const cheapest = att.reduce((a, b) => (VALUE[board[a]!.type] <= VALUE[board[b]!.type] ? a : b));
  return `${who} is worth more than the ${NAME[board[cheapest]!.type]} attacking it — being defended doesn't save it.`;
}

/** Why a good move worked, from its motifs (null when there is nothing special to say). */
export function goodWhy(p: Pick<PlyRecord, 'fenBefore' | 'uci'>): string | null {
  const board = parseFen(p.fenBefore).board;
  const ms = moveMotifs(p.fenBefore, p.uci);
  const name = (sq: number) => NAME[board[sq]?.type ?? 'p'];
  for (const m of ms) {
    if (m.kind === 'mate') return 'It’s checkmate.';
  }
  for (const m of ms) {
    switch (m.kind) {
      case 'fork': return `It forks the ${m.fork.targets.map(name).join(' and ')}.`;
      case 'skewer': return `It skewers the ${name(m.motif.first)} — the ${name(m.motif.behind)} behind it falls.`;
      case 'pin': return m.motif.absolute ? `It pins the ${name(m.motif.first)} to the king.` : `It pins the ${name(m.motif.first)} to the ${name(m.motif.behind)}.`;
      case 'discovered': return `It uncovers an attack on the ${name(m.d.target)}${m.d.check ? ' — with check' : ''}.`;
      case 'winningCapture':
      case 'freeCapture': return `It wins the ${NAME[m.piece]}.`;
      case 'promotion': return 'It promotes to a queen.';
      default:
    }
  }
  for (const m of ms) if (m.kind === 'escape' || m.kind === 'defend') return `It saves your ${NAME[m.piece]}.`;
  return null;
}

function sanFor(fen: string, uci: string, side: Color): string | null {
  const parts = fen.split(' ');
  parts[1] = side;
  parts[3] = '-';
  try {
    const c = new Chess(parts.join(' '), { skipValidation: true });
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' }).san;
  } catch {
    return null;
  }
}
