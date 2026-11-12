// The cup in progress (saved between rounds; the game itself saves mid-game in game.ts).
import { create } from 'zustand';
import { kvGet, kvSet } from '../lib/db';
import { awardXp } from '../lib/progress/xp';
import { getRepertoire, linePlies, repertoireLines } from '../lib/repertoire';
import { applyResult, applySecondChance, summarize, currentRound, newCup, opponentRating, roundDone, secondChanceApplies, yourColor, yourOpponent, type CupState } from './cup';
import { addTrophy, advances, cupXp, getTrophies, type CupTier, type Trophies } from './ladder';
import { fenOf, turnOf, useCupGame, type GameOver } from './game';
import { NOTICE_KEY } from './legacy';
import { TUNING } from './tuning';
import { boonOffer, canHoldCharm, charmPrice, gameStartMods, goldFor, shopOffer, type BoonId, type CharmId } from './boons';
import { useCupsMeta } from './meta';
import { hiddenQuirk } from './quirks';
import { laurelsFor } from './laurels';
import { sponsorOffers } from './sponsors';

const KEY = 'cupState';

interface CupStore {
  cup: CupState | null;
  trophies: Trophies;
  loaded: boolean;
  /** A short message for the hub (e.g. Home Prep found no line). */
  note: string | null;
  load(): Promise<void>;
  /** Start a cup of this tier. */
  enter(tier: CupTier): Promise<void>;
  /** Set up your next game (the opponent card and intro come first). */
  playNext(): Promise<void>;
  /** Your game is over: gold, then the round (or Second Chance), then the boon pick and shop. */
  finishRound(over: GameOver): Promise<void>;
  pickBoon(id: BoonId | null): Promise<void>;
  buyCharm(id: CharmId): Promise<boolean>;
  leaveShop(): Promise<void>;
  /** Spend a charm from your slots (returns false if you don't have it). */
  spendCharm(id: CharmId): Promise<boolean>;
  /** Pre-game charms: change the next game's colour or start position, then set it up again. */
  pregame(p: { color?: 'w' | 'b'; start?: CupState['nextStart'] }): Promise<void>;
  /** Close a finished cup (or withdraw from one) and go back to the cup list. */
  leave(): Promise<void>;
  /** Playtest tools (dev panel). */
  dev: {
    result(r: 'win' | 'loss' | 'draw'): Promise<void>;
    gold(n: number): Promise<void>;
    boon(b: BoonId): Promise<void>;
    charm(c: CharmId): Promise<void>;
    /** Set a clock in the game being played (seconds left). */
    clock(who: 'me' | 'them', sec: number): void;
    /** Give the current opponent this quirk for the game being played. */
    quirk(id: string): void;
    /** Restart the current game from a position (FEN). */
    fen(fen: string): Promise<void>;
  };
}

const save = (c: CupState | null) => kvSet(KEY, c);
const unlocked = () => useCupsMeta.getState().unlocks ?? [];

/** Home Prep: one of your repertoire lines for your colour, played to its end (null if you have none). */
async function homePrepLine(color: 'w' | 'b'): Promise<{ fen: string; sans: string[]; name: string } | null> {
  const lines = repertoireLines(await getRepertoire()).filter((l) => l.color === color);
  if (!lines.length) return null;
  const l = lines[Math.floor(Math.random() * lines.length)];
  try {
    const plies = linePlies(l.moves);
    return { fen: plies[plies.length - 1].fenAfter, sans: plies.map((p) => p.san), name: l.name };
  } catch {
    return null;
  }
}

