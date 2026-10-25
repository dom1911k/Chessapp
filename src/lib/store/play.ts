// Play-vs-bot state machine with live coaching.
import { create } from 'zustand';
import { chooseBotMove, botParams } from '../bot';
import { moveAccuracy, winPct, povScore, type Score } from '../chess/evaluation';
import { gameOverInfo, START_FEN, tryMove, type GameResult, type MoveInput } from '../chess/game';
import { other, type Color } from '../chess/pos';
import { explainMove, explainTakeback, getHint, type CoachComment } from '../coach';
import type { Hint } from '../coach/hints';
import { db } from '../db';
import { CancelledError, getEngine, type AnalysisResult } from '../engine';
import { useSettings } from '../settings';
import { finishGame } from './finish';
import type { SavedGame } from './types';

export type Phase = 'loading' | 'setup' | 'userTurn' | 'analyzing' | 'botThinking' | 'paused' | 'over';

export const ANALYSIS_DEPTH = 12;
const ANALYSIS_TIME = 3000;

interface PlayStore {
  game: SavedGame | null;
  phase: Phase;
  /** Comment shown in the coach panel (for the latest user move). */
  comment: { comment: CoachComment; ply: number } | null;
  /** Short coach message (take-backs, try again…). */
  message: string | null;
  hint: Hint | null;
  over: { result: GameResult; reason: string; gameId: number } | null;
  load(): Promise<void>;
  newGame(color: Color, elo: number): void;
  userMove(m: MoveInput): boolean;
  continueGame(): void;
  tryAgain(): void;
  takeback(): void;
  requestHint(): Promise<void>;
  resign(): Promise<void>;
  /** Start over: very short games are discarded, longer ones count as resigned. */
  abandon(): Promise<void>;
  leaveGame(): void;
}

let token = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function currentFen(g: SavedGame | null): string {
  return g?.plies.length ? g.plies[g.plies.length - 1].fenAfter : (g?.startFen ?? START_FEN);
}

export function turnOf(fen: string): Color {
  return fen.split(' ')[1] as Color;
}

async function analyze(fen: string, multipv = 3, depth = ANALYSIS_DEPTH): Promise<AnalysisResult> {
  return getEngine().analyze(fen, { depth, movetime: ANALYSIS_TIME, multipv });
}

function save(g: SavedGame) {
  void db.current.put(structuredClone(g));
}

