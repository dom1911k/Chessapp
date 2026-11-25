// Export / import of all user data as one JSON file.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db, kvGet, kvSet, today } from './db';
import { pickSettings, replaceSettings, useSettings, type Settings } from './settings';

const FORMAT = 'chess-coach-backup';
const VERSION = 1;
const TABLES = ['games', 'current', 'attempts', 'cards', 'ratings', 'activity', 'kv', 'imported'] as const;

export interface Backup {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  tables: Record<(typeof TABLES)[number], unknown[]>;
}

export async function buildBackup(): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const t of TABLES) tables[t] = await db.table(t).toArray();
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), settings: pickSettings(useSettings.getState()), tables };
}

/** Saves the backup: share sheet on Android (save to Drive/Files/…), a download on the web. */
export async function exportBackup(): Promise<string> {
  const name = `chess-coach-backup-${today()}.json`;
  await shareJsonFile(name, JSON.stringify(await buildBackup()), 'Chess Coach backup');
  await kvSet(LAST_BACKUP_KEY, Date.now());
  return name;
}

// ---- The backup reminder: everything lives only on the phone, and an export is the only copy. ----

/** When the last export was made (every export records it). */
export const LAST_BACKUP_KEY = 'lastBackupAt';
/** "Later" on More's reminder hides it until then. */
export const BACKUP_LATER_KEY = 'backupLaterUntil';
const DAY = 864e5;
export const REMIND_GAMES = 10;
export const REMIND_DAYS = 30;

/** "never", "today", "yesterday", "3 days ago". */
export function backupAgo(at: number | null, now = Date.now()): string {
  if (!at) return 'never';
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

/** More shows the reminder with 10 or more games and no backup in 30 days (unless "Later" hid it). */
export function shouldRemindBackup(o: { games: number; lastAt: number | null; laterUntil: number | null; now?: number }): boolean {
  const now = o.now ?? Date.now();
  if (o.games < REMIND_GAMES) return false;
  if (o.lastAt && now - o.lastAt < REMIND_DAYS * DAY) return false;
  return !o.laterUntil || now >= o.laterUntil;
}

export async function backupReminder(now = Date.now()): Promise<boolean> {
  const [games, lastAt, laterUntil] = await Promise.all([db.games.count(), kvGet<number | null>(LAST_BACKUP_KEY, null), kvGet<number | null>(BACKUP_LATER_KEY, null)]);
  return shouldRemindBackup({ games, lastAt, laterUntil, now });
}

export const remindBackupLater = (now = Date.now()) => kvSet(BACKUP_LATER_KEY, now + REMIND_DAYS * DAY);

/** Hands a JSON file to the Android share sheet (or downloads it in a browser). */
export async function shareJsonFile(name: string, json: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title, text: title, url: res.uri, dialogTitle: title });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function parseBackup(text: string): Backup {
  let data: Backup;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (data?.format !== FORMAT || typeof data.version !== 'number' || !data.tables) throw new Error('This is not a Chess Coach backup file.');
  if (data.version > VERSION) throw new Error('This backup was made by a newer version of Chess Coach. Please update the app first.');
  return data;
}

export function describeBackup(b: Backup): string {
  const n = (t: keyof Backup['tables']) => b.tables[t]?.length ?? 0;
  return `${n('games')} games${n('imported') ? ` (+${n('imported')} from chess.com)` : ''}, ${n('attempts')} puzzle attempts, ${n('cards')} review cards — saved ${new Date(b.exportedAt).toLocaleString()}`;
}

/** Replaces all current data with the backup. */
export async function restoreBackup(b: Backup): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = b.tables[t] ?? [];
      if (rows.length) await db.table(t).bulkPut(rows);
    }
  });
  await replaceSettings(b.settings ?? {});
}

/**
 * Deletes all progress — games, puzzles, ratings, XP, achievements, journey,
 * collection, course — and starts fresh. Settings (board, sound…) are kept.
 */
export async function resetProgress(): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
}
