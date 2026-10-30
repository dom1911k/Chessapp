// Play-vs-bot state machine with live coaching.
import { create } from 'zustand';
import { chooseBotMove, botParams } from '../bot';
import { chooseMaiaMove, maiaLogits, maiaTemperature, vetoLimit } from '../maia';
import { moveAccuracy, winPct, povScore, scoreToCp, type Score } from '../chess/evaluation';
import { gameOverInfo, START_FEN, tryMove, type GameResult, type MoveInput } from '../chess/game';
import { hangingPieces, other, parseFen, PIECE_NAME, VALUE, type Color, type PieceType } from '../chess/pos';
import { getOpponentRecords } from '../people/record';
import { explainMove, explainTakeback, getHint, type CoachComment } from '../coach';
import type { Hint } from '../coach/hints';
import type { Theme } from '../coach/types';
import { THEMES } from '../themes';
import { botMoveNote, describeThreat, nullMoveFen, type ThreatInfo } from '../coach/threats';
import { explainPosition } from '../coach/position';
import { preMoveCheck, type PreCheck } from '../coach/precheck';
import { db } from '../db';
import { CancelledError, getEngine, type AnalysisResult } from '../engine';
import { analysisLimits } from '../engine/speed';
import { useSettings } from '../settings';
import { playSound } from '../sound';
import { opponentById, pickLine, type ChatEvent, type Mood } from '../people';
import { bookMove, REPERTOIRES } from '../people/openings';
import { detectOpening } from '../openings';
import { useCelebrate } from '../celebrate';
import { finishGame, gameTactics, type GameRewards } from './finish';
import type { FeedItem, SavedGame } from './types';
import { cap, moveWords } from '../chess/words';
import { specialMove, tacticsOfMove, TACTIC_KEYS, type Special, type TacticCounts, type TacticKey } from '../rewards/career';
import { checkAchievements } from '../progress/achievements';

export type Phase = 'loading' | 'setup' | 'userTurn' | 'analyzing' | 'botThinking' | 'paused' | 'over';


interface PlayStore {
  game: SavedGame | null;
  phase: Phase;
  /** Comment shown in the coach panel (for the latest user move). */
  comment: { comment: CoachComment; ply: number } | null;
  /** Short coach message (take-backs, try again…). */
  message: string | null;
  hint: Hint | null;
  /** Answer to "What's my opponent threatening?". */
  threat: ThreatInfo | null;
  /** Note about a threat the bot's last move created. */
  botNote: ThreatInfo | null;
  /** The opponent's latest chat line. */
  chat: { text: string; mood: Mood; ply: number } | null;
  over: { result: GameResult; reason: string; gameId: number; stars?: number; firstWin?: boolean; practice?: Theme } | null;
  /** The results screen after a game (null once closed). */
  rewards: GameRewards | null;
  closeRewards(): void;
  /** A short celebration on the board: brilliant / great move or a tactic like a fork. */
  flash: { id: number; kind: Special | TacticKey; sq: string } | null;
  /** "Are you sure?" before a risky move. */
  precheck: { move: MoveInput; uci: string; check: PreCheck; revealed: boolean } | null;
  load(): Promise<void>;
  newGame(color: Color, elo: number, startFen?: string, opponentId?: string): void;
  userMove(m: MoveInput, force?: boolean): boolean;
  /** Play the move the "are you sure?" check stopped. */
  confirmPrecheck(): void;
  dismissPrecheck(): void;
  revealPrecheck(): void;
  continueGame(): void;
  tryAgain(): void;
  takeback(): void;
  requestHint(): Promise<void>;
  requestThreat(): Promise<void>;
  /** Coach Sam describes the current position in the conversation. */
  requestExplain(): Promise<void>;
  resign(): Promise<void>;
  /** Start over: very short games are discarded, longer ones count as resigned. */
  abandon(): Promise<void>;
  leaveGame(): void;
  /** Back to the menu while a game is running (the game stays saved). */
  away: boolean;
  setAway(away: boolean): void;
}

let token = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function currentFen(g: SavedGame | null): string {
  return g?.plies.length ? g.plies[g.plies.length - 1].fenAfter : (g?.startFen ?? START_FEN);
}

