import type { Theme } from '../coach/types';

export interface ThemeSet {
  id: string; // Lichess theme name
  label: string;
  icon: string;
  description: string;
  coachTheme?: Theme;
  /** Group on the Custom Puzzles screen. */
  group?: 'Checkmates' | 'Tactics' | 'Ideas' | 'Phases';
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
  { id: 'mateIn3', label: 'Mate in 3', icon: 'crown', description: 'Three moves to checkmate.' },
  { id: 'smotheredMate', label: 'Smothered mate', icon: 'knight', description: 'A knight mates a king boxed in by its own pieces.' },
  { id: 'kingsideAttack', label: 'Kingside attack', icon: 'swords', description: 'Break through to the castled king.' },
  { id: 'exposedKing', label: 'Exposed king', icon: 'crosshair', description: 'Punish a king without cover.' },
  { id: 'sacrifice', label: 'Sacrifices', icon: 'flame', description: 'Give material to get more back.' },
  { id: 'attraction', label: 'Attraction', icon: 'target', description: 'Lure a piece onto a bad square.' },
  { id: 'capturingDefender', label: 'Remove the defender', icon: 'shield', description: 'Take the piece that guards.' },
  { id: 'clearance', label: 'Clearance', icon: 'bridge', description: 'Clear a square or line for another piece.' },
  { id: 'interference', label: 'Interference', icon: 'wall', description: 'Block the line between two enemy pieces.' },
  { id: 'xRayAttack', label: 'X-ray', icon: 'eye', description: 'Attack through another piece.' },
  { id: 'intermezzo', label: 'In-between moves', icon: 'zap', description: 'A surprise move before the expected one.' },
  { id: 'quietMove', label: 'Quiet moves', icon: 'coffee', description: 'The strongest move is not a check or capture.' },
  { id: 'zugzwang', label: 'Zugzwang', icon: 'repeat', description: 'Any move they make loses.' },
  { id: 'advancedPawn', label: 'Advanced pawns', icon: 'pawn', description: 'Push and support a pawn near promotion.' },
  { id: 'opening', label: 'Opening tactics', icon: 'book', description: 'Tricks in the first moves.' },
  { id: 'rookEndgame', label: 'Rook endgames', icon: 'rook', description: 'The most common endgame.' },
  { id: 'pawnEndgame', label: 'Pawn endgames', icon: 'square', description: 'King and pawns: every tempo counts.' },
];

const GROUPS: Record<string, ThemeSet['group']> = {
  mateIn1: 'Checkmates', mateIn2: 'Checkmates', mateIn3: 'Checkmates', backRankMate: 'Checkmates', smotheredMate: 'Checkmates', kingsideAttack: 'Checkmates', exposedKing: 'Checkmates',
  hangingPiece: 'Tactics', fork: 'Tactics', pin: 'Tactics', skewer: 'Tactics', discoveredAttack: 'Tactics', doubleCheck: 'Tactics', trappedPiece: 'Tactics', attackingF2F7: 'Tactics', xRayAttack: 'Tactics',
  deflection: 'Ideas', sacrifice: 'Ideas', attraction: 'Ideas', capturingDefender: 'Ideas', clearance: 'Ideas', interference: 'Ideas', intermezzo: 'Ideas', quietMove: 'Ideas', defensiveMove: 'Ideas', zugzwang: 'Ideas',
  opening: 'Phases', endgame: 'Phases', promotion: 'Phases', advancedPawn: 'Phases', rookEndgame: 'Phases', pawnEndgame: 'Phases',
};
for (const t of THEME_SETS) t.group = GROUPS[t.id] ?? 'Tactics';
export const THEME_GROUPS = ['Checkmates', 'Tactics', 'Ideas', 'Phases'] as const;

export const themeLabel = (id: string) => THEME_SETS.find((t) => t.id === id)?.label ?? id;
