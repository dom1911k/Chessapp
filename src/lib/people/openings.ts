// Each opponent's repertoire. Lines are SAN from the starting position; the bot
// follows a line while the game matches it, whichever colour it has.
import { Chess } from 'chess.js';

export interface Repertoire {
  /** Shown on the opponent card. */
  favourite: string;
  lines: string[];
}

export const REPERTOIRES: Record<string, Repertoire> = {
  tom: {
    favourite: 'Italian Game',
    lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5',
      'e4 c5 Nf3 d6 d4 cxd4 Nxd4',
      'e4 e6 d4 d5 Nc3',
      'e4 c6 d4 d5 Nc3',
      'e4 d5 exd5 Qxd5 Nc3',
      'd4 d5 c4 e6 Nc3 Nf6',
      'c4 e5 Nc3 Nf6',
      'Nf3 d5 d4 Nf6',
    ],
  },
  maya: {
    favourite: 'Scandinavian Defense',
    lines: [
      'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6',
      'e4 d5 Nc3 dxe4 Nxe4',
      'e4 d5 e5 Bf5',
      'd4 d5 c4 c6',
      'e4 e5 Nf3 Nc6 Bb5',
      'e4 c5 Nc3 Nc6',
      'e4 e6 d4 d5 exd5',
    ],
  },
  jonas: {
    favourite: "King's Gambit",
    lines: [
      'e4 e5 f4 exf4 Nf3 g5 h4',
      'e4 e5 f4 d5 exd5 exf4',
      'e4 e5 f4 Bc5 Nf3 d6',
      'e4 c5 f4 Nc6 Nf3',
      'e4 e6 d4 d5 Nc3',
      'e4 c6 d4 d5 Nc3',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5',
      'd4 d5 c4 e5',
      'd4 Nf6 c4 e5',
    ],
  },
  priya: {
    favourite: 'London System & Caro-Kann',
    lines: [
      'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3',
      'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O',
      'd4 Nf6 Bf4 e6 e3 d5 Nf3',
      'd4 e6 Bf4 d5 e3',
      'd4 c5 d5 e6',
      'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5',
      'e4 c6 d4 d5 e5 Bf5',
      'e4 c6 Nf3 d5 Nc3',
      'd4 d5 c4 c6 Nf3 Nf6',
    ],
  },
  marcus: {
    favourite: 'Evans Gambit & Dragon',
    lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5',
      'e4 c5 d4 cxd4 c3 dxc3 Nxc3',
      'e4 e6 d4 d5 e5 c5',
      'e4 c6 d4 d5 e5 Bf5',
      'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6',
      'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6',
    ],
  },
  sofia: {
    favourite: 'Ruy Lopez & French',
    lines: [
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O',
      'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3',
      'e4 e6 d4 d5 Nd2 Nf6',
      'e4 c6 d4 d5 e5 Bf5',
      'e4 e6 d4 d5 Nc3 Nf6',
      'e4 e6 d4 d5 e5 c5',
      'd4 Nf6 c4 e6 Nc3 Bb4',
    ],
  },
  viktor: {
    favourite: "Queen's Gambit",
    lines: [
      'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7',
      'd4 d5 c4 dxc4 e3 Nf6',
      'd4 Nf6 c4 e6 Nf3 b6',
      'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5',
      'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O',
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6',
      'd4 d5 c4 e6 Nc3 Nf6 Bg5',
    ],
  },
  mei: {
    favourite: 'A bit of everything',
    lines: [
      'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
      'd4 Nf6 c4 e6 Nc3 Bb4 e3',
      'Nf3 d5 g3 Nf6 Bg2',
      'c4 e5 Nc3 Nf6 Nf3 Nc6',
      'e4 e5 Nf3 Nc6 Bb5 a6',
      'd4 d5 c4 c6 Nf3 Nf6',
    ],
  },
};

/** Next book move (UCI) for the side to move, if the game so far follows one of the lines. */
export function bookMove(opponentId: string | undefined, sanHistory: string[], rand: () => number = Math.random): string | null {
  const rep = opponentId ? REPERTOIRES[opponentId] : undefined;
  if (!rep) return null;
  const n = sanHistory.length;
  const candidates = rep.lines
    .map((l) => l.split(' '))
    .filter((l) => l.length > n && sanHistory.every((m, i) => l[i] === m))
    .map((l) => l[n]);
  if (!candidates.length) return null;
  const san = candidates[Math.floor(rand() * candidates.length)];
  const c = new Chess();
  try {
    for (const m of sanHistory) c.move(m);
    return c.move(san).lan;
  } catch {
    return null;
  }
}
