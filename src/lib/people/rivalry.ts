// Badges: the one track with each opponent. Eight feats you can earn once each against every
// opponent; seven of them open that opponent's special challenge. (Rivalry points and levels from
// earlier versions stay in the stored records but are no longer shown or written.)
import { Chess } from 'chess.js';
import { povScore, scoreToCp } from '../chess/evaluation';
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
  // Every real game is without help now, so the old "On your own" (id kept) became Comeback.
  { id: 'clean', label: 'Comeback', hint: 'Win a game you were losing' },
  { id: 'sharp', label: 'Sharp', hint: 'Win with 85% accuracy or more' },
  { id: 'quick', label: 'Quick work', hint: 'Win in 30 moves or fewer' },
  { id: 'mate', label: 'Checkmate', hint: 'Win by checkmate' },
  // And the old "Match play" (id kept) became With a clock.
  { id: 'match', label: 'With a clock', hint: 'Win a timed game' },
  { id: 'streak', label: 'Hat-trick', hint: 'Win three games in a row against them' },
];

/** Badges this game earns (ignoring ones already held). `streak` is your win run against them including this game. */
export function badgesEarned(g: GameRecord, streak: number): string[] {
  if (g.userResult !== 'win') return [];
  const out: string[] = [g.userColor === 'w' ? 'white' : 'black'];
  if (wasLosing(g)) out.push('clean');
  if (g.summary.accuracy >= 85) out.push('sharp');
  if (g.plies.filter((p) => p.isUser).length <= 30) out.push('quick');
  const last = g.plies[g.plies.length - 1];
  if (g.reason === 'checkmate' || (last && new Chess(last.fenAfter).isCheckmate())) out.push('mate');
  if (g.timeControl) out.push('match');
  if (streak >= 3) out.push('streak');
  return out;
}

/** Comeback: your evaluation was −3 or worse at some point after move 10 (plies are scored from White's side). */
export function wasLosing(g: Pick<GameRecord, 'plies' | 'userColor'>): boolean {
  return g.plies.some((p, i) => i >= 20 && !!p.evalAfter && scoreToCp(povScore(p.evalAfter, g.userColor)) <= -300);
}

/**
 * Badges with one opponent that open their special challenge. Seven of eight: one win can earn
 * four or five at once, so it takes several games (With Black, Comeback, With a clock, Hat-trick).
 */
export const CHALLENGE_BADGES = 7;

/** The next badge to go for: the first one in order you don't hold yet. */
export const nextBadge = (held: string[] | undefined) => BADGES.find((b) => !(held ?? []).includes(b.id));

export interface RivalryChange {
  /** Badges this game earned (in BADGES order). */
  newBadges: string[];
  /** Badges held against them after this game, and which. */
  badges: number;
  held: string[];
}
