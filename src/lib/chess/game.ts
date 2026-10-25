import { Chess, type Move } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface MoveInput {
  from: string;
  to: string;
  promotion?: string;
}

export function toUci(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? '');
}

export function parseUci(uci: string): MoveInput {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

/** Plays a move on a copy; returns null if illegal. */
export function tryMove(fen: string, m: MoveInput | string): { move: Move; fen: string } | null {
  const c = new Chess(fen);
  try {
    const move = c.move(typeof m === 'string' ? parseUci(m) : m);
    return { move, fen: c.fen() };
  } catch {
    return null;
  }
}

export function uciToSan(fen: string, uci: string): string {
  return tryMove(fen, uci)?.move.san ?? uci;
}

/** Converts a UCI line into SAN, stopping at the first illegal move. */
export function lineToSan(fen: string, uciLine: string[], max = 99): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of uciLine.slice(0, max)) {
    try {
      out.push(c.move(parseUci(u)).san);
    } catch {
      break;
    }
  }
  return out;
}

/** Formats a SAN line with move numbers, e.g. "12. Nf3 Qxf3 13. gxf3". */
export function formatLine(fen: string, san: string[]): string {
  const parts = fen.split(' ');
  let moveNo = Number(parts[5] ?? 1);
  let white = parts[1] === 'w';
  const out: string[] = [];
  san.forEach((s, i) => {
    if (white) out.push(`${moveNo}. ${s}`);
    else out.push(i === 0 ? `${moveNo}… ${s}` : s);
    if (!white) moveNo++;
    white = !white;
  });
  return out.join(' ');
}

export function isPromotion(fen: string, from: string, to: string): boolean {
  const c = new Chess(fen);
  const p = c.get(from as never);
  if (!p || p.type !== 'p') return false;
  return (p.color === 'w' && to[1] === '8') || (p.color === 'b' && to[1] === '1');
}

export type GameResult = '1-0' | '0-1' | '1/2-1/2';

export function gameOverInfo(fen: string, historyFens: string[] = []): { result: GameResult; reason: string } | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { result: c.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
  if (c.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
  if (c.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient material' };
  if (Number(fen.split(' ')[4]) >= 100) return { result: '1/2-1/2', reason: '50-move rule' };
  const key = fen.split(' ').slice(0, 4).join(' ');
  if (historyFens.filter((f) => f.split(' ').slice(0, 4).join(' ') === key).length >= 3)
    return { result: '1/2-1/2', reason: 'threefold repetition' };
  return null;
}
