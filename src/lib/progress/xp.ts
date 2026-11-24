// Legacy experience points and levels. XP is no longer awarded (round 4) but the stored total
// stays: the level it reached still keeps what it unlocked (looks, frames, titles) unlocked.
import { kvGet } from '../db';

export const LEVEL_TITLES = [
  'Newcomer',
  'Pawn Pusher',
  'Curious Knight',
  'Bishop in Training',
  'Castle Builder',
  'Fork Finder',
  'Pin Master',
  'Rook Lifter',
  'Endgame Explorer',
  "Queen's Friend",
  'Club Player',
  'Tactician',
  'Strategist',
  'Expert in the Making',
  'Master of the Board',
];

/** Total XP needed to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelFor(total: number): { level: number; into: number; span: number; title: string } {
  let level = 1;
  while (total >= xpForLevel(level + 1)) level++;
  const into = total - xpForLevel(level);
  const span = xpForLevel(level + 1) - xpForLevel(level);
  return { level, into, span, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] };
}

export const getXp = () => kvGet<number>('xp', 0);
