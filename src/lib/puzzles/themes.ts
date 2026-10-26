import type { Theme } from '../coach/types';

export interface ThemeSet {
  id: string; // Lichess theme name
  label: string;
  icon: string;
  description: string;
  coachTheme?: Theme;
}

export const THEME_SETS: ThemeSet[] = [
  { id: 'mateIn1', label: 'Mate in 1', icon: 'king', description: 'Find the checkmating move.', coachTheme: 'mateIn1' },
  { id: 'mateIn2', label: 'Mate in 2', icon: 'queen', description: 'Force checkmate in two moves.', coachTheme: 'mateIn2' },
  { id: 'hangingPiece', label: 'Free pieces', icon: 'gift', description: 'Spot pieces left undefended.', coachTheme: 'hangingPiece' },
  { id: 'fork', label: 'Forks', icon: 'fork', description: 'Attack two things at once.', coachTheme: 'fork' },
  { id: 'pin', label: 'Pins', icon: 'pin', description: 'Pin a piece to something more valuable.', coachTheme: 'pin' },
  { id: 'skewer', label: 'Skewers', icon: 'skewer', description: 'Attack a valuable piece and win the one behind.', coachTheme: 'skewer' },
  { id: 'discoveredAttack', label: 'Discovered attacks', icon: 'eye', description: 'Move one piece to unleash another.', coachTheme: 'discoveredAttack' },
  { id: 'backRankMate', label: 'Back-rank mates', icon: 'castle', description: 'Exploit a king trapped behind its pawns.', coachTheme: 'backRankMate' },
  { id: 'defensiveMove', label: 'Defense', icon: 'shield', description: 'Find the move that saves the day.', coachTheme: 'defense' },
  { id: 'trappedPiece', label: 'Trapped pieces', icon: 'trap', description: 'Catch a piece with nowhere to go.' },
  { id: 'deflection', label: 'Deflection', icon: 'shuffle', description: 'Lure a defender away from its job.' },
  { id: 'doubleCheck', label: 'Double check', icon: 'zap', description: 'Check with two pieces at once.' },
  { id: 'attackingF2F7', label: 'Attacking f7/f2', icon: 'target', description: 'Hit the weakest square near the king.', coachTheme: 'kingSafety' },
  { id: 'promotion', label: 'Promotion', icon: 'crown', description: 'Turn a pawn into a queen.' },
  { id: 'endgame', label: 'Endgames', icon: 'flag', description: 'Tactics with few pieces left.', coachTheme: 'endgame' },
];

export const themeLabel = (id: string) => THEME_SETS.find((t) => t.id === id)?.label ?? id;
