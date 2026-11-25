import type { RivalryChange } from '../people/rivalry';
import { recordRematch } from '../rematch';
import { START_FEN, type GameResult } from '../chess/game';
import { bumpActivity, db, kvGet, kvSet } from '../db';
import { detectOpening } from '../openings';
import { hasAccuracy, recurringPattern, summarize, accuracyAverage } from '../report';
import { recordOpponentGame } from '../people/record';
import { progress } from '../progress';
import { newCardDue, type Card } from '../srs';
import type { GameRecord, SavedGame } from './types';
import { addToCareer, type TacticCounts } from '../rewards/career';
import { rateGame, MILESTONES, type Milestone } from '../rewards/rating';
import { skillStates, SKILLS, type Tier } from '../rewards/skills';
import { freshUnlocks, type Cosmetic } from '../rewards/cosmetics';
import { ACHIEVEMENTS, checkAchievements, unlockedAchievements, type Achievement } from '../progress/achievements';
import { reviewGame } from '../review';
import { cpLosses, gameRating } from '../reviewText';
import { OPPONENTS } from '../people';
import { TACTIC_KEYS } from '../rewards/career';
import { BEST_WIN_STREAK, currentWinStreak } from '../stats';
import { afterSparring, getSparring, saveSparring } from '../sparring';

export const FOCUS_KEY = 'focusTheme';

export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** chess.com's rule: until each side has made 2 moves, the game can be aborted instead of resigned. */
export function canAbort(g: { plies: { isUser: boolean }[] }): boolean {
  const mine = g.plies.filter((p) => p.isUser).length;
  return mine < 2 || g.plies.length - mine < 2;
}

export { shortDate } from '../dates';

/** Store the finished game, turn its mistakes into review cards, and set the lesson focus. */
export interface FinishInfo {
  gameId: number;
  firstWin: boolean;
  rewards: GameRewards;
}

/** Everything the results screen shows. */
export interface GameRewards {
  userResult: 'win' | 'loss' | 'draw';
  reason: string;
  opponentId?: string;
  accuracy: number;
  /** Your average over the previous 10 games with an accuracy (once there are 3): "Accuracy · avg 58%". */
  accuracyAvg?: number;
  /** None of your moves were analysed (resigned before moving): the sheet shows "—". */
  noMoves?: boolean;
  /** Badges from this game against this opponent. */
  rivalry?: RivalryChange;
  /** The fifth badge just came in: the special challenge opens. */
  challengeOpened: boolean;
  challengeDone: boolean;
  ratingBefore: number;
  ratingAfter: number;
  /** How strongly you played this game on the bots' scale (as in the review summary); none for short games. */
  gameRating?: number;
  /** Journey milestones reached with this game. */
  milestones: Milestone[];
  achievements: Achievement[];
  unlocks: Cosmetic[];
  tactics: TacticCounts;
  /** Skills that moved up a tier. */
  skillsUp: { id: string; tier: Tier }[];
  /** Skills that gained points. */
  skillsGained: { id: string; points: number }[];
  /** Wins in a row against the bots after this game, and your best ever. */
  winStreak?: number;
  bestWinStreak?: number;
  newBestStreak?: boolean;
  /** First ever win against this opponent, and the opponent it unlocked (if any). */
  firstWin?: boolean;
  unlocked?: string;
}

/**
 * `opts.cup`: a game from the Cups tab. It is stored and rewarded like any game, but leaves the
 * game in progress on the Play tab alone, and adds no review cards (Cups adds its own through
 * src/cups/bridge.ts).
 */
