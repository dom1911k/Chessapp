// Lasting Cups progress: Laurels (stage 6 adds the shop, unlocks and the trophy cabinet).
// Stored in the app's key-value table, so it is part of Settings → Backup.
import { create } from 'zustand';
import { kvGet, kvSet } from '../lib/db';
import { migrateLegacyRun } from './legacy';
import { TUNING } from './tuning';

export interface CupsMeta {
  laurels: number;
  /** Boons, charms and cosmetics bought in the Laurel shop. */
  unlocks: string[];
  /** Quirks you faced most recently, newest first (cups avoid them). */
  recentQuirks: string[];
  /** Every finished cup (rivals remember; the trophy cabinet reads it). */
  history: CupSummary[];
}

/** One finished cup, as remembered afterwards. */
export interface CupSummary {
  id: string;
  tier: string;
  place: 'winner' | 'final' | 'semi' | 'quarter';
  endedAt: number;
  /** Your moves over the games that counted. */
  moves: number;
  charmsUsed: number;
  /** Second Chance was used in this cup. */
  secondChance: boolean;
  /** Who knocked you out, and who you beat on the way. */
  eliminatedBy?: string;
  beaten: string[];
}

const KEY = 'cupsMeta';
export const EMPTY_META: CupsMeta = { laurels: 0, unlocks: [], recentQuirks: [], history: [] };

interface MetaStore extends CupsMeta {
  loaded: boolean;
  load(): Promise<void>;
  addLaurels(n: number): Promise<void>;
  /** Remember quirks you just faced. */
  faced(quirks: string[]): Promise<void>;
  /** A cup is over: remember it. */
  recordCup(c: CupSummary): Promise<void>;
}

const save = (m: CupsMeta) => kvSet(KEY, m);
const pick = (s: MetaStore): CupsMeta => ({ laurels: s.laurels, unlocks: s.unlocks, recentQuirks: s.recentQuirks, history: s.history });

export const useCupsMeta = create<MetaStore>((set, get) => ({
  ...EMPTY_META,
  loaded: false,
  async load() {
    if (get().loaded) return;
    const m = { ...EMPTY_META, ...(await kvGet<Partial<CupsMeta>>(KEY, {})) };
    const legacy = await migrateLegacyRun();
    if (legacy) m.laurels += legacy;
    set({ ...m, loaded: true });
    if (legacy) await save(m);
  },
  async faced(quirks) {
    const recent = [...quirks, ...get().recentQuirks.filter((q) => !quirks.includes(q))].slice(0, TUNING.quirks.recentMemory);
    set({ recentQuirks: recent });
    await save(pick(get()));
  },
  async recordCup(c) {
    if (get().history.some((h) => h.id === c.id)) return;
    set({ history: [...get().history, c] });
    await save(pick(get()));
  },
  async addLaurels(n) {
    set({ laurels: Math.max(0, get().laurels + n) });
    await save(pick(get()));
  },
}));
