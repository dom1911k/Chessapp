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
import { getOpponentRecords, isUnlocked, starsOf } from '../lib/people/record';
import { hangingPieces, other, parseFen, sqName } from '../lib/chess/pos';
import { safetyInfo } from '../lib/coach/safety';
import type { CoachArrow, CoachHighlight } from '../lib/coach/types';
import { TUNING as T } from './tuning';
import positions from './data/positions.json';
import { archiveRun, loadCurrent, saveCurrent } from './db';
import {
  ALL_RELICS, buildMap, composureCost, consumableOffer, endFires, judge, maxConsumables, moveFires, povCp, price, restPrice,
  roomScore, sample, sound,
} from './rules';
import { sfx, buzz } from './sfx';
import { ROOM_NAME } from './content';
import type { ConsumableId, MapNode, RelicId, RoomState, Run, UserMove } from './types';

type Pos = [string, number];
const POOLS = positions as unknown as Record<'convert' | 'hold' | 'boss', Pos[]>;

export type Verdict = { uci: string; label: 'safe' | 'risky' | 'blunder'; after: AnalysisResult; cls: Classification };

export interface Aids {
  eye: string | null;
  cards: string[] | null;
  lens: boolean;
  opinion: boolean;
  verdict: Verdict | null;
}
const NO_AIDS: Aids = { eye: null, cards: null, lens: false, opinion: false, verdict: null };

export type FxEvent =
  | { id: number; kind: 'relic'; relic: RelicId; label: string }
  | { id: number; kind: 'hit'; amount: number; insured?: boolean }
  | { id: number; kind: 'consumable'; item: ConsumableId };