export async function finishGame(g: SavedGame, result: GameResult, reason: string, opts: { cup?: boolean } = {}): Promise<FinishInfo | null> {
  // Each game is recorded (and rewarded) exactly once.
  if (await db.games.filter((r) => r.startedAt === g.startedAt).first()) {
    if (!opts.cup) await db.current.delete('play');
    return null;
  }
  const userResult =
    result === '1/2-1/2' ? 'draw' : (result === '1-0') === (g.userColor === 'w') ? 'win' : 'loss';
  const summary = summarize(g.plies);
  // Real games count too: the latest analysed chess.com games join the app's own.
  const recentApp = await db.games.orderBy('endedAt').reverse().limit(4).toArray();
  const recentCc = (await db.imported.orderBy('endedAt').reverse().limit(12).toArray()).filter((x) => x.analyzed).slice(0, 4);
  const recent = [...recentApp, ...recentCc].sort((a, b) => b.endedAt - a.endedAt).slice(0, 4);
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
    opponentName: g.sparring ? 'Sparring partner' : g.rematch ? `${g.rematch.name} (stand-in)` : undefined,
  };
  const gameId = await db.transaction('rw', [db.games, db.current, db.cards], async () => {
    const id = await db.games.add(record);
    if (opts.cup) return id;
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
  const skillsBefore = await skillStates();
  const rec = await recordOpponentGame({ ...record, id: gameId });
  await addToCareer(record.tactics ?? {});
  // Rematches: results per chess.com opponent.
  if (g.rematch && !opts.cup) await recordRematch(g.rematch.name, userResult);
  // The sparring partner moves its rating to keep you near 50%.
  if (g.sparring && !opts.cup) await saveSparring(afterSparring(await getSparring(g.elo), userResult));
  const { before: rb, after: ra } = await rateGame(g.elo, userResult === 'win' ? 1 : userResult === 'draw' ? 0.5 : 0, g.hintsUsed + g.takebacks);
  await progress({ kind: 'game', result: userResult, accuracy: summary.accuracy });
  // A recurring pattern beats a one-game lesson for steering puzzle practice.
  const focus = summary.pattern?.theme ?? summary.lessonTheme;
  if (focus) await kvSet(FOCUS_KEY, { theme: focus, until: Date.now() + 7 * 864e5 });

  // Context for the accuracy: your previous games (not this one).
  const avg = accuracyAverage(await db.games.orderBy('endedAt').reverse().filter((x) => x.id !== gameId).limit(40).toArray());
  const skillsAfter = await skillStates();
  const streakNow = await currentWinStreak();
  const bestBefore = await kvGet<number>(BEST_WIN_STREAK, 0);
  const newBestStreak = streakNow > bestBefore && streakNow >= 2;
  if (streakNow > bestBefore) await kvSet(BEST_WIN_STREAK, streakNow);
  const unlockedAt = await unlockedAchievements();
  const rewards: GameRewards = {
    userResult,
    reason,
    opponentId: g.opponentId,
    accuracy: summary.accuracy,
    ...(avg !== null ? { accuracyAvg: avg } : {}),
    noMoves: !hasAccuracy(summary) || undefined,
    challengeOpened: rec?.challengeOpened ?? false,
    challengeDone: rec?.challengeDone ?? false,
    ratingBefore: rb.rating,
    ratingAfter: ra.rating,
    gameRating: perfOf(record),
    milestones: MILESTONES.filter((m) => m.rating > rb.peak && m.rating <= ra.peak),
    achievements: ACHIEVEMENTS.filter((a) => (unlockedAt[a.id] ?? 0) >= g.startedAt),
    unlocks: await freshUnlocks(),
    tactics: record.tactics ?? {},
    skillsUp: SKILLS.filter((k) => skillsAfter[k.id].tier > skillsBefore[k.id].tier).map((k) => ({ id: k.id, tier: skillsAfter[k.id].tier })),
    skillsGained: SKILLS.filter((k) => skillsAfter[k.id].points > skillsBefore[k.id].points).map((k) => ({ id: k.id, points: skillsAfter[k.id].points - skillsBefore[k.id].points })),
    firstWin: rec?.firstWin ?? false,
    rivalry: rec?.rivalry,
    // The ladder's first three are always open; beating one of the others opens the next.
    unlocked: rec?.firstWin && g.opponentId && OPPONENTS.findIndex((x) => x.id === g.opponentId) + 1 >= 3 ? OPPONENTS[OPPONENTS.findIndex((x) => x.id === g.opponentId) + 1]?.id : undefined,
    winStreak: streakNow,
    bestWinStreak: Math.max(streakNow, bestBefore),
    newBestStreak,
  };
  // Unlocking items can complete the "Collector" achievement.
  if (rewards.unlocks.length) rewards.achievements.push(...(await checkAchievements()));
  return { gameId, firstWin: rec?.firstWin ?? false, rewards };
}

/** Your game rating for the results sheet (the review summary's number), when the game is long enough. */
function perfOf(g: GameRecord): number | undefined {
  try {
    return gameRating(cpLosses(g, reviewGame(g), true)) ?? undefined;
  } catch {
    return undefined;
  }
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
