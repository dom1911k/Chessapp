// Badges: the one track with each opponent. Eight feats you can earn once each against every
// opponent; five of them open that opponent's special challenge. (Rivalry points and levels from
// earlier versions stay in the stored records but are no longer shown or written.)
import { Chess } from 'chess.js';
import type { GameRecord } from '../store/types';

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

/** Badges with one opponent that open their special challenge. */
export const CHALLENGE_BADGES = 5;

/** The next badge to go for: the first one in order you don't hold yet. */
export const nextBadge = (held: string[] | undefined) => BADGES.find((b) => !(held ?? []).includes(b.id));

export interface RivalryChange {
  /** Badges this game earned (in BADGES order). */
  newBadges: string[];
  /** Badges held against them after this game, and which. */
  badges: number;
  held: string[];
}
