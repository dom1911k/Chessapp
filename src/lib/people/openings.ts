// Each opponent's repertoire. Lines are SAN from the starting position; the bot
// follows a line while the game matches it, whichever colour it has.
import { Chess } from 'chess.js';

export interface Repertoire {
  /** Shown on the opponent card. */
  favourite: string;
  lines: string[];
  /**
   * Short "identity" starts with weights (round 7, below 1000): what they play as White, and their
   * answers as Black. Used instead of `lines` for the colour they cover; only the first few of
   * their own moves come from it (bookDepth), then Maia plays the opening like people at that level.
   */
  white?: [string, number][];
  black?: [string, number][];
}

export const REPERTOIRES: Record<string, Repertoire> = {
  // Coach Sam (Play Coach): a teaching repertoire of classical openings, played to full depth.
  coach: {
    favourite: 'Italian Game',
    lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
      'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
      'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Be7 Re1 d6 c3 O-O d4',
      'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
      'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4 O-O e3 c5',
      'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6',
      'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4',
    ],
  },
  lily: {
    // Lily (200) plays one book move half the time (her own first move the other half, as people at
    // 200 do); her Overconfident type brings the queen out in some games.
    favourite: 'Early queen attacks',
    lines: [],
    white: [['e4', 1], ['', 1]],
    black: [['e4 e5', 3], ['d4 d5', 1], ['c4 e5', 1], ['Nf3 e5', 1], ['', 6]],
  },
  tom: {
    // Tom (400) plays one book move: 1.e4 most of the time, 1.d4 now and then; 1...e5 against 1.e4.
    favourite: "King's Pawn (1.e4 e5)",
    lines: [],
    white: [['e4', 4], ['d4', 1]],
    black: [['e4 e5', 5], ['e4 e6', 1], ['d4 d5', 1], ['c4 e5', 1], ['Nf3 d5', 1]],
  },
  maya: {
    // Maya (600) plays two book moves: the Scandinavian with Black (1...d5 2.exd5 Nf6; ...Qxd5 is
    // left to her, as people at 600 play it now and then), and 1...e5 like most people at her level.
    favourite: 'Scandinavian Defense',
    lines: [],
    white: [['e4 e5 Nf3', 3], ['e4 c5 Nc3', 1], ['d4 d5 c4', 1]],
    black: [['e4 d5 exd5 Nf6', 3], ['e4 d5 Nc3 dxe4', 1], ['e4 e5', 3], ['d4 d5 c4 c6', 2], ['c4 e5', 1], ['Nf3 d5', 1]],
  },
  jonas: {
    // Jonas (800) plays three book moves: the King's Gambit (e4, f4, Nf3); his Gambiteer type
    // keeps the gambits coming as Black too.
    favourite: "King's Gambit",
    lines: [],
    white: [['e4 e5 f4 exf4 Nf3', 4], ['e4 e5 f4 d5 exd5', 1], ['e4 c5 f4 Nc6 Nf3', 1], ['d4 d5 c4', 1]],
    black: [['e4 e5 Nf3 Nc6 Bc4 Nf6', 3], ['e4 c6 d4 d5', 1], ['d4 d5 c4 e5', 2], ['d4 Nf6 c4 e5', 1], ['c4 e5 Nc3 Nf6', 1]],
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

/** How many of its own moves a bot plays from its book (round 7): below 1000 people leave theory
 *  almost at once, so a 400 plays one book move and then Maia; from 1200 the whole line. */
export function bookDepth(elo: number): number {
  return elo < 600 ? 1 : elo < 800 ? 2 : elo < 1000 ? 3 : elo < 1200 ? 4 : Infinity;
}

/**
 * Up to about 400, people's first moves are more varied than Maia-3's favourites (odd pawn moves,
 * early sorties): its temperature is raised by `peak` (by rating) up to move `fullUntil`, fading
 * out by `endMove`. Matched to chess.com openings per band (benchmark: openings.ts); it stays
 * clear of the blunder benchmark, which starts at ply 12.
 */
export const OPENING_TEMP = { peak: [[200, 1.7], [400, 1.5], [600, 1]] as [number, number][], fullUntil: 4, endMove: 6 };

export function openingTemperature(elo: number, moveNo: number): number {
  const c = OPENING_TEMP.peak;
  let peak = c[c.length - 1][1];
  if (elo <= c[0][0]) peak = c[0][1];
  else for (let i = 1; i < c.length; i++) if (elo <= c[i][0]) { peak = c[i - 1][1] + ((elo - c[i - 1][0]) / (c[i][0] - c[i - 1][0])) * (c[i][1] - c[i - 1][1]); break; }
  if (moveNo <= OPENING_TEMP.fullUntil) return peak;
  if (moveNo >= OPENING_TEMP.endMove) return 1;
  return peak + ((moveNo - OPENING_TEMP.fullUntil) / (OPENING_TEMP.endMove - OPENING_TEMP.fullUntil)) * (1 - peak);
}

/**
 * Between about 500 and 1000, Maia-3 castles later than people do (chess.com: 32–42% castle by move
 * 10 at 500–900): castling moves get this weight (by rating) in the first `untilMove` moves.
 */
export const OPENING_CASTLE = { weight: [[400, 1], [600, 2.5], [800, 2.5], [1000, 1.5], [1200, 1]] as [number, number][], untilMove: 10 };

export function castleWeight(elo: number, moveNo: number, san: string): number {
  if (moveNo > OPENING_CASTLE.untilMove || !san.startsWith('O-O')) return 1;
  const c = OPENING_CASTLE.weight;
  if (elo <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (elo <= c[i][0]) return c[i - 1][1] + ((elo - c[i - 1][0]) / (c[i][0] - c[i - 1][0])) * (c[i][1] - c[i - 1][1]);
  return c[c.length - 1][1];
}

/** Next book move (UCI) for the side to move, if the game so far follows one of the lines. */
export function bookMove(opponentId: string | undefined, sanHistory: string[], rand: () => number = Math.random): string | null {
  const rep = opponentId ? REPERTOIRES[opponentId] : undefined;
  if (!rep) return null;
  const n = sanHistory.length;
  // Weighted identity starts for the colour to move, else every line (with weight 1). An empty line
  // is "its own first move": at its first move it may leave the book to Maia.
  const weighted = (n % 2 === 0 ? rep.white : rep.black) ?? rep.lines.map((l) => [l, 1] as [string, number]);
  const options = weighted
    .filter(([l]) => l !== '')
    .map(([l, w]) => [l.split(' '), w] as [string[], number])
    .filter(([l]) => l.length > n && sanHistory.every((m, i) => l[i] === m))
    .map(([l, w]) => [l[n], w] as [string, number]);
  if (n < 2 && options.length) for (const [l, w] of weighted) if (l === '') options.push(['', w]);
  if (!options.length) return null;
  let x = rand() * options.reduce((a, [, w]) => a + w, 0);
  let san = options[options.length - 1][0];
  for (const [m, w] of options) {
    if ((x -= w) < 0) {
      san = m;
      break;
    }
  }
  if (!san) return null;
  const c = new Chess();
  try {
    for (const m of sanHistory) c.move(m);
    return c.move(san).lan;
  } catch {
    return null;
  }
}
