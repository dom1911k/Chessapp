// Run mode state machine: map → room → tally → reward → (curse) → camp → … → boss → debrief.
// Uses the app's engine, Maia, puzzles and coach read-only; stores everything in its own DB.
import { create } from 'zustand';
import { Chess } from 'chess.js';
import { getEngine, type AnalysisResult } from '../lib/engine';
import { classify, moveAccuracy, winPct, povScore, type Classification } from '../lib/chess/evaluation';
import { parseUci, tryMove } from '../lib/chess/game';
import { maiaLogits, maiaTemperature, sampleMove } from '../lib/maia';
import { loadRange } from '../lib/puzzles/data';
import { fromLichess } from '../lib/puzzles/spec';
import { getRating } from '../lib/puzzles/rating';
import { OPPONENTS, opponentById } from '../lib/people';
import { DRILLS } from '../lib/endgames';
import { ECO } from '../lib/openings';
import { getOpponentRecords, isUnlocked } from '../lib/people/record';
import { hangingPieces, other, parseFen, sqName } from '../lib/chess/pos';
import { safetyInfo } from '../lib/coach/safety';
import type { CoachArrow, CoachHighlight } from '../lib/coach/types';
import { TUNING as T } from './tuning';
import positions from './data/positions.json';
import { archiveRun, loadCurrent, saveCurrent } from './db';
import { addRunReviews, readEchoes, readNemesis } from './bridge';
import { REPLACES, techAffinity, techMult, techniquesIn, type TechId } from './codex';
import { THEME_SETS } from '../lib/puzzles/themes';
import {
  buildMap, cardSlots, composureCost, roomCap, roomLoss, consumableOffer, endFires, judge, maxComposure, moveFires, reachable, unofferable, povCp, relicOffer, shopPrice, isFinalCamp, materialOf, pickRival,
  roomScore, sample, shopOffers, sound, diffOf, fervorAfterBlunder, fervorAfterRoom, judgeBattlefield, heatFor, heatRules, nullMoveFen, stallExtraPrice, closeMoves, plausibleWrong, scenarioOf, scenarioWeight, type Grimoire, nextRestCost, stallPrice, pouchPrice, cleansePrice, rerollPrice, canTakeBack, playStrength, rivalElo, type CostCtx,
} from './rules';
import { useRunSettings } from './settings';
import { sfx, buzz } from './sfx';
import { fakeChain, moveChain, scoreMilestones, type Chain } from './crunch';
import { ROOM_NAME, rivalRule } from './content';
import { lockedCards, lockedDrills, lockedEvents, lockedRelics, lockedRooms, perks, runSeals, useMeta } from './meta';
import { addMaterials, dripRate, mintGold, moveDrip, nextPurchase, roomYield, runMaterialBonus, roomMaterial, type Material } from './order';
import type { BossMod } from './tuning';
import type { ConsumableId, EchoPos, Fire, MapNode, PuzzleProgress, RelicId, RoomKind, RoomState, Run, UserMove } from './types';

type Pos = [string, number];
const POOLS = positions as unknown as Record<'convert' | 'hold' | 'boss', Pos[]> & { ward?: [string, number, string[]][] };
const WARDS = POOLS.ward ?? [];

/** Opening positions for the Duel: book lines of a few half-moves, side to move = you. */
const DUELS: { fen: string; name: string; sans: string[] }[] = (() => {
  const out: { fen: string; name: string; sans: string[] }[] = [];
  for (const e of ECO) {
    const sans = e.moves.split(' ');
    if (sans.length < T.rooms.duel.minPlies || sans.length > T.rooms.duel.maxPlies) continue;
    const c = new Chess();
    try {
      for (const m of sans) c.move(m);
      out.push({ fen: c.fen(), name: e.name, sans });
    } catch {
      /* skip */
    }
  }
  return out;
})();

/** Endgame vault positions from the app's endgame drills. */
const VAULTS = DRILLS.filter((d) => (T.rooms.vault.drills as readonly string[]).includes(d.id)).flatMap((d) =>
  d.fens.map((fen) => ({ fen, drill: d.id, goal: d.goal, title: d.title })),
);
/** A rival position by pool index (battlefield previews). */
export const bossFen = (i: number) => POOLS.boss[i % POOLS.boss.length][0];
export const poolSizes = () => ({ convert: POOLS.convert.length, hold: POOLS.hold.length, boss: POOLS.boss.length, ward: WARDS.length, duel: DUELS.length, vault: VAULTS.length, vaultDrills: VAULTS.map((v) => v.drill) });

/** Riddle themes the Grimoire tracks (the app's puzzle theme sets). */
const RIDDLE_THEMES = new Set(THEME_SETS.map((t) => t.id));
export const riddleThemes = (themes: string[]) => themes.filter((t) => RIDDLE_THEMES.has(t));

export type Verdict = { uci: string; label: 'safe' | 'risky' | 'blunder' | 'shadow'; after?: AnalysisResult; cls?: Classification; fromCheck?: boolean; /** Shadow: their likeliest reply. */ reply?: string };

export interface Aids {
  eye: string | null;
  cards: string[] | null;
  lens: boolean;
  opinion: boolean;
  /** Blunder Check armed: only a blunder is stopped. */
  check: boolean;
  /** Shadow armed: your next move shows their likeliest reply first. */
  shadow: boolean;
  verdict: Verdict | null;
}
const NO_AIDS: Aids = { eye: null, cards: null, lens: false, opinion: false, check: false, shadow: false, verdict: null };

export type FxEvent =
  | { id: number; kind: 'relic'; relic: RelicId | 'rival' | 'tech'; label: string; tech?: TechId }
  | { id: number; kind: 'technique'; tech: TechId; label: string }
  | { id: number; kind: 'drip'; material: Material; amount: number; sq: string }
  | { id: number; kind: 'ready'; label: string }
  | { id: number; kind: 'hit'; amount: number; insured?: boolean }
  | { id: number; kind: 'consumable'; item: ConsumableId }
  | { id: number; kind: 'move'; cls: Classification; san: string }
  /** The scoring chain of a move (quiet = an unsound move: the counters just update). */
  | { id: number; kind: 'score'; chain: Chain; sq: string; quiet?: boolean; fake?: boolean };

interface RunStore {
  run: Run | null;
  loaded: boolean;
  /** One-line notice for the home screen (e.g. an old run was set aside). */
  notice: string | null;
  /** Engine or opponent working. */
  busy: boolean;
  cur: { fen: string; a: AnalysisResult } | null;
  aids: Aids;
  fx: FxEvent[];
  /** Puzzle-like rooms: answer shown after a wrong move. */
  answer: CoachArrow | null;
  /** The Mirror: the question is being prepared (no moves yet). */
  asking: boolean;
  load(): Promise<void>;
  newRun(): Promise<void>;
  abandon(): void;
  pickStartRelic(id: RelicId): void;
  chooseNode(i: number): void;
  enterRoom(): Promise<void>;
  userMove(uci: string): boolean;
  confirmVerdict(play: boolean): void;
  /** The Mirror: name the opponent's most dangerous idea. */
  mirrorPick(uci: string): void;
  /** Choose your battlefield (rival): fight in option `i`. */
  pickBattlefield(i: number): void;
  use(id: ConsumableId): Promise<void>;
  /** Undo your last move: with the Rewind card, or `free` with a difficulty take-back. */
  rewind(free?: boolean): void;
  nextPuzzle(): void;
  /** Accept a decided room → tally (or debrief). */
  closeRoom(): void;
  afterTally(): void;
  pickReward(id: string | null): void;
  decideCurse(take: boolean): void;
  buy(id: ConsumableId): void;
  rest(): void;
  /** Campfire extras: the relic stall, Bigger Pouch, cleanse the curse, paid reroll. */
  buyStall(extra?: boolean): void;
  buyPouch(): void;
  cleanse(): void;
  paidReroll(): void;
  leaveCamp(): void;
  /** Second Look boost: a fresh shop, once per campfire. */
  rerollShop(): void;
  /** Give up the run (Embers still count) and go to the debrief. */
  abandonRun(): void;
  // events
  shrinePick(uci: string): void;
  gamble(): Promise<void>;
  merchantBuy(id: RelicId): void;
  springBuy(): void;
  altarTake(id: RelicId): void;
  leaveEvent(): void;
  dev: {
    skipRoom(won: boolean): void;
    gold(n: number): void;
    relic(id: RelicId): void;
    consumable(id: ConsumableId): void;
    composure(n: number): void;
    /** Fire a fake 12-trigger scoring chain (×mult in the middle). */
    fakeChain(): void;
  };
  /** The run finale has been shown (the debrief follows). */
  seeFinale(): void;
}

let token = 0;
let fxId = 1;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <X,>(x: X): X => JSON.parse(JSON.stringify(x));

async function analyze(fen: string, multipv: number = T.engine.multipv): Promise<AnalysisResult> {
  return getEngine().analyze(fen, { depth: T.engine.depth, movetime: T.engine.movetime, multipv, owner: 'run' });
}

