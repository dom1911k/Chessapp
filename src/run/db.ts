// Run mode's own storage: a separate IndexedDB database, never touched by the rest of the app
// (and not part of the app's backup).
import Dexie, { type Table } from 'dexie';
import type { Playtest, Run } from './types';

class RunDB extends Dexie {
  state!: Table<{ key: string; value: unknown }, string>;
  runs!: Table<Run & { pk?: number }, number>;
  playtests!: Table<Playtest, number>;
  constructor() {
    super('chess-coach-run');
    this.version(1).stores({ state: 'key', runs: '++pk, startedAt', playtests: '++id, at' });
  }
}

export const runDb = new RunDB();

/** The saved run in progress; a run from an older version is set aside (`stale`). */
export async function loadCurrent(): Promise<{ run: Run | null; stale: boolean }> {
  try {
    const r = (await runDb.state.get('current'))?.value as (Omit<Run, 'version'> & { version: number }) | undefined;
    if (!r) return { run: null, stale: false };
    if (r.version === 3) return { run: r as Run, stale: false };
    await runDb.state.delete('current');
    return { run: null, stale: !r.ended };
  } catch {
    return { run: null, stale: false };
  }
}

let saving: Promise<unknown> = Promise.resolve();
export function saveCurrent(run: Run | null) {
  const snap = run ? (JSON.parse(JSON.stringify(run)) as Run) : null;
  saving = saving
    .then(async () => {
      if (snap) await runDb.state.put({ key: 'current', value: snap });
      else await runDb.state.delete('current');
    })
    .catch(() => {});
}

export async function archiveRun(run: Run) {
  try {
    await runDb.runs.add(JSON.parse(JSON.stringify(run)));
  } catch {
    /* ignore */
  }
}

export const addPlaytest = (p: Playtest) => runDb.playtests.add(p);
export const allPlaytests = () => runDb.playtests.orderBy('at').toArray();
export const allRuns = () => runDb.runs.orderBy('startedAt').toArray();
