// IndexedDB storage (Dexie). WebView storage lives in the app's private data
// directory, so it survives installing a newer APK signed with the same key.
import Dexie, { type Table } from 'dexie';
import type { GameRecord, SavedGame } from './store/types';
import type { PuzzleAttempt, RatingPoint } from './puzzles/types';
import type { Card } from './srs';

export interface Activity {
  day: string; // YYYY-MM-DD (local)
  puzzles: number;
  games: number;
  reviews: number;
  dailyDone?: boolean;
  xp?: number;
}

export interface KV {
  key: string;
  value: unknown;
}

class ChessCoachDB extends Dexie {
  games!: Table<GameRecord, number>;
  current!: Table<SavedGame, string>;
  attempts!: Table<PuzzleAttempt, number>;
  cards!: Table<Card, string>;
  ratings!: Table<RatingPoint, number>;
  activity!: Table<Activity, string>;
  kv!: Table<KV, string>;

  constructor() {
    super('chess-coach');
    this.version(1).stores({
      games: '++id, endedAt',
      current: 'id',
      attempts: '++id, puzzleId, at',
      cards: 'id, due, kind',
      ratings: '++id, at',
      activity: 'day',
      kv: 'key',
    });
  }
}

export const db = new ChessCoachDB();

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

export function today(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function bumpActivity(field: 'puzzles' | 'games' | 'reviews', n = 1) {
  const day = today();
  await db.transaction('rw', db.activity, async () => {
    const row = (await db.activity.get(day)) ?? { day, puzzles: 0, games: 0, reviews: 0 };
    row[field] += n;
    await db.activity.put(row);
  });
}

/** Ask the browser not to evict our storage under pressure. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => undefined);
}