interface RunStore {
  run: Run | null;
  loaded: boolean;
  /** Engine or opponent working. */
  busy: boolean;
  cur: { fen: string; a: AnalysisResult } | null;
  aids: Aids;
  fx: FxEvent[];
  /** Puzzle room: answer shown after a wrong move. */
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

export const useRun = create<RunStore>((set, get) => {
  const run = () => get().run!;
  const room = () => get().run!.room!;
  /** Immutable update of the run (and persist). */
  const patch = (f: (r: Run) => void) => {
    const r = clone(get().run!);
    f(r);
    set({ run: r });
    saveCurrent(r);
  };
  const fire = (e: Omit<Extract<FxEvent, { kind: 'relic' }>, 'id'> | Omit<Extract<FxEvent, { kind: 'hit' }>, 'id'> | Omit<Extract<FxEvent, { kind: 'consumable' }>, 'id'>) => {
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
    const me = other(new Chess(spec.fen).turn());
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
    await sleep(T.timing.puzzleSetupDelay);
    if (t !== token) return;
    playOpp(spec.setup!);
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

  /** Maia replies (game rooms). */
  const oppTurn = async (t: number) => {
    set({ busy: true });
    try {
      const rm = room();
      const fens = [rm.startFen, ...rm.plies.map((p) => p.fen)];
      const style = opponentById(rm.oppId)?.style;
      let uci: string | null = null;
      try {
        const [logits] = await Promise.all([maiaLogits(fens, rm.elo), sleep(T.timing.oppMoveMinDelay)]);
        uci = sampleMove(logits, maiaTemperature(rm.elo, style));
      } catch {
        uci = (await analyze(rm.fen, 1)).bestMove;
      }
      if (t !== token) return;
      if (!uci) {
        const moves = new Chess(rm.fen).moves({ verbose: true });
        uci = moves.length ? moves[Math.floor(Math.random() * moves.length)].lan : null;
      }
      if (uci) playOpp(uci);
      const verdict = judge(room(), 'reply');
      if (verdict) return decide(verdict.status, verdict.reason);
      void prepare(t);
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
    const lost = insured ? 0 : cost;
    m.composureLost = lost;
    m.insured = insured || undefined;
    const rm = room();
    const fires = moveFires(run().relics, rm, m, rm.moves.length);
    patch((r) => {
      const R = r.room!;
      if (insured) r.consumables.splice(r.consumables.indexOf('insurance'), 1);
      r.composure = Math.max(0, r.composure - lost);
      if (m.eye) (r.eyeMoves ??= []).push(`${ROOM_NAME[R.node.kind]}: ${m.san}`);
      if (cost > 0) r.moments.push({ layer: R.layer, kind: R.node.kind, move: clone(m), cost });
      if (!(cost > 0)) {
        delete m.before;
        delete m.after;
      }
      R.moves.push(m);
      R.fires.push(...fires);
    });
    if (lost > 0) {
      fire({ kind: 'hit', amount: lost });
      sfx('hit');
      buzz([40, 30, 80]);
    } else if (insured) {
      fire({ kind: 'hit', amount: 0, insured: true });
      fire({ kind: 'consumable', item: 'insurance' });
      sfx('card');
    }
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
      record(m, composureCost(cls, rm.node));
      if (room().status !== 'playing') return;
      const v = judge(room(), 'mine');
      if (v) return decide(v.status, v.reason);
      await oppTurn(t);
    } catch {
      /* cancelled */
    } finally {
      if (t === token) set({ busy: false });
    }
  };

  const puzzleMove = async (uci: string, t: number, pre?: Verdict) => {
    const rm = room();
    const p = rm.puzzle!;
    const spec = p.list[p.index];
    const expected = spec.solution[p.step];
    const res = tryMove(rm.fen, uci)!;
    const correct = uci === expected || res.move.san.endsWith('#');
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
      if (room().puzzle!.solved >= T.rooms.puzzle.needSolved) return decide('won', `Solved ${room().puzzle!.solved} puzzles.`);
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
      record(m, composureCost(cls, rm.node));
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
    const remaining = T.rooms.puzzle.count - (p.solved + p.failed);
    if (p.solved + remaining < T.rooms.puzzle.needSolved || remaining <= 0)
      return decide(p.solved >= T.rooms.puzzle.needSolved ? 'won' : 'failed', `Solved ${p.solved} of ${p.solved + p.failed}.`);
    patch((r) => void r.room!.puzzle!.index++);
    void showPuzzle(t);
  };

  const pickPuzzles = async (r: Run, n: number) => {
    const w = T.rooms.puzzle.ratingWindow;
    let pool = await loadRange(r.rating - w, r.rating + w);
    if (pool.length < 20) pool = await loadRange(r.rating - 3 * w, r.rating + 3 * w);
    pool = pool.filter((p) => !r.usedPuzzles.includes(p.id) && p.moves.length >= 2);
    return sample(pool, n, Math.random).map(fromLichess);
  };

  const roomElo = (r: Run) => Math.max(T.roomElo.min, Math.min(T.roomElo.max, r.rating + T.roomElo.offset));

  const resumeRoom = (t: number) => {
    const rm = room();
    if (rm.status !== 'playing') return;
    if (rm.node.kind === 'puzzle') {
      const p = rm.puzzle!;
      if (p.lost) return;
      if (!rm.plies.length) return void showPuzzle(t);
      if (new Chess(rm.fen).turn() !== rm.me) {
        playOpp(p.list[p.index].solution[p.step - 1]);
      }
      return void prepare(t);
    }
    if (new Chess(rm.fen).turn() !== rm.me) return void oppTurn(t);
    void prepare(t);
  };

  const openCamp = (r: Run) => {
    r.phase = 'camp';
    r.shopStock = consumableOffer(T.shop.offers, Math.random);
    r.restBought = false;
  };

  const finishRun = (r: Run, won: boolean) => {
    r.ended = won ? 'won' : 'lost';
    r.endedAt = Date.now();
    r.phase = 'debrief';
    r.finalScore = r.results.reduce((s, x) => s + x.score, 0) + (won ? r.composure * T.score.composureLeftChips : 0);
    r.room = null;
    void archiveRun(clone(r));
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
      const [{ rating }, records] = await Promise.all([getRating(), getOpponentRecords()]);
      const unlocked = OPPONENTS.filter((o) => isUnlocked(o.id, records));
      const boss = unlocked.find((o) => starsOf(records[o.id]) === 0) ?? unlocked[unlocked.length - 1] ?? OPPONENTS[0];
      const r: Run = {
        version: 1,
        id: Math.random().toString(36).slice(2, 10),
        startedAt: Date.now(),
        rating: Math.round(rating),
        bossId: boss.id,
        phase: 'start',
        layers: buildMap(Math.random, { convert: POOLS.convert.length, hold: POOLS.hold.length, boss: POOLS.boss.length }),
        path: [],
        layer: 0,
        composure: T.composure.start,
        gold: T.gold.start,
        relics: [],
        consumables: [],
        room: null,
        results: [],
        moments: [],
        offer: { type: 'relic', ids: sample(ALL_RELICS, 3, Math.random), free: true, title: 'Choose your first relic' },
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
        r.relics.push(id);
        r.offer = null;
        r.phase = 'map';
      });
      sfx('card');
    },

    chooseNode(i) {
      patch((r) => {
        r.path[r.layer] = i;
        r.phase = 'intro';
      });
    },

    async enterRoom() {
      const t = ++token;
      const r = run();
      const node: MapNode = r.layers[r.layer][r.path[r.layer] ?? 0];
      let rm: RoomState;
      if (node.kind === 'puzzle') {
        set({ busy: true });
        const list = await pickPuzzles(r, T.rooms.puzzle.count);
        if (t !== token) return;
        rm = {
          layer: r.layer, node, me: 'w', startFen: list[0].fen, fen: list[0].fen, plies: [], moves: [], fires: [], startEval: 0,
          elo: roomElo(r), status: 'playing', puzzle: { list, index: 0, step: 0, solved: 0, failed: 0, lost: false },
        };
        patch((x) => {
          x.room = rm;
          x.phase = 'room';
          x.usedPuzzles.push(...list.map((p) => p.id));
        });
        set({ busy: false, cur: null, aids: { ...NO_AIDS }, answer: null });
        void showPuzzle(t);
        return;
      }
      const pool = POOLS[node.kind as 'convert' | 'hold' | 'boss'];
      const [fen, ev] = pool[(node.pos ?? 0) % pool.length];
      const boss = node.kind === 'boss' ? opponentById(r.bossId) : undefined;
      rm = {
        layer: r.layer, node, me: new Chess(fen).turn(), startFen: fen, fen, plies: [], moves: [], fires: [], startEval: ev,
        elo: boss ? boss.elo + (r.cursed ? T.curse.ratingBoost : 0) : roomElo(r), oppId: boss?.id, status: 'playing',
      };
      patch((x) => {
        x.room = rm;
        x.phase = 'room';
      });
      set({ cur: null, aids: { ...NO_AIDS }, answer: null, busy: false });
      void prepare(t);
    },

    userMove(uci) {
      const s = get();
      const rm = s.run?.room;
      if (!rm || rm.status !== 'playing' || s.busy || s.aids.verdict) return false;
      if (rm.puzzle?.lost) return false;
      const c = new Chess(rm.fen);
      if (c.turn() !== rm.me || !tryMove(rm.fen, uci)) return false;
      const t = token;
      if (s.aids.opinion) {
        // Second Opinion: judge first, commit only after confirmation.
        set({ busy: true });
        void (async () => {
          try {
            const before = await currentAnalysis(t);
            const fenAfter = tryMove(rm.fen, uci)!.fen;
            const after = new Chess(fenAfter).isGameOver() ? null : await analyze(fenAfter, 1);
            if (t !== token || !before) return;
            const isSolution = rm.puzzle ? uci === rm.puzzle.list[rm.puzzle.index].solution[rm.puzzle.step] : uci === before.bestMove;
            const cls = classify(wpOf(rm.fen, before, rm.me).wp, wpOf(fenAfter, after, rm.me).wp, isSolution);
            const label = cls === 'blunder' ? 'blunder' : cls === 'mistake' || cls === 'inaccuracy' ? 'risky' : 'safe';
            set({ aids: { ...get().aids, opinion: false, verdict: { uci, label, after: after!, cls } } });
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
          const close = new Set(a.lines.filter((l) => Math.abs(l.score.value - a.lines[0].score.value) < 60).map((l) => l.pv[0]));
          const others = new Chess(rm.fen).moves({ verbose: true }).map((m) => m.lan).filter((u) => u !== best && !close.has(u));
          set({ aids: { ...get().aids, cards: sample([best, ...sample(others, 2, Math.random)], 3, Math.random) } });
        }
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
        x.composure = Math.min(T.composure.max, x.composure + last.composureLost);
        if (last.insured && x.consumables.length < maxConsumables(x.relics)) x.consumables.push('insurance');
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
      patch((r) => {
        const R = r.room!;
        R.fires.push(...endFires(r, R));
        const sc = roomScore(R, r);
        const fail = R.status === 'failed' && R.node.kind !== 'boss' && !broke ? T.composure.failRoom : 0;
        const calm = R.fires.reduce((s, f) => s + (f.composure ?? 0), 0);
        r.composure = Math.max(0, Math.min(T.composure.max, r.composure - fail + (broke ? 0 : calm)));
        r.gold += sc.gold;
        r.results.push({
          layer: R.layer, kind: R.node.kind, modifier: R.node.modifier, won: R.status === 'won', chips: sc.chips, mult: sc.mult, score: sc.score,
          gold: sc.gold, fires: R.fires, composureLost: R.moves.reduce((s, m) => s + m.composureLost, 0) + fail, reason: R.reason ?? '',
        });
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
        const reward = res.won ? T.rewardAfterLayer[r.layer] : null;
        r.room = null;
        r.layer++;
        if (reward === 'relic') {
          const ids = sample(ALL_RELICS.filter((x) => !r.relics.includes(x)), 3, Math.random);
          if (ids.length) {
            r.offer = { type: 'relic', ids, free: true, title: 'Spoils: choose a relic' };
            r.phase = 'reward';
            return;
          }
        }
        if (reward === 'consumable') {
          r.offer = { type: 'consumable', ids: consumableOffer(3, Math.random), free: true, title: 'Spoils: choose a card' };
          r.phase = 'reward';
          return;
        }
        nextAfterReward(r);
      });
    },

    pickReward(id) {
      patch((r) => {
        if (id && r.offer?.type === 'relic') r.relics.push(id as RelicId);
        if (id && r.offer?.type === 'consumable' && r.consumables.length < maxConsumables(r.relics)) r.consumables.push(id as ConsumableId);
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
      const p = price(id, r.relics);
      if (r.gold < p || r.consumables.length >= maxConsumables(r.relics) || !r.shopStock.includes(id)) return;
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
      const p = restPrice(r.relics);
      if (r.gold < p || r.restBought || r.composure >= T.composure.max) return;
      patch((x) => {
        x.gold -= p;
        x.composure = Math.min(T.composure.max, x.composure + T.shop.restComposure);
        x.restBought = true;
      });
      sfx('coin');
    },

    leaveCamp() {
      patch((r) => {
        r.phase = 'map';
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
      relic: (id) => patch((r) => void (!r.relics.includes(id) && r.relics.push(id))),
      consumable: (id) => patch((r) => void r.consumables.push(id)),
      composure: (n) => patch((r) => void (r.composure = Math.max(0, Math.min(T.composure.max, n)))),
    },
  };

  function nextAfterReward(r: Run) {
    const bossNext = r.layer === r.layers.length - 1;
    if (bossNext && !r.curseDecided) {
      r.phase = 'curse';
      return;
    }
    openCamp(r);
  }
});

// Lens: hanging/attacked pieces for both sides.
export function lensMarks(fen: string, me: 'w' | 'b'): CoachHighlight[] {
  const mine = safetyInfo(fen, me).highlights;
  const board = parseFen(fen).board;
  const theirs = hangingPieces(board, other(me)).map((h) => ({ sq: sqName(h.sq), tone: 'good' as const }));
  return [...mine, ...theirs];
}

export const arrowOf = (uci: string, tone: CoachArrow['tone']): CoachArrow => ({ ...parseUci(uci), tone });

// Dev hook for automated playtests.
if (import.meta.env.DEV) (window as unknown as { __run: typeof useRun }).__run = useRun;
