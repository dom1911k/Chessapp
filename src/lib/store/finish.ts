import { START_FEN, type GameResult } from '../chess/game';
import { bumpActivity, db, kvSet } from '../db';
import { detectOpening } from '../openings';
import { recurringPattern, summarize } from '../report';
import { recordOpponentGame } from '../people/record';
import { progress } from '../progress';
import { newCardDue, type Card } from '../srs';
import type { GameRecord, SavedGame } from './types';
import { addToCareer, type TacticCounts } from '../rewards/career';
import { rateGame, MILESTONES, type Milestone } from '../rewards/rating';
import { skillStates, SKILLS, type Tier } from '../rewards/skills';
import { freshUnlocks, type Cosmetic } from '../rewards/cosmetics';
import { getXp } from '../progress/xp';
import { ACHIEVEMENTS, checkAchievements, unlockedAchievements, type Achievement } from '../progress/achievements';
import { MAX_STARS } from '../people/record';
import { TACTIC_KEYS } from '../rewards/career';

export const FOCUS_KEY = 'focusTheme';

export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Store the finished game, turn its mistakes into review cards, and set the lesson focus. */
export interface FinishInfo {
  gameId: number;
  stars: number;
  firstWin: boolean;
  rewards: GameRewards;
}

/** Everything the results screen shows. */
export interface GameRewards {
  userResult: 'win' | 'loss' | 'draw';
  reason: string;
  opponentId?: string;
  accuracy: number;
  starsBefore: number;
  starsAfter: number;
  /** All five stars just reached: the special challenge opens. */
  challengeOpened: boolean;
  challengeDone: boolean;
  xpBefore: number;
  xpAfter: number;
  ratingBefore: number;
  ratingAfter: number;
  /** Journey milestones reached with this game. */
  milestones: Milestone[];
  achievements: Achievement[];
  unlocks: Cosmetic[];
  tactics: TacticCounts;
  /** Skills that moved up a tier. */
  skillsUp: { id: string; tier: Tier }[];
  /** Skills that gained points. */
  skillsGained: { id: string; points: number }[];
}

export async function finishGame(g: SavedGame, result: GameResult, reason: string): Promise<FinishInfo> {
  const userResult =
    result === '1/2-1/2' ? 'draw' : (result === '1-0') === (g.userColor === 'w') ? 'win' : 'loss';
  const summary = summarize(g.plies);
  const recent = await db.games.orderBy('endedAt').reverse().limit(4).toArray();
  summary.pattern = recurringPattern([g.plies, ...recent.map((r) => r.plies)]);
  const { id: _id, ...rest } = g;
  void _id;
  const record: GameRecord = {
    ...rest,
    endedAt: Date.now(),
    result,
    reason,
    userResult,
    summary,
    opening: g.startFen === START_FEN ? detectOpening(g.plies.map((p) => p.san))?.name : undefined,
    tactics: gameTactics(g),
  };
  const gameId = await db.transaction('rw', [db.games, db.current, db.cards], async () => {
    const id = await db.games.add(record);
    await db.current.delete('play');
    const cards: Card[] = [];
    g.plies.forEach((p, i) => {
      if (!p.isUser || (p.classification !== 'mistake' && p.classification !== 'blunder')) return;
      const best = p.comment?.bestUci;
      if (!best || best === p.uci) return;
      cards.push({
        id: `m:${id}:${i}`,
        kind: 'mistake',
        fen: p.fenBefore,
        solution: [best],
        playedUci: p.uci,
        playedSan: p.san,
        themes: p.comment?.themes ?? [],
        label: `From your game on ${formatDate(g.startedAt)}`,
        explanation: p.comment?.text,
        gameId: id,
        createdAt: Date.now(),
        due: newCardDue(),
        step: 0,
        reps: 0,
        lapses: 0,
      });
    });
    await db.cards.bulkPut(cards);
    return id;
  });
  await bumpActivity('games');
  const xpBefore = await getXp();
  const skillsBefore = await skillStates();
  const rec = await recordOpponentGame({ ...record, id: gameId });
  await addToCareer(record.tactics ?? {});
  const { before: rb, after: ra } = await rateGame(g.elo, userResult === 'win' ? 1 : userResult === 'draw' ? 0.5 : 0, g.hintsUsed + g.takebacks);
  await progress({ kind: 'game', result: userResult, accuracy: summary.accuracy });
  // A recurring pattern beats a one-game lesson for steering puzzle practice.
  const focus = summary.pattern?.theme ?? summary.lessonTheme;
  if (focus) await kvSet(FOCUS_KEY, { theme: focus, until: Date.now() + 7 * 864e5 });

  const skillsAfter = await skillStates();
  const unlockedAt = await unlockedAchievements();
  const rewards: GameRewards = {
    userResult,
    reason,
    opponentId: g.opponentId,
    accuracy: summary.accuracy,
    starsBefore: rec?.starsBefore ?? 0,
    starsAfter: rec?.stars ?? 0,
    challengeOpened: (rec?.starsBefore ?? 0) < MAX_STARS && (rec?.stars ?? 0) >= MAX_STARS,
    challengeDone: rec?.challengeDone ?? false,
    xpBefore,
    xpAfter: await getXp(),
    ratingBefore: rb.rating,
    ratingAfter: ra.rating,
    milestones: MILESTONES.filter((m) => m.rating > rb.peak && m.rating <= ra.peak),
    achievements: ACHIEVEMENTS.filter((a) => (unlockedAt[a.id] ?? 0) >= g.startedAt),
    unlocks: await freshUnlocks(),
    tactics: record.tactics ?? {},
    skillsUp: SKILLS.filter((k) => skillsAfter[k.id].tier > skillsBefore[k.id].tier).map((k) => ({ id: k.id, tier: skillsAfter[k.id].tier })),
    skillsGained: SKILLS.filter((k) => skillsAfter[k.id].points > skillsBefore[k.id].points).map((k) => ({ id: k.id, points: skillsAfter[k.id].points - skillsBefore[k.id].points })),
  };
  // Unlocking items can complete the "Collector" achievement.
  if (rewards.unlocks.length) rewards.achievements.push(...(await checkAchievements()));
  return { gameId, stars: rec?.stars ?? 0, firstWin: rec?.firstWin ?? false, rewards };
}

/** Tactics you played this game, summed over your moves (take-backs drop out by themselves). */
export function gameTactics(g: SavedGame): TacticCounts {
  const out: TacticCounts = {};
  for (const p of g.plies) {
    if (!p.isUser || !p.tactics) continue;
    for (const k of TACTIC_KEYS) if (p.tactics[k]) out[k] = (out[k] ?? 0) + p.tactics[k]!;
  }
  return out;
}
