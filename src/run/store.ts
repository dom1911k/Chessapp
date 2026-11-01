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
import { getOpponentRecords, isUnlocked, starsOf } from '../lib/people/record';
import { hangingPieces, other, parseFen, sqName } from '../lib/chess/pos';
import { safetyInfo } from '../lib/coach/safety';
import type { CoachArrow, CoachHighlight } from '../lib/coach/types';
import { TUNING as T } from './tuning';
import positions from './data/positions.json';
import { archiveRun, loadCurrent, saveCurrent } from './db';
import {
  buildMap, cardSlots, composureCost, roomCap, roomLoss, consumableOffer, endFires, judge, maxComposure, moveFires, reachable, unofferable, povCp, relicOffer, relicPrice, restCost, shopPrice,
  roomScore, sample, shopOffers, sound, type CostCtx,
} from './rules';
import { sfx, buzz } from './sfx';
import { ROOM_NAME, bossMod } from './content';
import { embersFor, lockedCards, lockedEvents, lockedRelics, lockedRooms, useMeta } from './meta';
import type { BossMod } from './tuning';
import type { ConsumableId, MapNode, PuzzleProgress, RelicId, RoomKind, RoomState, Run, UserMove } from './types';

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
  d.fens.map((fen) => ({ fen, drill: d.id, goal: d.goal as 'mate' | 'promote' | 'capture', title: d.title })),
);
export const poolSizes = () => ({ convert: POOLS.convert.length, hold: POOLS.hold.length, boss: POOLS.boss.length, ward: WARDS.length, duel: DUELS.length, vault: VAULTS.length });

export type Verdict = { uci: string; label: 'safe' | 'risky' | 'blunder'; after: AnalysisResult; cls: Classification; fromCheck?: boolean };

export interface Aids {
  eye: string | null;
  cards: string[] | null;
  lens: boolean;
  opinion: boolean;
  /** Blunder Check armed: only a blunder is stopped. */
  check: boolean;
  verdict: Verdict | null;
}
const NO_AIDS: Aids = { eye: null, cards: null, lens: false, opinion: false, check: false, verdict: null };

export type FxEvent =
  | { id: number; kind: 'relic'; relic: RelicId | 'rival'; label: string }
  | { id: number; kind: 'hit'; amount: number; insured?: boolean }
  | { id: number; kind: 'consumable'; item: ConsumableId }
  | { id: number; kind: 'move'; cls: Classification; san: string };

interface RunStore {
  run: Run | null;
  loaded: boolean;
  /** Engine or opponent working. */
  busy: boolean;
  cur: { fen: string; a: AnalysisResult } | null;
  aids: Aids;
  fx: FxEvent[];
  /** Puzzle-like rooms: answer shown after a wrong move. */
  answer: CoachArrow | null;
  load(): Promise<void>;
  newRun(): Promise<void>;
  abandon(): void;
  pickStartRelic(id: RelicId): void;
  chooseNode(i: number): void;
  enterRoom(): Promise<void>;
  userMove(uci: string): boolean;
  confirmVerdict(play: boolean): void;
  use(id: ConsumableId): Promise<void>;
  rewind(): void;
  nextPuzzle(): void;
  /** Accept a decided room → tally (or debrief). */
  closeRoom(): void;
  afterTally(): void;
  pickReward(id: string | null): void;
  decideCurse(take: boolean): void;
  buy(id: ConsumableId): void;
  rest(): void;
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
  };
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

/** The rival's rule, when the current room is the boss. */
export const bossOf = (r: Run | null): BossMod | undefined => (r?.room?.node.kind === 'boss' ? bossMod(r.bossId) : undefined);

/** Add a relic (Glass Cannon takes its Composure at once). */
function addRelic(r: Run, id: RelicId) {
  if (r.relics.includes(id)) return;
  r.relics.push(id);
  if (id === 'glass') r.composure = Math.max(1, r.composure - T.relics.glassComposure);
  while (r.consumables.length > cardSlots(r)) r.consumables.pop();
}

