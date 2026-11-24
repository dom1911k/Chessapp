// The game screen: top bar, the two player bars around the board, the coach (or the moves
// table), and the Dock or the choices of the moment.
import { Dock, DockButton } from '../../components/Dock';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Chess, type Square } from 'chess.js';
import { squareAtPoint, stepView, swipeDir } from '../../lib/chess/boardfeel';
import { kingBadges } from '../../lib/chess/kingBadges';
import { FlipVertical2, ChevronRight, ChevronLeft, Crosshair, EllipsisVertical, Flag, Lightbulb, ListOrdered, MessageCircleHeart, MessagesSquare, RotateCcw, ScanSearch, ShieldCheck, Dumbbell, Sparkles, Undo2, Users, X } from 'lucide-react';
import { povScore, winPct } from '../../lib/chess/evaluation';
import { safetyInfo } from '../../lib/coach';
import { START_FEN } from '../../lib/chess/game';
import { detectOpening } from '../../lib/openings';
import { useNav } from '../../lib/nav';
import { useSettings } from '../../lib/settings';
import { currentFen, turnOf, usePlay } from '../../lib/store/play';
import { canAbort } from '../../lib/store/finish';
import { Board } from '../../components/Board';
import { opponentById } from '../../lib/people';
import { Dialog, EvalBar, FadeScroll, IconButton, useBackHandler } from '../../components/ui';
import { MoveList } from '../../components/MoveList';
import { MoveHistory } from '../../components/MoveHistory';
import type { CoachArrow, CoachHighlight } from '../../lib/coach/types';
import { BoardFlash } from '../../components/BoardFlash';
import { timeControlLabel } from '../../lib/chesscom/parse';
import { aidsFor } from '../../lib/coach/level';
import { VersusIntro } from '../../components/VersusIntro';
import { RewardsOverlay } from '../../components/RewardsOverlay';
import { THEMES } from '../../lib/themes';
import { CoachCard, CoachHistory } from './CoachCard';
import { type ActionKind, GameActions, rematch } from './GameActions';
import { PlayerBar } from './PlayerBar';
import { haptic, reduced } from '../../lib/motion';
import { sfx } from '../../lib/sfx';
import { END_BEATS, END_STALE_MS, endStinger } from '../../lib/endBeats';

/** Slim top row: back to menu, the opening (or the mode), game menu. */
function GameTopBar({ onMenu }: { onMenu: () => void }) {
  const s = usePlay();
  const g = s.game!;
  const opening = useMemo(() => (g.startFen === START_FEN ? detectOpening(g.plies.map((p) => p.san)) : null), [g.plies, g.startFen]);
  const sub = [g.match ? 'Match conditions' : 'Coached', g.timeControl ? timeControlLabel(g.timeControl) : null].filter(Boolean).join(' · ');
  return (
    <header className="safe-top relative z-20">
      <div className="mx-auto flex h-11 max-w-xl items-center gap-2 px-1 land:max-w-6xl">
        <IconButton label="Back to menu" onClick={() => s.setAway(true)}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </IconButton>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[16px] font-bold tracking-[-0.01em]">{opening ? opening.name : `vs ${opponentById(g.opponentId)?.name ?? (g.rematch ? `${g.rematch.name} (stand-in)` : g.sparring ? 'Sparring partner' : 'Bot')}`}</div>
          <div className="truncate text-[12px] font-medium text-stone-500">{sub}</div>
        </div>
        <IconButton label="Game menu" onClick={onMenu}>
          <EllipsisVertical size={21} />
        </IconButton>
      </div>
    </header>
  );
}

