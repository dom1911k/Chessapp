import type { Theme } from './coach/types';

export interface ThemeInfo {
  label: string;
  /** Lichess puzzle themes that train this. */
  puzzleThemes: string[];
  lesson: string;
}

export const THEMES: Record<Theme, ThemeInfo> = {
  hangingPiece: {
    label: 'Hanging pieces',
    puzzleThemes: ['hangingPiece'],
    lesson: 'Before every move, ask: "Which of my pieces are attacked, and are they defended?" Then check whether your opponent left anything unprotected.',
  },
  defense: {
    label: 'Spotting threats',
    puzzleThemes: ['defensiveMove', 'hangingPiece'],
    lesson: 'After your opponent moves, ask "What does that move threaten?" before you make your own plan.',
  },
  fork: {
    label: 'Forks',
    puzzleThemes: ['fork'],
    lesson: 'Watch for squares where an enemy knight or queen could attack two of your pieces at once — and look for such squares for your own pieces.',
  },
  pin: {
    label: 'Pins',
    puzzleThemes: ['pin'],
    lesson: 'When a piece stands in front of your king or queen on a line, it may be pinned. Keep valuable pieces off open lines with enemy bishops, rooks and queens.',
  },
  skewer: {
    label: 'Skewers',
    puzzleThemes: ['skewer'],
    lesson: 'Avoid lining up your king or queen in front of another piece on an open line — a skewer wins the piece behind.',
  },
  discoveredAttack: {
    label: 'Discovered attacks',
    puzzleThemes: ['discoveredAttack'],
    lesson: 'When an enemy piece stands between their bishop, rook or queen and your pieces, imagine it moving away — what would be attacked?',
  },
  backRankMate: {
    label: 'Back-rank mates',
    puzzleThemes: ['backRankMate'],
    lesson: 'Give your castled king an escape square (for example a pawn move like h3 or g3) before your back rank gets crowded.',
  },
  mateIn1: {
    label: 'Mate in 1',
    puzzleThemes: ['mateIn1'],
    lesson: 'Every move, look at all your checks first. Sometimes one of them is checkmate!',
  },
  mateIn2: {
    label: 'Mate in 2',
    puzzleThemes: ['mateIn2'],
    lesson: 'Look for forcing moves — checks, captures and threats — they can lead to checkmate in a couple of moves.',
  },
  mate: {
    label: 'Checkmate patterns',
    puzzleThemes: ['mateIn1', 'mateIn2', 'mateIn3'],
    lesson: 'Keep an eye on your king: if the opponent has many pieces near it, look for checks they could play.',
  },
  trade: {
    label: 'Trades',
    puzzleThemes: ['hangingPiece', 'crushing'],
    lesson: 'Before capturing, count: what do you win, and what can your opponent take back? A queen for a pawn is a bad deal.',
  },
  opening: {
    label: 'Opening principles',
    puzzleThemes: ['opening'],
    lesson: 'In the opening: control the center, develop knights and bishops, castle early, and avoid moving the same piece twice.',
  },
  kingSafety: {
    label: 'King safety',
    puzzleThemes: ['kingsideAttack', 'attackingF2F7'],
    lesson: 'Castle early and keep the pawns in front of your king where they are, unless you have a good reason to push them.',
  },
  endgame: {
    label: 'Endgames',
    puzzleThemes: ['endgame', 'pawnEndgame', 'rookEndgame'],
    lesson: 'In the endgame your king becomes a fighting piece — bring it toward the center.',
  },
  material: {
    label: 'Calculation',
    puzzleThemes: ['advantage', 'crushing'],
    lesson: 'Before moving, take a few seconds for a "blunder check": what is my opponent\'s best reply to this move?',
  },
};
