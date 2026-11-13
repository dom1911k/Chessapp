// The cup in progress (saved between rounds; the game itself saves mid-game in game.ts).
import { create } from 'zustand';
import { kvGet, kvSet } from '../lib/db';
import { awardXp } from '../lib/progress/xp';
import { getRepertoire, linePlies, repertoireLines } from '../lib/repertoire';
import { applyResult, applySecondChance, cupAdvances, cupGold, heatOn, summarize, currentRound, newCup, opponentRating, roundDone, secondChanceApplies, yourColor, yourOpponent, type CupState } from './cup';
import { addTrophy, cupXp, getTrophies, rng, type CupTier, type Trophies } from './ladder';
import { fenOf, turnOf, useCupGame, type GameOver } from './game';
import { NOTICE_KEY } from './legacy';
import { TUNING } from './tuning';
import { at, boonOffer, canHoldCharm, charmPrice, gameStartMods, lv, offerSize, shopOffer, type BoonId, type CharmId } from './boons';
import { useCupsMeta } from './meta';
import { hiddenQuirk } from './quirks';
import { codexAfterGame, codexDone, cupEnd, flawless } from './mastery';
import { heatOf, type HeatId } from './heat';

const KEY = 'cupState';

interface CupStore {
  cup: CupState | null;
  trophies: Trophies;
  loaded: boolean;
  /** A short message for the hub (e.g. Home Prep found no line). */
  note: string | null;
  load(): Promise<void>;
  /** Start a cup of this tier, with heat challenges and a sponsor's contract. */
  enter(tier: CupTier, opts?: { heat?: HeatId[]; sponsor?: string; seed?: number }): Promise<void>;
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
/** Boons you may hold this cup (Lean Deck heat allows fewer). */
const maxBoons = (c: CupState) => (heatOn(c, 'fewerBoons') ? TUNING.heat.mods.fewerBoons.maxBoons ?? 2 : TUNING.boons.maxPerCup);
/** After a boon pick: the shop, unless Closed Shop heat. */
const toShop = (c: CupState): CupState => (heatOn(c, 'noShop') ? { ...c, flow: undefined, offer: undefined, shop: undefined } : { ...c, flow: 'shop', offer: undefined, shop: shopOffer(unlocked(), Math.random) });

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
  const settle = async (c: CupState, g: { color: 'w' | 'b'; opponentId: string; elo: number; events: CupState['yours'][number]['events']; quirks?: string[]; hidden?: string }, over: Pick<GameOver, 'userResult' | 'reason' | 'moves' | 'opening' | 'accuracy' | 'clockLeft' | 'gameId' | 'greats' | 'decisive'>) => {
    const through = cupAdvances(c, over.userResult, g.color);
    const gold = cupGold(c, { userResult: over.userResult, color: g.color, accuracy: over.accuracy, greats: over.greats });
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
      greats: over.greats,
    };
    let next: CupState = { ...c, gold: c.gold + gold.total, lastGold: gold.parts };
    if (secondChanceApplies(c, over.userResult, g.color)) next = applySecondChance(next, rec);
    else next = applyResult(next, rec);
    // The quirk codex: every quirk you played against, and the first win against each.
    const meta = useCupsMeta.getState();
    const faced = [...(g.quirks ?? []), ...(g.hidden ? [g.hidden] : [])];
    const cx = codexAfterGame(meta.codex ?? {}, faced, over.userResult === 'win');
    const codexLaurels = cx.firsts.length * TUNING.mastery.codexLaurels;
    // A full codex unlocks the Quirk Hunter title and frame.
    const hunter = codexDone(cx.codex) && !meta.unlocks.includes('title:hunter') ? ['title:hunter', 'frame:hunter'] : [];
    await meta.patch({ codex: cx.codex, laurels: meta.laurels + codexLaurels, unlocks: [...meta.unlocks, ...hunter] });
    if (cx.firsts.length) next = { ...next, codexNew: [...(next.codexNew ?? []), ...cx.firsts] };
    let trophies = get().trophies;
    if (next.place) {
      await useCupsMeta.getState().recordCup({ ...summarize(next), heat: heatOf(next.heat), flawless: flawless(next) });
      const end = cupEnd(next, useCupsMeta.getState());
      const laurels = end.lines.reduce((n, l) => n + l.laurels, 0);
      await useCupsMeta.getState().patch({ ...end.patch, laurels: useCupsMeta.getState().laurels + laurels });
      next = { ...next, rewards: end.lines };
      const xp = cupXp(next.tier, next.place!);
      if (xp) await awardXp(xp, true);
      if (next.place === 'winner') trophies = await addTrophy(next.tier);
    } else if (through) {
      // Between rounds: a boon (while you have room), then the shop.
      const offer = next.boons.length < maxBoons(next) ? boonOffer(next.boons, unlocked(), Math.random, offerSize(next.boons, next.levels)) : [];
      next = offer.length ? { ...next, flow: 'boon', offer } : toShop(next);
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
      let cup: CupState | null = raw && raw.v === 2 ? { ...raw, charmsUsed: raw.charmsUsed ?? 0, boons: raw.boons ?? [], charms: raw.charms ?? [], gold: raw.gold ?? 0, quirks: raw.quirks ?? {}, levels: raw.levels ?? {}, heat: raw.heat ?? [] } : null;
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

    async enter(tier, opts = {}) {
      const meta = useCupsMeta.getState();
      const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
      const cup = newCup(tier, seed, Date.now(), meta.recentQuirks ?? [], { levels: { ...meta.levels }, heat: opts.heat ?? [], sponsor: opts.sponsor, nemesis: meta.nemesis });
      // A free boon before the quarter-final (with the picks after the quarter- and semi-final: 3 for the final),
      // unless Lean Deck heat.
      const offer = heatOn(cup, 'fewerBoons') ? [] : boonOffer([], unlocked(), Math.random);
      await put(offer.length ? { ...cup, flow: 'boon', offer } : cup);
    },

    async playNext() {
      let c = get().cup;
      const opp = c && yourOpponent(c);
      if (!c || !opp) return;
      const round = currentRound(c);
      // The finalist gets a hidden second quirk (with Two-Faced heat, every opponent does).
      if (round === 2 && !c.hidden) {
        c = { ...c, hidden: hiddenQuirk(Object.values(c.quirks), useCupsMeta.getState().recentQuirks ?? [], Math.random) };
        await put(c);
      } else if (round < 2 && heatOn(c, 'doubleQuirk') && !c.hiddens?.[round]) {
        const own = c.quirks[opp];
        c = { ...c, hiddens: { ...c.hiddens, [round]: hiddenQuirk(own ? [own] : [], [], rng(c.seed + 13 * round)) } };
        await put(c);
      }
      const quirks = c.quirks[opp] ? [c.quirks[opp]] : [];
      const hidden = round === 2 ? c.hidden : c.hiddens?.[round];
      void useCupsMeta.getState().faced([...quirks, ...(hidden ? [hidden] : [])]);
      const color = yourColor(c);
      const mods = gameStartMods(c.boons, color, c.levels);
      // Short Clock heat takes time off your clock; Second Chance III adds some to the replay.
      const shortMs = heatOn(c, 'shortClock') ? (TUNING.heat.mods.shortClock.ms ?? 480_000) - 600_000 : 0;
      const plusMs = shortMs + (c.nextExtraMs ?? 0);
      if (plusMs) mods.extraMs = { ...mods.extraMs, [color]: (mods.extraMs[color] ?? 0) + plusMs };
      let start = c.nextStart ?? null;
      let note: string | null = null;
      const hpl = lv(c.levels, 'homePrep');
      if (!start && c.boons.includes('homePrep')) {
        if (color === 'b' && !at(TUNING.boons.homePrepBlack, hpl)) note = 'Home Prep I only works with White.';
        else {
          start = await homePrepLine(color);
          note = start ? `Home Prep: the game starts after your ${start.name} line.` : `Home Prep: you have no repertoire line for ${color === 'w' ? 'White' : 'Black'}, so it does nothing this game.`;
          if (start) mods.freeMoves += at(TUNING.boons.homePrepFreeMoves, hpl);
        }
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
        levels: c.levels,
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
      await settle(c, { color: g.userColor, opponentId: g.opponentId, elo: g.elo, events: g.events, quirks: g.quirks, hidden: g.hidden }, over);
      useCupGame.getState().clear();
    },

    async pickBoon(id) {
      const c = get().cup;
      if (!c || c.flow !== 'boon') return;
      const boons = id && c.offer?.includes(id) && !c.boons.includes(id) ? [...c.boons, id] : c.boons;
      // The pick before the first game goes straight to the match (no gold to spend yet).
      if (c.yours.length === 0) return put({ ...c, boons, flow: undefined, offer: undefined });
      await put(toShop({ ...c, boons }));
    },

    async buyCharm(id) {
      const c = get().cup;
      if (!c || c.flow !== 'shop' || !c.shop?.includes(id)) return false;
      const price = charmPrice(id, c.levels);
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
        await settle(c, { color: yourColor(c), opponentId: opp, elo: opponentRating(c), events: [], quirks: c.quirks[opp] ? [c.quirks[opp]] : [] }, { userResult: r, reason: r === 'draw' ? 'agreement' : 'checkmate', moves: 24, accuracy: 82, clockLeft: 120, greats: 1 });
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
