// A cup game: a real game under Match conditions (no take-backs, hints, coach or warnings)
// against a character playing Maia at the cup's band rating. Boons and charms are the only help
// (stages 3–4 plug in through mods.ts). The game is saved after every move and resumes after a
// restart; like Match conditions, the clock keeps running while the app is closed.
import { Chess } from 'chess.js';
import { create } from 'zustand';
import { kvGet, kvSet } from '../lib/db';
import { chooseBotMove, botParams } from '../lib/bot';
import { chooseHumanMove, humanParams, maiaLogits, shiftedTemperature } from '../lib/maia';
import { moveAccuracy, povScore, scoreToCp, winPct, type Score } from '../lib/chess/evaluation';
import { gameOverInfo, START_FEN, tryMove, type GameResult, type MoveInput } from '../lib/chess/game';
import type { Color } from '../lib/chess/pos';
import { explainMove } from '../lib/coach';
import { CancelledError, getEngine, type AnalysisResult } from '../lib/engine';
import { analysisLimits } from '../lib/engine/speed';
import { bookMove } from '../lib/people/openings';
import { flagResult, parseTc } from '../lib/clock';
import { botThinkMs, positionInfo, pressureParams, swingTracker, timePressure } from '../lib/thinktime';
import { evalHistory, shouldResign } from '../lib/resign';

const swingOf = swingTracker();
const evalsOf = evalHistory();
import { specialMove, tacticsOfMove, type TacticCounts } from '../lib/rewards/career';
import { finishGame } from '../lib/store/finish';
import { db } from '../lib/db';
import type { PlyRecord, SavedGame } from '../lib/store/types';
import { detectOpening } from '../lib/openings';
import { botMods, quirkCtx, quirkOpening, activeQuirks } from './mods';
import { addCupReviews } from './bridge';
import { quirkById } from './quirks';
import { material } from './material';
import { preMoveCheck } from '../lib/coach/precheck';
import { TUNING } from './tuning';
import { at, lv } from './boons';
import { useCelebrate } from '../lib/celebrate';
import { moveSound, sfx } from './sfx';

export type GamePhase = 'intro' | 'userTurn' | 'analyzing' | 'botThinking' | 'over';

/** Something a boon, charm or quirk did during the game (for the boon rail and the chronicle). */
export interface CupEvent {
  ply: number;
  kind: 'boon' | 'charm' | 'quirk';
  id: string;
  text: string;
}

export interface CupGameState {
  v: 1;
  cupId: string;
  tier: string;
  round: number;
  opponentId: string;
  /** The band rating the opponent plays at. */
  elo: number;
  userColor: Color;
  startFen: string;
  /** Moves played before the game proper (Home Prep), shown but not part of `plies`. */
  prelude?: string[];
  startedAt: number;
  timeControl: string;
  plies: PlyRecord[];
  clock: { w: number; b: number; turnStart: number };
  /** Increment per side (ms) — boons can give you more than the opponent. */
  inc: { w: number; b: number };
  /** Seconds left on the mover's clock after each ply. */
  clocks: number[];
  /** Your next moves that cost no clock time (Opening Prep). */
  freeMoves: number;
  /** The clock runs once the intro is over. */
  started: boolean;
  events: CupEvent[];
  /** Rewind charms used (count as take-backs in your records). */
  rewinds: number;
  /** Your boons for this cup (they act during the game). */
  boons: string[];
  /** Boon and charm levels for this cup. */
  levels?: Record<string, number>;
  /** Threat Bell moves still guarded (Threat Bell III guards two). */
  bellLeft?: number;
  /** Rattled: opponent moves left with a looser temperature. */
  rattled: number;
  /** The ply of the capture that set off Rattled (a Rewind past it cancels it). */
  rattledPly?: number;
  /** Quirk state before your last move changed it (a Rewind past that move restores it). */
  qUndo?: { ply: number; qstate: Record<string, number> };
  secondWindUsed?: boolean;
  /** Threat Bell is armed for your next move. */
  armed?: 'threatBell';
  /** The opponent's visible quirk(s) and the finalist's hidden one. */
  quirks: string[];
  hidden?: string;
  /** Quirks you have seen act (a hidden quirk is revealed on its first act). */
  revealed: string[];
  /** Per-quirk counters (Tilter's moves left, one-time notices). */
  qstate: Record<string, number>;
  /** Ply each quirk last pulsed (so icons don't flash every move). */
  lastPulse: Record<string, number>;
  result?: { result: GameResult; reason: string };
  /** The end screen's data, once the game is recorded. */
  over?: GameOver;
}