export const usePlay = create<PlayStore>((set, get) => {
  const update = (fn: (g: SavedGame) => void) => {
    const g = get().game;
    if (!g) return;
    const copy: SavedGame = { ...g, plies: [...g.plies], told: [...g.told] };
    fn(copy);
    set({ game: copy });
    save(copy);
  };

  const checkOver = async (g: SavedGame): Promise<boolean> => {
    const fens = [g.startFen, ...g.plies.map((p) => p.fenAfter)];
    const info = gameOverInfo(currentFen(g), fens);
    if (!info) return false;
    await endGame(info.result, info.reason);
    return true;
  };

  const endGame = async (result: GameResult, reason: string) => {
    const g = get().game;
    if (!g) return;
    token++;
    getEngine().cancelAll();
    set({ phase: 'over', hint: null });
    const gameId = await finishGame(g, result, reason);
    set({ over: { result, reason, gameId } });
  };

  /** After the user's move at index `i`: analyse, classify, coach, then let the bot reply. */
  const reviewUserMove = async (i: number) => {
    const my = token;
    const g = get().game!;
    const ply = g.plies[i];
    set({ phase: 'analyzing' });
    try {
      const params = botParams(g.elo);
      const depth = Math.max(ANALYSIS_DEPTH, params.depth);
      const before = await analyze(ply.fenBefore, 3);
      const gameOver = !!gameOverInfo(ply.fenAfter);
      const after = gameOver ? null : await analyze(ply.fenAfter, params.multipv, depth);
      if (my !== token) return;
      const history = g.plies.slice(0, i).map((p) => p.uci);
      const comment = explainMove({
        fenBefore: ply.fenBefore,
        uci: ply.uci,
        before,
        after,
        history,
        startFen: g.startFen,
        suppress: g.told,
      });
      const bScore = before.lines[0]?.score;
      const aScore: Score | undefined = after?.lines[0]?.score ?? (gameOver ? terminalScore(ply.fenAfter) : undefined);
      const wpB = bScore ? winPct(povScore(bScore, ply.color)) : 50;
      const wpA = aScore ? winPct(povScore(aScore, ply.color)) : wpB;
      update((gg) => {
        gg.plies[i] = {
          ...ply,
          evalAfter: aScore,
          classification: comment.classification,
          accuracy: moveAccuracy(wpB, wpA),
          wpLoss: Math.max(0, wpB - wpA),
          comment,
        };
        gg.told = [...new Set([...gg.told, ...comment.ruleIds.filter((r) => PRINCIPLE_IDS.has(r))])];
      });
      if (await checkOver(get().game!)) {
        set({ comment: { comment, ply: i } });
        return;
      }
      const serious = comment.classification === 'mistake' || comment.classification === 'blunder';
      if (serious && useSettings.getState().pauseOnMistakes) {
        set({ phase: 'paused', comment: { comment, ply: i } });
        return;
      }
      set({ comment: { comment, ply: i } });
      await botMove();
    } catch (e) {
      if (!(e instanceof CancelledError)) console.error(e);
    }
  };

  const botMove = async () => {
    const my = token;
    const g = get().game!;
    const fen = currentFen(g);
    set({ phase: 'botThinking' });
    try {
      const params = botParams(g.elo);
      const started = Date.now();
      const a = await analyze(fen, params.multipv, Math.max(ANALYSIS_DEPTH, params.depth));
      if (my !== token) return;
      const uci = chooseBotMove(fen, a, g.elo);
      await sleep(Math.max(0, 600 - (Date.now() - started)));
      if (my !== token || !uci) return;
      const r = tryMove(fen, uci)!;
      update((gg) => {
        gg.plies.push({ uci, san: r.move.san, color: r.move.color, fenBefore: fen, fenAfter: r.fen, isUser: false });
      });
      if (await checkOver(get().game!)) return;
      set({ phase: 'userTurn' });
      prefetch();
    } catch (e) {
      if (!(e instanceof CancelledError)) console.error(e);
    }
  };

  /** Analyse the position the user is thinking about (eval for the graph, hints, next review). */
  const prefetch = () => {
    const g = get().game;
    if (!g) return;
    const i = g.plies.length - 1;
    const fen = currentFen(g);
    analyze(fen, 3)
      .then((a) => {
        const gg = get().game;
        if (!gg || gg.plies[i]?.fenAfter !== fen || gg.plies[i].evalAfter) return;
        update((x) => {
          x.plies[i] = { ...x.plies[i], evalAfter: a.lines[0]?.score };
        });
      })
      .catch(() => undefined);
  };

  return {
    game: null,
    phase: 'loading',
    comment: null,
    message: null,
    hint: null,
    over: null,

    async load() {
      const saved = await db.current.get('play');
      if (!saved) {
        set({ phase: 'setup' });
        return;
      }
      token++;
      set({ game: saved, over: null, hint: null, message: null, comment: null });
      const last = saved.plies[saved.plies.length - 1];
      const lastUser = [...saved.plies].reverse().findIndex((p) => p.isUser);
      if (lastUser >= 0) {
        const idx = saved.plies.length - 1 - lastUser;
        const c = saved.plies[idx].comment;
        if (c) set({ comment: { comment: c, ply: idx } });
      }
      const fen = currentFen(saved);
      if (await checkOver(saved)) return;
      if (last?.isUser && !last.classification) void reviewUserMove(saved.plies.length - 1);
      else if (turnOf(fen) !== saved.userColor) void botMove();
      else {
        set({ phase: 'userTurn' });
        prefetch();
      }
    },

    newGame(color, elo) {
      token++;
      getEngine().cancelAll();
      const game: SavedGame = {
        id: 'play',
        userColor: color,
        elo,
        startFen: START_FEN,
        startedAt: Date.now(),
        plies: [],
        takebacks: 0,
        hintsUsed: 0,
        told: [],
      };
      set({ game, over: null, comment: null, hint: null, message: null });
      save(game);
      if (color === 'b') void botMove();
      else {
        set({ phase: 'userTurn' });
        prefetch();
      }
    },

    userMove(m) {
      const { game, phase } = get();
      if (!game || phase !== 'userTurn') return false;
      const fen = currentFen(game);
      if (turnOf(fen) !== game.userColor) return false;
      const r = tryMove(fen, m);
      if (!r) return false;
      update((g) => {
        g.plies.push({ uci: r.move.lan, san: r.move.san, color: r.move.color, fenBefore: fen, fenAfter: r.fen, isUser: true });
      });
      set({ hint: null, message: null });
      void reviewUserMove(get().game!.plies.length - 1);
      return true;
    },

    continueGame() {
      if (get().phase !== 'paused') return;
      void botMove();
    },

    tryAgain() {
      const g = get().game;
      if (!g || get().phase !== 'paused') return;
      const undone = g.plies[g.plies.length - 1];
      update((gg) => {
        gg.plies.pop();
        gg.takebacks++;
      });
      set({
        phase: 'userTurn',
        message: `Let's try that again. ${undone.comment?.classification === 'blunder' ? 'Before you move, check what each of your pieces is attacked by.' : 'Look for a safer or stronger move.'}`,
        comment: null,
      });
    },

    takeback() {
      const { game: g, phase } = get();
      if (!g || !['userTurn', 'paused', 'botThinking'].includes(phase)) return;
      const lastUserIdx = g.plies.map((p) => p.isUser).lastIndexOf(true);
      if (lastUserIdx < 0) return;
      token++;
      getEngine().cancelAll();
      const undone = g.plies[lastUserIdx];
      update((gg) => {
        gg.plies = gg.plies.slice(0, lastUserIdx);
        gg.takebacks++;
      });
      set({
        phase: 'userTurn',
        comment: null,
        hint: null,
        message: explainTakeback(undone.comment, undone.fenBefore),
      });
      prefetch();
    },

    async requestHint() {
      const g = get().game;
      if (!g || get().phase !== 'userTurn') return;
      const level = Math.min(3, (get().hint?.level ?? 0) + 1) as 1 | 2 | 3;
      const fen = currentFen(g);
      try {
        const a = await analyze(fen, 3);
        if (currentFen(get().game) !== fen) return;
        const h = getHint(fen, a.lines[0]?.pv ?? [], level);
        if (h) {
          set({ hint: h, message: null });
          update((gg) => {
            gg.hintsUsed++;
          });
        }
      } catch {
        /* cancelled */
      }
    },

    async resign() {
      const g = get().game;
      if (!g) return;
      await endGame(g.userColor === 'w' ? '0-1' : '1-0', 'resignation');
    },

    async abandon() {
      const g = get().game;
      if (!g) return;
      if (g.plies.filter((p) => p.isUser).length < 3) {
        await db.current.delete('play');
        get().leaveGame();
        return;
      }
      await get().resign();
      get().leaveGame();
    },

    leaveGame() {
      token++;
      getEngine().cancelAll();
      set({ game: null, phase: 'setup', over: null, comment: null, hint: null, message: null });
    },
  };
});

const PRINCIPLE_IDS = new Set(['king-walk', 'early-queen', 'same-piece-twice', 'flank-pawn', 'knight-rim', 'no-castle']);

function terminalScore(fen: string): Score {
  const info = gameOverInfo(fen);
  if (info?.reason === 'checkmate') return { type: 'mate', value: info.result === '1-0' ? 1 : -1 } as Score;
  return { type: 'cp', value: 0 };
}

export { other };
