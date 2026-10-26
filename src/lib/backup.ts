// Export / import of all user data as one JSON file.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db, today } from './db';
import { pickSettings, replaceSettings, useSettings, type Settings } from './settings';

const FORMAT = 'chess-coach-backup';
const VERSION = 1;
const TABLES = ['games', 'current', 'attempts', 'cards', 'ratings', 'activity', 'kv'] as const;

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
  return name;
}

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
  return `${n('games')} games, ${n('attempts')} puzzle attempts, ${n('cards')} review cards — saved ${new Date(b.exportedAt).toLocaleString()}`;
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
