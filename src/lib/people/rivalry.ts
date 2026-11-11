// Rivalries: the progression with each opponent that never ends. Every finished game earns
// rivalry points (a win most, but a loss still counts), points raise your rivalry level with
// that opponent, and eight matchup badges give you something specific to go for.
import { Chess } from 'chess.js';
import type { GameRecord } from '../store/types';

/** Points for a finished game: win 3, draw 2, loss 1 — plus 1 for a win with no hints or take-backs. */
export function rivalryPoints(g: Pick<GameRecord, 'userResult' | 'hintsUsed' | 'takebacks'>): number {
  const base = g.userResult === 'win' ? 3 : g.userResult === 'draw' ? 2 : 1;
  return base + (g.userResult === 'win' && g.hintsUsed + g.takebacks === 0 ? 1 : 0);
}

/** Points needed to go from level n to n+1: 6, 8, 10, … (so the early levels come quickly). */
export const levelSpan = (level: number) => 4 + 2 * level;

export function rivalryLevel(points: number): { level: number; into: number; span: number; /** level + fraction, for fill bars */ pos: number } {
  let level = 1;
  let left = Math.max(0, points);
  while (left >= levelSpan(level)) {
    left -= levelSpan(level);
    level++;
  }
  return { level, into: left, span: levelSpan(level), pos: level + left / levelSpan(level) };
}

const RANKS: [number, string][] = [[1, 'New face'], [2, 'Acquaintance'], [3, 'Sparring partner'], [5, 'Rival'], [8, 'Arch-rival'], [12, 'Nemesis'], [16, 'Legendary rivalry']];
/** What the two of you are to each other at a rivalry level. */
export const rivalryRank = (level: number) => [...RANKS].reverse().find(([l]) => level >= l)![1];

/** XP bonus for reaching a rivalry level. */
export const rivalryXp = (level: number) => Math.min(100, 10 * level);

export interface Badge {
  id: string;
  label: string;
  hint: string;
}

/** The same eight feats against every opponent; each can be earned once per opponent. */
export const BADGES: Badge[] = [
  { id: 'white', label: 'With White', hint: 'Win with the white pieces' },
  { id: 'black', label: 'With Black', hint: 'Win with the black pieces' },
  { id: 'clean', label: 'On your own', hint: 'Win without hints or take-backs' },
  { id: 'sharp', label: 'Sharp', hint: 'Win with 85% accuracy or more' },
  { id: 'quick', label: 'Quick work', hint: 'Win in 30 moves or fewer' },
  { id: 'mate', label: 'Checkmate', hint: 'Win by checkmate' },
  { id: 'match', label: 'Match play', hint: 'Win under match conditions' },
  { id: 'streak', label: 'Hat-trick', hint: 'Win three games in a row against them' },
];

/** Badges this game earns (ignoring ones already held). `streak` is your win run against them including this game. */
export function badgesEarned(g: GameRecord, streak: number): string[] {
  if (g.userResult !== 'win') return [];
  const out: string[] = [g.userColor === 'w' ? 'white' : 'black'];
  if (g.hintsUsed + g.takebacks === 0) out.push('clean');
  if (g.summary.accuracy >= 85) out.push('sharp');
  if (g.plies.filter((p) => p.isUser).length <= 30) out.push('quick');
  const last = g.plies[g.plies.length - 1];
  if (g.reason === 'checkmate' || (last && new Chess(last.fenAfter).isCheckmate())) out.push('mate');
  if (g.match) out.push('match');
  if (streak >= 3) out.push('streak');
  return out;
}

/** Each new badge is worth this many rivalry points. */
export const BADGE_POINTS = 3;

export interface RivalryChange {
  pointsBefore: number;
  pointsAfter: number;
  gained: number;
  levelBefore: number;
  levelAfter: number;
  newBadges: string[];
  /** XP earned from rivalry levels reached in this game. */
  xp: number;
}
