// Between-run progression: Embers earned every run (win or lose), spent in the Sanctum on
// unlocks (new relics, rooms, events, board themes) and a few small permanent boosts.
// Stored in Run mode's own database; never touches the app's XP or rewards.
import { create } from 'zustand';
import { runDb } from './db';
import type { EventKind, RelicId, RoomKind, Run } from './types';

export type BoostId = 'purse' | 'candle' | 'pocket' | 'reroll' | 'satchel';

export interface Unlock {
  id: string;
  kind: 'relic' | 'room' | 'event' | 'board';
  ref: string;
  name: string;
  text: string;
  cost: number;
  sprite: string;
}

/** Everything that starts locked. (All other content is available from the first run.) */
export const UNLOCKS: Unlock[] = [
  { id: 'relic:scholar', kind: 'relic', ref: 'scholar', name: 'Scholar', text: 'Relic: gold for every puzzle solved.', cost: 8, sprite: 'book' },
  { id: 'relic:lucky', kind: 'relic', ref: 'lucky', name: 'Lucky Coin', text: 'Relic: a bigger, cheaper campfire.', cost: 8, sprite: 'clover' },
  { id: 'room:vault', kind: 'room', ref: 'vault', name: 'The Vault', text: 'Room: win an endgame against perfect defence.', cost: 12, sprite: 'chest' },
  { id: 'event:gambler', kind: 'event', ref: 'gambler', name: 'The Gambler', text: 'Event: stake a candle on one puzzle.', cost: 12, sprite: 'dice' },
  { id: 'relic:executioner', kind: 'relic', ref: 'executioner', name: 'Executioner', text: 'Rare relic: big mult for a checkmate finish.', cost: 16, sprite: 'axe' },
  { id: 'event:altar', kind: 'event', ref: 'altar', name: 'The Cursed Altar', text: 'Event: a rare relic, for a curse.', cost: 16, sprite: 'altar' },
  { id: 'relic:secondwind', kind: 'relic', ref: 'secondwind', name: 'Second Wind', text: 'Rare relic: survive your Composure breaking once.', cost: 20, sprite: 'feather' },
  { id: 'relic:glass', kind: 'relic', ref: 'glass', name: 'Glass Cannon', text: 'Rare relic: +1.5 mult everywhere, at a price.', cost: 20, sprite: 'crystal' },
  { id: 'board:bone', kind: 'board', ref: 'bone', name: 'Bone & Blood', text: 'Board theme: ivory and crimson.', cost: 15, sprite: 'skull' },
  { id: 'board:frost', kind: 'board', ref: 'frost', name: 'Frost Tomb', text: 'Board theme: ice and moonlight.', cost: 15, sprite: 'crystal' },
  { id: 'board:ember', kind: 'board', ref: 'ember', name: 'Ember Forge', text: 'Board theme: lava and brass.', cost: 15, sprite: 'flame' },
];

export interface Boost {
  id: BoostId;
  name: string;
  text: (lvl: number) => string;
  costs: number[];
  sprite: string;
}

export const BOOSTS: Boost[] = [
  { id: 'purse', name: 'Heavy Purse', text: (l) => `Start every run with +${2 * Math.max(1, l)} gold.`, costs: [8, 16, 24], sprite: 'coin' },
  { id: 'satchel', name: 'Satchel', text: () => 'Start every run with a random card.', costs: [12], sprite: 'bag' },
  { id: 'reroll', name: 'Second Look', text: () => 'Reroll the campfire shop once per visit, free.', costs: [15], sprite: 'dice' },
  { id: 'candle', name: 'Spare Candle', text: (l) => `+${Math.max(1, l)} Composure at the start (and max).`, costs: [20, 40], sprite: 'candle' },
  { id: 'pocket', name: 'Deep Pockets', text: () => 'Carry one more card.', costs: [30], sprite: 'chest' },
];

export interface Meta {
  embers: number;
  earned: number;
  unlocked: string[];
  boosts: Partial<Record<BoostId, number>>;
  runs: number;
  wins: number;
  best: number;
}

const EMPTY: Meta = { embers: 0, earned: 0, unlocked: [], boosts: {}, runs: 0, wins: 0, best: 0 };

/** Embers for a finished run: something every time, more for progress and a win. */
export function embersFor(r: Run): number {
  const won = r.results.filter((x) => x.won).length;
  const beatBoss = r.ended === 'won';
  return 3 + won * 2 + Math.floor((r.finalScore ?? 0) / 600) + (beatBoss ? 6 : 0) + (beatBoss && r.cursed ? 3 : 0);
}

export const isUnlocked = (m: Meta, id: string) => !UNLOCKS.some((u) => u.id === id) || m.unlocked.includes(id);
export const lockedRelics = (m: Meta): RelicId[] => UNLOCKS.filter((u) => u.kind === 'relic' && !m.unlocked.includes(u.id)).map((u) => u.ref as RelicId);
export const lockedRooms = (m: Meta): RoomKind[] => UNLOCKS.filter((u) => u.kind === 'room' && !m.unlocked.includes(u.id)).map((u) => u.ref as RoomKind);
export const lockedEvents = (m: Meta): EventKind[] => UNLOCKS.filter((u) => u.kind === 'event' && !m.unlocked.includes(u.id)).map((u) => u.ref as EventKind);
export const boardUnlocked = (m: Meta, id: string) => id === 'crypt' || m.unlocked.includes(`board:${id}`);

interface MetaStore extends Meta {
  loaded: boolean;
  load(): Promise<Meta>;
  buyUnlock(id: string): boolean;
  buyBoost(id: BoostId): boolean;
  /** Record a finished run (Embers, stats). */
  finish(r: Run, embers: number): void;
  dev(n: number): void;
}

const save = (m: Meta) => void runDb.state.put({ key: 'meta', value: m }).catch(() => {});
const pick = (s: Meta): Meta => ({ embers: s.embers, earned: s.earned, unlocked: s.unlocked, boosts: s.boosts, runs: s.runs, wins: s.wins, best: s.best });

export const useMeta = create<MetaStore>((set, get) => ({
  ...EMPTY,
  loaded: false,
  async load() {
    if (get().loaded) return pick(get());
    let m = EMPTY;
    try {
      m = { ...EMPTY, ...((await runDb.state.get('meta'))?.value as Meta | undefined) };
    } catch {
      /* first time */
    }
    set({ ...m, loaded: true });
    return m;
  },
  buyUnlock(id) {
    const u = UNLOCKS.find((x) => x.id === id);
    const s = get();
    if (!u || s.unlocked.includes(id) || s.embers < u.cost) return false;
    set({ embers: s.embers - u.cost, unlocked: [...s.unlocked, id] });
    save(pick(get()));
    return true;
  },
  buyBoost(id) {
    const b = BOOSTS.find((x) => x.id === id)!;
    const s = get();
    const lvl = s.boosts[id] ?? 0;
    const cost = b.costs[lvl];
    if (cost === undefined || s.embers < cost) return false;
    set({ embers: s.embers - cost, boosts: { ...s.boosts, [id]: lvl + 1 } });
    save(pick(get()));
    return true;
  },
  finish(r, embers) {
    const s = get();
    set({ embers: s.embers + embers, earned: s.earned + embers, runs: s.runs + 1, wins: s.wins + (r.ended === 'won' ? 1 : 0), best: Math.max(s.best, r.finalScore ?? 0) });
    save(pick(get()));
  },
  dev(n) {
    set({ embers: get().embers + n });
    save(pick(get()));
  },
}));
