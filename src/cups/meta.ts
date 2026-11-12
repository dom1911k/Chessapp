// Lasting Cups progress: Laurels (stage 6 adds the shop, unlocks and the trophy cabinet).
// Stored in the app's key-value table, so it is part of Settings → Backup.
import { create } from 'zustand';
import { kvGet, kvSet } from '../lib/db';
import { migrateLegacyRun } from './legacy';

export interface CupsMeta {
  laurels: number;
  /** Boons, charms and cosmetics bought in the Laurel shop. */
  unlocks: string[];
}

const KEY = 'cupsMeta';
export const EMPTY_META: CupsMeta = { laurels: 0, unlocks: [] };

interface MetaStore extends CupsMeta {
  loaded: boolean;
  load(): Promise<void>;
  addLaurels(n: number): Promise<void>;
}

const save = (m: CupsMeta) => kvSet(KEY, m);
const pick = (s: MetaStore): CupsMeta => ({ laurels: s.laurels, unlocks: s.unlocks });

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
  async addLaurels(n) {
    set({ laurels: Math.max(0, get().laurels + n) });
    await save(pick(get()));
  },
}));
