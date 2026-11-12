// One-time move from the old Run mode. Its progress (Embers, materials, unlocks, finished runs)
// becomes a flat starting balance of Laurels; a run that was still in progress is discarded with
// a one-line notice. The old Run mode database is deleted afterwards.
import Dexie from 'dexie';
import { kvGet, kvSet } from '../lib/db';
import { TUNING } from './tuning';

const OLD_DB = 'chess-coach-run';
const DONE_KEY = 'cupsLegacyDone';
export const NOTICE_KEY = 'cupsNotice';

/** The old Run meta, as far as the migration cares. */
export interface OldMeta {
  embers?: number;
  earned?: number;
  runs?: number;
  unlocked?: string[];
  materials?: Record<string, number>;
  codex?: Record<string, unknown>;
}

/** Did the old Run mode leave any progress worth honouring? */
export function hadProgress(meta: OldMeta | undefined, archivedRuns: number): boolean {
  if (archivedRuns > 0) return true;
  if (!meta) return false;
  const mats = Object.values(meta.materials ?? {}).some((v) => v > 0);
  return (meta.embers ?? 0) > 0 || (meta.earned ?? 0) > 0 || (meta.runs ?? 0) > 0 || (meta.unlocked?.length ?? 0) > 0 || mats || Object.keys(meta.codex ?? {}).length > 0;
}

/** Laurels granted for old progress: a flat amount, not a conversion rate. */
export const legacyLaurels = (meta: OldMeta | undefined, archivedRuns: number) => (hadProgress(meta, archivedRuns) ? TUNING.legacyLaurels : 0);

/**
 * Runs once. Returns the Laurels to add (0 if nothing to migrate) and stores the notice lines
 * for the Cups tab to show once.
 */
export async function migrateLegacyRun(): Promise<number> {
  if (await kvGet<boolean>(DONE_KEY, false)) return 0;
  let laurels = 0;
  const notice: string[] = [];
  try {
    if (await Dexie.exists(OLD_DB)) {
      const old = new Dexie(OLD_DB);
      old.version(1).stores({ state: 'key', runs: '++pk, startedAt', playtests: '++id, at' });
      await old.open();
      const meta = (await old.table('state').get('meta'))?.value as OldMeta | undefined;
      const current = (await old.table('state').get('current'))?.value as { ended?: boolean } | undefined;
      const runs = await old.table('runs').count();
      laurels = legacyLaurels(meta, runs);
      if (laurels) notice.push(`Your Run mode progress became ${laurels} Laurels.`);
      if (current && !current.ended) notice.push('Your unfinished Run was from the old Run mode and has been cleared.');
      old.close();
      await Dexie.delete(OLD_DB);
    }
  } catch {
    /* an unreadable old database is simply skipped */
  }
  await kvSet(DONE_KEY, true);
  if (notice.length) await kvSet(NOTICE_KEY, notice);
  return laurels;
}