/** Win% for `me` from an analysis (or from a finished game). */
function wpOf(fen: string, a: AnalysisResult | null, me: 'w' | 'b'): { wp: number; cp: number } {
  const c = new Chess(fen);
  if (c.isCheckmate()) return c.turn() === me ? { wp: 0, cp: -10000 } : { wp: 100, cp: 10000 };
  if (c.isDraw()) return { wp: 50, cp: 0 };
  const s = a?.lines[0]?.score ?? { type: 'cp' as const, value: 0 };
  return { wp: winPct(povScore(s, me)), cp: povCp(s, me) };
}

/**
 * Two wrong options for a multiple choice: Maia's likeliest moves at `elo` (what a player at
 * that level would be tempted by), never one within cardsCloseCp of the best move.
 */
async function wrongOptions(fens: string[], answer: string[], elo: number): Promise<string[]> {
  const fen = fens[fens.length - 1];
  const c = new Chess(fen);
  const legal = c.moves({ verbose: true }).map((m) => m.lan);
  let close = new Set<string>();
  try {
    close = closeMoves((await analyze(fen, T.engine.optionsMultipv)).lines, c.turn());
  } catch {
    /* engine busy: exclude only the answer */
  }
  let logits: Map<string, number> | null = null;
  try {
    logits = await maiaLogits(fens, elo);
  } catch {
    /* Maia unavailable: random fallback */
  }
  return plausibleWrong(legal, [...answer, ...close], logits, 2, Math.random);
}

/** Shown on room entry when an Order upgrade changed this room's drip rate since you last saw it. */
function rateChangeFor(r: Run, node: MapNode): { from: number; to: number } | undefined {
  const d = dripRate(r.meta?.order, node.kind as RoomKind);
  if (!d.material) return undefined;
  const seen = useMeta.getState().rateSeen?.[d.material];
  useMeta.getState().seeRate(d.material, d.rate);
  return seen !== undefined && Math.abs(seen - d.rate) > 1e-6 ? { from: seen, to: d.rate } : undefined;
}

/** The rival's rule, when the current room is the boss. */
export const bossOf = (r: Run | null): BossMod | undefined => (r?.room?.node.kind === 'boss' ? rivalRule(r) : undefined);

/** Add a relic (Glass Cannon takes its Composure at once). */
function addRelic(r: Run, id: RelicId) {
  if (r.relics.includes(id)) return;
  r.relics.push(id);
  if (id === 'glass') r.composure = Math.max(1, r.composure - T.relics.glassComposure);
  // Endgame Sense: one more Vault ahead (a room node in a later row becomes one).
  if (id === 'endgamesense') {
    const locked = r.meta?.lockedDrills ?? [];
    const pos = VAULTS.map((v, i) => (locked.includes(v.drill) ? -1 : i)).filter((i) => i >= 0);
    const spots: [number, number][] = [];
    r.layers.forEach((row, l) => {
      if (l <= r.layer) return;
      row.forEach((n, i) => {
        if (['puzzle', 'convert', 'hold', 'ward', 'duel', 'echo', 'mirror'].includes(n.kind)) spots.push([l, i]);
      });
    });
    if (spots.length && pos.length) {
      const [l, i] = spots[Math.floor(Math.random() * spots.length)];
      const n = r.layers[l][i];
      r.layers[l][i] = { kind: 'vault', modifier: n.modifier, elite: n.elite, next: n.next, pos: pos[Math.floor(Math.random() * pos.length)] };
    }
  }
  while (r.consumables.length > cardSlots(r)) r.consumables.pop();
}