export function GameView() {
  const s = usePlay();
  const settings = useSettings();
  const push = useNav((n) => n.push);
  const [menu, setMenu] = useState(false);
  const [history, setHistory] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [overMenu, setOverMenu] = useState(false);
  // The coach's whole message in a sheet, when it doesn't fit under the board.
  const [full, setFull] = useState(false);
  const g = s.game!;
  const fen = currentFen(g);
  const [flipped, setFlipped] = useState(false);
  const orientation = (g.userColor === 'w') !== flipped ? 'white' : 'black';
  const last = g.plies[g.plies.length - 1];
  const myTurn = s.phase === 'userTurn' && turnOf(fen) === g.userColor;
  // Looking back at an earlier position (index of the ply shown, -1 = start); null follows the game.
  const [view, setView] = useState<number | null>(null);
  useEffect(() => setView(null), [g.startedAt]);
  const viewing = view !== null && view < g.plies.length - 1;
  // The game ends on the board, chess.com style: the loser's king glows, the king badges pop
  // (260ms, with a knock), the win / loss / draw stinger (+160ms), then the results sheet (+950ms).
  const ended = s.ending ?? s.over;
  const [endBeat, setEndBeat] = useState(0);
  useEffect(() => {
    const e = s.ending;
    const sting = e ? endStinger(e.result, g.userColor) : null;
    if (!e || !sting) return setEndBeat(0);
    // Opened later (or the screen came back): the final state, no sounds.
    if (Date.now() - e.at > END_STALE_MS) return setEndBeat(2);
    const rm = reduced();
    const t1 = setTimeout(() => {
      setEndBeat(1);
      sfx('mate');
      haptic('success');
    }, rm ? 0 : END_BEATS.badges);
    const t2 = setTimeout(() => sfx(sting), rm ? 0 : END_BEATS.stinger);
    const t3 = setTimeout(() => setEndBeat(2), rm ? 300 : END_BEATS.sheet);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [s.ending?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheetReady = !s.ending || endBeat >= 2;
  // Swipe on the board to step through the game (right = back, left = forward), like Game Review.
  // A gesture that starts on one of your pieces is a drag, a slow one a drawing — both left alone.
  const swipe = useRef<{ x: number; y: number; t: number; fen: string } | null>(null);
  const boardBox = useRef<HTMLDivElement>(null);
  const onSwipeStart = (e: React.TouchEvent) => {
    swipe.current = null;
    if (e.touches.length !== 1 || !boardBox.current) return;
    const tch = e.touches[0];
    const shownFen = viewing ? (viewPly ? viewPly.fenAfter : g.startFen) : fen;
    const sq = squareAtPoint(boardBox.current.getBoundingClientRect(), tch.clientX, tch.clientY, orientation);
    const piece = sq ? new Chess(shownFen).get(sq as Square) : undefined;
    if (piece && piece.color === g.userColor && !viewing) return;
    swipe.current = { x: tch.clientX, y: tch.clientY, t: Date.now(), fen: shownFen };
  };
  const onSwipeEnd = (e: React.TouchEvent) => {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0) return;
    const dir = swipeDir(e.changedTouches[0].clientX - s0.x, e.changedTouches[0].clientY - s0.y, Date.now() - s0.t);
    if (dir) setView(stepView(view, g.plies.length, dir));
  };
  const viewPly = viewing && view! >= 0 ? g.plies[view!] : null;
  const aids = aidsFor(settings, g);
  // Match conditions and the quieter coach levels show the move list in the coach's place.
  const coachOff = !aids.comments;
  const feed = g.feed ?? [];
  const latestFeed = feed[feed.length - 1];
  // The game-over actions (Game Review · Rematch · ⋯) are what you use after closing the results
  // sheet, so they appear only once it's closed; until then the Dock stays.
  const sheetPending = !!s.rewards;
  const actionKind: ActionKind | null = s.precheck ? 'precheck' : s.over && !sheetPending ? 'over' : s.phase === 'paused' && latestFeed?.kind === 'comment' ? 'paused' : null;
  // With the coach off, only what you asked for (hints, threats, the result…) shows, and only while it's fresh.
  const coachFresh = !!s.precheck || !!s.over || (!!latestFeed && latestFeed.ply >= g.plies.length - 1);

  const arrows: CoachArrow[] = [];
  const highlights: CoachHighlight[] = [];
  if (s.phase === 'paused' && s.comment) {
    arrows.push(...s.comment.comment.arrows);
    highlights.push(...s.comment.comment.highlights);
  }
  if (s.hint) {
    arrows.push(...s.hint.arrows);
    highlights.push(...s.hint.highlights);
  }
  if (s.precheck) {
    arrows.push({ from: s.precheck.uci.slice(0, 2), to: s.precheck.uci.slice(2, 4), tone: 'info' });
    if (s.precheck.revealed) highlights.push({ sq: s.precheck.check.sq, tone: 'bad' });
  }
  const note = s.threat ?? s.botNote;
  if (note && s.phase === 'userTurn') {
    arrows.push(...note.arrows);
    highlights.push(...note.highlights);
  }
  const safety = useMemo(
    () => (aids.safetyOverlay && myTurn ? safetyInfo(fen, g.userColor) : null),
    [aids.safetyOverlay, myTurn, fen, g.userColor],
  );
  if (safety) {
    arrows.push(...safety.arrows);
    highlights.push(...safety.highlights);
  }

  const lastEval = [...g.plies].reverse().find((p) => p.evalAfter)?.evalAfter;
  const whitePct = lastEval ? winPct(povScore(lastEval, 'w')) : 50;
  const userPlies = g.plies.filter((p) => p.isUser).length;
  // Before each side has made 2 moves, Resign reads Abort (chess.com): nothing is recorded.
  const abortable = !s.over && canAbort(g);

  useEffect(() => {
    if (s.over) setMenu(false);
  }, [s.over]);
  // Android back button: return to the menu (the game stays saved).
  const setAway = s.setAway;
  const goAway = useCallback(() => setAway(true), [setAway]);
  const stackEmpty = useNav((n) => n.stack.length === 0);
  useBackHandler(goAway, stackEmpty);

  const whyNot = () => {
    const lastUser = [...g.plies].reverse().find((p) => p.isUser);
    push({ name: 'explore', fen: lastUser ? lastUser.fenBefore : fen, orientation, title: 'Why not this move?' });
  };
  const menuItem = (icon: ReactNode, label: string, onClick: () => void, extra?: ReactNode) => (
    <button
      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left font-semibold press"
      onClick={() => {
        setMenu(false);
        onClick();
      }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">{icon}</span>
      <span className="flex-1">{label}</span>
      {extra}
    </button>
  );
  const onOff = (on: boolean) => <span className={`chip ${on ? 'bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'}`}>{on ? 'On' : 'Off'}</span>;

  return (
    <div className="flex h-full flex-col bg-stone-100 dark:bg-stone-950">
      <GameTopBar onMenu={() => setMenu(true)} />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col land:max-w-6xl land:flex-row land:gap-5 land:px-3">
        <div className="land:w-[min(calc(100dvh-11rem),58vw)] land:shrink-0">
          {settings.showMoveList && !coachOff && (
            // At the top, like chess.com's app: the coach then sits right under your bar. On tablets
            // the moves are a two-column table beside the board instead (below).
            <div className="land:hidden">
              <MoveList plies={g.plies} startFen={g.startFen} current={viewing ? view! : undefined} onSelect={(i) => setView(i >= g.plies.length - 1 ? null : i)} />
            </div>
          )}
          <PlayerBar me={flipped} />
          {/* Full-bleed on phones, like every board screen; the eval bar (when on) sits on the left. */}
          <div className="flex gap-1">
            {aids.evalBar && <EvalBar whitePct={whitePct} orientation={orientation} />}
            <div ref={boardBox} className="relative flex-1" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} data-testid="game-board">
              {/* The tactic label stays through the end, and fades out as the results sheet opens. */}
              <div className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 ${s.rewards && sheetReady ? 'opacity-0' : ''}`}>
                <BoardFlash flash={s.flash} orientation={orientation} />
              </div>
              <Board
                fen={viewing ? (viewPly ? viewPly.fenAfter : g.startFen) : fen}
                orientation={orientation}
                movable={myTurn && !viewing ? g.userColor : null}
                onMove={s.userMove}
                arrows={viewing ? [] : arrows}
                highlights={viewing ? [] : highlights}
                lastMove={viewing ? (viewPly ? { from: viewPly.uci.slice(0, 2), to: viewPly.uci.slice(2, 4) } : null) : last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null}
                showCoordinates={settings.showCoordinates}
                confirm={settings.confirmMoves}
                premoveColor={!viewing && (s.phase === 'analyzing' || s.phase === 'botThinking') ? g.userColor : null}
                kingBadges={ended && !viewing && (!s.ending || endBeat >= 1) ? kingBadges(ended.result, ended.reason) : null}
              />
              {viewing && (
                <button
                  onClick={() => setView(null)}
                  className="animate-pop absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stone-900/85 py-1.5 pr-1.5 pl-3.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg backdrop-blur"
                >
                  {view! < 0 ? 'Start position' : `Move ${Math.floor((view! + (g.startFen.split(' ')[1] === 'b' ? 1 : 0)) / 2) + Number(g.startFen.split(' ')[5] ?? 1)}`}
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-stone-900">{myTurn ? 'Back to your move' : 'Back to game'}</span>
                </button>
              )}
            </div>
          </div>
          <PlayerBar me={!flipped} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col land:pt-1">
          {/* The coach's message sits right under the move strip and scrolls (with a fade) if long. */}
          {coachOff ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-1 pb-2">
              <MoveHistory plies={g.plies} startFen={g.startFen} view={viewing ? view : null} onView={setView} arrows={aids.requests} />
              {coachFresh && (
                <div className="max-h-[45%] shrink-0 overflow-y-auto">
                  <CoachCard safetyMessages={safety?.messages ?? []} onHistory={() => setHistory(true)} />
                </div>
              )}
            </div>
          ) : (
            <>
              <FadeScroll className="px-3 pt-2 pb-3" testId="coach-panel" onMore={() => setFull(true)}>
                <CoachCard safetyMessages={safety?.messages ?? []} onHistory={() => setHistory(true)} />
              </FadeScroll>
              {settings.showMoveList && (
                <div className="hidden min-h-0 px-3 pb-2 land:flex land:max-h-[48%] land:flex-col" data-testid="move-table">
                  <MoveHistory plies={g.plies} startFen={g.startFen} view={viewing ? view : null} onView={setView} />
                </div>
              )}
            </>
          )}
          {/* Choices (a paused mistake, the pre-check, game over) take the Dock's place, so they're never scrolled away. */}
          {actionKind ? (
            <GameActions kind={actionKind} onMore={() => setOverMenu(true)} />
          ) : (!s.over || sheetPending) && (
            <Dock>
                {aids.requests ? (
                  <>
                    <DockButton label={s.hint ? `Hint ${s.hint.level}/3` : 'Hint'} icon={<Lightbulb size={22} />} disabled={!myTurn || s.hint?.level === 3} onClick={s.requestHint} primary />
                    <DockButton label="Take back" icon={<Undo2 size={22} />} disabled={userPlies === 0 || !['userTurn', 'paused', 'botThinking'].includes(s.phase)} onClick={s.takeback} />
                    <DockButton label="Threats" icon={<Crosshair size={22} />} disabled={!myTurn} onClick={s.requestThreat} />
                  </>
                ) : (
                  // Match conditions: chess.com's bar. Back and Forward step through the game like a swipe.
                  <>
                    <DockButton label="Back" icon={<ChevronLeft size={24} />} disabled={!g.plies.length || view === -1} onClick={() => setView(stepView(view, g.plies.length, -1))} />
                    <DockButton label="Forward" icon={<ChevronRight size={24} />} disabled={!viewing} onClick={() => setView(stepView(view, g.plies.length, 1))} />
                    {abortable ? (
                      <DockButton label="Abort" icon={<X size={22} />} onClick={() => void s.abort()} />
                    ) : (
                      <DockButton label="Resign" icon={<Flag size={22} />} onClick={() => setConfirmResign(true)} />
                    )}
                  </>
                )}
                <DockButton label="More" icon={<EllipsisVertical size={22} />} onClick={() => setMenu(true)} />
            </Dock>
          )}
        </div>
      </div>
      {s.intro && <VersusIntro opponentId={g.opponentId} elo={g.elo} userColor={g.userColor} line={s.chat?.text} onDone={s.endIntro} />}
      {s.rewards && sheetReady && (
        <RewardsOverlay
          r={s.rewards}
          onClose={s.closeRewards}
          onRematch={() => (s.closeRewards(), rematch(s))}
          onNewOpponent={() => (s.closeRewards(), s.leaveGame())}
          onPlayNext={(id) => (settings.set({ opponentId: id }), s.closeRewards(), s.leaveGame())}
          onReport={
            s.over?.gameId
              ? () => {
                  const id = s.over!.gameId;
                  s.closeRewards();
                  push({ name: 'report', gameId: id });
                }
              : undefined
          }
        />
      )}
      <Dialog open={menu} onClose={() => setMenu(false)}>
        <div className="-mx-2 space-y-0.5">
          {!s.over && aids.requests && menuItem(<ScanSearch size={19} />, 'Why not my move?', whyNot)}
          {(aids.requests || s.over) && menuItem(<Sparkles size={19} />, 'Explain this position', () => void s.requestExplain())}
          {menuItem(<MessagesSquare size={19} />, 'Conversation', () => setHistory(true))}
          {menuItem(<FlipVertical2 size={19} />, 'Flip board', () => setFlipped((f) => !f))}
          {!g.match && menuItem(
            <MessageCircleHeart size={19} />,
            'Coach comments',
            () => settings.set({ coachStyle: settings.coachStyle === 'gentle' ? 'detailed' : settings.coachStyle === 'detailed' ? 'off' : 'gentle' }),
            <span className="chip bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{settings.coachStyle === 'gentle' ? 'Gentle' : settings.coachStyle === 'detailed' ? 'Every move' : 'Off · move list'}</span>,
          )}
          {!g.match && menuItem(<ShieldCheck size={19} />, 'Safety overlay', () => settings.set({ safetyOverlay: !settings.safetyOverlay }), onOff(settings.safetyOverlay))}
          {menuItem(<ListOrdered size={19} />, 'Move list', () => settings.set({ showMoveList: !settings.showMoveList }), onOff(settings.showMoveList))}
          {!s.over && (abortable ? menuItem(<X size={19} />, 'Abort', () => void s.abort()) : menuItem(<Flag size={19} />, 'Resign', () => (g.match ? setConfirmResign(true) : void s.resign())))}
          {menuItem(<RotateCcw size={19} />, 'New game', () => void (s.over ? s.leaveGame() : s.abandon()))}
        </div>
      </Dialog>
      <Dialog open={full} onClose={() => setFull(false)}>
        <div className="max-h-[70dvh] overflow-y-auto">
          <CoachCard safetyMessages={safety?.messages ?? []} onHistory={() => (setFull(false), setHistory(true))} />
        </div>
      </Dialog>
      <Dialog open={overMenu} onClose={() => setOverMenu(false)}>
        <div className="-mx-2 space-y-0.5">
          {s.over?.practice && menuItem(<Dumbbell size={19} />, `Practise: ${THEMES[s.over.practice].label.toLowerCase()}`, () => push({ name: 'practice', theme: s.over!.practice! }))}
          {menuItem(<Users size={19} />, 'New opponent', () => s.leaveGame())}
          {menuItem(<MessagesSquare size={19} />, 'Conversation', () => setHistory(true))}
        </div>
      </Dialog>
      <Dialog open={confirmResign} onClose={() => setConfirmResign(false)} title="Resign this game?">
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setConfirmResign(false)}>Keep playing</button>
          <button className="btn-primary flex-1" onClick={() => (setConfirmResign(false), void s.resign())}>Resign</button>
        </div>
      </Dialog>
      <Dialog open={history} onClose={() => setHistory(false)} title="Conversation">
        <div className="-mx-1 max-h-[62dvh] overflow-y-auto px-1">
          <CoachHistory />
        </div>
      </Dialog>
    </div>
  );
}