/** What the screen shows after the game. */
export interface GameOver {
  result: GameResult;
  reason: string;
  userResult: 'win' | 'loss' | 'draw';
  gameId?: number;
  accuracy: number;
  moves: number;
  opening?: string;
  clockLeft: number;
  /** Your great and brilliant moves. */
  greats: number;
  /** The ply of your biggest mistake, if any. */
  biggestPly: number | null;
  /** The biggest mistake went into your reviews. */
  reviewAdded?: boolean;
  /** The moment that decided the game (for the chronicle). */
  decisive?: Decisive;
}

/** The turning point of a game: a slip by them, a great move or a mistake by you. */
export interface Decisive {
  who: 'you' | 'them';
  san: string;
  moveNo: number;
  kind: 'blunder' | 'mistake' | 'brilliant' | 'great' | 'slip';
}

/** Find the decisive moment from the analysed moves (win% from your point of view). */
export function decisiveMoment(plies: PlyRecord[], userColor: Color, userResult: 'win' | 'loss' | 'draw'): Decisive | undefined {
  const wp = (p: PlyRecord) => (p.evalAfter ? winPct(povScore(p.evalAfter, userColor)) : null);
  const moveNo = (i: number) => Math.floor(i / 2) + 1;
  if (userResult === 'loss') {
    let worst = -1;
    plies.forEach((p, i) => {
      if (p.isUser && (p.wpLoss ?? 0) > (worst >= 0 ? plies[worst].wpLoss ?? 0 : 8)) worst = i;
    });
    if (worst >= 0) return { who: 'you', san: plies[worst].san, moveNo: moveNo(worst), kind: plies[worst].classification === 'blunder' ? 'blunder' : 'mistake' };
    return undefined;
  }
  // Their biggest slip: your winning chance jumps after their move.
  let best: { i: number; drop: number } | null = null;
  for (let i = 1; i < plies.length; i++) {
    const p = plies[i];
    if (p.isUser) continue;
    const before = wp(plies[i - 1]);
    const after = wp(p);
    if (before === null || after === null) continue;
    const drop = after - before;
    if (drop >= 15 && (!best || drop > best.drop)) best = { i, drop };
  }
  const special = plies.findIndex((p) => p.isUser && p.special);
  if (special >= 0 && (!best || plies[special].special === 'brilliant')) return { who: 'you', san: plies[special].san, moveNo: moveNo(special), kind: plies[special].special! };
  if (best) return { who: 'them', san: plies[best.i].san, moveNo: moveNo(best.i), kind: best.drop >= 30 ? 'blunder' : 'slip' };
  return undefined;
}

export interface StartParams {
  cupId: string;
  tier: string;
  round: number;
  opponentId: string;
  elo: number;
  userColor: Color;
  startFen?: string;
  prelude?: string[];
  timeControl: string;
  /** Extra starting time per side (ms). */
  extraMs?: { w?: number; b?: number };
  /** Extra increment per side (ms). */
  extraInc?: { w?: number; b?: number };
  freeMoves?: number;
  boons?: string[];
  levels?: Record<string, number>;
  quirks?: string[];
  hidden?: string;
  /** Scout Report: the hidden quirk is known before the game. */
  scouted?: boolean;
}

const KEY = 'cupGame';
const OWNER = 'cups';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const fenOf = (g: CupGameState) => (g.plies.length ? g.plies[g.plies.length - 1].fenAfter : g.startFen);
export const turnOf = (fen: string) => fen.split(' ')[1] as Color;
export const otherColor = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** Time left for `side` now. */
export function clockLeft(g: CupGameState, side: Color, now = Date.now()): number {
  if (!g.started || g.result) return Math.max(0, g.clock[side]);
  const toMove = turnOf(fenOf(g));
  return Math.max(0, g.clock[side] - (side === toMove ? now - g.clock.turnStart : 0));
}

