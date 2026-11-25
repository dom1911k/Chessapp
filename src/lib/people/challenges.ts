// Each opponent's special challenge. It opens once you hold 7 of the 8 badges against them
// (see rivalry.ts) and rewards something unique from their world.
import type { GameRecord } from '../store/types';
import { Chess } from 'chess.js';

export interface Challenge {
  opponentId: string;
  title: string;
  description: string;
  /** Cosmetic ids unlocked by completing it. */
  rewards: string[];
  check: (g: GameRecord) => boolean;
}

const won = (g: GameRecord) => g.userResult === 'win';
const userMoves = (g: GameRecord) => g.plies.filter((p) => p.isUser).length;
const finalFen = (g: GameRecord) => g.plies[g.plies.length - 1]?.fenAfter ?? g.startFen;
/** The game reached an endgame: at some point both queens were off the board. */
export const queensOff = (g: Pick<GameRecord, 'plies'>) => g.plies.some((p) => !/[qQ]/.test(p.fenAfter.split(' ')[0]));
const hasOwnQueen = (g: GameRecord) => {
  const c = new Chess(finalFen(g));
  return c.board().flat().some((p) => p?.type === 'q' && p.color === g.userColor);
};

export const CHALLENGES: Challenge[] = [
  { opponentId: 'lily', title: 'Speedy win', description: 'Win in 20 moves or fewer.', rewards: ['board-candy'], check: (g) => won(g) && userMoves(g) <= 20 },
  // Id and rewards kept; every real game is without help now (round 7), so it suits his grinding instead.
  { opponentId: 'tom', title: 'Out-grind the grinder', description: 'Win a game that reached an endgame (queens off).', rewards: ['board-park'], check: (g) => won(g) && queensOff(g) },
  { opponentId: 'maya', title: 'Top of the class', description: 'Win with 80% accuracy or more.', rewards: ['pieces-candy'], check: (g) => won(g) && g.summary.accuracy >= 80 },
  { opponentId: 'jonas', title: 'Keep your queen', description: 'Win with your queen still on the board.', rewards: ['board-cafe'], check: (g) => won(g) && hasOwnQueen(g) },
  { opponentId: 'priya', title: 'Spotless', description: 'Win without a single mistake or blunder.', rewards: ['board-library'], check: (g) => won(g) && g.summary.counts.mistake + g.summary.counts.blunder === 0 },
  { opponentId: 'marcus', title: 'Hunter hunted', description: 'Win by checkmate.', rewards: ['board-neon'], check: (g) => won(g) && g.reason === 'checkmate' },
  { opponentId: 'sofia', title: 'Black belt', description: 'Win with the black pieces.', rewards: ['board-hall'], check: (g) => won(g) && g.userColor === 'b' },
  { opponentId: 'viktor', title: 'Endgame technique', description: 'Win a game in which you promoted a pawn.', rewards: ['board-oldclub'], check: (g) => won(g) && g.plies.some((p) => p.isUser && /=/.test(p.san)) },
  { opponentId: 'mei', title: 'Hold the champion', description: 'Draw or win against Mei.', rewards: ['board-jade', 'pieces-jade'], check: (g) => g.userResult !== 'loss' },
];

export const challengeFor = (id: string | undefined) => CHALLENGES.find((c) => c.opponentId === id);