export const useRun = create<RunStore>((set, get) => {
  const run = () => get().run!;
  const room = () => get().run!.room!;
  const ctx = (): CostCtx => ({ node: room().node, boss: bossOf(run()), curses: run().curses });
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
  const prepare = async (t: number) => {
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
  const record = (m: UserMove, cost: number) => {
    let insured = false;
    if (cost > 0 && m.cls === 'blunder' && run().consumables.includes('insurance')) insured = true;
    let lost = insured ? 0 : cost;
    // Steady Nerves: the first blunder of the run costs one less.
    let nerves = false;
    if (lost > 0 && m.cls === 'blunder' && run().meta?.boosts.nerves && !run().nervesUsed) {
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
    patch((r) => {
      const R = r.room!;
      if (insured) r.consumables.splice(r.consumables.indexOf('insurance'), 1);
      if (wind) r.secondWindUsed = true;
      if (nerves) r.nervesUsed = true;
      r.composure = Math.max(0, r.composure - lost);
      if (m.eye) (r.eyeMoves ??= []).push(`${ROOM_NAME[R.node.kind as RoomKind]}: ${m.san}`);
      if (cost > 0) r.moments.push({ layer: R.layer, kind: R.node.kind as RoomKind, move: clone(m), cost });
      if (!(cost > 0)) {
        delete m.before;
        delete m.after;
      }
      R.moves.push(m);
      R.fires.push(...fires);
    });
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
    fires.forEach((f, i) =>
      setTimeout(() => {
        fire({ kind: 'relic', relic: f.relic, label: f.mult ? `+${f.mult}×` : f.gold ? `+${f.gold}g` : '' });
        sfx('relic', i);
        buzz(15);
      }, 250 + i * 260),
    );
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
        composureLost: 0, eye: eye || undefined, before, after,
      };
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
      patch((r) => void r.room!.puzzle!.solved++);
      sfx('chip', 12);
      buzz(20);
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
        evalAfter: a.cp, composureLost: 0, correct: false, eye: eye || undefined, before, after,
      };
      record(m, composureCost(cls, ctx()));
      patch((r) => {
        r.room!.puzzle!.lost = true;
        r.room!.puzzle!.failed++;
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
    return sample(pool, n, Math.random).map(fromLichess);
  };

  const roomElo = (r: Run, elite?: boolean) => Math.max(T.roomElo.min, Math.min(T.roomElo.max + (elite ? T.elite.elo : 0), r.rating + T.roomElo.offset + (elite ? T.elite.elo : 0)));

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
    r.embers = embersFor(r);
    useMeta.getState().finish(r, r.embers);
    void archiveRun(clone(r));
  };

  /** Award milestones (once ever) and remember them on the run for the debrief. */
  const earn = (r: Run, ids: string[]) => {
    const fresh = useMeta.getState().award(ids);
    if (!fresh.length) return;
    r.milestones = [...(r.milestones ?? []), ...fresh.map((x) => x.id)];
    setTimeout(() => sfx('relic', 3), 300);
  };

  /** Next stop after a room or event: the curse offer before the boss, else the campfire. */
  const nextAfterReward = (r: Run) => {
    const bossNext = r.layer === r.layers.length - 1;
    if (bossNext && !r.curseDecided) {
      r.phase = 'curse';
      return;
    }
    openCamp(r);
  };

  const puzzleRoom = (r: Run, node: MapNode, list: PuzzleProgress['list'], count: number, need: number, extra: Partial<RoomState> = {}): RoomState => ({
    layer: r.layer, node, me: 'w', startFen: list[0].fen, fen: list[0].fen, plies: [], moves: [], fires: [], startEval: 0,
    elo: roomElo(r), opp: 'maia', status: 'playing', puzzle: { list, index: 0, step: 0, solved: 0, failed: 0, lost: false, count, need }, ...extra,
  });

  const startPuzzleRoom = (t: number, rm: RoomState, used: string[]) => {
    patch((x) => {
      x.room = rm;
      x.phase = 'room';
      x.usedPuzzles.push(...used);
    });
    set({ busy: false, cur: null, aids: { ...NO_AIDS }, answer: null });
    void showPuzzle(t);
  };

  return {
    run: null,
    loaded: false,
    busy: false,
    cur: null,
    aids: { ...NO_AIDS },
    fx: [],
    answer: null,

    async load() {
      if (get().loaded) return;
      const r = await loadCurrent();
      if (get().run) return set({ loaded: true }); // a run started meanwhile wins
      set({ run: r, loaded: true });
      if (r?.phase === 'room' && r.room) resumeRoom(++token);
    },

    async newRun() {
      token++;
      getEngine().cancelAll('run');
      const [{ rating }, records, meta] = await Promise.all([getRating(), getOpponentRecords(), useMeta.getState().load()]);
      const boosts = meta.boosts;
      const locked = lockedRelics(meta);
      const lockedC = lockedCards(meta);
      const unlocked = OPPONENTS.filter((o) => isUnlocked(o.id, records));
      const boss = unlocked.find((o) => starsOf(records[o.id]) === 0) ?? unlocked[unlocked.length - 1] ?? OPPONENTS[0];
      const r: Run = {
        version: 2,
        id: Math.random().toString(36).slice(2, 10),
        startedAt: Date.now(),
        rating: Math.round(rating),
        bossId: boss.id,
        phase: 'start',
        layers: buildMap(Math.random, poolSizes(), { rooms: lockedRooms(meta), events: lockedEvents(meta) }),
        path: [],
        layer: 0,
        composure: T.composure.start + (boosts.candle ?? 0),
        gold: T.gold.start + 2 * (boosts.purse ?? 0),
        relics: [],
        consumables: [...(boosts.notes ? (['cards'] as ConsumableId[]) : []), ...(boosts.satchel ? consumableOffer(1, Math.random, lockedC) : [])],
        meta: { boosts: { ...boosts }, lockedRelics: locked, lockedCards: lockedC },
        curses: [],
        room: null,
        event: null,
        results: [],
        moments: [],
        offer: { type: 'relic', ids: relicOffer(locked, boosts.keeneye ? 4 : 3, Math.random), free: true, title: 'Choose your first relic' },
        shopStock: [],
        restBought: false,
        cursed: false,
        curseDecided: false,
        ended: null,
        usedPuzzles: [],
      };
      set({ run: r, cur: null, aids: { ...NO_AIDS }, fx: [], answer: null, busy: false });
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
        addRelic(r, id);
        r.offer = null;
        r.phase = 'map';
      });
      sfx('card');
    },

    chooseNode(i) {
      if (!reachable(run()).includes(i)) return;
      patch((r) => {
        r.path[r.layer] = i;
        r.phase = 'intro';
      });
    },

    async enterRoom() {
      const t = ++token;
      const r = run();
      const node: MapNode = r.layers[r.layer][r.path[r.layer] ?? 0];
      set({ busy: true });
      try {
        if (node.kind === 'event') {
          const ev = node.event!;
          let lib: { fen: string; answer: string[]; themes: string[]; others: string[]; id: string } | null = null;
          if (ev === 'library') {
            const [p] = await pickPuzzles(r, 1);
            if (t !== token) return;
            const fen = tryMove(p.fen, p.setup!)!.fen;
            const answer = [p.solution[0]];
            lib = { fen, answer, themes: p.themes, id: p.id, others: new Chess(fen).moves({ verbose: true }).map((m) => m.lan).filter((u) => !answer.includes(u)) };
          }
          patch((x) => {
            x.phase = 'event';
            if (ev === 'shrine') {
              const [fen, , accept] = WARDS[Math.floor(Math.random() * WARDS.length)];
              const others = new Chess(fen).moves({ verbose: true }).map((m) => m.lan).filter((u) => !accept.includes(u));
              x.event = { kind: 'shrine', fen, answer: accept, choices: sample([accept[0], ...sample(others, 2, Math.random)], 3, Math.random) };
            } else if (ev === 'merchant') {
              x.event = { kind: 'merchant', stock: relicOffer(unofferable(x), T.events.merchantStock, Math.random).map((id) => ({ id, price: relicPrice(id, x.relics) })) };
            } else if (ev === 'altar') {
              x.event = { kind: 'altar', ids: relicOffer(unofferable(x), 3, Math.random, T.relics.rarity, 'rare') };
            } else if (ev === 'library' && lib) {
              x.event = { kind: 'library', fen: lib.fen, answer: lib.answer, themes: lib.themes, choices: sample([lib.answer[0], ...sample(lib.others, 2, Math.random)], 3, Math.random) };
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
          const max = T.rooms.vault.maxMoves[v.goal] - (node.elite ? T.elite.vaultMovesLess : 0);
          extra = { vault: { goal: v.goal, maxMoves: max, title: v.title }, opp: 'engine' };
        } else {
          const pool = POOLS[node.kind as 'convert' | 'hold' | 'boss'];
          [fen, ev] = pool[(node.pos ?? 0) % pool.length];
        }
        const boss = node.kind === 'boss' ? opponentById(r.bossId) : undefined;
        const rm: RoomState = {
          layer: r.layer, node, me: new Chess(fen).turn(), startFen: fen, fen, plies: [], moves: [], fires: [], startEval: ev,
          elo: boss ? boss.elo + (r.cursed ? T.curse.ratingBoost : 0) : roomElo(r, node.elite), oppId: boss?.id, opp: 'maia', status: 'playing', ...extra,
        };
        patch((x) => {
          x.room = rm;
          x.phase = 'room';
        });
        set({ cur: null, aids: { ...NO_AIDS }, answer: null });
        void prepare(t);
      } finally {
        if (t === token) set({ busy: false });
      }
    },

    userMove(uci) {
      const s = get();
      const rm = s.run?.room;
      if (!rm || rm.status !== 'playing' || s.busy || s.aids.verdict) return false;
      if (rm.puzzle?.lost) return false;
      const c = new Chess(rm.fen);
      if (c.turn() !== rm.me || !tryMove(rm.fen, uci)) return false;
      const t = token;
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
        patch((r) => void r.consumables.splice(r.consumables.indexOf(id), 1));
        fire({ kind: 'consumable', item: id });
        sfx('card');
      };
      if (id === 'lens') {
        consume();
        set({ aids: { ...get().aids, lens: true } });
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
          const close = new Set([...accept, ...a.lines.filter((l) => Math.abs(l.score.value - a.lines[0].score.value) < 60).map((l) => l.pv[0])]);
          const others = new Chess(rm.fen).moves({ verbose: true }).map((m) => m.lan).filter((u) => u !== best && !close.has(u));
          set({ aids: { ...get().aids, cards: sample([best, ...sample(others, 2, Math.random)], 3, Math.random) } });
        }
      } catch {
        /* cancelled */
      } finally {
        if (t === token) set({ busy: false });
      }
    },

    rewind() {
      const s = get();
      const r = s.run;
      const rm = r?.room;
      if (!r || !rm || !r.consumables.includes('rewind') || s.busy) return;
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
        x.consumables.splice(x.consumables.indexOf('rewind'), 1);
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
        }
      });
      fire({ kind: 'consumable', item: 'rewind' });
      sfx('card');
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
        const fail = R.status === 'failed' && R.node.kind !== 'boss' && !broke ? Math.min(failCost, Math.max(0, roomCap(R) - roomLoss(R))) : 0;
        const calm = R.fires.reduce((s, f) => s + (f.composure ?? 0), 0);
        r.composure = Math.max(0, Math.min(maxComposure(r), r.composure - fail + (broke ? 0 : calm)));
        r.gold += sc.gold;
        r.results.push({
          layer: R.layer, kind: R.node.kind as RoomKind, modifier: R.node.modifier, elite: R.node.elite, gamble: R.gamble, won: R.status === 'won',
          chips: sc.chips, target: sc.target, mult: sc.mult, score: sc.score, gold: sc.gold, fires: R.fires,
          composureLost: R.moves.reduce((s, m) => s + m.composureLost, 0) + fail, reason: R.reason ?? '',
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
        earn(r, ids);
        if (r.composure <= 0) {
          sfx('over');
          buzz([80, 60, 160]);
          return finishRun(r, false);
        }
        r.phase = 'tally';
      });
      set({ cur: null, aids: { ...NO_AIDS }, answer: null, busy: false });
    },

    afterTally() {
      patch((r) => {
        const res = r.results[r.results.length - 1];
        if (res.kind === 'boss') return finishRun(r, res.won);
        const reward = !res.won || res.gamble ? null : res.elite ? 'elite' : T.rewardAfterLayer[r.layer];
        r.room = null;
        r.event = null;
        r.layer++;
        if (reward === 'relic' || reward === 'elite') {
          const ids = relicOffer(unofferable(r), 3, Math.random, reward === 'elite' ? T.relics.eliteRarity : T.relics.rarity);
          if (ids.length) {
            r.offer = { type: 'relic', ids, free: true, title: reward === 'elite' ? 'Elite spoils: choose a relic' : 'Spoils: choose a relic' };
            r.phase = 'reward';
            return;
          }
        }
        if (reward === 'consumable') {
          r.offer = { type: 'consumable', ids: consumableOffer(3, Math.random, r.meta?.lockedCards), free: true, title: 'Spoils: choose a card' };
          r.phase = 'reward';
          return;
        }
        nextAfterReward(r);
      });
    },

    pickReward(id) {
      patch((r) => {
        if (id && r.offer?.type === 'relic') addRelic(r, id as RelicId);
        if (id && r.offer?.type === 'consumable' && r.consumables.length < cardSlots(r)) r.consumables.push(id as ConsumableId);
        r.offer = null;
        nextAfterReward(r);
      });
      if (id) sfx('card');
    },

    decideCurse(take) {
      patch((r) => {
        r.curseDecided = true;
        r.cursed = take;
        if (take) r.gold = Math.round(r.gold * T.curse.goldFactor);
        openCamp(r);
      });
      if (take) sfx('coin');
    },

    buy(id) {
      const r = run();
      const p = shopPrice(r, id);
      if (r.gold < p || r.consumables.length >= cardSlots(r) || !r.shopStock.includes(id)) return;
      patch((x) => {
        x.gold -= p;
        x.consumables.push(id);
        x.shopStock.splice(x.shopStock.indexOf(id), 1);
      });
      sfx('coin');
      buzz(15);
    },

    rest() {
      const r = run();
      const p = restCost(r);
      if (r.gold < p || r.restBought || r.composure >= maxComposure(r)) return;
      patch((x) => {
        x.gold -= p;
        x.composure = Math.min(maxComposure(x), x.composure + T.shop.restComposure);
        x.restBought = true;
      });
      sfx('coin');
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
      set({ cur: null, aids: { ...NO_AIDS }, answer: null, busy: false });
      sfx('over');
    },

    leaveCamp() {
      patch((r) => {
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
        x.gold -= item.price;
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
        x.gold -= T.events.springPrice;
        x.composure = Math.min(maxComposure(x), x.composure + 1);
        (x.event as { used?: boolean }).used = true;
      });
      sfx('clear');
    },

    leaveEvent() {
      const ev = run().event;
      patch((x) => {
        if (ev?.kind === 'library' && ev.picked && ev.answer.includes(ev.picked)) {
          x.event = null;
          x.layer++;
          x.offer = { type: 'consumable', ids: consumableOffer(3, Math.random, x.meta?.lockedCards), free: true, title: 'The Library: choose a card' };
          x.phase = 'reward';
          return;
        }
        if (ev?.kind === 'shrine' && ev.picked && ev.answer.includes(ev.picked)) {
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
    },
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
  if (room.node.kind !== 'duel' || !room.book || room.moves.length >= T.rooms.duel.hintMoves) return null;
  const seq = [...room.book, ...room.plies.map((p) => p.san)];
  const line = ECO.map((e) => e.moves.split(' ')).find((m) => m.length > seq.length && seq.every((x, i) => m[i] === x));
  if (!line) return null;
  const res = tryMove(room.fen, line[seq.length]);
  return res ? res.move.lan : null;
}