/** After `mover` moves at `now`: charge the time (unless it's a free move) and add the increment. */
export function pressCupClock(g: Pick<CupGameState, 'clock' | 'inc' | 'freeMoves' | 'userColor'>, mover: Color, now: number): { clock: CupGameState['clock']; freeMoves: number } {
  const free = mover === g.userColor && g.freeMoves > 0;
  const left = free ? g.clock[mover] : Math.max(0, g.clock[mover] - (now - g.clock.turnStart));
  return { clock: { ...g.clock, [mover]: left + g.inc[mover], turnStart: now }, freeMoves: free ? g.freeMoves - 1 : g.freeMoves };
}

/** A new game's state. */
export function newCupGame(p: StartParams, now = Date.now()): CupGameState {
  const { base, inc } = parseTc(p.timeControl);
  return {
    v: 1,
    cupId: p.cupId,
    tier: p.tier,
    round: p.round,
    opponentId: p.opponentId,
    elo: p.elo,
    userColor: p.userColor,
    startFen: p.startFen ?? START_FEN,
    prelude: p.prelude,
    startedAt: now,
    timeControl: p.timeControl,
    plies: [],
    clock: { w: base + (p.extraMs?.w ?? 0), b: base + (p.extraMs?.b ?? 0), turnStart: now },
    inc: { w: inc + (p.extraInc?.w ?? 0), b: inc + (p.extraInc?.b ?? 0) },
    clocks: [],
    freeMoves: p.freeMoves ?? 0,
    started: false,
    events: [],
    rewinds: 0,
    boons: p.boons ?? [],
    levels: p.levels ?? {},
    rattled: 0,
    quirks: p.quirks ?? [],
    hidden: p.hidden,
    revealed: p.scouted && p.hidden ? [p.hidden] : [],
    qstate: {},
    lastPulse: {},
  };
}

/** The game as the app's SavedGame (for the history, ratings and rivalries). */
export function toSavedGame(g: CupGameState): SavedGame {
  return {
    id: 'play',
    userColor: g.userColor,
    elo: g.elo,
    opponentId: g.opponentId,
    startFen: g.startFen,
    startedAt: g.startedAt,
    plies: g.plies,
    takebacks: g.rewinds,
    hintsUsed: 0,
    told: [],
    match: true,
    timeControl: g.timeControl,
    clock: g.clock,
    clocks: g.clocks,
    cup: { id: g.cupId, tier: g.tier, round: g.round },
  };
}

function terminalScore(fen: string): Score {
  const info = gameOverInfo(fen);
  if (info?.reason === 'checkmate') return { type: 'mate', value: info.result === '1-0' ? 1 : -1 } as Score;
  return { type: 'cp', value: 0 };
}

/** Your material lead in a position (pawn = 1). */
function balance(fen: string, me: Color): number {
  const d = material(fen).diff;
  return me === 'w' ? d : -d;
}

async function analyze(fen: string, multipv = 3, depth?: number): Promise<AnalysisResult> {
  const l = analysisLimits();
  return getEngine().analyze(fen, { depth: depth ?? l.depth, movetime: l.movetime, multipv, owner: OWNER });
}

interface Store {
  game: CupGameState | null;
  phase: GamePhase;
  over: GameOver | null;
  /** A boon/charm/quirk that just acted (the rail lights it up). */
  pulse: { id: string; kind: CupEvent['kind']; at: number } | null;
  loaded: boolean;
  load(): Promise<void>;
  start(p: StartParams): void;
  /** The intro is over: the clock starts, and the opponent moves if it is White. */
  begin(): void;
  userMove(m: MoveInput): boolean;
  resign(): Promise<void>;
  /** Forget the finished game (after the cup has taken its result). */
  clear(): void;
  /** Record a boon/charm/quirk event and light it up. */
  note(e: Omit<CupEvent, 'ply'>): void;
  /** Change the game (charms, boons) and save. */
  mutate(fn: (g: CupGameState) => void): void;
  /** Threat Bell's warning: the move it stopped and why. */
  warning: { text: string; sq: string } | null;
  /** Candidate Cards on show. */
  cands: { uci: string; san: string }[] | null;
  /** Charm: take back your last move (and the reply). */
  rewind(): boolean;
  /** Charm: arm Threat Bell for your next move. */
  armThreatBell(): void;
  /** Charm: three candidate moves (engine best + Maia's likely moves at `rating`). */
  showCandidates(rating: number): Promise<boolean>;
  dismissCands(): void;
}

let token = 0;
let ticker: ReturnType<typeof setInterval> | null = null;

