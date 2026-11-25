// Your game rating: an Elo-style number that moves after every game against an
// opponent. The journey map is drawn from your best (peak) rating, so a bad day
// never takes a milestone away.
import { announceChange } from '../changes';
import { kvGet, kvSet } from '../db';
import { setPlayerRating } from '../playerRating';
import { shortDate } from '../dates';
import { plural } from '../plural';

export interface GameRating {
  rating: number;
  peak: number;
  games: number;
  /** Rating after each game (for the chart on the journey screen). */
  history: { at: number; rating: number }[];
}

const KEY = 'gameRating';
/** A new player starts here (chess.com scale). */
export const START_RATING = 250;

export const getGameRating = () => kvGet<GameRating>(KEY, { rating: START_RATING, peak: START_RATING, games: 0, history: [] });

/** Updates the rating after a game; `score` 1 win, 0.5 draw, 0 loss. */
export async function rateGame(opponentElo: number, score: number, helpUsed: number): Promise<{ before: GameRating; after: GameRating }> {
  const before = await getGameRating();
  // A win with lots of take-backs and hints counts a little less.
  const s = score === 1 && helpUsed > 3 ? 0.75 : score;
  const expected = 1 / (1 + 10 ** ((opponentElo - before.rating) / 400));
  const k = before.games < 10 ? 48 : before.games < 30 ? 32 : 24;
  const rating = Math.max(100, Math.round(before.rating + k * (s - expected)));
  const after: GameRating = {
    rating,
    peak: Math.max(before.peak, rating),
    games: before.games + 1,
    history: [...before.history, { at: Date.now(), rating }].slice(-200),
  };
  await kvSet(KEY, after);
  setPlayerRating(after.rating);
  announceChange('rating');
  return { before, after };
}

/** Your best rating before a restart: the looks it unlocked stay unlocked. */
export const KEPT_PEAK_KEY = 'keptPeak';

/**
 * Starts your game rating again at `rating` (history and game count cleared, so it settles fast).
 * The peak starts there too, unless `keepPeak` and it was higher (the Journey stays where it was).
 * Either way, the old peak is kept for unlocks: nothing already unlocked locks again.
 */
export async function restartGameRating(rating: number, opts: { keepPeak?: boolean } = {}): Promise<GameRating> {
  const before = await getGameRating();
  await kvSet(KEPT_PEAK_KEY, Math.max(await kvGet<number>(KEPT_PEAK_KEY, 0), before.peak));
  const fresh: GameRating = { rating, peak: opts.keepPeak ? Math.max(rating, before.peak) : rating, games: 0, history: [{ at: Date.now(), rating }] };
  await kvSet(KEY, fresh);
  setPlayerRating(rating);
  announceChange('rating');
  return fresh;
}

/** The last restart (from chess.com or a fresh start), while its first entry is still in the history:
 *  a restart leaves one entry before the games it counts, so the history has one more than games. */
export function lastRestart(r: GameRating): { at: number; rating: number } | null {
  return r.history.length > 0 && r.history.length === r.games + 1 ? r.history[0] : null;
}

/** Profile → Bots, under the rating: "Started at 512 · 24 Nov" until the next game, then "3 games
 *  since 24 Nov"; without a restart, "12 rated games". */
export function botsLine(r: GameRating, now = Date.now()): string {
  const rs = lastRestart(r);
  if (!rs) return plural(r.games, 'rated game');
  return r.games ? `${plural(r.games, 'game')} since ${shortDate(rs.at, now)}` : `Started at ${rs.rating} · ${shortDate(rs.at, now)}`;
}

export interface Milestone {
  rating: number;
  title: string;
  /** Coach Sam's words when you get there. */
  line: string;
  /** Cosmetic unlocked (id from COSMETICS). */
  reward: string;
}

export interface Region {
  name: string;
  from: number;
  icon: string;
  /** Background colours for the map band. */
  colors: [string, string];
}

export const REGIONS: Region[] = [
  { name: 'The Park', from: 0, icon: 'tree', colors: ['#dff0d3', '#c3e2b3'] },
  { name: 'The Café', from: 800, icon: 'coffee', colors: ['#f3e3cc', '#e6cba6'] },
  { name: 'The Chess Club', from: 1100, icon: 'library', colors: ['#e3e6f3', '#c9cfe8'] },
  { name: 'The Tournament Hall', from: 1400, icon: 'trophy', colors: ['#f1e2ea', '#e2c4d4'] },
  { name: 'The Championship', from: 1800, icon: 'crown', colors: ['#f6ead0', '#ead19a'] },
];

export const MILESTONES: Milestone[] = [
  { rating: 500, title: 'Park Rookie', line: 'Your first milestone! Every master started exactly here.', reward: 'board-marble' },
  { rating: 600, title: 'Park Player', line: "You'd hold your own on any park bench now.", reward: 'hl-mint' },
  { rating: 700, title: 'Park Champion', line: 'You are starting to see two things at once. That is a big step.', reward: 'fx-stars' },
  { rating: 800, title: 'Café Regular', line: 'Welcome to the café! The games get trickier from here.', reward: 'board-ocean' },
  { rating: 900, title: 'Café Shark', line: 'Fewer pieces left hanging, more pieces won. Lovely progress.', reward: 'pieces-marble' },
  { rating: 1000, title: 'Club Member', line: 'Four digits! That is a real chess rating to be proud of.', reward: 'board-tournament' },
  { rating: 1100, title: 'Club Regular', line: 'The club players nod when you walk in now.', reward: 'snd-bamboo' },
  { rating: 1200, title: 'Tournament Debutant', line: 'Ready for your first tournament, I think!', reward: 'pieces-glass' },
  { rating: 1300, title: 'Sharp Shooter', line: 'Your tactics are getting really sharp.', reward: 'fx-fireworks' },
  { rating: 1400, title: 'Attacker', line: 'Kings tremble when you sit down at the board.', reward: 'board-midnight' },
  { rating: 1500, title: 'Deep Thinker', line: 'You are thinking in plans now, not just moves.', reward: 'hl-gold' },
  { rating: 1600, title: 'Tournament Player', line: 'Tournament strength. Remarkable work.', reward: 'pieces-ruby' },
  { rating: 1700, title: 'Rising Star', line: 'Not many players get this far. I am proud of you.', reward: 'snd-crystal' },
  { rating: 1800, title: 'Candidate', line: 'The championship is within sight.', reward: 'board-royal' },
  { rating: 1900, title: 'Master', line: 'Masterful. Simply masterful.', reward: 'fx-coins' },
  { rating: 2000, title: 'Champion', line: 'Champion! You have reached the top of the journey.', reward: 'pieces-gold' },
];

export function titleFor(peak: number): string {
  return [...MILESTONES].reverse().find((m) => peak >= m.rating)?.title ?? 'Newcomer';
}