export const useCup = create<CupStore>((set, get) => {
  const put = async (cup: CupState) => {
    await save(cup);
    set({ cup });
  };
  /** A game's result goes into the cup: gold, then the round (or Second Chance), then boon pick and shop. */
  const settle = async (c: CupState, g: { color: 'w' | 'b'; opponentId: string; elo: number; events: CupState['yours'][number]['events'] }, over: Pick<GameOver, 'userResult' | 'reason' | 'moves' | 'opening' | 'accuracy' | 'clockLeft' | 'gameId' | 'greats' | 'decisive'>) => {
    const through = advances(over.userResult, g.color, c.boons.includes('drawOdds'));
    const gold = goldFor({ userResult: over.userResult, advanced: through, accuracy: over.accuracy, greats: over.greats });
    const rec = {
      opponentId: g.opponentId,
      elo: g.elo,
      color: g.color,
      result: over.userResult,
      reason: over.reason,
      moves: over.moves,
      opening: over.opening,
      accuracy: over.accuracy,
      clockLeft: over.clockLeft,
      gameId: over.gameId,
      gold: gold.total,
      events: g.events,
      decisive: over.decisive,
    };
    let next: CupState = { ...c, gold: c.gold + gold.total, lastGold: gold.parts };
    if (secondChanceApplies(c, over.userResult, g.color)) next = applySecondChance(next, rec);
    else next = applyResult(next, rec, { drawOdds: c.boons.includes('drawOdds') });
    let trophies = get().trophies;
    if (next.place) {
      await useCupsMeta.getState().recordCup(summarize(next));
      const laurels = laurelsFor(next.place);
      if (laurels) await useCupsMeta.getState().addLaurels(laurels);
      const xp = cupXp(next.tier, next.place);
      if (xp) await awardXp(xp, true);
      if (next.place === 'winner') trophies = await addTrophy(next.tier);
    } else if (through) {
      // Between rounds: a boon (while you have room), then the shop.
      const offer = next.boons.length < TUNING.boons.maxPerCup ? boonOffer(next.boons, unlocked(), Math.random) : [];
      next = offer.length ? { ...next, flow: 'boon', offer } : { ...next, flow: 'shop', shop: shopOffer(unlocked(), Math.random) };
    }
    set({ trophies });
    await put(next);
  };
  return {
    cup: null,
    trophies: {},
    loaded: false,
    note: null,

    async load() {
      if (get().loaded) return;
      const raw = await kvGet<(CupState & { v?: number }) | null>(KEY, null);
      let cup: CupState | null = raw && raw.v === 2 ? { ...raw, charmsUsed: raw.charmsUsed ?? 0, boons: raw.boons ?? [], charms: raw.charms ?? [], gold: raw.gold ?? 0, quirks: raw.quirks ?? {} } : null;
      // A cup from the old format (played from the Play tab) can't continue here.
      if (raw && raw.v !== 2) {
        await save(null);
        const n = await kvGet<string[]>(NOTICE_KEY, []);
        if (!(raw as { place?: string }).place) await kvSet(NOTICE_KEY, [...n, 'Your unfinished cup from the old format has been closed. Your trophies are safe.']);
        cup = null;
      }
      set({ cup, trophies: await getTrophies(), loaded: true });
      await useCupsMeta.getState().load();
      await useCupGame.getState().load();
    },

    async enter(tier) {
      // SPONSORS HOOK: sponsorOffers(tier) is always empty for now; see src/cups/sponsors.ts.
      void sponsorOffers(tier);
      const cup = newCup(tier, Math.floor(Math.random() * 1e9), Date.now(), useCupsMeta.getState().recentQuirks ?? []);
      // A free boon before the quarter-final (with the picks after the quarter- and semi-final: 3 for the final).
      const offer = boonOffer([], unlocked(), Math.random);
      await put(offer.length ? { ...cup, flow: 'boon', offer } : cup);
    },

    async playNext() {
      let c = get().cup;
      const opp = c && yourOpponent(c);
      if (!c || !opp) return;
      // The finalist gets a hidden second quirk.
      if (currentRound(c) === 2 && !c.hidden) {
        c = { ...c, hidden: hiddenQuirk(Object.values(c.quirks), useCupsMeta.getState().recentQuirks ?? [], Math.random) };
        await put(c);
      }
      const quirks = c.quirks[opp] ? [c.quirks[opp]] : [];
      const hidden = currentRound(c) === 2 ? c.hidden : undefined;
      void useCupsMeta.getState().faced([...quirks, ...(hidden ? [hidden] : [])]);
      const color = yourColor(c);
      const mods = gameStartMods(c.boons, color);
      let start = c.nextStart ?? null;
      let note: string | null = null;
      if (!start && c.boons.includes('homePrep')) {
        start = await homePrepLine(color);
        note = start ? `Home Prep: the game starts after your ${start.name} line.` : `Home Prep: you have no repertoire line for ${color === 'w' ? 'White' : 'Black'}, so it does nothing this game.`;
      }
      set({ note });
      useCupGame.getState().start({
        cupId: c.id,
        tier: c.tier,
        round: currentRound(c),
        opponentId: opp,
        elo: opponentRating(c),
        userColor: color,
        timeControl: TUNING.ladder.timeControl,
        startFen: start?.fen,
        prelude: start?.sans,
        boons: c.boons,
        quirks,
        hidden,
        scouted: c.boons.includes('scoutReport'),
        ...mods,
      });
    },

    async finishRound(over) {
      const c = get().cup;
      const g = useCupGame.getState().game;
      if (!c || !g || g.cupId !== c.id || roundDone(c, g.round)) {
        useCupGame.getState().clear();
        return;
      }
      await settle(c, { color: g.userColor, opponentId: g.opponentId, elo: g.elo, events: g.events }, over);
      useCupGame.getState().clear();
    },

    async pickBoon(id) {
      const c = get().cup;
      if (!c || c.flow !== 'boon') return;
      const boons = id && c.offer?.includes(id) && !c.boons.includes(id) ? [...c.boons, id] : c.boons;
      // The pick before the first game goes straight to the match (no gold to spend yet).
      if (c.yours.length === 0) return put({ ...c, boons, flow: undefined, offer: undefined });
      await put({ ...c, boons, flow: 'shop', offer: undefined, shop: shopOffer(unlocked(), Math.random) });
    },

    async buyCharm(id) {
      const c = get().cup;
      if (!c || c.flow !== 'shop' || !c.shop?.includes(id)) return false;
      const price = charmPrice(id);
      if (!canHoldCharm(c.charms, id) || c.gold < price || c.charms.length >= TUNING.charms.slots) return false;
      const shop = [...c.shop];
      shop.splice(shop.indexOf(id), 1);
      await put({ ...c, gold: c.gold - price, charms: [...c.charms, id], shop });
      return true;
    },

    async leaveShop() {
      const c = get().cup;
      if (c) await put({ ...c, flow: undefined, shop: undefined });
    },

    async spendCharm(id) {
      const c = get().cup;
      if (!c) return false;
      const i = c.charms.indexOf(id);
      if (i < 0) return false;
      const charms = [...c.charms];
      charms.splice(i, 1);
      await put({ ...c, charms, charmsUsed: c.charmsUsed + 1 });
      return true;
    },

    async pregame(p) {
      const c = get().cup;
      if (!c) return;
      await put({ ...c, nextColor: p.color ?? c.nextColor, nextStart: p.start ?? c.nextStart });
      await get().playNext();
    },

    async leave() {
      useCupGame.getState().clear();
      await save(null);
      set({ cup: null, trophies: await getTrophies(), note: null });
    },

    dev: {
      async result(r) {
        const c = get().cup;
        const opp = c && yourOpponent(c);
        if (!c || !opp) return;
        useCupGame.getState().clear();
        await settle(c, { color: yourColor(c), opponentId: opp, elo: opponentRating(c), events: [] }, { userResult: r, reason: r === 'draw' ? 'agreement' : 'checkmate', moves: 24, accuracy: 82, clockLeft: 120, greats: 1 });
      },
      async gold(n) {
        const c = get().cup;
        if (c) await put({ ...c, gold: c.gold + n });
      },
      async boon(b) {
        const c = get().cup;
        if (c && !c.boons.includes(b)) await put({ ...c, boons: [...c.boons, b] });
      },
      async charm(ch) {
        const c = get().cup;
        if (c && c.charms.length < TUNING.charms.slots) await put({ ...c, charms: [...c.charms, ch] });
      },
      clock(who, sec) {
        useCupGame.getState().mutate((g) => {
          const side = who === 'me' ? g.userColor : g.userColor === 'w' ? 'b' : 'w';
          const running = g.started && !g.result && turnOf(fenOf(g)) === side;
          g.clock = { ...g.clock, [side]: sec * 1000 + (running ? Date.now() - g.clock.turnStart : 0) };
        });
      },
      quirk(id) {
        useCupGame.getState().mutate((g) => {
          g.quirks = [id];
          g.hidden = undefined;
          g.revealed = [];
          g.lastPulse = {};
          g.qstate = {};
        });
      },
      async fen(fen) {
        await get().pregame({ start: { fen, sans: [], name: 'Dev position' } });
      },
    },
  };
});