export const useCupGame = create<Store>((set, get) => {
  const save = () => {
    const g = get().game;
    void kvSet(KEY, g ? structuredClone(g) : null);
  };
  const update = (fn: (g: CupGameState) => void) => {
    const g = get().game;
    if (!g) return;
    const copy: CupGameState = { ...g, plies: [...g.plies], clocks: [...g.clocks], events: [...g.events], clock: { ...g.clock } };
    fn(copy);
    set({ game: copy });
    save();
  };
  const press = (gg: CupGameState, mover: Color) => {
    const r = pressCupClock(gg, mover, Date.now());
    gg.clock = r.clock;
    gg.freeMoves = r.freeMoves;
    gg.clocks = [...gg.clocks.slice(0, gg.plies.length - 1), Math.round(gg.clock[mover] / 100) / 10];
  };

  const startTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => {
      const { game: g, phase } = get();
      if (!g || !g.started || g.result || phase === 'over' || phase === 'intro') return;
      const toMove = turnOf(fenOf(g));
      // Second Wind: once per game, below the threshold, more time.
      if (g.boons.includes('secondWind') && !g.secondWindUsed && clockLeft(g, g.userColor) > 0 && clockLeft(g, g.userColor) < TUNING.boons.secondWindBelowMs) {
        update((gg) => {
          gg.secondWindUsed = true;
          gg.clock = { ...gg.clock, [gg.userColor]: gg.clock[gg.userColor] + at(TUNING.boons.secondWindAddMs, lv(gg.levels, 'secondWind')) };
        });
        get().note({ kind: 'boon', id: 'secondWind', text: `Second Wind: +${at(TUNING.boons.secondWindAddMs, lv(g.levels, 'secondWind')) / 1000} s` });
        sfx('relic');
        return;
      }
      if (clockLeft(g, toMove) <= 0) {
        const f = flagResult(fenOf(g), toMove);
        void endGame(f.result, f.reason);
      }
    }, 200);
  };

  const checkOver = async (): Promise<boolean> => {
    const g = get().game!;
    const info = gameOverInfo(fenOf(g), [g.startFen, ...g.plies.map((p) => p.fenAfter)]);
    if (!info) return false;
    await endGame(info.result, info.reason);
    return true;
  };

  const endGame = async (result: GameResult, reason: string) => {
    const g = get().game;
    if (!g || g.result) return;
    token++;
    getEngine().cancelAll(OWNER);
    const final = { ...g, clock: { ...g.clock, [turnOf(fenOf(g))]: clockLeft(g, turnOf(fenOf(g))) }, result: { result, reason } };
    set({ game: final, phase: 'over' });
    save();
    const userResult = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (g.userColor === 'w') ? 'win' : 'loss';
    sfx(userResult === 'win' ? 'win' : userResult === 'loss' ? 'over' : 'clear');
    // Stored like any game (history, rating journey, rivalry) — without touching the Play tab.
    // The app's own toasts stay quiet: the cup shows its own results.
    useCelebrate.getState().setMuted(true);
    let gameId: number | undefined;
    let accuracy = 0;
    let biggestPly: number | null = null;
    let reviewAdded = false;
    try {
      const info = await finishGame(toSavedGame(final), result, reason, { cup: true });
      // Already recorded (the app closed right after the game): find it again.
      const rec = info ? await db.games.get(info.gameId) : await db.games.filter((r) => r.startedAt === g.startedAt).first();
      gameId = rec?.id;
      accuracy = rec?.summary.accuracy ?? 0;
      biggestPly = rec?.summary.biggestMistakePly ?? null;
      // The biggest mistake goes into your reviews (the one write into the main app).
      const big = biggestPly !== null ? g.plies[biggestPly] : undefined;
      if (big?.comment?.bestUci)
        reviewAdded = (await addCupReviews(`${g.cupId}-${g.round}-${g.startedAt}`, [{ fenBefore: big.fenBefore, playedUci: big.uci, playedSan: big.san, bestUci: big.comment.bestUci, themes: big.comment.themes, explanation: big.comment.text }])) > 0;
    } catch (e) {
      console.warn('cup game not recorded', e);
    }
    const over: GameOver = {
        result,
        reason,
        userResult,
        gameId,
        accuracy,
        moves: g.plies.filter((p) => p.isUser).length,
        opening: g.startFen === START_FEN ? detectOpening(g.plies.map((p) => p.san))?.name : undefined,
        clockLeft: Math.round(clockLeft(final, g.userColor) / 1000),
        greats: g.plies.filter((p) => p.isUser && p.special).length,
        biggestPly,
        reviewAdded,
        decisive: decisiveMoment(g.plies, g.userColor, userResult),
      };
    set({ over });
    update((gg) => void (gg.over = over));
  };

  /** Classify your move (for accuracy, gold and the review) while the opponent's clock runs. */
  const reviewUserMove = async (i: number) => {
    const my = token;
    set({ phase: 'analyzing' });
    try {
      const g = get().game!;
      const ply = g.plies[i];
      const before = await analyze(ply.fenBefore, 3);
      const gameOver = !!gameOverInfo(ply.fenAfter);
      const after = gameOver ? null : await analyze(ply.fenAfter, 3);
      if (my !== token) return;
      const comment = explainMove({ fenBefore: ply.fenBefore, uci: ply.uci, before, after, history: g.plies.slice(0, i).map((p) => p.uci), startFen: g.startFen, suppress: [] });
      const sound = comment.classification === 'best' || comment.classification === 'good';
      const tactics: TacticCounts = sound ? tacticsOfMove(ply.fenBefore, ply.uci) : {};
      const special = specialMove(ply.fenBefore, ply.uci, before, after, comment.classification === 'best', g.plies[i - 1]?.uci) ?? undefined;
      if (special) tactics[special] = 1;
      const bScore = before.lines[0]?.score;
      const aScore: Score | undefined = after?.lines[0]?.score ?? (gameOver ? terminalScore(ply.fenAfter) : undefined);
      const wpB = bScore ? winPct(povScore(bScore, ply.color)) : 50;
      const wpA = aScore ? winPct(povScore(aScore, ply.color)) : wpB;
      update((gg) => {
        if (gg.plies[i]?.uci !== ply.uci) return;
        // The position before your move is the one after their reply: keep its eval for the chronicle.
        if (i > 0 && !gg.plies[i - 1].isUser && bScore) gg.plies[i - 1] = { ...gg.plies[i - 1], evalAfter: bScore };
        gg.plies[i] = { ...ply, evalAfter: aScore, classification: comment.classification, accuracy: moveAccuracy(wpB, wpA), wpLoss: Math.max(0, wpB - wpA), comment, special, tactics: Object.keys(tactics).length ? tactics : undefined };
      });
      if (await checkOver()) return;
      await botMove();
    } catch (e) {
      if (!(e instanceof CancelledError)) console.error(e);
    }
  };

  const botMove = async () => {
    const my = token;
    const g = get().game!;
    const fen = fenOf(g);
    const turn = turnOf(fen);
    set({ phase: 'botThinking' });
    try {
      const baseCtx = quirkCtx(g, fen, { botLeftMs: clockLeft(g, turn) });
      // Openings: the quirks' plans first (gambits, traps, early queen), then the character's own book.
      const planned = baseCtx.fromStart ? quirkOpening(g, baseCtx, Math.random) : null;
      const sans = baseCtx.sans;
      const book = planned?.uci ?? (g.startFen === START_FEN ? bookMove(g.opponentId, sans) : null);
      let uci = book;
      let seen: { logits?: Map<string, number>; candidates?: Map<string, number> } = {};
      const pressure = timePressure(clockLeft(g, turn), g.timeControl);
      let mods = botMods(g, baseCtx);
      let ctx = baseCtx;
      if (!uci) {
        try {
          const fens = [g.startFen, ...g.plies.map((p) => p.fenAfter)];
          const [logits, a] = await Promise.all([maiaLogits(fens, g.elo), analyze(fen, 8, Math.max(analysisLimits().depth, botParams(g.elo).depth)).catch(() => null)]);
          const candidates = a ? new Map(a.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, turn))])) : undefined;
          // Now the opponent knows how it stands (Comeback Kid, Endgame Grinder need that).
          ctx = { ...baseCtx, botEval: candidates?.size ? Math.max(...candidates.values()) : undefined };
          mods = botMods(g, ctx);
          const weighted = new Map([...logits].map(([m, v]) => [m, v + Math.log(Math.max(1e-6, mods.reweight?.(m) ?? 1))]));
          // Quirks shift the temperature; short of time, the opponent also plays looser.
          const params = pressureParams({ ...humanParams(g.elo), temperature: shiftedTemperature(g.elo, mods.tempDelta) }, pressure);
          uci = chooseHumanMove(weighted, g.elo, candidates, Math.random, { params });
          seen = { logits, candidates };
        } catch (e) {
          console.warn('Maia failed, using Stockfish', e);
        }
        if (my !== token) return;
      }
      if (!uci) {
        const a = await analyze(fen, botParams(g.elo).multipv);
        if (my !== token) return;
        uci = chooseBotMove(fen, a, g.elo, Math.random);
      }
      const gc = get().game!;
      // A clearly lost opponent may resign (never in a final before move 20).
      const bestNow = seen.candidates?.size ? Math.max(...seen.candidates.values()) : undefined;
      if (!book && shouldResign({ elo: g.elo, moveNo: Math.floor(gc.plies.length / 2) + 1, evals: evalsOf(gc.startedAt, bestNow), cupFinal: g.round === 2 })) {
        await sleep(Math.min(1200 + 1500 * Math.random(), Math.max(0, clockLeft(gc, turn) - 50)));
        if (my !== token) return;
        await endGame(g.userColor === 'w' ? '1-0' : '0-1', 'resignation');
        return;
      }
      const info = uci ? positionInfo(seen.logits, seen.candidates, uci, gc.plies[gc.plies.length - 1]) : {};
      const target =
        botThinkMs({
          elo: g.elo,
          moveNo: Math.floor(gc.plies.length / 2) + 1,
          leftMs: clockLeft(gc, turn),
          tc: gc.timeControl,
          book: !!book,
          forced: new Chess(fen).moves().length === 1,
          ...info,
          swing: swingOf(gc.startedAt, info.best),
        }) * mods.thinkFactor;
      await sleep(Math.max(0, Math.min(target, clockLeft(gc, turn) - 50) - (Date.now() - gc.clock.turnStart)));
      if (my !== token || !uci) return;
      const r = tryMove(fen, uci);
      if (!r) return;
      update((gg) => {
        gg.plies.push({ uci, san: r.move.san, color: r.move.color as Color, fenBefore: fen, fenAfter: r.fen, isUser: false });
        press(gg, r.move.color as Color);
        if (gg.rattled > 0) gg.rattled--;
        if ((gg.qstate.tilt ?? 0) > 0) gg.qstate = { ...gg.qstate, tilt: gg.qstate.tilt - 1 };
      });
      sfx(moveSound(r.move.san), 0, true);
      noticeQuirks(ctx, r.move, !!planned && planned.uci === uci);
      if (await checkOver()) return;
      set({ phase: 'userTurn' });
    } catch (e) {
      if (!(e instanceof CancelledError)) console.error(e);
    }
  };

  /** Quirks that visibly acted with the opponent's move: the icon pulses, a hidden quirk is revealed. */
  const noticeQuirks = (ctx: ReturnType<typeof quirkCtx>, m: import('chess.js').Move, fromOpening: boolean) => {
    const g = get().game!;
    for (const id of activeQuirks(g)) {
      const q = quirkById(id);
      if (!q?.acted?.(ctx, m, fromOpening)) continue;
      reveal(id, q.act);
    }
  };

  /** A quirk acts: note it (first time per game), reveal it if hidden, pulse its icon (throttled). */
  const reveal = (id: string, text: string) => {
    const g = get().game!;
    const ply = g.plies.length;
    const first = !g.events.some((e) => e.kind === 'quirk' && e.id === id);
    const wasHidden = id === g.hidden && !g.revealed.includes(id);
    const last = g.lastPulse[id] ?? -99;
    if (!first && !wasHidden && ply - last < TUNING.quirks.pulseEvery) return;
    update((gg) => {
      gg.lastPulse = { ...gg.lastPulse, [id]: ply };
      if (!gg.revealed.includes(id)) gg.revealed = [...gg.revealed, id];
      if (id === 'timeTrouble' && ctxLow(gg)) gg.qstate = { ...gg.qstate, ttLow: 1 };
      if (id === 'comebackKid') gg.qstate = { ...gg.qstate, ckOn: 1 };
      if (first || wasHidden) gg.events = [...gg.events, { ply, kind: 'quirk', id, text: wasHidden ? `Hidden quirk revealed — ${text}` : text }];
    });
    set({ pulse: { id, kind: 'quirk', at: Date.now() } });
    if (wasHidden) sfx('slam');
  };
  const ctxLow = (gg: CupGameState) => clockLeft(gg, otherColor(gg.userColor)) < TUNING.quirks.timeTrouble.lowMs;

  return {
    game: null,
    phase: 'intro',
    over: null,
    pulse: null,
    loaded: false,

    async load() {
      if (get().loaded) return;
      const saved = await kvGet<CupGameState | null>(KEY, null);
      set({ loaded: true });
      if (!saved || saved.v !== 1) return;
      token++;
      set({ game: saved, over: null });
      if (saved.over) return set({ phase: 'over', over: saved.over });
      if (saved.result) {
        // Ended but not yet recorded (the app closed at that moment): record it now.
        set({ game: { ...saved, result: undefined } });
        await endGame(saved.result.result, saved.result.reason);
        return;
      }
      if (!saved.started) return set({ phase: 'intro' });
      startTicker();
      const last = saved.plies[saved.plies.length - 1];
      if (await checkOver()) return;
      if (last?.isUser && !last.classification) void reviewUserMove(saved.plies.length - 1);
      else if (turnOf(fenOf(saved)) !== saved.userColor) void botMove();
      else set({ phase: 'userTurn' });
    },

    start(p) {
      token++;
      getEngine().cancelAll(OWNER);
      set({ game: newCupGame(p), phase: 'intro', over: null, pulse: null });
      save();
    },

    begin() {
      const g = get().game;
      if (!g || g.started) return;
      update((gg) => {
        gg.started = true;
        gg.clock = { ...gg.clock, turnStart: Date.now() };
      });
      startTicker();
      if (turnOf(fenOf(get().game!)) !== g.userColor) void botMove();
      else set({ phase: 'userTurn' });
    },

    userMove(m) {
      const { game: g, phase } = get();
      if (!g || phase !== 'userTurn' || !g.started) return false;
      const fen = fenOf(g);
      if (turnOf(fen) !== g.userColor) return false;
      const r = tryMove(fen, m);
      if (!r) return false;
      // Threat Bell: this one move is checked; a hanging piece or mate-in-one rings the bell.
      if (g.armed === 'threatBell') {
        const bl = lv(g.levels, 'threatBell');
        const check = preMoveCheck(fen, r.move.lan, { minValue: at(TUNING.charms.threatBellMinValue, bl) });
        // Threat Bell III checks two moves; I and II check one.
        const left = (g.bellLeft ?? at(TUNING.charms.threatBellMoves, bl)) - 1;
        update((gg) => {
          gg.armed = left > 0 ? 'threatBell' : undefined;
          gg.bellLeft = left > 0 ? left : undefined;
        });
        if (check) {
          set({ warning: { text: check.reveal, sq: check.sq }, cands: null });
          get().note({ kind: 'charm', id: 'threatBell', text: `Threat Bell rang: ${check.reveal}` });
          sfx('fail');
          return false;
        }
        get().note({ kind: 'charm', id: 'threatBell', text: 'Threat Bell: the move was safe.' });
      }
      const free = g.freeMoves > 0;
      const before = g.plies.length >= 2 ? balance(g.plies[g.plies.length - 1].fenBefore, g.userColor) : balance(fen, g.userColor);
      update((gg) => {
        gg.plies.push({ uci: r.move.lan, san: r.move.san, color: r.move.color as Color, fenBefore: fen, fenAfter: r.fen, isUser: true });
        press(gg, r.move.color as Color);
      });
      set({ warning: null, cands: null });
      sfx(moveSound(r.move.san));
      // Boons that act on your move light up.
      const ng = get().game!;
      if (free) {
        if (ng.freeMoves === 0) get().note({ kind: 'boon', id: 'openingPrep', text: 'Opening Prep: your free moves are used up.' });
        else set({ pulse: { id: 'openingPrep', kind: 'boon', at: Date.now() } });
      } else if (g.boons.includes('steadyHand')) set({ pulse: { id: 'steadyHand', kind: 'boon', at: Date.now() } });
      // Quirks that react to your move (Tilter: it just lost material).
      const lost = balance(r.fen, g.userColor) - before;
      if (lost > 0)
        for (const id of activeQuirks(g)) {
          const q = quirkById(id);
          const change = q?.afterUserMove?.(quirkCtx(ng, r.fen, { botLeftMs: clockLeft(ng, otherColor(g.userColor)) }), lost);
          if (change) {
            update((gg) => {
              gg.qUndo = { ply: gg.plies.length - 1, qstate: gg.qstate };
              gg.qstate = { ...gg.qstate, ...change };
            });
            reveal(id, q!.act);
          }
        }
      // Rattled: you just came out ahead in material.
      if (g.boons.includes('rattled') && r.move.captured && balance(r.fen, g.userColor) > before) {
        update((gg) => {
          gg.rattled = at(TUNING.boons.rattledMoves, lv(gg.levels, 'rattled'));
          gg.rattledPly = gg.plies.length - 1;
        });
        get().note({ kind: 'boon', id: 'rattled', text: 'Rattled: they lost material and look shaken.' });
      }
      void reviewUserMove(get().game!.plies.length - 1);
      return true;
    },

    async resign() {
      const g = get().game;
      if (!g || g.result) return;
      await endGame(g.userColor === 'w' ? '0-1' : '1-0', 'resignation');
    },

    clear() {
      token++;
      getEngine().cancelAll(OWNER);
      if (ticker) clearInterval(ticker);
      ticker = null;
      set({ game: null, phase: 'intro', over: null, pulse: null, warning: null, cands: null });
      useCelebrate.getState().setMuted(false);
      void kvSet(KEY, null);
    },

    note(e) {
      const g = get().game;
      if (!g) return;
      update((gg) => void gg.events.push({ ...e, ply: gg.plies.length }));
      set({ pulse: { id: e.id, kind: e.kind, at: Date.now() } });
    },

    mutate(fn) {
      update(fn);
    },

    warning: null,
    cands: null,

    rewind() {
      const { game: g, phase } = get();
      if (!g || g.result || !['userTurn', 'botThinking', 'analyzing'].includes(phase)) return false;
      const lastUser = g.plies.map((p) => p.isUser).lastIndexOf(true);
      if (lastUser < 0) return false;
      token++;
      getEngine().cancelAll(OWNER);
      update((gg) => {
        gg.plies = gg.plies.slice(0, lastUser);
        gg.clocks = gg.clocks.slice(0, lastUser);
        gg.clock = { ...gg.clock, turnStart: Date.now() };
        gg.rewinds++;
        // A capture you took back no longer rattles them.
        if (gg.rattledPly !== undefined && gg.rattledPly >= lastUser) {
          gg.rattled = 0;
          gg.rattledPly = undefined;
        }
        if (gg.qUndo && gg.qUndo.ply >= lastUser) {
          gg.qstate = gg.qUndo.qstate;
          gg.qUndo = undefined;
        }
      });
      set({ phase: 'userTurn', warning: null, cands: null });
      get().note({ kind: 'charm', id: 'rewind', text: `Rewind: took back ${g.plies[lastUser].san}.` });
      sfx('whoosh');
      return true;
    },

    armThreatBell() {
      update((gg) => {
        gg.armed = 'threatBell';
        gg.bellLeft = at(TUNING.charms.threatBellMoves, lv(gg.levels, 'threatBell'));
      });
      set({ pulse: { id: 'threatBell', kind: 'charm', at: Date.now() } });
      sfx('card');
    },

    async showCandidates(rating) {
      const g = get().game;
      if (!g || get().phase !== 'userTurn') return false;
      const fen = fenOf(g);
      try {
        const [a, logits] = await Promise.all([analyze(fen, 1), maiaLogits([g.startFen, ...g.plies.map((p) => p.fenAfter)], rating)]);
        if (fenOf(get().game!) !== fen) return false;
        const best = a.lines[0]?.pv[0] ?? a.bestMove;
        if (!best) return false;
        const likely = [...logits].filter(([m]) => m !== best).sort((x, y) => y[1] - x[1]).slice(0, at(TUNING.charms.candidateCards, lv(g.levels, 'candidates')) - 1).map(([m]) => m);
        const cands = [best, ...likely].map((uci) => ({ uci, san: tryMove(fen, uci)?.move.san ?? uci })).sort(() => Math.random() - 0.5);
        set({ cands });
        get().note({ kind: 'charm', id: 'candidates', text: `Candidate Cards: ${cands.map((c) => c.san).join(', ')}.` });
        return true;
      } catch {
        return false;
      }
    },

    dismissCands() {
      set({ cands: null });
    },
  };
});
