import { Chess } from 'chess.js';
import { parseUci } from '../chess/game';
import { hangingPieces, parseFen } from '../chess/pos';
import type { Task } from './data';

/** Does `uci` solve the task in position `fen`? */
export function solvesTask(fen: string, task: Task, uci: string): boolean {
  const c = new Chess(fen);
  let m;
  try {
    m = c.move(parseUci(uci));
  } catch {
    return false;
  }
  switch (task.kind) {
    case 'moves':
      return task.solutions.includes(m.lan);
    case 'mate':
      return c.isCheckmate();
    case 'safe':
      return hangingPieces(parseFen(c.fen()).board, m.color).length === 0;
  }
}

/** All legal moves that solve the task (used for hints and tests). */
export function taskSolutions(fen: string, task: Task): string[] {
  return new Chess(fen).moves({ verbose: true }).map((m) => m.lan).filter((u) => solvesTask(fen, task, u));
}
