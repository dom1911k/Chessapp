// The skill tree: your chess skills, each growing from puzzles you solve, tactics
// you play in real games and lessons you finish. Bronze → Silver → Gold.
import { db, kvGet } from '../db';
import { getCareer, type TacticCounts } from './career';

export type Tier = 0 | 1 | 2 | 3;
export const TIERS = [
  { name: 'Not started', points: 0, color: '#a8a29e' },
  { name: 'Bronze', points: 10, color: '#c27c3e' },
  { name: 'Silver', points: 30, color: '#94a3b8' },
  { name: 'Gold', points: 75, color: '#eab308' },
] as const;

export interface Skill {
  id: string;
  name: string;
  icon: string;
  branch: 'safety' | 'tactics' | 'mates' | 'endgame';
  description: string;
  /** Lichess puzzle themes: 1 point per solved puzzle. */
  puzzles: string[];
  /** Tactics played in games: points each. */
  game?: { key: keyof TacticCounts; points: number }[];
  /** Lessons (ids, incl. mate patterns): 5 points each. */
  lessons?: string[];
  /** Puzzle set to train it (THEME_SETS id). */
  train?: string;
}

export const BRANCHES = [
  { id: 'safety', name: 'Safety', color: '#0ea5e9' },
  { id: 'tactics', name: 'Tactics', color: '#f97316' },
  { id: 'mates', name: 'Checkmates', color: '#e11d48' },
  { id: 'endgame', name: 'Endgames', color: '#8b5cf6' },
] as const;

export const SKILLS: Skill[] = [
  { id: 'free', name: 'Free pieces', icon: 'gift', branch: 'safety', description: 'Spot pieces left without protection — yours and theirs.', puzzles: ['hangingPiece'], lessons: ['hanging'], train: 'hangingPiece' },
  { id: 'defense', name: 'Spotting threats', icon: 'shield', branch: 'safety', description: 'See what your opponent wants and stop it.', puzzles: ['defensiveMove'], train: 'defensiveMove' },
  { id: 'king', name: 'King safety', icon: 'castle', branch: 'safety', description: 'Keep your king tucked away and safe.', puzzles: ['kingsideAttack', 'attackingF2F7'], lessons: ['opening'], train: 'attackingF2F7' },
  { id: 'forks', name: 'Forks', icon: 'fork', branch: 'tactics', description: 'Attack two things at once.', puzzles: ['fork'], game: [{ key: 'forks', points: 3 }, { key: 'royalForks', points: 3 }], lessons: ['forks'], train: 'fork' },
  { id: 'pins', name: 'Pins & skewers', icon: 'pin', branch: 'tactics', description: 'Use pieces lined up on a line.', puzzles: ['pin', 'skewer'], game: [{ key: 'pins', points: 3 }, { key: 'skewers', points: 3 }], lessons: ['pins'], train: 'pin' },
  { id: 'discovered', name: 'Discovered attacks', icon: 'eye', branch: 'tactics', description: 'Move one piece to unleash another.', puzzles: ['discoveredAttack', 'doubleCheck'], game: [{ key: 'discovered', points: 3 }], train: 'discoveredAttack' },
  { id: 'defender', name: 'Remove the defender', icon: 'shuffle', branch: 'tactics', description: 'Take or lure away the guard.', puzzles: ['capturingDefender', 'deflection'], lessons: ['defender'], train: 'deflection' },
  { id: 'mate1', name: 'Mate in one', icon: 'king', branch: 'mates', description: 'Find the finishing blow.', puzzles: ['mateIn1'], game: [{ key: 'checkmates', points: 3 }], lessons: ['checkmate'], train: 'mateIn1' },
  { id: 'backrank', name: 'Back-rank mates', icon: 'castle', branch: 'mates', description: 'Catch a king stuck behind its pawns.', puzzles: ['backRankMate'], game: [{ key: 'backRankMates', points: 5 }], lessons: ['backrank', 'mate-backrank'], train: 'backRankMate' },
  { id: 'mate2', name: 'Mate in two', icon: 'queen', branch: 'mates', description: 'Force checkmate in a couple of moves.', puzzles: ['mateIn2', 'mateIn3'], lessons: ['mate2'], train: 'mateIn2' },
  { id: 'patterns', name: 'Mating patterns', icon: 'crown', branch: 'mates', description: 'Smothered, Arabian, Opera and more.', puzzles: ['smotheredMate', 'arabianMate', 'anastasiaMate', 'hookMate', 'bodenMate', 'doubleBishopMate'], game: [{ key: 'smotheredMates', points: 8 }], lessons: ['mate-ladder', 'mate-kingrook', 'mate-kiss', 'mate-smothered', 'mate-arabian', 'mate-scholar', 'mate-helper', 'mate-opera', 'mate-corner'] },
  { id: 'pawns', name: 'Pawn power', icon: 'pawn', branch: 'endgame', description: 'Push passed pawns and make a new queen.', puzzles: ['promotion', 'advancedPawn', 'pawnEndgame'], game: [{ key: 'promotions', points: 3 }], lessons: ['pawns'], train: 'promotion' },
  { id: 'endgames', name: 'Endgames', icon: 'flag', branch: 'endgame', description: 'Win when only a few pieces are left.', puzzles: ['endgame', 'rookEndgame', 'queenEndgame'], train: 'endgame' },
];

export interface SkillState {
  points: number;
  tier: Tier;
  /** Progress towards the next tier, 0..1 (1 at gold). */
  toNext: number;
}

export function tierFor(points: number): Tier {
  return points >= TIERS[3].points ? 3 : points >= TIERS[2].points ? 2 : points >= TIERS[1].points ? 1 : 0;
}

export async function skillStates(extra: TacticCounts = {}): Promise<Record<string, SkillState>> {
  const attempts = await db.attempts.toArray();
  const career = await getCareer();
  const lessons = new Set(await kvGet<string[]>('lessonsDone', []));
  const drills = await kvGet<Record<string, { completed: number }>>('endgameProgress', {});
  const solved = new Map<string, number>();
  for (const a of attempts) if (a.success) for (const t of a.themes ?? []) solved.set(t, (solved.get(t) ?? 0) + 1);
  const out: Record<string, SkillState> = {};
  for (const s of SKILLS) {
    let points = s.puzzles.reduce((n, t) => n + (solved.get(t) ?? 0), 0);
    for (const g of s.game ?? []) points += ((career[g.key] ?? 0) + (extra[g.key] ?? 0)) * g.points;
    points += (s.lessons ?? []).filter((l) => lessons.has(l)).length * 5;
    if (s.id === 'endgames') points += Object.values(drills).filter((d) => d.completed > 0).length * 5;
    const tier = tierFor(points);
    const lo = TIERS[tier].points;
    const hi = tier < 3 ? TIERS[(tier + 1) as Tier].points : lo;
    out[s.id] = { points, tier, toNext: tier === 3 ? 1 : (points - lo) / (hi - lo) };
  }
  return out;
}