export function turnOf(fen: string): Color {
  return fen.split(' ')[1] as Color;
}

async function analyze(fen: string, multipv = 3, depth?: number): Promise<AnalysisResult> {
  const l = analysisLimits();
  return getEngine().analyze(fen, { depth: depth ?? l.depth, movetime: l.movetime, multipv, owner: 'play' });
}

function save(g: SavedGame) {
  void db.current.put(structuredClone(g));
}

const CHAT_MOOD: Partial<Record<ChatEvent, Mood>> = {
  userBrilliant: 'worried',
  greetRematch: 'happy',
  userCheck: 'worried',
  userCapture: 'worried',
  userThreat: 'worried',
  userBlunder: 'happy',
  botCapture: 'happy',
  botWinning: 'happy',
  botWins: 'happy',
  botLosing: 'worried',
  botLoses: 'worried',
  userGoodMove: 'worried',
};

export const usePlay = create<PlayStore>((set, get) => {
  /** Adds a message to Coach Sam's conversation (saved with the game). */
  let feedId = Date.now();
  const post = (item: Omit<FeedItem, 'id' | 'ply'> & { ply?: number }) => {
    const g = get().game;
    if (!g) return;
    update((gg) => {
      gg.feed = [...(gg.feed ?? []), { ...item, id: feedId++, ply: item.ply ?? gg.plies.length - 1 }].slice(-80);
    });
  };

  /** Announces the opening the first time its name appears. */
  const announceOpening = () => {
    const g = get().game!;
    if (g.startFen !== START_FEN || g.plies.length > 16 || useSettings.getState().coachStyle === 'gentle') return;
    const o = detectOpening(g.plies.map((p) => p.san));
    if (!o || g.told.includes(`opening:${o.name}`)) return;
    update((gg) => void gg.told.push(`opening:${o.name}`));
    post({ kind: 'opening', text: [o.name, o.idea] });
  };

  /** Let the opponent say something (with probability `p`). */
  const say = (event: ChatEvent, p = 1, vars: Record<string, string> = {}) => {
    const g = get().game;
    const o = opponentById(g?.opponentId);
    if (!g || !o) return;
    // Even when they stay quiet, their face reacts.
    const text = Math.random() <= p ? pickLine(o, event, Math.random(), vars) : '';
    set({ chat: { text, mood: CHAT_MOOD[event] ?? 'neutral', ply: g.plies.length } });
  };

  /** The opponent reacts to your move right away: check, a capture, or a new attack on a piece. */
  const reactToUserMove = (fenBefore: string, fenAfter: string, m: { san: string; captured?: string }) => {
    const g = get().game!;
    const bot = other(g.userColor);
    if (m.san.includes('+')) return say('userCheck', 0.55);
    if (m.captured && m.captured !== 'p') return say('userCapture', 0.6, { piece: PIECE_NAME[m.captured as PieceType] });
    const before = new Set(hangingPieces(parseFen(fenBefore).board, bot).map((h) => h.sq));
    const board = parseFen(fenAfter).board;
    const fresh = hangingPieces(board, bot).find((h) => !before.has(h.sq) && VALUE[board[h.sq]!.type] >= 3);
    if (fresh) say('userThreat', 0.5, { piece: PIECE_NAME[board[fresh.sq]!.type] });
  };

  /** After the game the opponent sums it up in their own voice. */
  const sayLater = (text: string, mood: Mood, delay: number) => {
    const g = get().game;
    setTimeout(() => {
      if (get().game !== g && get().game?.startedAt !== g?.startedAt) return;
      set({ chat: { text, mood, ply: get().game?.plies.length ?? 0 } });
    }, delay);
  };

  const update = (fn: (g: SavedGame) => void) => {
    const g = get().game;
    if (!g) return;
    const copy: SavedGame = { ...g, plies: [...g.plies], told: [...g.told] };
    fn(copy);
    set({ game: copy });
    // A finished game is stored in the history; never save it as "in progress" again
    // (it would be finished — and rewarded — a second time on the next start).
    if (get().phase !== 'over') save(copy);
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
    // Only once per game, even if two paths notice the end at the same time.
    if (!g || get().phase === 'over') return;
    token++;
    getEngine().cancelAll('play');
    set({ phase: 'over', hint: null });
    const botWon = result !== '1/2-1/2' && (result === '1-0') !== (g.userColor === 'w');
    say(reason === 'resignation' ? 'userResigned' : result === '1/2-1/2' ? 'draw' : botWon ? 'botWins' : 'botLoses');
    if (!botWon && result !== '1/2-1/2') setTimeout(() => playSound('win'), 350);
    // The results screen shows the rewards; keep the usual toasts quiet meanwhile.
    useCelebrate.getState().setMuted(true);
    const info = await finishGame(g, result, reason);
    if (!info) {
      // Already recorded (e.g. the app was closed right after the game ended).
      useCelebrate.getState().setMuted(false);
      get().leaveGame();
      return;
    }
    const rec = await db.games.get(info.gameId);
    const practice = rec?.summary.pattern?.theme ?? rec?.summary.lessonTheme;
    set({ over: { result, reason, gameId: info.gameId, stars: info.stars, firstWin: info.firstWin, practice }, rewards: info.rewards });
    const userResult = result === '1/2-1/2' ? 'draw' : botWon ? 'loss' : 'win';
    const lines = resultLines(userResult, reason, info.stars, opponentById(g.opponentId)?.name);
    if (practice) lines.push(`${THEMES[practice].label} tripped you up this game. Want to practise it for 2 minutes?`);
    post({ kind: 'result', text: lines, mood: userResult === 'loss' ? 'concerned' : 'happy' });
    // The opponent's take on the game.
    const o = opponentById(g.opponentId);
    if (o && rec) {
      const big = rec.summary.biggestMistakePly !== null ? rec.plies[rec.summary.biggestMistakePly] : null;
      const event = big ? 'summaryMistake' : 'summaryGood';
      sayLater(cap(pickLine(o, event).replace('{move}', big ? moveWords(big.fenBefore, big.uci, 'you', 'ger', false) : '')), big ? 'neutral' : 'happy', 2600);
    }
  };

  /** After the user's move at index `i`: analyse, classify, coach, then let the bot reply. */
  const reviewUserMove = async (i: number) => {
    const my = token;
    const g = get().game!;
    const ply = g.plies[i];
    set({ phase: 'analyzing' });
    try {
      const params = botParams(g.elo);
      const depth = Math.max(analysisLimits().depth, params.depth);
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
      // Tactics you played (sound moves only) and brilliant / great moves.
      const sound = comment.classification === 'best' || comment.classification === 'good';
      const tactics: TacticCounts = sound ? tacticsOfMove(ply.fenBefore, ply.uci) : {};
      const special = specialMove(ply.fenBefore, ply.uci, before, after, comment.classification === 'best', g.plies[i - 1]?.uci) ?? undefined;
      if (special) tactics[special] = 1;
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
          special,
          tactics: Object.keys(tactics).length ? tactics : undefined,
        };
        gg.minWp = Math.min(gg.minWp ?? 50, wpA);
        gg.told = [...new Set([...gg.told, ...comment.ruleIds.filter((r) => PRINCIPLE_IDS.has(r))])];
      });
      const gentle = useSettings.getState().coachStyle === 'gentle';
      const cls = comment.classification;
      const loss = Math.max(0, wpB - wpA);
      const slip = cls === 'mistake' || cls === 'blunder';
      // Gentle coach: speak up only when a move really costs you (a big drop that leaves you worse off, or
      // a huge one). Missed chances while you're doing fine and small slips stay for the game report.
      // It also gives you some room: after pointing out a slip it stays quiet for a few moves unless it's huge.
      const feed = get().game!.feed ?? [];
      const lastOf = (ok: (c?: string) => boolean) => [...feed].reverse().find((f) => f.kind === 'comment' && ok(f.classification));
      const lastSlip = lastOf((c) => c === 'mistake' || c === 'blunder');
      const slipDue = !lastSlip || i - lastSlip.ply >= 6 || loss >= 40;
      const hurts = slip && (gentle ? ((cls === 'blunder' && wpA < 40) || loss >= 35) && slipDue : true);
      const lastPraise = lastOf((c) => c === 'best' || c === 'good');
      const praiseDue = !gentle || !lastPraise || i - lastPraise.ply >= 6;
      // Gentle praises real highlights (a tactic, a free piece, mate) and skips "nice move, but remember…" reminders.
      const praiseWorthy = gentle
        ? comment.ruleIds.some((r) => r.startsWith('praise-') && r !== 'praise-generic')
        : !comment.ruleIds.every((r) => r === 'praise-generic');
      const notable = special || (slip || cls === 'inaccuracy' ? (gentle ? hurts : true) : praiseWorthy && praiseDue);
      if (notable) {
        let text = special ? [SPECIAL_TEXT[special], ...comment.text.filter((t) => !/best move|exactly right|Spot on/.test(t))] : comment.text;
        if (gentle && hurts) text = [pick(GENTLE_OPENERS), ...text.slice(0, 2).map((t, k) => (k ? t : cap(t.replace(/^(Oops|Ouch|Careful)\s*[!,—–-]*\s*/, ''))))];
        post({
          kind: 'comment',
          text,
          special,
          classification: cls,
          ply: i,
          mood: hurts ? 'concerned' : 'happy',
        });
      }
      const shown = special ?? (TACTIC_KEYS.find((k) => tactics[k] && FLASHY.has(k)) as TacticKey | undefined);
      if (shown) {
        set({ flash: { id: Date.now(), kind: shown, sq: ply.uci.slice(2, 4) } });
        if (special) {
          playSound('brilliant');
          say('userBrilliant', 0.8);
        }
      }
      if (Object.keys(tactics).length) void checkAchievements(gameTactics(get().game!));
      announceOpening();
      if (await checkOver(get().game!)) {
        set({ comment: { comment, ply: i } });
        return;
      }
      const serious = hurts;
      if (serious) say('userBlunder', gentle ? 0.5 : 0.85);
      else if (comment.ruleIds.some((r) => r === 'praise-tactic' || r === 'praise-mate' || r === 'praise-capture')) say('userGoodMove', 0.7);
      if (serious && useSettings.getState().pauseOnMistakes ) {
        playSound('error');
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
      // Opponents play their favourite openings from a small book first.
      const book = g.startFen === START_FEN ? bookMove(g.opponentId, g.plies.map((p) => p.san)) : null;
      let uci = book;
      // Human-like (Maia) or classic (Stockfish) opponent; Stockfish also covers any Maia failure.
      if (!uci && useSettings.getState().opponentEngine === 'maia') {
        try {
          const fens = [g.startFen, ...g.plies.map((p) => p.fenAfter)];
          // Strong opponents: Stockfish checks Maia's choice for blunders.
          const [logits, a] = await Promise.all([
            maiaLogits(fens, g.elo),
            vetoLimit(g.elo) !== null ? analyze(fen, 8, Math.max(analysisLimits().depth, params.depth)) : Promise.resolve(null),
          ]);
          const turn = turnOf(fen);
          const candidates = a ? new Map(a.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, turn))])) : undefined;
          uci = chooseMaiaMove(logits, maiaTemperature(g.elo, opponentById(g.opponentId)?.style), g.elo, candidates);
        } catch (e) {
          console.warn('Maia failed, using Stockfish', e);
        }
        if (my !== token) return;
      }
      if (!uci) {
        const a = await analyze(fen, params.multipv, Math.max(analysisLimits().depth, params.depth));
        if (my !== token) return;
        uci = chooseBotMove(fen, a, g.elo, Math.random, opponentById(g.opponentId)?.style);
      }
      await sleep(Math.max(0, (book ? 700 : 600) - (Date.now() - started)));
      if (my !== token || !uci) return;
      const r = tryMove(fen, uci)!;
      update((gg) => {
        gg.plies.push({ uci, san: r.move.san, color: r.move.color, fenBefore: fen, fenAfter: r.fen, isUser: false });
      });
      if (r.move.san.includes('+')) say('botCheck', 0.5);
      else if (r.move.captured) say('botCapture', 0.3);
      announceOpening();
      if (await checkOver(get().game!)) return;
      let note = useSettings.getState().botNotes ? botMoveNote(fen, r.fen, uci, g.userColor, opponentById(g.opponentId)?.name) : null;
      // Gentle: checks speak for themselves and a threatened pawn isn't worth a message.
      // Other warnings get a few moves' break, except a checkmate threat.
      if (note && useSettings.getState().coachStyle === 'gentle') {
        const lastNote = [...(g.feed ?? [])].reverse().find((f) => f.kind === 'note');
        const recent = !!lastNote && g.plies.length - lastNote.ply <= 6;
        if (note.level === 'check' || note.level === 'pawn' || (note.level !== 'mate' && recent)) note = null;
      }
      set({ phase: 'userTurn', botNote: note });
      if (note) post({ kind: 'note', text: [note.text], mood: 'concerned' });
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
        const s = a.lines[0]?.score;
        if (s) {
          const botCp = scoreToCp(povScore(s, other(gg.userColor)));
          const told = get().game!.told;
          const flag = botCp >= 300 ? 'chat:winning' : botCp <= -300 ? 'chat:losing' : null;
          if (flag && !told.includes(flag)) {
            update((x) => void x.told.push(flag));
            say(flag === 'chat:winning' ? 'botWinning' : 'botLosing');
          }
        }
      })
      .catch(() => undefined);
  };

  return {
    game: null,
    phase: 'loading',
    comment: null,
    message: null,
    hint: null,
    threat: null,
    botNote: null,
    chat: null,
    over: null,
    precheck: null,
    flash: null,
    rewards: null,
    away: false,

    setAway(away) {
      set({ away });
    },

    closeRewards() {
      set({ rewards: null });
      useCelebrate.getState().setMuted(false);
    },

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

    newGame(color, elo, startFen = START_FEN, opponentId) {
      token++;
      getEngine().cancelAll('play');
      const game: SavedGame = {
        id: 'play',
        userColor: color,
        elo,
        opponentId,
        startFen,
        startedAt: Date.now(),
        plies: [],
        takebacks: 0,
        hintsUsed: 0,
        told: [],
      };
      set({ game, over: null, comment: null, hint: null, message: null, threat: null, botNote: null, chat: null, precheck: null, rewards: null, flash: null, away: false });
      useCelebrate.getState().setMuted(false);
      save(game);
      const greetFor = game.startedAt;
      void getOpponentRecords().then((recs) => {
        if (get().game?.startedAt !== greetFor) return;
        const last = opponentId ? recs[opponentId]?.last : undefined;
        say(last === 'win' ? 'greetRevenge' : last === 'loss' ? 'greetRematch' : 'greet');
      });
      const o = opponentById(opponentId);
      post({
        kind: 'info',
        ply: -1,
        text: [
          o ? `You're playing ${o.name} (~${o.elo}). ${REPERTOIRES[o.id] ? `Watch out — ${o.name.split(' ').pop()} likes the ${REPERTOIRES[o.id].favourite}.` : 'Expect surprises!'}` : 'New game — good luck!',
          color === 'w' ? 'You have the white pieces, so you move first. Tap a piece, then a square.' : 'You have black, so your opponent moves first.',
        ],
      });
      if (turnOf(startFen) !== color) void botMove();
      else {
        set({ phase: 'userTurn' });
        prefetch();
      }
    },

    userMove(m, force = false) {
      const { game, phase } = get();
      if (!game || phase !== 'userTurn') return false;
      const fen = currentFen(game);
      if (turnOf(fen) !== game.userColor) return false;
      const r = tryMove(fen, m);
      if (!r) return false;
      if (!force && useSettings.getState().checkBeforeMove) {
        const check = preMoveCheck(fen, r.move.lan);
        if (check) {
          set({ precheck: { move: m, uci: r.move.lan, check, revealed: false }, hint: null, threat: null });
          playSound('notify');
          return false;
        }
      }
      set({ precheck: null });
      update((g) => {
        g.plies.push({ uci: r.move.lan, san: r.move.san, color: r.move.color, fenBefore: fen, fenAfter: r.fen, isUser: true });
      });
      reactToUserMove(fen, r.fen, r.move);
      set({ hint: null, message: null, threat: null, botNote: null });
      void reviewUserMove(get().game!.plies.length - 1);
      return true;
    },

    confirmPrecheck() {
      const p = get().precheck;
      if (!p) return;
      set({ precheck: null });
      get().userMove(p.move, true);
    },

    dismissPrecheck() {
      set({ precheck: null });
    },

    revealPrecheck() {
      const p = get().precheck;
      if (p) set({ precheck: { ...p, revealed: true } });
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
      post({ kind: 'info', mood: 'thinking', text: [`Let's try that again. ${undone.comment?.classification === 'blunder' ? 'Before you move, check what each of your pieces is attacked by.' : 'Look for a safer or stronger move.'}`] });
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
      getEngine().cancelAll('play');
      const undone = g.plies[lastUserIdx];
      update((gg) => {
        gg.plies = gg.plies.slice(0, lastUserIdx);
        gg.takebacks++;
      });
      set({
        phase: 'userTurn',
        comment: null,
        hint: null,
        threat: null,
        botNote: null,
        precheck: null,
        message: explainTakeback(undone.comment, undone.fenBefore),
      });
      post({ kind: 'takeback', text: [explainTakeback(undone.comment, undone.fenBefore)] });
      say('takeback', 0.6);
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
          post({ kind: 'hint', mood: 'thinking', text: [h.text] });
          update((gg) => {
            gg.hintsUsed++;
          });
        }
      } catch {
        /* cancelled */
      }
    },

    async requestThreat() {
      const g = get().game;
      if (!g || get().phase !== 'userTurn') return;
      const fen = currentFen(g);
      const nf = nullMoveFen(fen);
      try {
        const a = nf ? await analyze(nf, 1, 10) : null;
        if (currentFen(get().game) !== fen) return;
        const th = describeThreat(fen, a);
        set({ threat: th, hint: null, message: null });
        post({ kind: 'threat', mood: 'thinking', text: [th.text] });
      } catch {
        /* cancelled */
      }
    },

    async requestExplain() {
      const g = get().game;
      if (!g || !['userTurn', 'paused', 'over'].includes(get().phase)) return;
      const fen = currentFen(g);
      try {
        const a = await analyze(fen, 1);
        post({ kind: 'explain', mood: 'thinking', text: explainPosition(fen, a, g.userColor) });
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
      getEngine().cancelAll('play');
      set({ game: null, phase: 'setup', over: null, comment: null, hint: null, message: null, threat: null, botNote: null, chat: null, precheck: null, rewards: null, flash: null, away: false });
      useCelebrate.getState().setMuted(false);
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

/** Coach Sam's words at the end of a game. */
export function resultLines(userResult: 'win' | 'loss' | 'draw', reason: string, stars: number, opponent?: string): string[] {
  const who = opponent ?? 'the bot';
  if (userResult === 'win')
    return [
      `You won against ${who}${reason === 'checkmate' ? ' by checkmate' : ''}! 🎉`,
      ...(opponent ? [stars >= 5 ? `That's all 5 stars with ${who}!` : `Star ${stars} of 5 with ${who}. Five stars open ${who}'s special challenge.`] : []),
    ];
  if (userResult === 'draw') return [`A draw (${reason}). That's a solid result!`];
  if (reason === 'resignation') return ['Game over. Every game teaches us something — let\'s look at the report together.'];
  return [`${who} got you this time. Let's learn from it — the report shows the turning point.`];
}

const SPECIAL_TEXT: Record<Special, string> = {
  brilliant: 'Brilliant move!! You gave something up on purpose — and it works. That takes real vision.',
  great: 'Great move! It was the only good move here, and you found it.',
};

/** Tactics that get a little celebration on the board. */
const FLASHY = new Set<TacticKey>(['royalForks', 'forks', 'skewers', 'discovered', 'pins', 'smotheredMates', 'backRankMates']);


/** Gentle coach: a kind word before explaining a costly move. */
const GENTLE_OPENERS = [
  'No worries — this happens to everyone.',
  "Ah, small slip! Let's look at it together.",
  'Easy to miss, this one.',
  "Don't worry, that's how we learn.",
  'Ooh, tricky spot. Here is what happened:',
];
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
