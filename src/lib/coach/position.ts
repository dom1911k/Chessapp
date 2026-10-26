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
    if (d('r') === 1 && d('n') + d('b') === -1) return "Points are even, but you have a rook against a smaller piece and a pawn — that's usually good for you.";
    return "You both have the same amount of pieces.";
  }
  const up = diff > 0;
  const n = Math.abs(diff);
  const what =
    n >= 9 && Math.abs(d('q')) >= 1 ? 'a queen' : n >= 5 && Math.abs(d('r')) >= 1 ? 'a rook' : n === 2 && Math.abs(d('r')) === 1 ? 'a rook for a smaller piece' : n >= 3 ? (Math.abs(d('n')) >= 1 ? 'a knight' : 'a bishop') : n === 1 ? 'a pawn' : `${n} pawns`;
  return up ? `You are up ${what} (+${n} points).` : `You are down ${what} (−${n} points).`;
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
  if (myKing === 'center') out.push('Your king is still in the middle — castling would make it safer.');
  else if (myKing === 'open') out.push('Your king doesn\'t have many pawns in front of it. Watch out for attacks there.');
  if (theirKing === 'center') out.push("Their king is still in the middle. Try to open things up and go after it!");
  else if (theirKing === 'open') out.push("Their king doesn't have many pawns protecting it — a nice target.");

  if (fullmove <= 12) {
    const u = undeveloped(board, me);
    const t = undeveloped(board, other(me));
    if (u >= 2) out.push(`You still have ${u} knights and bishops at home — bring them out!`);
    else if (t >= 2 && u <= 1) out.push('You\'ve brought out more pieces than them. Use that head start!');
  }

  const mineHang = hangingPieces(board, me)[0];
  const theirsHang = hangingPieces(board, other(me))[0];
  if (mineHang) out.push(`Watch your ${PIECE_NAME[board[mineHang.sq]!.type]} on ${sqName(mineHang.sq)} — they can take it.`);
  if (theirsHang && fen.split(' ')[1] === me) out.push('One of their pieces isn\'t protected. Can you grab it?');

  const mp = pawnIssues(board, me);
  const tp = pawnIssues(board, other(me));
  if (mp.isolated + mp.doubled >= 2) out.push('Some of your pawns are weak — stacked on the same line or all alone. Keep an eye on them.');
  else if (tp.isolated + tp.doubled >= 2) out.push("Some of their pawns are weak — you can go after them later.");

  if (!new Chess(fen).isGameOver()) {
    const la = leastActive(board, me, fullmove);
    if (la) out.push(`Your ${la} isn't doing much. Find it a better square!`);
  }
  return out.slice(0, 6);
}