export const useRun = create<RunStore>((set, get) => {
  const run = () => get().run!;
  const room = () => get().run!.room!;
  const ctx = (): CostCtx => ({ node: room().node, boss: bossOf(run()), curses: run().curses, diff: run().difficulty, heat: run().heat, relics: run().relics });
  /** Immutable update of the run (and persist). */
  const patch = (f: (r: Run) => void) => {
    const r = clone(get().run!);
    f(r);
    set({ run: r });
    saveCurrent(r);
  };
  const fire = (e: { kind: FxEvent['kind'] } & Record<string, unknown>) => {
    const ev = { ...e, id: fxId++ } as FxEvent;
    set((s) => ({ fx: [...s.fx.slice(-8), ev] }));
  };

  /** Analyse the current position (your move) in the background. */
  /** The Mirror: before your move, three ideas for the opponent (if it were their turn); one is the engine's best. */
  const askMirror = async (t: number) => {
    const rm = room();
    if (rm.node.kind !== 'mirror' || rm.status !== 'playing' || rm.mirror?.fen === rm.fen || new Chess(rm.fen).turn() !== rm.me) return;
    const nf = nullMoveFen(rm.fen);
    if (!nf) return void patch((r) => void (r.room!.mirror = undefined));
    set({ asking: true });
    try {
      const a = await analyze(nf, 1);
      if (t !== token || !a.bestMove) return;
      const others = await wrongOptions([nf], [a.bestMove], rm.elo);
      if (t !== token || get().run?.room?.fen !== rm.fen) return;
      patch((r) => void (r.room!.mirror = { fen: rm.fen, choices: sample([a.bestMove!, ...others], 3, Math.random), answer: a.bestMove! }));
    } catch {
      /* cancelled */
    } finally {
      // Always clear (a cancelled question must not freeze the next room).
      set({ asking: false });
    }
  };

  const prepare = async (t: number) => {
    await askMirror(t);
    if (t !== token || !get().run?.room) return;
    const fen = room().fen;
    if (get().cur?.fen === fen) return;
    try {
      const a = await analyze(fen);
      if (t !== token || get().run?.room?.fen !== fen) return;
      set({ cur: { fen, a } });
    } catch {
      /* cancelled */
    }
  };
  const currentAnalysis = async (t: number): Promise<AnalysisResult | null> => {
    const fen = room().fen;
    if (get().cur?.fen === fen) return get().cur!.a;
    const a = await analyze(fen);
    if (t !== token) return null;
    set({ cur: { fen, a } });
    return a;
  };

  // ---------- rooms ----------

  const showPuzzle = async (t: number) => {
    const p = room().puzzle!;
    const spec = p.list[p.index];
    const turn = new Chess(spec.fen).turn();
    const me = spec.setup ? other(turn) : turn;
    patch((r) => {
      const rm = r.room!;
      rm.fen = spec.fen;
      rm.startFen = spec.fen;
      rm.me = me;
      rm.plies = [];
      rm.puzzle!.step = 0;
      rm.puzzle!.lost = false;
      rm.puzzleCard = false;
    });
    set({ answer: null, aids: { ...NO_AIDS }, cur: null });
    if (spec.setup) {
      await sleep(T.timing.puzzleSetupDelay);
      if (t !== token) return;
      playOpp(spec.setup);
    }
    void prepare(t);
  };

  const playOpp = (uci: string) => {
    patch((r) => {
      const rm = r.room!;
      const res = tryMove(rm.fen, uci);
      if (!res) return;
      rm.plies.push({ uci, san: res.move.san, fen: res.fen, by: 'opp' });
      rm.fen = res.fen;
    });
  };

  /** Watchman: the Threat Lens comes back if material was won within a few of your moves. */
  const watchman = () => {
    const rm = room();
    const L = rm.lensAt;
    if (!L || !run().relics.includes('watchman')) return;
    const gained = materialOf(rm.fen, rm.me) - L.mat >= 1;
    const refund = gained && run().consumables.length < cardSlots(run());
    if (refund || gained || rm.moves.length - L.moves >= T.relics.watchmanMoves)
      patch((r) => {
        r.room!.lensAt = undefined;
        if (refund) r.consumables.push('lens');
      });
    if (refund) {
      fire({ kind: 'relic', relic: 'watchman', label: '+lens' });
      sfx('relic');
    }
  };

  /** The opponent replies (Maia, or Stockfish's best defence in the Vault). */
  const oppTurn = async (t: number) => {
    set({ busy: true });
    try {
      const rm = room();
      let uci: string | null = null;
      if (rm.opp === 'engine') {
        const [a] = await Promise.all([analyze(rm.fen, 1), sleep(T.timing.oppMoveMinDelay)]);
        uci = a.bestMove;
      } else {
        const fens = [rm.startFen, ...rm.plies.map((p) => p.fen)];
        const style = opponentById(rm.oppId)?.style;
        try {
          const [logits] = await Promise.all([maiaLogits(fens, rm.elo), sleep(T.timing.oppMoveMinDelay)]);
          uci = sampleMove(logits, maiaTemperature(rm.elo, style));
        } catch {
          uci = (await analyze(rm.fen, 1)).bestMove;
        }
      }
      if (t !== token) return;
      if (!uci) {
        const moves = new Chess(rm.fen).moves({ verbose: true });
        uci = moves.length ? moves[Math.floor(Math.random() * moves.length)].lan : null;
      }
      if (uci) playOpp(uci);
      watchman();
      const verdict = judge(room(), 'reply', bossOf(run()));
      if (verdict) return decide(verdict.status, verdict.reason);
      void prepare(t);
    } catch {
      /* cancelled */
    } finally {
      if (t === token) set({ busy: false });
    }
  };

  const decide = (status: 'won' | 'failed', reason: string) => {
    patch((r) => {
      r.room!.status = status;
      r.room!.reason = reason;
    });
    sfx(status === 'won' ? 'clear' : 'fail');
    buzz(status === 'won' ? [20, 40, 20] : 60);
  };

  /** Bookkeeping for one of your moves: classification, Composure, relics, debrief moment. */
  const record = (m: UserMove, cost: number, best?: string) => {
    let insured = false;
    if (cost > 0 && m.cls === 'blunder' && run().consumables.includes('insurance')) insured = true;
    let lost = insured ? 0 : cost;
    // Steady Nerves: the first blunder of the run costs one less.
    let nerves = false;
    if (lost > 0 && m.cls === 'blunder' && run().meta?.boosts.nerves && run().difficulty === 'apprentice' && !run().nervesUsed) {
      lost = Math.max(0, lost - 1);
      nerves = true;
    }
    // A single room can only take so many candles.
    lost = Math.min(lost, Math.max(0, roomCap(room()) - roomLoss(room())));
    // Second Wind: once per run, Composure doesn't break.
    let wind = false;
    if (lost > 0 && run().composure - lost <= 0 && run().relics.includes('secondwind') && !run().secondWindUsed) {
      lost = run().composure - 1;
      wind = true;
    }
    m.composureLost = lost;
    m.insured = insured || undefined;
    const rm = room();
    const fires = moveFires(run().relics, rm, m, rm.moves.length, bossOf(run()));
    // Codex: an equipped technique executed with a sound move fires its own ×mult.
    const techs = sound(m.cls) && m.fenBefore && run().techniques?.length ? techniquesIn(run().techniques!, m.fenBefore, m.uci, { kind: rm.node.kind as RoomKind, goal: rm.node.goal }) : [];
    const codex = useMeta.getState().codex ?? {};
    const techFires: Fire[] = techs.map((id) => ({ relic: 'tech', tech: id, xmult: techMult(codex[id]?.uses), at: rm.moves.length }));
    // The Order: a sound move drips the room's material (a wrong puzzle move never does).
    const mat = rm.gamble ? null : roomMaterial(rm.node.kind as RoomKind);
    const drip = mat && sound(m.cls) && m.correct !== false ? moveDrip(run().meta?.order, rm.node.kind as RoomKind, { bookMove: rm.node.kind === 'duel' && bookMove(rm) === m.uci }) : 0;
    const readyBefore = drip ? nextPurchase(useMeta.getState().order ?? { reclaimed: [], buildings: {} }, addMaterials(useMeta.getState().materials ?? {}, run().materials ?? {}))?.ready : true;
    patch((r) => {
      const R = r.room!;
      if (insured) {
        r.consumables.splice(r.consumables.indexOf('insurance'), 1);
        R.cardsUsed = (R.cardsUsed ?? 0) + 1;
      }
      if (wind) r.secondWindUsed = true;
      if (nerves) r.nervesUsed = true;
      r.composure = Math.max(0, r.composure - lost);
      if (m.eye) (r.eyeMoves ??= []).push(`${ROOM_NAME[R.node.kind as RoomKind]}: ${m.san}`);
      // Every mistake and blunder becomes a debrief moment, whatever it cost (free slips too).
      if (cost > 0 || m.cls === 'mistake' || m.cls === 'blunder')
        r.moments.push({ layer: R.layer, kind: R.node.kind as RoomKind, move: clone(m), cost, best: best ?? m.before?.bestMove ?? undefined });
      // Keep the analysis of costly moves and slips (the debrief and the "why" note use it).
      if (!(cost > 0) && m.cls !== 'mistake' && m.cls !== 'blunder') {
        delete m.before;
        delete m.after;
      }
      R.moves.push(m);
      R.fires.push(...fires, ...techFires);
      if (drip && mat) {
        r.materials = addMaterials(r.materials ?? {}, { [mat]: drip });
        R.dripped = Math.round(((R.dripped ?? 0) + drip) * 100) / 100;
      }
      // Fervor: a blunder halves it (this room too).
      if (m.cls === 'blunder' && (r.fervor ?? 1) > 1) {
        r.fervor = fervorAfterBlunder(r.fervor ?? 1);
        R.fervor = r.fervor;
      }
    });
    if (drip && mat) {
      fire({ kind: 'drip', material: mat, amount: drip, sq: m.uci.slice(2, 4) });
      const np = nextPurchase(useMeta.getState().order ?? { reclaimed: [], buildings: {} }, addMaterials(useMeta.getState().materials ?? {}, run().materials ?? {}));
      if (np?.ready && !readyBefore) setTimeout(() => (fire({ kind: 'ready', label: np.label }), sfx('ready')), 500);
    }
    techs.forEach((id) => useMeta.getState().useTechnique(id));
    // The scoring chain: every trigger of this move, one beat at a time (the room view plays it).
    fire({ kind: 'score', chain: moveChain(rm, room()), sq: m.uci.slice(2, 4), quiet: !sound(m.cls) });
    fire({ kind: 'move', cls: m.cls, san: m.san });
    if (lost > 0) {
      fire({ kind: 'hit', amount: lost });
      sfx('hit');
      buzz([40, 30, 80]);
    } else if (insured) {
      fire({ kind: 'hit', amount: 0, insured: true });
      fire({ kind: 'consumable', item: 'insurance' });
      sfx('card');
    }
    if (wind) setTimeout(() => (fire({ kind: 'relic', relic: 'secondwind', label: 'saved!' }), sfx('relic')), 200);
    if (run().composure <= 0) decide('failed', 'Too many costly moves.');
  };

  const gameMove = async (uci: string, t: number, pre?: Verdict) => {
    set({ busy: true });
    try {
      const rm = room();
      const fenBefore = rm.fen;
      const before = await currentAnalysis(t);
      if (t !== token || !before) return;
      const res = tryMove(fenBefore, uci)!;
      const eye = get().aids.eye === uci;
      // Show your move at once; the engine judges it meanwhile.
      patch((r) => {
        r.room!.plies.push({ uci, san: res.move.san, fen: res.fen, by: 'me' });
        r.room!.fen = res.fen;
      });
      set({ aids: { ...NO_AIDS } });
      const after = pre?.after ?? (new Chess(res.fen).isGameOver() ? null : await analyze(res.fen, 1));
      if (t !== token) return;
      const b = wpOf(fenBefore, before, rm.me);
      const a = wpOf(res.fen, after, rm.me);
      const cls = classify(b.wp, a.wp, uci === before.bestMove);
      const m: UserMove = {
        uci, san: res.move.san, fenBefore, fenAfter: res.fen, cls, accuracy: moveAccuracy(b.wp, a.wp), evalAfter: a.cp,
        composureLost: 0, eye: eye || undefined, before, after, wpLoss: Math.max(0, b.wp - a.wp), evalBefore: b.cp,
      };
      // Archive: a Duel move that matches the opening book.
      const bookMatch = rm.node.kind === 'duel' && bookMove(rm) === uci;
      if (bookMatch) patch((r) => void (r.room!.bookMatched = (r.room!.bookMatched ?? 0) + 1));
      // The Mirror: a wrong read of their idea halves this move's chips.
      const q = rm.mirror;
      if (q && q.fen === fenBefore && q.picked && q.picked !== q.answer) {
        m.accuracy = Math.round(m.accuracy * T.rooms.mirror.wrongChipFactor);
        m.misread = true;
      }
      record(m, composureCost(cls, ctx()));
      if (room().status !== 'playing') return;
      const v = judge(room(), 'mine', bossOf(run()));
      if (v) return decide(v.status, v.reason);
      await oppTurn(t);
    } catch {
      /* cancelled */
    } finally {
      if (t === token) set({ busy: false });
    }
  };

  const isCorrect = (uci: string, san: string) => {
    const p = room().puzzle!;
    const spec = p.list[p.index];
    if (spec.accept) return spec.accept.includes(uci);
    return uci === spec.solution[p.step] || san.endsWith('#');
  };

  const puzzleMove = async (uci: string, t: number, pre?: Verdict) => {
    const rm = room();
    const p = rm.puzzle!;
    const spec = p.list[p.index];
    const expected = spec.solution[p.step];
    const res = tryMove(rm.fen, uci)!;
    const correct = isCorrect(uci, res.move.san);
    const fenBefore = rm.fen;
    const eye = get().aids.eye === uci;
    patch((r) => {
      r.room!.plies.push({ uci, san: res.move.san, fen: res.fen, by: 'me' });
      r.room!.fen = res.fen;
    });
    set({ aids: { ...NO_AIDS } });
    if (correct) {
      const m: UserMove = {
        uci, san: res.move.san, fenBefore, fenAfter: res.fen, cls: 'best', accuracy: T.rooms.puzzle.chipsPerMove, evalAfter: 0,
        composureLost: 0, correct: true, eye: eye || undefined,
      };
      record(m, 0);
      const done = p.step + 1 >= spec.solution.length || res.move.san.endsWith('#');
      if (!done) {
        patch((r) => void (r.room!.puzzle!.step += 2));
        set({ busy: true });
        await sleep(T.timing.puzzleSetupDelay);
        if (t !== token) return;
        playOpp(spec.solution[p.step + 1]);
        set({ busy: false });
        void prepare(t);
        return;
      }
      let bound = false;
      patch((r) => {
        r.room!.puzzle!.solved++;
        (r.room!.puzzle!.outcomes ??= []).push(true);
        // Bookbinder: puzzles solved without a card earn a free Blunder Check.
        if (r.relics.includes('bookbinder') && !r.room!.puzzleCard && !r.room!.gamble) {
          r.bookbinder = (r.bookbinder ?? 0) + 1;
          if (r.bookbinder % T.relics.bookbinderEvery === 0 && r.consumables.length < cardSlots(r)) {
            r.consumables.push('check');
            bound = true;
          }
        }
      });
      if (bound) setTimeout(() => (fire({ kind: 'relic', relic: 'bookbinder', label: '+card' }), sfx('relic')), 250);
      const q = room().puzzle!;
      if (q.solved >= q.need) return decide('won', `Solved ${q.solved} of ${q.solved + q.failed}.`);
      return advancePuzzle(t);
    }
    // Wrong: the engine grades the move, the answer is shown.
    set({ busy: true, answer: { from: expected.slice(0, 2), to: expected.slice(2, 4), tone: 'good' } });
    try {
      const before = await (get().cur?.fen === fenBefore ? Promise.resolve(get().cur!.a) : analyze(fenBefore));
      const after = pre?.after ?? (new Chess(res.fen).isGameOver() ? null : await analyze(res.fen, 1));
      if (t !== token) return;
      const b = wpOf(fenBefore, before, rm.me);
      const a = wpOf(res.fen, after, rm.me);
      const cls = classify(b.wp, a.wp, false);
      const m: UserMove = {
        uci, san: res.move.san, fenBefore, fenAfter: res.fen, cls, accuracy: Math.min(moveAccuracy(b.wp, a.wp), sound(cls) ? 50 : 100),
        evalAfter: a.cp, composureLost: 0, correct: false, eye: eye || undefined, before, after, wpLoss: Math.max(0, b.wp - a.wp),
      };
      record(m, composureCost(cls, ctx()), expected);
      patch((r) => {
        r.room!.puzzle!.lost = true;
        r.room!.puzzle!.failed++;
        (r.room!.puzzle!.outcomes ??= []).push(false);
      });
    } catch {
      /* cancelled */
    } finally {
      if (t === token) set({ busy: false });
    }
  };

  const advancePuzzle = (t: number) => {
    const p = room().puzzle!;
    const remaining = p.count - (p.solved + p.failed);
    if (p.solved + remaining < p.need || remaining <= 0)
      return decide(p.solved >= p.need ? 'won' : 'failed', room().gamble ? (p.solved ? 'The gamble pays off!' : 'The house wins.') : `Solved ${p.solved} of ${p.solved + p.failed}.`);
    patch((r) => void r.room!.puzzle!.index++);
    void showPuzzle(t);
  };

  const pickPuzzles = async (r: Run, n: number, shift = 0) => {
    const w = T.rooms.puzzle.ratingWindow;
    const c = r.rating + shift;
    let pool = await loadRange(c - w, c + w);
    if (pool.length < 20) pool = await loadRange(c - 3 * w, c + 3 * w);
    pool = pool.filter((p) => !r.usedPuzzles.includes(p.id) && p.moves.length >= 2);
    // Grimoire: riddle themes you fail more often come up a little more.
    const g = useMeta.getState().grimoire ?? {};
    const tw = (p: (typeof pool)[number]) => Math.max(1, ...riddleThemes(p.themes).map((th) => scenarioWeight(g, `riddle:${th}`))) * Math.max(1, ...p.themes.map((th) => techAffinity(r.techniques ?? [], `riddle:${th}`)));
    const out: typeof pool = [];
    const left = [...pool];
    while (out.length < n && left.length) {
      let x = Math.random() * left.reduce((a, p) => a + tw(p), 0);
      let i = 0;
      for (; i < left.length - 1; i++) if ((x -= tw(left[i])) <= 0) break;
      out.push(left.splice(i, 1)[0]);
    }
    return out.map(fromLichess);
  };

  const roomElo = (r: Run, elite?: boolean) => {
    const e = elite ? T.elite.elo : 0;
    return Math.max(T.roomElo.min, Math.min(T.roomElo.max + e, (r.strength ?? r.rating) + T.roomElo.offset + diffOf(r.difficulty).eloOffset + e));
  };

  const resumeRoom = (t: number) => {
    const rm = room();
    if (rm.status !== 'playing') return;
    if (rm.puzzle) {
      const p = rm.puzzle;
      if (p.lost) return;
      const spec = p.list[p.index];
      if (!rm.plies.length && spec.setup) return void showPuzzle(t);
      if (new Chess(rm.fen).turn() !== rm.me) playOpp(spec.solution[p.step - 1]);
      return void prepare(t);
    }
    if (new Chess(rm.fen).turn() !== rm.me) return void oppTurn(t);
    void prepare(t);
  };

  const openCamp = (r: Run) => {
    r.phase = 'camp';
    r.shopStock = consumableOffer(shopOffers(r.relics), Math.random, r.meta?.lockedCards);
    r.restBought = false;
    r.rerollUsed = false;
    r.rests = 0;
    r.rerolls = 0;
    r.stall = relicOffer(unofferable(r), 1, Math.random)[0] ?? null;
    r.stallExtra = r.relics.includes('patron') ? (relicOffer([...unofferable(r), ...(r.stall ? [r.stall] : [])], 1, Math.random)[0] ?? null) : null;
  };

  const finishRun = (r: Run, won: boolean) => {
    r.ended = won ? 'won' : 'lost';
    r.endedAt = Date.now();
    r.phase = 'debrief';
    r.finalScore = r.results.reduce((s, x) => s + x.score, 0) + (won ? r.composure * T.score.composureLeftChips : 0);
    r.room = null;
    r.event = null;
    const ids: string[] = [];
    if (won) ids.push('first-win');
    if ((r.finalScore ?? 0) >= 5000) ids.push('score-5k');
    if (won && r.cursed) ids.push('cursed-win');
    if (won && r.results.every((x) => x.composureLost === 0)) ids.push('untouched');
    earn(r, ids);
    r.seals = runSeals(r);
    // For the finale: was this a new personal best?
    r.prevBest = useMeta.getState().best ?? 0;
    // Run-end bonus: sqrt of the run total, split like the materials you earned.
    r.materialBonus = runMaterialBonus(r.finalScore ?? 0, r.materials ?? {});
    r.materials = addMaterials(r.materials ?? {}, r.materialBonus);
    useMeta.getState().finish(r);
    const snap = clone(r);
    // The one write into the main app: the top moments become review cards.
    void addRunReviews(snap, snap.techMissed ?? []).then((n) => {
      snap.reviewsAdded = n;
      void archiveRun(snap);
      if (get().run?.id === snap.id) patch((x) => void (x.reviewsAdded = n));
    });
  };

  /** Award milestones (once ever) and remember them on the run for the debrief. */
  const earn = (r: Run, ids: string[]): string[] => {
    const fresh = useMeta.getState().award(ids);
    if (!fresh.length) return [];
    r.milestones = [...(r.milestones ?? []), ...fresh.map((x) => x.id)];
    // Score milestones get their own banner and sound in the tally.
    if (fresh.some((x) => !x.id.startsWith('room-'))) setTimeout(() => sfx('relic', 3), 300);
    return fresh.map((x) => x.id);
  };

  const spend = (x: Run, n: number) => {
    x.gold -= n;
    x.goldSpent = (x.goldSpent ?? 0) + n;
  };

  /** After a room, event or campfire: back to the map (campfires are map nodes now). */
  const nextAfterReward = (r: Run) => {
    r.offer = null;
    r.phase = 'map';
  };

  const puzzleRoom = (r: Run, node: MapNode, list: PuzzleProgress['list'], count: number, need: number, extra: Partial<RoomState> = {}): RoomState => ({
    layer: r.layer, node, me: 'w', startFen: list[0].fen, fen: list[0].fen, plies: [], moves: [], fires: [], startEval: 0,
    elo: roomElo(r), opp: 'maia', status: 'playing', diff: r.difficulty, fervor: r.fervor ?? 1, rateChange: rateChangeFor(r, node), puzzle: { list, index: 0, step: 0, solved: 0, failed: 0, lost: false, count, need }, ...extra,
  });

  const startPuzzleRoom = (t: number, rm: RoomState, used: string[]) => {
    patch((x) => {
      x.room = rm;
      x.phase = 'room';
      x.usedPuzzles.push(...used);
      x.roomStartedAt = Date.now();
    });
    set({ busy: false, cur: null, aids: { ...NO_AIDS }, answer: null });
    void showPuzzle(t);
  };

  return {
    run: null,
    loaded: false,
    notice: null,
    busy: false,
    cur: null,
    aids: { ...NO_AIDS },
    fx: [],
    answer: null,
    asking: false,

    async load() {
      if (get().loaded) return;
      const { run: r, stale } = await loadCurrent();
      if (get().run) return set({ loaded: true }); // a run started meanwhile wins
      if (r?.phase === 'room') r.roomStartedAt = Date.now(); // time away doesn't count as room time
      set({ run: r, loaded: true, notice: stale ? 'Run mode was updated: your run in progress was set aside. Start a new one!' : null });
      if (r?.phase === 'room' && r.room) resumeRoom(++token);
    },

    async newRun() {
      token++;
      getEngine().cancelAll('run');
      const [{ rating }, records, meta, nemesis, allEchoes] = await Promise.all([getRating(), getOpponentRecords(), useMeta.getState().load(), readNemesis(), readEchoes()]);
      // The Echo: your own slips (too few: the room borrows Siege positions).
      const echoes: EchoPos[] = allEchoes.length >= T.rooms.echo.minPositions ? sample(allEchoes, T.rooms.echo.sample, Math.random) : [];
      const grimoire: Grimoire = meta.grimoire ?? {};
      // Old Sanctum perks now come with Order buildings.
      const boosts = perks(meta);
      // Codex: equipped techniques; a learned Fork/Pin replaces its relic.
      const techniques = (meta.equipped ?? []).filter((id) => meta.codex?.[id]?.learned);
      const replaced = (Object.keys(REPLACES) as TechId[]).filter((id) => meta.codex?.[id]?.learned).map((id) => REPLACES[id]!);
      const locked = [...lockedRelics(meta), ...replaced];
      const difficulty = useRunSettings.getState().difficulty ?? 'apprentice';
      const heat = heatFor(difficulty, useRunSettings.getState().heat ?? 0, meta.heatUnlocked ?? 0);
      // Heat 4: Engine's Eye is never offered.
      const lockedC = [...lockedCards(meta), ...(heatRules(heat).noEye ? (['eye'] as ConsumableId[]) : [])];
      // Keen Eye: a 4th, rare choice that carries the Brittle curse.
      const start = relicOffer(locked, 3, Math.random);
      const cursedPick = boosts.keeneye ? relicOffer([...locked, ...start], 1, Math.random, T.relics.rarity, T.sanctum.keenEyeRarity)[0] : undefined;
      const unlocked = OPPONENTS.filter((o) => isUnlocked(o.id, records));
      const boss = pickRival(unlocked.length ? unlocked : [OPPONENTS[0]], meta.rivalWins ?? {}, Math.random);
      const r: Run = {
        version: 3,
        id: Math.random().toString(36).slice(2, 10),
        startedAt: Date.now(),
        rating: Math.round(rating),
        strength: playStrength(rating, records),
        difficulty,
        heat,
        bossId: boss.id,
        phase: 'start',
        layers: buildMap(Math.random, { ...poolSizes(), echo: echoes.length || POOLS.hold.length, mirror: POOLS.hold.length }, { rooms: lockedRooms(meta), events: lockedEvents(meta), drills: lockedDrills(meta) }, (k) => scenarioWeight(grimoire, k) * techAffinity(techniques, k)),
        nemesis,
        echoes,
        techniques,
        path: [],
        layer: 0,
        composure: T.composure.start,
        gold: T.gold.start,
        relics: [],
        consumables: boosts.notes ? ['cards'] : [],
        meta: { boosts: { ...boosts }, lockedRelics: locked, lockedCards: lockedC, lockedDrills: lockedDrills(meta), order: clone(meta.order) },
        materials: {},
        curses: [],
        room: null,
        event: null,
        results: [],
        moments: [],
        offer: { type: 'relic', ids: cursedPick ? [...start, cursedPick] : start, cursed: cursedPick, free: true, title: 'Choose your first relic' },
        shopStock: [],
        restBought: false,
        cursed: false,
        curseDecided: false,
        ended: null,
        usedPuzzles: [],
        roomMs: 0,
        goldEarned: 0,
        goldSpent: 0,
      };
      set({ run: r, cur: null, aids: { ...NO_AIDS }, fx: [], answer: null, busy: false, notice: null });
      saveCurrent(r);
    },

    abandon() {
      token++;
      getEngine().cancelAll('run');
      set({ run: null, cur: null, busy: false });
      saveCurrent(null);
    },

    pickStartRelic(id) {
      patch((r) => {
        if (r.offer?.type === 'relic' && r.offer.cursed === id && !r.curses.includes('brittle')) r.curses.push('brittle');
        addRelic(r, id);
        r.offer = null;
        r.phase = 'map';
      });
      sfx('card');
    },

    chooseNode(i) {
      if (!reachable(run()).includes(i) || run().phase !== 'map') return;
      const node = run().layers[run().layer][i];
      if (node.kind === 'camp') {
        patch((r) => {
          r.path[r.layer] = i;
          // The Devil's Bargain waits at the last campfire.
          if (isFinalCamp(r) && !r.curseDecided) r.phase = 'curse';
          else openCamp(r);
        });
        return;
      }
      // The rival: choose your battlefield first (three positions, evals hidden).
      if (node.kind === 'boss') {
        patch((r) => {
          r.path[r.layer] = i;
          const all = POOLS.boss.map((_, j) => j).filter((j) => j !== (node.pos ?? 0) % POOLS.boss.length);
          r.battlefield = sample([(node.pos ?? 0) % POOLS.boss.length, ...sample(all, T.battlefield.options - 1, Math.random)], T.battlefield.options, Math.random);
          r.phase = 'battlefield';
        });
        return;
      }
      patch((r) => void (r.path[r.layer] = i));
      void get().enterRoom();
    },

    pickBattlefield(i) {
      const r = run();
      if (r.phase !== 'battlefield' || r.battlefield?.[i] === undefined) return;
      patch((x) => {
        const row = x.layers[x.layer];
        row[x.path[x.layer] ?? 0] = { ...row[x.path[x.layer] ?? 0], pos: x.battlefield![i] };
      });
      sfx('slam');
      void get().enterRoom();
    },

    async enterRoom() {
      const t = ++token;
      const r = run();
      let node: MapNode = r.layers[r.layer][r.path[r.layer] ?? 0];
      // Healing Spring's price: the next room is under Razor Focus.
      if (r.springDebt && node.kind !== 'event' && node.kind !== 'boss' && node.kind !== 'camp') {
        node = { ...node, modifier: 'focused' };
        patch((x) => void (x.springDebt = false));
      }
      set({ busy: true });
      try {
        if (node.kind === 'event') {
          const ev = node.event!;
          let lib: { fen: string; answer: string[]; themes: string[]; others: string[]; id: string } | null = null;
          let shrine: { fen: string; answer: string[]; others: string[] } | null = null;
          if (ev === 'library') {
            const [p] = await pickPuzzles(r, 1);
            if (t !== token) return;
            const fen = tryMove(p.fen, p.setup!)!.fen;
            const answer = [p.solution[0]];
            const others = await wrongOptions([p.fen, fen], answer, roomElo(r));
            if (t !== token) return;
            lib = { fen, answer, themes: p.themes, id: p.id, others };
          } else if (ev === 'shrine') {
            const [fen, , accept] = WARDS[Math.floor(Math.random() * WARDS.length)];
            const others = await wrongOptions([fen], accept, roomElo(r));
            if (t !== token) return;
            shrine = { fen, answer: accept, others };
          }
          patch((x) => {
            x.phase = 'event';
            if (ev === 'shrine' && shrine) {
              x.event = { kind: 'shrine', fen: shrine.fen, answer: shrine.answer, choices: sample([shrine.answer[0], ...shrine.others], 3, Math.random) };
            } else if (ev === 'merchant') {
              // One uncommon and one rare, priced like the campfire stall.
              const ids = T.events.merchantRarities.map((rar) => relicOffer(unofferable(x), 1, Math.random, T.relics.rarity, rar)[0]).filter(Boolean);
              x.event = { kind: 'merchant', stock: ids.map((id) => ({ id, price: stallPrice(x, id) })) };
            } else if (ev === 'altar') {
              x.event = { kind: 'altar', ids: relicOffer(unofferable(x), 3, Math.random, T.relics.rarity, 'rare') };
            } else if (ev === 'library' && lib) {
              x.event = { kind: 'library', fen: lib.fen, answer: lib.answer, themes: lib.themes, choices: sample([lib.answer[0], ...lib.others], 3, Math.random) };
              x.usedPuzzles.push(lib.id);
            } else if (ev === 'spring') {
              x.event = { kind: 'spring' };
            } else x.event = { kind: 'gambler' };
          });
          return;
        }
        if (node.kind === 'puzzle') {
          const p = T.rooms.puzzle;
          const list = await pickPuzzles(r, p.count, node.elite ? T.elite.puzzleRating : 0);
          if (t !== token) return;
          const rm = puzzleRoom(r, node, list, p.count, node.elite ? T.elite.puzzleNeed : p.needSolved);
          return startPuzzleRoom(t, rm, list.map((x) => x.id));
        }
        if (node.kind === 'ward') {
          const w = T.rooms.ward;
          const picks = sample(WARDS, w.count, Math.random);
          const list = picks.map(([fen, ev, accept], i) => ({ id: `ward-${i}-${fen}`, kind: 'lichess' as const, fen, solution: [accept[0]], accept, themes: ['defensiveMove'], rating: ev }));
          const rm = puzzleRoom(r, node, list, w.count, node.elite ? T.elite.wardNeed : w.needSolved);
          return startPuzzleRoom(t, rm, []);
        }
        let fen: string;
        let ev = 0;
        let extra: Partial<RoomState> = {};
        if (node.kind === 'duel') {
          const d = DUELS[(node.pos ?? 0) % DUELS.length];
          fen = d.fen;
          // The goal is relative to where the book leaves you.
          const a = await analyze(fen, 1);
          if (t !== token) return;
          ev = povCp(a.lines[0]?.score ?? { type: 'cp', value: 0 }, new Chess(fen).turn());
          extra = { book: d.sans, elo: Math.max(400, roomElo(r, node.elite) + T.rooms.duel.eloOffset) };
        } else if (node.kind === 'vault') {
          const v = VAULTS[(node.pos ?? 0) % VAULTS.length];
          fen = v.fen;
          const max = T.rooms.vault.maxMoves[v.goal] - (node.elite && v.goal !== 'hold' ? T.elite.vaultMovesLess : 0);
          extra = { vault: { goal: v.goal, maxMoves: max, title: v.title, drill: v.drill }, opp: 'engine' };
        } else if (node.kind === 'echo' && r.echoes?.length) {
          const e = r.echoes[(node.pos ?? 0) % r.echoes.length];
          fen = e.fen;
          const a = await analyze(fen, 1);
          if (t !== token) return;
          ev = povCp(a.lines[0]?.score ?? { type: 'cp', value: 0 }, new Chess(fen).turn());
          extra = { elo: Math.max(T.roomElo.min, e.elo + diffOf(r.difficulty).eloOffset), echo: { when: e.when, played: e.played, best: e.best } };
        } else {
          const pool = POOLS[node.kind === 'echo' || node.kind === 'mirror' ? 'hold' : (node.kind as 'convert' | 'hold' | 'boss')];
          [fen, ev] = pool[(node.pos ?? 0) % pool.length];
        }
        const boss = node.kind === 'boss' ? opponentById(r.bossId) : undefined;
        const rm: RoomState = {
          layer: r.layer, node, me: new Chess(fen).turn(), startFen: fen, fen, plies: [], moves: [], fires: [], startEval: ev,
          elo: boss ? rivalElo(r) : roomElo(r, node.elite), oppId: boss?.id, opp: 'maia', status: 'playing', diff: r.difficulty, heat: r.heat, fervor: r.fervor ?? 1, rateChange: rateChangeFor(r, node), ...extra,
        };
        patch((x) => {
          x.room = rm;
          x.phase = 'room';
          x.roomStartedAt = Date.now();
        });
        set({ cur: null, aids: { ...NO_AIDS }, answer: null, asking: false });
        void prepare(t);
      } finally {
        if (t === token) set({ busy: false });
      }
    },

    userMove(uci) {
      const s = get();
      const rm = s.run?.room;
      if (!rm || rm.status !== 'playing' || s.busy || s.asking || s.aids.verdict) return false;
      if (rm.puzzle?.lost) return false;
      if (rm.mirror && rm.mirror.fen === rm.fen && !rm.mirror.picked) return false;
      const c = new Chess(rm.fen);
      if (c.turn() !== rm.me || !tryMove(rm.fen, uci)) return false;
      const t = token;
      if (s.aids.shadow) {
        // Shadow: show Maia's likeliest reply before the move counts.
        set({ busy: true });
        void (async () => {
          try {
            const res = tryMove(rm.fen, uci)!;
            const after = new Chess(res.fen);
            let reply: string | undefined;
            if (!after.isGameOver()) {
              const logits = await maiaLogits([rm.startFen, ...rm.plies.map((p) => p.fen), res.fen], rm.elo);
              reply = [...logits.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
            }
            if (t !== token) return;
            set({ aids: { ...get().aids, shadow: false, verdict: { uci, label: 'shadow', reply } } });
          } catch {
            /* cancelled */
          } finally {
            if (t === token) set({ busy: false });
          }
        })();
        return false;
      }
      if (s.aids.check) {
        // Blunder Check: judge first; only a blunder is stopped.
        set({ busy: true });
        void (async () => {
          try {
            const before = await currentAnalysis(t);
            const res = tryMove(rm.fen, uci)!;
            const after = new Chess(res.fen).isGameOver() ? null : await analyze(res.fen, 1);
            if (t !== token || !before) return;
            const ok = rm.puzzle ? isCorrect(uci, res.move.san) : uci === before.bestMove;
            const cls = classify(wpOf(rm.fen, before, rm.me).wp, wpOf(res.fen, after, rm.me).wp, ok);
            set({ aids: { ...get().aids, check: false } });
            if (cls === 'blunder') {
              set({ aids: { ...get().aids, verdict: { uci, label: 'blunder', after: after!, cls, fromCheck: true } } });
              return;
            }
            const v: Verdict = { uci, label: 'safe', after: after!, cls };
            set({ busy: false });
            if (rm.puzzle) void puzzleMove(uci, t, v);
            else void gameMove(uci, t, v);
          } catch {
            /* cancelled */
          } finally {
            if (t === token && get().aids.verdict) set({ busy: false });
          }
        })();
        return false;
      }
      if (s.aids.opinion) {
        // Second Opinion: judge first, commit only after confirmation.
        set({ busy: true });
        void (async () => {
          try {
            const before = await currentAnalysis(t);
            const res = tryMove(rm.fen, uci)!;
            const after = new Chess(res.fen).isGameOver() ? null : await analyze(res.fen, 1);
            if (t !== token || !before) return;
            const ok = rm.puzzle ? isCorrect(uci, res.move.san) : uci === before.bestMove;
            const cls = classify(wpOf(rm.fen, before, rm.me).wp, wpOf(res.fen, after, rm.me).wp, ok);
            const label = ok ? 'safe' : cls === 'blunder' ? 'blunder' : cls === 'mistake' || cls === 'inaccuracy' || rm.puzzle ? 'risky' : 'safe';
            set({ aids: { ...get().aids, opinion: false, verdict: { uci, label, after: after!, cls } } });
          } catch {
            /* cancelled */
          } finally {
            if (t === token) set({ busy: false });
          }
        })();
        return false;
      }
      if (rm.puzzle) void puzzleMove(uci, t);
      else void gameMove(uci, t);
      return true;
    },

    mirrorPick(uci) {
      const rm = get().run?.room;
      if (!rm?.mirror || rm.mirror.picked || rm.mirror.fen !== rm.fen) return;
      const ok = uci === rm.mirror.answer;
      patch((r) => void (r.room!.mirror!.picked = uci));
      sfx(ok ? 'chip' : 'fail', ok ? 8 : 0);
      buzz(ok ? 15 : 40);
    },

    confirmVerdict(play) {
      const v = get().aids.verdict;
      if (!v) return;
      set({ aids: { ...get().aids, verdict: null } });
      if (!play) return;
      const t = token;
      if (room().puzzle) void puzzleMove(v.uci, t, v);
      else void gameMove(v.uci, t, v);
    },

    async use(id) {
      const s = get();
      const rm = s.run?.room;
      if (!rm || rm.status !== 'playing' || !s.run!.consumables.includes(id) || s.busy) return;
      if (bossOf(s.run)?.sealed?.includes(id)) return;
      if (id === 'insurance') return; // passive
      if (id === 'rewind') return get().rewind();
      const t = token;
      const consume = () => {
        patch((r) => {
          r.consumables.splice(r.consumables.indexOf(id), 1);
          r.room!.cardsUsed = (r.room!.cardsUsed ?? 0) + 1;
          if (r.room!.puzzle) r.room!.puzzleCard = true;
        });
        fire({ kind: 'consumable', item: id });
        sfx('card');
      };
      if (id === 'lens') {
        consume();
        set({ aids: { ...get().aids, lens: true } });
        if (!rm.puzzle) patch((r) => void (r.room!.lensAt = { moves: rm.moves.length, mat: materialOf(rm.fen, rm.me) }));
        return;
      }
      if (id === 'check') {
        consume();
        set({ aids: { ...get().aids, check: true } });
        return;
      }
      if (id === 'opinion') {
        consume();
        set({ aids: { ...get().aids, opinion: true } });
        return;
      }
      if (id === 'shadow') {
        consume();
        set({ aids: { ...get().aids, shadow: true } });
        return;
      }
      set({ busy: true });
      try {
        const a = await currentAnalysis(t);
        if (t !== token || !a) return;
        const best = rm.puzzle ? rm.puzzle.list[rm.puzzle.index].solution[rm.puzzle.step] : a.bestMove;
        if (!best) return;
        consume();
        if (id === 'eye') set({ aids: { ...get().aids, eye: best } });
        if (id === 'cards') {
          const accept = rm.puzzle?.list[rm.puzzle.index].accept ?? [];
          const fens = [rm.startFen, ...rm.plies.map((p) => p.fen)];
          const others = await wrongOptions(fens, [best, ...accept, ...closeMoves(a.lines, rm.me)], rm.elo);
          if (t !== token) return;
          set({ aids: { ...get().aids, cards: sample([best, ...others], 3, Math.random) } });
        }
      } catch {
        /* cancelled */
      } finally {
        if (t === token) set({ busy: false });
      }
    },

    rewind(free) {
      const s = get();
      const r = s.run;
      const rm = r?.room;
      if (!r || !rm || s.busy) return;
      if (free ? !canTakeBack(r) : !r.consumables.includes('rewind')) return;
      const last = rm.moves[rm.moves.length - 1];
      if (!last) return;
      // Only the move just played; in puzzles only a wrong one.
      if (rm.puzzle && !rm.puzzle.lost) return;
      if (!rm.plies.some((p) => p.by === 'me' && p.fen === last.fenAfter)) return;
      token++;
      const t = token;
      getEngine().cancelAll('run');
      const idx = rm.moves.length - 1;
      patch((x) => {
        const R = x.room!;
        if (free) R.takebacks = (R.takebacks ?? 0) + 1;
        else {
          x.consumables.splice(x.consumables.indexOf('rewind'), 1);
          R.cardsUsed = (R.cardsUsed ?? 0) + 1;
        }
        x.composure = Math.min(maxComposure(x), x.composure + last.composureLost);
        if (last.insured && x.consumables.length < cardSlots(x)) x.consumables.push('insurance');
        R.moves.pop();
        R.fires = R.fires.filter((f) => f.at !== idx);
        const mi = x.moments.findIndex((m) => m.move.fenBefore === last.fenBefore && m.move.uci === last.uci);
        if (mi >= 0) x.moments.splice(mi, 1);
        const pi = R.plies.findIndex((p) => p.fen === last.fenAfter);
        R.plies = R.plies.slice(0, pi);
        R.fen = last.fenBefore;
        R.status = 'playing';
        R.reason = undefined;
        if (R.puzzle && R.puzzle.lost) {
          R.puzzle.lost = false;
          R.puzzle.failed--;
          R.puzzle.outcomes?.pop();
        }
      });
      if (!free) fire({ kind: 'consumable', item: 'rewind' });
      sfx(free ? 'whoosh' : 'card');
      set({ busy: false, answer: null, aids: { ...NO_AIDS } });
      void prepare(t);
    },

    nextPuzzle() {
      if (!room().puzzle?.lost) return;
      set({ answer: null });
      advancePuzzle(token);
    },

    closeRoom() {
      const rm = get().run?.room;
      if (!rm || rm.status === 'playing') return;
      token++;
      getEngine().cancelAll('run');
      const broke = run().composure <= 0;
      const boss = bossOf(run());
      patch((r) => {
        const R = r.room!;
        R.fires.push(...endFires(r, R, boss));
        const sc = roomScore(R);
        const failCost = R.gamble ? T.events.gambleStake : T.composure.failRoom;
        // One punishment per slip: no fail penalty when a move here already cost candles (the gamble's stake always counts).
        const fail = R.status === 'failed' && R.node.kind !== 'boss' && !broke && (R.gamble || roomLoss(R) === 0) ? Math.min(failCost, Math.max(0, roomCap(R) - roomLoss(R))) : 0;
        const calm = R.fires.reduce((s, f) => s + (f.composure ?? 0), 0);
        r.composure = Math.max(0, Math.min(maxComposure(r), r.composure - fail + (broke ? 0 : calm)));
        // Battlefield: reveal the three options and pay for good judgement.
        let bf: import('./types').BattlefieldResult | undefined;
        if (R.node.kind === 'boss' && r.battlefield?.length) {
          const evals = r.battlefield.map((j) => POOLS.boss[j][1]);
          const picked = Math.max(0, r.battlefield.indexOf((R.node.pos ?? 0) % POOLS.boss.length));
          const j = judgeBattlefield(evals, picked);
          bf = { fens: r.battlefield.map((x) => POOLS.boss[x][0]), evals, picked, ...j };
          r.gold += j.gold;
          r.goldEarned = (r.goldEarned ?? 0) + j.gold;
        }
        // The Mint: a share of the score-gold on top.
        const mint = mintGold(r.meta?.order, sc.gold);
        r.gold += sc.gold + mint;
        r.goldEarned = (r.goldEarned ?? 0) + sc.gold + mint;
        // The Order: a cleared room pays its material.
        // The drip already landed move by move; a cleared room adds its burst (elite, blind, clean).
        let mat: { id: Material; amount: number; drip?: number; burst?: number } | undefined;
        const kindMat = R.gamble ? null : roomMaterial(R.node.kind as RoomKind);
        if (kindMat) {
          const y = R.status === 'won' ? roomYield(r.meta?.order, { kind: R.node.kind as RoomKind, elite: R.node.elite, beatBlind: sc.beatTarget, clean: sc.clean }) : { amount: 0 };
          if (y.amount > 0) r.materials = addMaterials(r.materials ?? {}, { [kindMat]: y.amount });
          const total = Math.round(((R.dripped ?? 0) + y.amount) * 100) / 100;
          if (total > 0) mat = { id: kindMat, amount: total, drip: R.dripped ?? 0, burst: y.amount };
        }
        // Fervor: +step for a room cleared above its blind; a failed room resets it.
        if (!R.gamble) {
          r.fervor = fervorAfterRoom(r.fervor ?? 1, R.status === 'won', sc.beatTarget);
          r.fervorPeak = Math.max(r.fervorPeak ?? 1, r.fervor);
        }
        if (r.roomStartedAt) r.roomMs = (r.roomMs ?? 0) + Math.min(30 * 60000, Math.max(0, Date.now() - r.roomStartedAt));
        r.roomStartedAt = undefined;
        r.results.push({
          layer: R.layer, kind: R.node.kind as RoomKind, modifier: R.node.modifier, elite: R.node.elite, gamble: R.gamble, won: R.status === 'won',
          chips: sc.chips, target: sc.target, mult: sc.mult, score: sc.score, gold: sc.gold, fires: R.fires,
          composureLost: R.moves.reduce((s, m) => s + m.composureLost, 0) + fail, reason: R.reason ?? '', clean: sc.clean, battlefield: bf, material: mat, mintGold: mint || undefined, fervorIn: sc.fervor, fervor: r.fervor, evalEnd: R.puzzle ? undefined : R.moves[R.moves.length - 1]?.evalAfter,
        });
        // Milestones from this room.
        const won = R.status === 'won';
        const ids: string[] = [];
        if (won) ids.push('first-clear');
        if (won && R.moves.length >= 5 && R.moves.every((m) => sound(m.cls))) ids.push('clean-room');
        if (won && [...R.plies].reverse().find((p) => p.by === 'me')?.san.endsWith('#')) ids.push('mate');
        if (won && R.node.kind === 'ward' && R.puzzle && R.puzzle.solved >= R.puzzle.count) ids.push('perfect-ward');
        if (won && R.node.elite) ids.push('elite');
        if (r.relics.length >= 5) ids.push('collector');
        // The first room above 10k, 100k and 1M (once ever).
        if (won) ids.push(...scoreMilestones(sc.score));
        const fresh = earn(r, ids);
        if (fresh.length) r.results[r.results.length - 1].milestones = fresh;
        // Codex: in a failed room, positions where an equipped technique was the best move go to your reviews.
        if (!won && r.techniques?.length)
          for (const m of R.moves) {
            const best = m.before?.bestMove;
            if (!best || best === m.uci || !m.fenBefore) continue;
            if (techniquesIn(r.techniques, m.fenBefore, best, { kind: R.node.kind as RoomKind, goal: R.node.goal }).length)
              (r.techMissed ??= []).push({ layer: R.layer, kind: R.node.kind as RoomKind, move: clone(m), cost: m.composureLost, best });
          }
        // Grimoire: the room's scenario, or each riddle's themes.
        const notes: { key: string; won: boolean }[] = [];
        const key = scenarioOf(R.node, R.vault?.drill);
        if (key) notes.push({ key, won });
        if (R.puzzle && (R.node.kind === 'puzzle' || R.gamble))
          (R.puzzle.outcomes ?? []).forEach((ok, i) => riddleThemes(R.puzzle!.list[i]?.themes ?? []).forEach((th) => notes.push({ key: `riddle:${th}`, won: ok })));
        useMeta.getState().noteGrimoire(notes);
        if (r.composure <= 0) {
          sfx('over');
          buzz([80, 60, 160]);
          return finishRun(r, false);
        }
        // The free pick shows under the tally: elites always give a relic, other rooms sometimes.
        r.offer = null;
        if (won && !R.gamble && R.node.kind !== 'boss') {
          const kind = R.node.elite ? 'elite' : sc.beatTarget ? (T.rewardAfterLayer[R.layer] ?? 'consumable') : null;
          if (kind === 'relic' || kind === 'elite') {
            const ids = relicOffer(unofferable(r), 3, Math.random, kind === 'elite' ? T.relics.eliteRarity : T.relics.rarity);
            if (ids.length) r.offer = { type: 'relic', ids, free: true, title: kind === 'elite' ? 'Elite spoils: choose a relic' : 'Spoils: choose a relic' };
          } else if (kind === 'consumable') r.offer = { type: 'consumable', ids: consumableOffer(3, Math.random, r.meta?.lockedCards), free: true, title: 'Spoils: choose a card' };
        }
        r.phase = 'tally';
      });
      set({ cur: null, aids: { ...NO_AIDS }, answer: null, busy: false, asking: false });
    },

    afterTally() {
      patch((r) => {
        const res = r.results[r.results.length - 1];
        if (res.kind === 'boss') return finishRun(r, res.won);
        r.room = null;
        r.event = null;
        r.layer++;
        nextAfterReward(r);
      });
    },

    pickReward(id) {
      const fromTally = run().phase === 'tally';
      patch((r) => {
        if (id && r.offer?.type === 'relic') addRelic(r, id as RelicId);
        if (id && r.offer?.type === 'consumable' && r.consumables.length < cardSlots(r)) r.consumables.push(id as ConsumableId);
        r.offer = null;
        if (fromTally) {
          r.room = null;
          r.layer++;
        }
        nextAfterReward(r);
      });
      if (id) sfx('card');
    },

    decideCurse(take) {
      patch((r) => {
        r.curseDecided = true;
        r.cursed = take;
        if (take) {
          const g = Math.round(r.gold * T.curse.goldFactor);
          r.goldEarned = (r.goldEarned ?? 0) + g - r.gold;
          r.gold = g;
        }
        openCamp(r);
      });
      if (take) sfx('coin');
    },

    buy(id) {
      const r = run();
      const p = shopPrice(r, id);
      if (r.gold < p || r.consumables.length >= cardSlots(r) || !r.shopStock.includes(id)) return;
      patch((x) => {
        spend(x, p);
        x.consumables.push(id);
        x.shopStock.splice(x.shopStock.indexOf(id), 1);
      });
      sfx('coin');
      buzz(15);
    },

    rest() {
      const r = run();
      const p = nextRestCost(r);
      if (r.gold < p || (r.rests ?? 0) >= T.shop.restMax || r.composure >= maxComposure(r)) return;
      patch((x) => {
        spend(x, p);
        x.composure = Math.min(maxComposure(x), x.composure + T.shop.restComposure);
        x.restBought = true;
        x.rests = (x.rests ?? 0) + 1;
      });
      sfx('coin');
    },

    buyStall(extra) {
      const r = run();
      const id = extra ? r.stallExtra : r.stall;
      if (r.phase !== 'camp' || !id) return;
      const price = extra ? stallExtraPrice(r, id) : stallPrice(r, id);
      if (r.gold < price) return;
      patch((x) => {
        spend(x, price);
        addRelic(x, id);
        if (extra) x.stallExtra = null;
        else x.stall = null;
      });
      sfx('relic');
      buzz(15);
    },

    buyPouch() {
      const r = run();
      if (r.phase !== 'camp' || (r.pouch ?? 0) > 0 || r.gold < pouchPrice(r)) return;
      patch((x) => {
        spend(x, pouchPrice(x));
        x.pouch = 1;
      });
      sfx('coin');
    },

    cleanse() {
      const r = run();
      if (r.phase !== 'camp' || !r.curses.length || r.gold < cleansePrice(r)) return;
      patch((x) => {
        spend(x, cleansePrice(x));
        x.curses = [];
      });
      sfx('clear');
    },

    paidReroll() {
      const r = run();
      if (r.phase !== 'camp' || r.gold < rerollPrice(r)) return;
      patch((x) => {
        spend(x, rerollPrice(x));
        x.rerolls = (x.rerolls ?? 0) + 1;
        x.shopStock = consumableOffer(shopOffers(x.relics), Math.random, x.meta?.lockedCards);
      });
      sfx('card');
    },

    rerollShop() {
      const r = run();
      if (!r.meta?.boosts.reroll || r.rerollUsed || r.phase !== 'camp') return;
      patch((x) => {
        x.shopStock = consumableOffer(shopOffers(x.relics), Math.random, x.meta?.lockedCards);
        x.rerollUsed = true;
      });
      sfx('card');
    },

    abandonRun() {
      if (!get().run || get().run!.ended) return;
      token++;
      getEngine().cancelAll('run');
      patch((r) => {
        r.abandoned = true;
        finishRun(r, false);
      });
      set({ cur: null, aids: { ...NO_AIDS }, answer: null, busy: false, asking: false });
      sfx('over');
    },

    leaveCamp() {
      patch((r) => {
        r.layer++;
        r.phase = 'map';
      });
    },

    // ---------- events ----------

    shrinePick(uci) {
      const ev = run().event;
      if ((ev?.kind !== 'shrine' && ev?.kind !== 'library') || ev.picked) return;
      const right = ev.answer.includes(uci);
      patch((r) => {
        (r.event as typeof ev).picked = uci;
      });
      sfx(right ? 'clear' : 'fail');
      buzz(right ? [20, 40, 20] : 60);
    },

    async gamble() {
      const r = run();
      if (r.event?.kind !== 'gambler') return;
      const t = ++token;
      set({ busy: true });
      const list = await pickPuzzles(r, 1);
      if (t !== token) return;
      const node = r.layers[r.layer][r.path[r.layer] ?? 0];
      const rm = puzzleRoom(r, { ...node, kind: 'puzzle' }, list, 1, 1, { gamble: true });
      patch((x) => void (x.event = null));
      startPuzzleRoom(t, rm, list.map((x) => x.id));
    },

    merchantBuy(id) {
      const r = run();
      const ev = r.event;
      if (ev?.kind !== 'merchant') return;
      const item = ev.stock.find((s) => s.id === id);
      if (!item || r.gold < item.price) return;
      patch((x) => {
        spend(x, item.price);
        addRelic(x, id);
        const e = x.event as typeof ev;
        e.stock = e.stock.filter((s) => s.id !== id);
      });
      sfx('coin');
      buzz(15);
    },

    altarTake(id) {
      const r = run();
      if (r.event?.kind !== 'altar') return;
      patch((x) => {
        addRelic(x, id);
        if (!x.curses.includes('brittle')) x.curses.push('brittle');
        x.event = null;
        x.layer++;
        nextAfterReward(x);
      });
      sfx('over');
      buzz([40, 30, 80]);
    },

    springBuy() {
      const r = run();
      if (r.event?.kind !== 'spring' || r.event.used || r.gold < T.events.springPrice || r.composure >= maxComposure(r)) return;
      patch((x) => {
        spend(x, T.events.springPrice);
        x.composure = Math.min(maxComposure(x), x.composure + T.events.springHeal);
        x.springDebt = true;
        (x.event as { used?: boolean }).used = true;
      });
      sfx('clear');
    },

    leaveEvent() {
      const ev = run().event;
      patch((x) => {
        if (ev?.kind === 'library' && ev.picked && ev.answer.includes(ev.picked)) {
          x.materials = addMaterials(x.materials ?? {}, { ink: T.order.roomYield.event });
          x.event = null;
          x.layer++;
          x.offer = { type: 'consumable', ids: consumableOffer(3, Math.random, x.meta?.lockedCards), free: true, title: 'The Library: choose a card' };
          x.phase = 'reward';
          return;
        }
        if (ev?.kind === 'shrine' && ev.picked && ev.answer.includes(ev.picked)) {
          x.materials = addMaterials(x.materials ?? {}, { pages: T.order.roomYield.event });
          // Sam's blessing: a relic pick.
          x.event = null;
          x.layer++;
          const ids = relicOffer(unofferable(x), 3, Math.random);
          if (ids.length) {
            x.offer = { type: 'relic', ids, free: true, title: "Sam's blessing: choose a relic" };
            x.phase = 'reward';
            return;
          }
          return nextAfterReward(x);
        }
        x.event = null;
        x.layer++;
        nextAfterReward(x);
      });
    },

    dev: {
      skipRoom(won) {
        if (get().run?.phase !== 'room') return;
        token++;
        getEngine().cancelAll('run');
        decide(won ? 'won' : 'failed', won ? 'Skipped (dev).' : 'Failed (dev).');
        set({ busy: false });
      },
      gold: (n) => patch((r) => void (r.gold += n)),
      relic: (id) => patch((r) => addRelic(r, id)),
      consumable: (id) => patch((r) => void r.consumables.push(id)),
      composure: (n) => patch((r) => void (r.composure = Math.max(0, Math.min(maxComposure(r), n)))),
      fakeChain() {
        const rm = get().run?.room;
        const sc = rm ? roomScore(rm) : { chips: 0, mult: 1 };
        fire({ kind: 'score', chain: fakeChain(sc.chips, sc.mult), sq: rm?.plies.filter((p) => p.by === 'me').pop()?.uci.slice(2, 4) ?? 'e4', fake: true });
      },
    },
    seeFinale: () => patch((r) => void (r.finaleSeen = true)),
  };
});

// Lens: hanging/attacked pieces for both sides.
export function lensMarks(fen: string, me: 'w' | 'b'): CoachHighlight[] {
  const mine = safetyInfo(fen, me).highlights;
  const board = parseFen(fen).board;
  const theirs = hangingPieces(board, other(me)).map((h) => ({ sq: sqName(h.sq), tone: 'good' as const }));
  return [...mine, ...theirs];
}

export const arrowOf = (uci: string, tone: CoachArrow['tone']): CoachArrow => ({ ...parseUci(uci), tone });

/** Your-POV eval of the current analysis (null while thinking). */
export function liveEval(cur: { fen: string; a: AnalysisResult } | null, fen: string, me: 'w' | 'b'): number | null {
  if (!cur || cur.fen !== fen) return null;
  return wpOf(fen, cur.a, me).cp;
}

// Dev hook for automated playtests.
if (import.meta.env.DEV) (window as unknown as { __run: typeof useRun }).__run = useRun;

/** The next book move for the Duel hint (UCI), while the game still follows a known line. */
export function bookHint(room: RoomState): string | null {
  if (room.moves.length >= T.rooms.duel.hintMoves) return null;
  return bookMove(room);
}

/** The opening book's next move in a Duel (any move number), if the line is still in the book. */
export function bookMove(room: RoomState): string | null {
  if (room.node.kind !== 'duel' || !room.book) return null;
  const seq = [...room.book, ...room.plies.map((p) => p.san)];
  const line = ECO.map((e) => e.moves.split(' ')).find((m) => m.length > seq.length && seq.every((x, i) => m[i] === x));
  if (!line) return null;
  const res = tryMove(room.fen, line[seq.length]);
  return res ? res.move.lan : null;
}


