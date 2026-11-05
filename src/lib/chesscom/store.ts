// chess.com import: sync (network, opt-in) and background analysis (on the phone, one game at a
// time, newest first). Analysis pauses while the engine is needed elsewhere and stops when the
// app goes to the background.
import { create } from 'zustand';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { db, kvGet, kvSet } from '../db';
import { getEngine, CancelledError, type AnalysisResult } from '../engine';
import { analysisLimits } from '../engine/speed';
import { gameOverInfo } from '../chess/game';
import { useSettings } from '../settings';
import { useNav } from '../nav';
import type { ImportedGame } from '../store/types';
import { fetchArchives, fetchMonth, ImportError } from './api';
import { monthComplete, monthOf, monthsToFetch, parseCcGame } from './parse';
import { mistakeCards, multipvFor, positionsOf, withAnalysis } from './analysis';
import { trapCard, trapForLoss } from '../traps';

const SYNC_KEY = 'cc.sync';
/** What has been synced for a username: complete months and the last sync time. */
export interface SyncState {
  user: string;
  full: string[];
  lastSync?: number;
}

interface ImportStore {
  syncing: boolean;
  /** "Fetching 2026/09…" while syncing. */
  status: string | null;
  error: string | null;
  /** Games added by the last sync. */
  added: number | null;
  analyzing: boolean;
  /** Analysis progress: games done of all imported, and the current game's progress (0..1). */
  done: number;
  total: number;
  current: number;
  lastSync?: number;
  sync(): Promise<void>;
  /** Start (or resume) background analysis. */
  analyze(): void;
  stop(): void;
  refresh(): Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let loopId = 0;

/** Screens that use the engine themselves: analysis waits while they're open. */
const ENGINE_SCREENS = new Set(['explore', 'endgame', 'openingPractice', 'lesson', 'puzzle', 'rush', 'practice', 'trapDrill', 'timeDrill']);
function engineBusy(): boolean {
  const nav = useNav.getState();
  const top = nav.stack[nav.stack.length - 1];
  if (top && ENGINE_SCREENS.has(top.name)) return true;
  if (nav.tab === 'run') return true;
  return playActive();
}
/** Set by the play store: true while a game is on the board. */
let playActive = () => false;
export const setPlayActiveCheck = (f: () => boolean) => void (playActive = f);

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

export const useImport = create<ImportStore>((set, get) => ({
  syncing: false,
  status: null,
  error: null,
  added: null,
  analyzing: false,
  done: 0,
  total: 0,
  current: 0,

  async refresh() {
    const all = await db.imported.toArray();
    const st = await kvGet<SyncState | null>(SYNC_KEY, null);
    set({ total: all.length, done: all.filter((g) => g.analyzed).length, lastSync: st?.lastSync });
  },

  async sync() {
    const user = useSettings.getState().ccUsername.trim();
    if (!user || get().syncing) return;
    set({ syncing: true, error: null, status: 'Looking up your games…', added: null });
    let added = 0;
    try {
      let st = await kvGet<SyncState | null>(SYNC_KEY, null);
      if (!st || st.user.toLowerCase() !== user.toLowerCase()) st = { user, full: [] };
      const archives = await fetchArchives(user);
      const todo = monthsToFetch(archives, st.full);
      // Newest month first, one request at a time.
      for (const url of todo) {
        const month = monthOf(url);
        set({ status: `Fetching ${month}…` });
        const games = await fetchMonth(url);
        const parsed = games.map((g) => parseCcGame(g, user)).filter((g): g is ImportedGame => !!g);
        const have = new Set(await db.imported.where('id').anyOf(parsed.map((g) => g.id)).primaryKeys());
        const fresh = parsed.filter((g) => !have.has(g.id));
        if (fresh.length) await db.imported.bulkPut(fresh);
        // A quick loss to a known trap: that trap goes into the daily reviews (once).
        const trapCards = fresh.map((g) => ({ g, t: trapForLoss(g) })).filter((x) => x.t);
        for (const { g, t } of trapCards) if (!(await db.cards.get(`t:${t!.id}`))) await db.cards.put(trapCard(t!, Date.now(), g));
        added += fresh.length;
        if (monthComplete(month) && !st.full.includes(month)) st.full.push(month);
        st.lastSync = Date.now();
        await kvSet(SYNC_KEY, st);
        await get().refresh();
      }
      st.lastSync = Date.now();
      await kvSet(SYNC_KEY, st);
      set({ status: null, added });
    } catch (e) {
      set({ status: null, error: e instanceof ImportError ? e.message : 'Something went wrong while importing. Try again later.', added });
    } finally {
      set({ syncing: false });
      await get().refresh();
      get().analyze();
    }
  },

  analyze() {
    if (get().analyzing) return;
    const my = ++loopId;
    set({ analyzing: true });
    void (async () => {
      try {
        while (my === loopId) {
          const next = (await db.imported.orderBy('endedAt').reverse().filter((g) => !g.analyzed).first()) ?? null;
          if (!next) break;
          const res: (AnalysisResult | null)[] = [];
          const fens = positionsOf(next);
          const l = analysisLimits();
          for (let k = 0; k < fens.length && my === loopId; k++) {
            // Wait while the engine is needed elsewhere (a game, a puzzle, Run mode…).
            while (my === loopId && (engineBusy() || hidden())) await sleep(1500);
            if (my !== loopId) break;
            set({ current: k / fens.length });
            if (gameOverInfo(fens[k])) {
              res.push(null);
              continue;
            }
            try {
              res.push(await getEngine().analyze(fens[k], { depth: Math.min(l.depth, 11), movetime: Math.min(l.movetime, 1200), multipv: multipvFor(next, k), owner: 'import' }));
            } catch (e) {
              if (e instanceof CancelledError) {
                k--;
                continue;
              }
              throw e;
            }
          }
          if (my !== loopId) break;
          const done = withAnalysis(next, res);
          await db.transaction('rw', [db.imported, db.cards], async () => {
            await db.imported.put(done);
            await db.cards.bulkPut(mistakeCards(done));
          });
          set({ current: 0 });
          await get().refresh();
        }
      } catch (e) {
        console.warn('chess.com analysis stopped', e);
      } finally {
        if (my === loopId) set({ analyzing: false, current: 0 });
      }
    })();
  },

  stop() {
    loopId++;
    getEngine().cancelAll('import');
    set({ analyzing: false, current: 0 });
  },
}));

/** App start: count imports, sync if asked to (and online), resume analysis; stop in the background. */
export function startImports() {
  const st = useImport.getState();
  void st.refresh().then(() => {
    const s = useSettings.getState();
    if (s.ccUsername && s.ccAutoSync && navigator.onLine !== false) void useImport.getState().sync();
    else useImport.getState().analyze();
  });
  const onVisible = () => (document.visibilityState === 'hidden' ? useImport.getState().stop() : useImport.getState().analyze());
  document.addEventListener('visibilitychange', onVisible);
  if (Capacitor.isNativePlatform()) void CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? useImport.getState().analyze() : useImport.getState().stop()));
}

/** Forget every imported game (and its review cards). */
export async function clearImports() {
  useImport.getState().stop();
  await db.transaction('rw', [db.imported, db.cards, db.kv], async () => {
    await db.imported.clear();
    await db.cards.filter((c) => c.source === 'chess.com').delete();
    await db.kv.delete(SYNC_KEY);
  });
  await useImport.getState().refresh();
}
