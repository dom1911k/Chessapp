// The cup in progress (saved between rounds; the game itself saves mid-game in game.ts).
import { create } from 'zustand';
import { kvGet, kvSet } from '../lib/db';
import { awardXp } from '../lib/progress/xp';
import { applyResult, currentRound, newCup, opponentRating, yourColor, yourOpponent, type CupState } from './cup';
import { addTrophy, cupXp, getTrophies, type CupTier, type Trophies } from './ladder';
import { useCupGame, type GameOver } from './game';
import { NOTICE_KEY } from './legacy';
import { TUNING } from './tuning';

const KEY = 'cupState';

interface CupStore {
  cup: CupState | null;
  trophies: Trophies;
  loaded: boolean;
  load(): Promise<void>;
  /** Start a cup of this tier. */
  enter(tier: CupTier): Promise<void>;
  /** Set up your next game (the opponent card and intro come first). */
  playNext(): void;
  /** Your game is over: play the round and move the bracket on. */
  finishRound(over: GameOver): Promise<void>;
  /** Close a finished cup (or withdraw from one) and go back to the cup list. */
  leave(): Promise<void>;
}

const save = (c: CupState | null) => kvSet(KEY, c);

export const useCup = create<CupStore>((set, get) => ({
  cup: null,
  trophies: {},
  loaded: false,

  async load() {
    if (get().loaded) return;
    const raw = await kvGet<(CupState & { v?: number }) | null>(KEY, null);
    let cup: CupState | null = raw && raw.v === 2 ? raw : null;
    // A cup from the old format (played from the Play tab) can't continue here.
    if (raw && raw.v !== 2) {
      await save(null);
      const n = await kvGet<string[]>(NOTICE_KEY, []);
      if (!(raw as { place?: string }).place) await kvSet(NOTICE_KEY, [...n, 'Your unfinished cup from the old format has been closed. Your trophies are safe.']);
      cup = null;
    }
    set({ cup, trophies: await getTrophies(), loaded: true });
    await useCupGame.getState().load();
  },

  async enter(tier) {
    const cup = newCup(tier, Math.floor(Math.random() * 1e9));
    await save(cup);
    set({ cup });
  },

  playNext() {
    const c = get().cup;
    const opp = c && yourOpponent(c);
    if (!c || !opp) return;
    useCupGame.getState().start({
      cupId: c.id,
      tier: c.tier,
      round: currentRound(c),
      opponentId: opp,
      elo: opponentRating(c),
      userColor: yourColor(c),
      timeControl: TUNING.ladder.timeControl,
    });
  },

  async finishRound(over) {
    const c = get().cup;
    const g = useCupGame.getState().game;
    if (!c || !g || g.cupId !== c.id || c.yours.some((r) => r.round === g.round)) {
      useCupGame.getState().clear();
      return;
    }
    const next = applyResult(c, {
      opponentId: g.opponentId,
      elo: g.elo,
      color: g.userColor,
      result: over.userResult,
      reason: over.reason,
      moves: over.moves,
      opening: over.opening,
      accuracy: over.accuracy,
      clockLeft: over.clockLeft,
      gameId: over.gameId,
    });
    let trophies = get().trophies;
    if (next.place) {
      const xp = cupXp(next.tier, next.place);
      if (xp) await awardXp(xp, true);
      if (next.place === 'winner') trophies = await addTrophy(next.tier);
    }
    await save(next);
    useCupGame.getState().clear();
    set({ cup: next, trophies });
  },

  async leave() {
    useCupGame.getState().clear();
    await save(null);
    set({ cup: null, trophies: await getTrophies() });
  },
}));
