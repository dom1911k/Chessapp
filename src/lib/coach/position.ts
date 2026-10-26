// "Explain this position": a plain-language overview of the position for one side.
import { Chess } from 'chess.js';
import { povScore, scoreToCp } from '../chess/evaluation';
import { attacksFrom, fileOf, hangingPieces, kingSquare, material, other, parseFen, PIECE_NAME, rankOf, sqName, type Color, type Piece, type PieceType } from '../chess/pos';
import type { AnalysisResult } from '../engine/types';

type Board = (Piece | null)[];

function verdict(cp: number | null, mate: number | null): string {
  if (mate !== null) return mate > 0 ? `You have a forced checkmate in ${mate}! Look for checks.` : `Danger: your opponent can force checkmate in ${-mate}.`;
  if (cp === null) return '';
  const a = Math.abs(cp);
  const who = cp > 0 ? 'You are' : 'Your opponent is';
  if (a < 40) return 'The position is about equal.';
  if (a < 120) return `${who} slightly better.`;
  if (a < 300) return `${who} clearly better.`;
  return `${who} winning.`;
}

function materialText(b: Board, me: Color): string {
  const diff = material(b, me) - material(b, other(me));
  const count = (c: Color, t: PieceType) => b.filter((p) => p?.color === c && p.type === t).length;
  const d = (t: PieceType) => count(me, t) - count(other(me), t);
  if (diff === 0) {
    if (d('r') === 1 && d('n') + d('b') === -1) return "Material is equal in points, but you have a rook against a minor piece and a pawn — that's usually good for you.";
    return 'Material is even.';
  }
  const up = diff > 0;
  const n = Math.abs(diff);
  const what =
    n >= 9 && Math.abs(d('q')) >= 1 ? 'a queen' : n >= 5 && Math.abs(d('r')) >= 1 ? 'a rook' : n === 2 && Math.abs(d('r')) === 1 ? 'the exchange' : n >= 3 ? (Math.abs(d('n')) >= 1 ? 'a knight' : 'a bishop') : n === 1 ? 'a pawn' : `${n} pawns`;
  return up ? `You are up ${what} (+${n}).` : `You are down ${what} (−${n}).`;
}

function kingText(b: Board, color: Color, fullmove: number): string | null {
  const k = kingSquare(b, color);
  if (k < 0) return null;
  const home = color === 'w' ? 0 : 7;
  const queens = b.some((p) => p?.type === 'q' && p.color !== color);
  if (rankOf(k) === home && fileOf(k) >= 3 && fileOf(k) <= 5 && fullmove >= 10 && queens) return 'center';
  // Pawn shield in front of a castled king.
  if (rankOf(k) === home && (fileOf(k) <= 2 || fileOf(k) >= 5)) {
    const dir = color === 'w' ? 1 : -1;
    let shield = 0;
    for (let df = -1; df <= 1; df++) {
      const f = fileOf(k) + df;
      if (f < 0 || f > 7) continue;
      for (const dr of [1, 2]) {
        const p = b[(home + dir * dr) * 8 + f];
        if (p?.type === 'p' && p.color === color) {
          shield++;
          break;
        }
      }
    }
    if (shield <= 1 && queens) return 'open';
  }
  return null;
}

function pawnIssues(b: Board, color: Color): { doubled: number; isolated: number } {
  const files = Array(8).fill(0);
  b.forEach((p, i) => p?.type === 'p' && p.color === color && files[fileOf(i)]++);
  let doubled = 0;
  let isolated = 0;
  files.forEach((n, f) => {
    if (n > 1) doubled += n - 1;
    if (n > 0 && !(files[f - 1] > 0) && !(files[f + 1] > 0)) isolated += n;
  });
  return { doubled, isolated };
}

function undeveloped(b: Board, color: Color): number {
  const r = color === 'w' ? 0 : 7;
  return [[1, 'n'], [6, 'n'], [2, 'b'], [5, 'b']].filter(([f, t]) => {
    const p = b[r * 8 + (f as number)];
    return p?.type === t && p.color === color;
  }).length;
}

/** The piece (knight/bishop/rook) with the fewest squares it attacks. */
function leastActive(b: Board, color: Color, fullmove: number): string | null {
  let worst: { sq: number; n: number } | null = null;
  b.forEach((p, i) => {
    if (!p || p.color !== color || !['n', 'b', 'r'].includes(p.type)) return;
    if (fullmove < 8 && p.type === 'r') return; // rooks wake up later
    const n = attacksFrom(b, i).filter((t) => !b[t] || b[t]!.color !== color).length;
    if (!worst || n < worst.n) worst = { sq: i, n };
  });
  if (!worst) return null;
  const w = worst as { sq: number; n: number };
  if (w.n > 3) return null;
  return `${PIECE_NAME[b[w.sq]!.type]} on ${sqName(w.sq)}`;
}

/** 3–6 short sentences about the position from `me`'s point of view. */
export function explainPosition(fen: string, analysis: AnalysisResult | null, me: Color): string[] {
  const { board } = parseFen(fen);
  const fullmove = Number(fen.split(' ')[5] ?? 1);
  const out: string[] = [];
  const s = analysis?.lines[0]?.score;
  const pov = s ? povScore(s, me) : null;
  const v = verdict(pov && pov.type === 'cp' ? scoreToCp(pov) : null, pov && pov.type === 'mate' ? pov.value : null);
  if (v) out.push(v);
  out.push(materialText(board, me));

  const myKing = kingText(board, me, fullmove);
  const theirKing = kingText(board, other(me), fullmove);
  if (myKing === 'center') out.push('Your king is still in the center — castling would make it safer.');
  else if (myKing === 'open') out.push('The pawns in front of your king are thin; be careful about attacks there.');
  if (theirKing === 'center') out.push("Your opponent's king is still in the center. Opening lines toward it could pay off.");
  else if (theirKing === 'open') out.push("Your opponent's king has few pawns in front of it — a target for your pieces.");

  if (fullmove <= 12) {
    const u = undeveloped(board, me);
    const t = undeveloped(board, other(me));
    if (u >= 2) out.push(`You still have ${u} knights/bishops at home — bring them out.`);
    else if (t >= 2 && u <= 1) out.push('You are ahead in development. Use that lead before your opponent catches up!');
  }

  const mineHang = hangingPieces(board, me)[0];
  const theirsHang = hangingPieces(board, other(me))[0];
  if (mineHang) out.push(`Watch your ${PIECE_NAME[board[mineHang.sq]!.type]} on ${sqName(mineHang.sq)} — it can be won.`);
  if (theirsHang && fen.split(' ')[1] === me) out.push('One of your opponent\'s pieces is loose. Can you win it?');

  const mp = pawnIssues(board, me);
  const tp = pawnIssues(board, other(me));
  if (mp.isolated + mp.doubled >= 2) out.push(`Your pawn structure has weaknesses (${[mp.doubled ? `${mp.doubled} doubled` : '', mp.isolated ? `${mp.isolated} isolated` : ''].filter(Boolean).join(', ')}).`);
  else if (tp.isolated + tp.doubled >= 2) out.push("Your opponent's pawns have weaknesses you can target later.");

  if (!new Chess(fen).isGameOver()) {
    const la = leastActive(board, me, fullmove);
    if (la) out.push(`Your least active piece is the ${la}. Improving it is often a good plan.`);
  }
  return out.slice(0, 6);
}
