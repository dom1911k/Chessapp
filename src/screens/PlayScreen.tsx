import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Bot, Brain, Check, ChevronLeft, Crosshair, EllipsisVertical, Flag, History, Lightbulb, ListOrdered, Lock, MessagesSquare, RotateCcw, ScanSearch, Settings, Share, ShieldCheck, Shuffle, SlidersHorizontal, Sparkles, Star, Trophy, Undo2 } from 'lucide-react';
import { eloLabel, MAX_ELO, MIN_ELO } from '../lib/bot';
import { povScore, scoreToCp, winPct } from '../lib/chess/evaluation';
import { safetyInfo } from '../lib/coach';
import { START_FEN } from '../lib/chess/game';
import { detectOpening } from '../lib/openings';
import { useNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { currentFen, turnOf, usePlay } from '../lib/store/play';
import { Board } from '../components/Board';
import { CoachBubble, FlagButton, Portrait } from '../components/Coach';
import { OPPONENTS, opponentById, type Mood } from '../lib/people';
import { LevelBadge } from '../components/Gamification';
import { tipOfTheDay, type Tip } from '../lib/coach/tips';
import { getOpponentRecords, isUnlocked, type OpponentRecord } from '../lib/people/record';
import { REPERTOIRES } from '../lib/people/openings';
import { Dialog, EvalBar, Header, IconButton, Segmented, Spinner, useBackHandler } from '../components/ui';
import { MoveList } from '../components/MoveList';
import type { CoachArrow, CoachHighlight } from '../lib/coach/types';
import type { FeedItem } from '../lib/store/types';
import { shortWords } from '../lib/chess/words';
import { MAX_STARS, starsOf } from '../lib/people/record';
import { challengeFor } from '../lib/people/challenges';
import { cosmeticById, type Cosmetic } from '../lib/rewards/cosmetics';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { BoardFlash } from '../components/BoardFlash';
import { Captured } from '../components/Captured';
import { RewardsOverlay } from '../components/RewardsOverlay';
import { needsHomeScreenHint } from '../lib/pwa';
import { THEMES } from '../lib/themes';
import { playSound } from '../lib/sound';

export function PlayScreen() {
  const phase = usePlay((s) => s.phase);
  const game = usePlay((s) => s.game);
  const away = usePlay((s) => s.away);
  if (phase === 'loading') return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (!game || phase === 'setup' || away) return <SetupView />;
  return <GameView />;
}

function SetupView() {
  const settings = useSettings();
  const newGame = usePlay((s) => s.newGame);
  const push = useNav((s) => s.push);
  const custom = settings.opponentId === 'custom';
  const [records, setRecords] = useState<Record<string, OpponentRecord>>({});
  useEffect(() => void getOpponentRecords().then(setRecords), []);
  const chosen = opponentById(settings.opponentId);
  const opp = custom ? null : chosen && isUnlocked(chosen.id, records) ? chosen : OPPONENTS[1];
  const rec = opp ? records[opp.id] : undefined;
  const running = usePlay((s) => (s.game && s.phase !== 'over' && s.phase !== 'setup' ? s.game : null));
  const start = async () => {
    const color = settings.colorPref === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.colorPref;
    // Starting over ends the game in progress (counts as resigned after a few moves).
    if (running) await usePlay.getState().abandon();
    newGame(color, opp ? opp.elo : settings.botElo, undefined, opp?.id);
  };
  return (
    <div className="flex h-full flex-col">
      <Header title="Play" right={<><LevelBadge /><SettingsButton /></>} />
      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto p-4">
        {running && <ResumeCard />}
        <HomeScreenHint />
        <TipOfTheDay />
        <div>
          <div className="mb-2 px-1 text-sm font-semibold text-stone-500">Choose your opponent</div>
          <div className="grid grid-cols-3 gap-2">
            {OPPONENTS.map((o, i) => {
              const open = isUnlocked(o.id, records);
              const stars = starsOf(records[o.id]);
              return (
                <button
                  key={o.id}
                  disabled={!open}
                  onClick={() => settings.set({ opponentId: o.id })}
                  className={`card relative flex flex-col items-center !p-2 transition ${opp?.id === o.id ? '!ring-2 !ring-brand-600' : ''}`}
                >
                  <Portrait id={o.id} size={56} mood={opp?.id === o.id ? 'happy' : 'neutral'} className={open ? '' : 'opacity-40 grayscale'} />
                  {!open && (
                    <span className="absolute top-9 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/75 text-white">
                      <Lock size={14} />
                    </span>
                  )}
                  <span className="mt-1 text-sm font-semibold leading-tight">{o.name}</span>
                  <span className="text-xs text-stone-500">{open ? o.elo : `Beat ${OPPONENTS[i - 1].name}`}</span>
                  {open && <Stars n={stars} of={MAX_STARS} size={10} />}
                </button>
              );
            })}
          </div>
          <button className={`mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${custom ? 'bg-brand-100 font-semibold text-brand-700 dark:bg-brand-700/30 dark:text-brand-100' : 'text-stone-500'}`} onClick={() => settings.set({ opponentId: 'custom' })}>
            <SlidersHorizontal size={16} /> Custom strength…
          </button>
        </div>
        {opp ? (
          <div className="card flex gap-3">
            <Portrait id={opp.id} size={64} />
            <div>
              <div className="font-bold">{opp.name} <span className="font-normal text-stone-500">· ~{opp.elo}</span></div>
              <div className="text-xs font-semibold text-brand-700 dark:text-brand-500">{opp.tagline}</div>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{opp.bio}</p>
              {REPERTOIRES[opp.id] && <p className="mt-1 text-xs text-stone-500"><BookOpen size={13} className="inline -mt-0.5" /> Favourite: {REPERTOIRES[opp.id].favourite}</p>}
              {rec && rec.w + rec.l + rec.d > 0 && (
                <p className="mt-0.5 text-xs text-stone-500">
                  Your record: {rec.w}W · {rec.d}D · {rec.l}L
                </p>
              )}
            </div>
          </div>
        ) : null}
        {opp ? (
          <ChallengeCard opponentId={opp.id} stars={starsOf(rec)} done={!!rec?.challengeDone} />
        ) : (
          <div className="card">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-stone-500">Bot strength</span>
              <span className="text-sm font-bold">
                ~{settings.botElo} <span className="font-normal text-stone-500">· {eloLabel(settings.botElo)}</span>
              </span>
            </div>
            <input type="range" min={MIN_ELO} max={MAX_ELO} step={50} value={settings.botElo} onChange={(e) => settings.set({ botElo: Number(e.target.value) })} className="w-full accent-brand-600" />
          </div>
        )}
        <div className="card space-y-3">
          <div>
            <div className="mb-2 text-sm font-semibold text-stone-500">You play</div>
            <Segmented
              value={settings.colorPref}
              onChange={(v) => settings.set({ colorPref: v })}
              options={[
                { value: 'w', label: <><span className="h-3.5 w-3.5 rounded-full bg-white ring-1 ring-stone-400" /> White</> },
                { value: 'b', label: <><span className="h-3.5 w-3.5 rounded-full bg-stone-900 ring-1 ring-stone-600" /> Black</> },
                { value: 'random', label: <><Shuffle size={15} /> Random</> },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-stone-500">Opponent style</div>
            <Segmented
              value={settings.opponentEngine}
              onChange={(v) => settings.set({ opponentEngine: v })}
              options={[
                { value: 'maia', label: <><Brain size={15} /> Human-like</> },
                { value: 'stockfish', label: <><Bot size={15} /> Classic</> },
              ]}
            />
            <p className="mt-1.5 px-1 text-xs text-stone-500">
              {settings.opponentEngine === 'maia'
                ? 'Plays like real people at that level (Maia AI, trained on millions of human games). Its mistakes are human mistakes.'
                : 'A chess engine made weaker with random slips. Often easier for complete beginners — it sometimes gives pieces away.'}
            </p>
          </div>
          <button className="btn-primary w-full !py-3 text-base" onClick={() => void start()}>
            {running ? 'Start a new game' : `Play ${opp ? opp.name : 'the bot'}`}
          </button>
          {running && <p className="-mt-1 text-center text-xs text-stone-500">This ends your game in progress.</p>}
        </div>
        <button className="btn-ghost w-full" onClick={() => push({ name: 'history' })}>
          <History size={17} /> Past games
        </button>
      </div>
    </div>
  );
}

/** On the menu while a game is running: jump back in. */
function ResumeCard() {
  const s = usePlay();
  const g = s.game!;
  const o = opponentById(g.opponentId);
  const moves = Math.ceil(g.plies.length / 2);
  return (
    <button className="card flex w-full items-center gap-3 !p-3 text-left ring-2 ring-brand-500 active:scale-[0.99]" onClick={() => s.setAway(false)}>
      {o ? <Portrait id={o.id} size={48} /> : <span className="flex h-12 w-12 items-center justify-center rounded-[30%] bg-stone-200 dark:bg-stone-800"><Bot size={24} /></span>}
      <span className="flex-1">
        <span className="block text-xs font-bold tracking-wider text-brand-700 uppercase dark:text-brand-500">Game in progress</span>
        <span className="block font-semibold">vs {o ? o.name : 'the bot'}</span>
        <span className="block text-xs text-stone-500">{moves ? `Move ${moves}` : 'Just started'} · tap to continue</span>
      </span>
      <span className="btn-primary !min-h-9 !px-4 !py-1.5">Continue</span>
    </button>
  );
}

export function SettingsButton() {
  const push = useNav((s) => s.push);
  return (
    <IconButton label="Settings" onClick={() => push({ name: 'settings' })}>
      <Settings size={21} strokeWidth={1.9} />
    </IconButton>
  );
}

/** Opponent's mood: their latest chat line, otherwise how the game is going for them. */
function useOpponentMood(): Mood {
  const s = usePlay();
  const g = s.game!;
  const lastEval = [...g.plies].reverse().find((p) => p.evalAfter)?.evalAfter;
  const botCp = lastEval ? scoreToCp(povScore(lastEval, g.userColor === 'w' ? 'b' : 'w')) : 0;
  const recent = s.chat && s.chat.ply >= g.plies.length - 1 ? s.chat : null;
  return recent ? recent.mood : botCp > 150 ? 'happy' : botCp < -150 ? 'worried' : 'neutral';
}

/** Slim top row: back to menu, opponent, opening name, game menu. */
function GameTopBar({ onMenu }: { onMenu: () => void }) {
  const s = usePlay();
  const g = s.game!;
  const o = opponentById(g.opponentId);
  const mood = useOpponentMood();
  const opening = useMemo(() => (g.startFen === START_FEN ? detectOpening(g.plies.map((p) => p.san)) : null), [g.plies, g.startFen]);
  const thinking = s.phase === 'botThinking';
  return (
    <header className="safe-top relative z-20">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-2 land:max-w-6xl">
        <IconButton label="Back to menu" onClick={() => s.setAway(true)}>
          <ChevronLeft size={24} strokeWidth={2.2} />
        </IconButton>
        <div className="relative">
          {o ? (
            <Portrait id={o.id} mood={mood} size={38} />
          ) : (
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[30%] bg-stone-200 text-stone-600 dark:bg-stone-800"><Bot size={20} /></span>
          )}
          {thinking && (
            <span className="absolute -right-1 -bottom-1 flex h-4 items-center gap-0.5 rounded-full bg-white px-1 shadow ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
              {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-stone-500" style={{ animationDelay: `${i * 120}ms` }} />)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold">
            {o ? o.name : 'Bot'} <span className="font-normal text-stone-400">{g.elo}</span>
          </div>
          <div className="truncate text-xs text-stone-500">{opening ? opening.name : thinking ? 'thinking…' : g.userColor === 'w' ? 'You play white' : 'You play black'}</div>
        </div>
        <Captured fen={currentFen(g)} startFen={g.startFen} side={g.userColor === 'w' ? 'b' : 'w'} className="shrink-0" />
        <IconButton label="Game menu" onClick={onMenu}>
          <EllipsisVertical size={21} />
        </IconButton>
      </div>
    </header>
  );
}

/** The opponent's latest line as a small speech bubble over the board; fades by itself. */
function ChatBubble() {
  const s = usePlay();
  const g = s.game!;
  const chat = s.chat && s.chat.ply >= g.plies.length - 1 && s.chat.text ? s.chat : null;
  if (!chat) return null;
  return (
    <div key={chat.text + chat.ply} className="animate-chat pointer-events-none absolute top-1.5 left-3 z-20 max-w-[78%]">
      <div className="relative rounded-2xl rounded-tl-sm bg-white/95 px-3 py-1.5 text-[13px] leading-snug shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-stone-800/95 dark:ring-white/10">
        {chat.text}
      </div>
    </div>
  );
}

function GameView() {
  const s = usePlay();
  const settings = useSettings();
  const push = useNav((n) => n.push);
  const [menu, setMenu] = useState(false);
  const [history, setHistory] = useState(false);
  const g = s.game!;
  const fen = currentFen(g);
  const orientation = g.userColor === 'w' ? 'white' : 'black';
  const last = g.plies[g.plies.length - 1];
  const myTurn = s.phase === 'userTurn' && turnOf(fen) === g.userColor;

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
    () => (settings.safetyOverlay && myTurn ? safetyInfo(fen, g.userColor) : null),
    [settings.safetyOverlay, myTurn, fen, g.userColor],
  );
  if (safety) {
    arrows.push(...safety.arrows);
    highlights.push(...safety.highlights);
  }

  const lastEval = [...g.plies].reverse().find((p) => p.evalAfter)?.evalAfter;
  const whitePct = lastEval ? winPct(povScore(lastEval, 'w')) : 50;
  const userPlies = g.plies.filter((p) => p.isUser).length;

  useEffect(() => {
    if (s.over) setMenu(false);
  }, [s.over]);
  // Android back button: return to the menu (the game stays saved).
  const setAway = s.setAway;
  const goAway = useCallback(() => setAway(true), [setAway]);
  useBackHandler(goAway);

  const whyNot = () => {
    const lastUser = [...g.plies].reverse().find((p) => p.isUser);
    push({ name: 'explore', fen: lastUser ? lastUser.fenBefore : fen, orientation, title: 'Why not this move?' });
  };
  const menuItem = (icon: ReactNode, label: string, onClick: () => void, extra?: ReactNode) => (
    <button
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold active:bg-stone-100 dark:active:bg-stone-800"
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
    <div className="flex h-full flex-col bg-gradient-to-b from-stone-100 to-[#efe7da] dark:from-stone-950 dark:to-[#1d1712]">
      <GameTopBar onMenu={() => setMenu(true)} />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col land:max-w-6xl land:flex-row land:gap-5 land:px-3">
        <div className="land:w-[min(calc(100dvh-6rem),58vw)] land:shrink-0">
          <div className="flex gap-1.5 px-2">
            {settings.showEvalBar && <EvalBar whitePct={whitePct} orientation={orientation} />}
            <div className="relative flex-1">
              <ChatBubble />
              <BoardFlash flash={s.flash} orientation={orientation} />
              <Board
                fen={fen}
                orientation={orientation}
                movable={myTurn ? g.userColor : null}
                onMove={s.userMove}
                arrows={arrows}
                highlights={highlights}
                lastMove={last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null}
                showCoordinates={settings.showCoordinates}
                confirm={settings.confirmMoves}
              />
            </div>
          </div>
          <div className="flex h-7 items-center px-3">
            <Captured fen={fen} startFen={g.startFen} side={g.userColor} />
          </div>
          {settings.showMoveList && <MoveList plies={g.plies} startFen={g.startFen} />}
        </div>
        <div className="flex min-h-0 flex-1 flex-col land:pt-1">
          {/* The coach sits just above the dock (Dr. Wolf style), close to the thumb; it scrolls if long. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3 pb-2">
            <div className="mt-auto" />
            <CoachCard safetyMessages={safety?.messages ?? []} onHistory={() => setHistory(true)} />
          </div>
          {!s.over && (
            <div className="safe-bottom px-3 pb-2">
              <div className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-[22px] bg-white/90 p-1.5 shadow-[0_6px_24px_rgba(60,35,15,0.12)] ring-1 ring-black/5 backdrop-blur dark:bg-stone-900/90 dark:ring-white/10">
                <DockButton label={s.hint ? `Hint ${s.hint.level}/3` : 'Hint'} icon={<Lightbulb size={22} />} disabled={!myTurn || s.hint?.level === 3} onClick={s.requestHint} primary />
                <DockButton label="Take back" icon={<Undo2 size={22} />} disabled={userPlies === 0 || !['userTurn', 'paused', 'botThinking'].includes(s.phase)} onClick={s.takeback} />
                <DockButton label="Threats" icon={<Crosshair size={22} />} disabled={!myTurn} onClick={s.requestThreat} />
                <DockButton label="More" icon={<EllipsisVertical size={22} />} onClick={() => setMenu(true)} />
              </div>
            </div>
          )}
        </div>
      </div>
      {s.rewards && (
        <RewardsOverlay
          r={s.rewards}
          onClose={s.closeRewards}
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
          {!s.over && menuItem(<ScanSearch size={19} />, 'Why not my move?', whyNot)}
          {menuItem(<Sparkles size={19} />, 'Explain this position', () => void s.requestExplain())}
          {menuItem(<MessagesSquare size={19} />, 'Conversation', () => setHistory(true))}
          {menuItem(<ShieldCheck size={19} />, 'Safety overlay', () => settings.set({ safetyOverlay: !settings.safetyOverlay }), onOff(settings.safetyOverlay))}
          {menuItem(<ListOrdered size={19} />, 'Move list', () => settings.set({ showMoveList: !settings.showMoveList }), onOff(settings.showMoveList))}
          {!s.over && menuItem(<Flag size={19} />, 'Resign', () => void s.resign())}
          {menuItem(<RotateCcw size={19} />, 'New game', () => void (s.over ? s.leaveGame() : s.abandon()))}
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

function DockButton({ label, icon, onClick, disabled, primary }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-30 ${
        primary ? 'text-amber-600 dark:text-amber-400' : 'text-stone-700 dark:text-stone-200'
      }`}
    >
      <span className="flex h-6 items-center">{icon}</span>
      {label}
    </button>
  );
}

const FEED_LABEL: Partial<Record<FeedItem['kind'], { label: string; icon: ReactNode }>> = {
  opening: { label: 'Opening', icon: <BookOpen size={12} /> },
  hint: { label: 'Hint', icon: <Lightbulb size={12} /> },
  threat: { label: 'Threats', icon: <Crosshair size={12} /> },
  takeback: { label: 'Take-back', icon: <Undo2 size={12} /> },
  explain: { label: 'The position', icon: <ScanSearch size={12} /> },
  note: { label: 'Watch out', icon: <ShieldCheck size={12} /> },
  result: { label: 'Game over', icon: <Flag size={12} /> },
};

// Messages already typed out (or already there when the game was opened) appear in full.
const typed = new Set<string>();
const typedGames = new Set<number>();

/** Marks the messages a game already has as read, so only new ones are typed out. */
function useTypedBaseline(startedAt: number, feed: FeedItem[]) {
  if (typedGames.has(startedAt)) return;
  typedGames.add(startedAt);
  for (const it of feed) typed.add(`${startedAt}:${it.id}`);
}

/** Reveals a message word by word with a soft tick; tap to show it all. Returns words shown so far. */
function useTypewriter(key: string, total: number, enabled: boolean) {
  const [fresh] = useState(() => enabled && !typed.has(key) && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [shown, setShown] = useState(fresh ? 0 : total);
  useEffect(() => {
    typed.add(key);
    if (!fresh) return;
    let n = 0;
    const t = setInterval(() => {
      n++;
      setShown(n);
      if (n % 2 === 1) playSound('type');
      if (n >= total) clearInterval(t);
    }, 55);
    return () => clearInterval(t);
  }, [key, fresh, total]);
  return { shown, skip: () => setShown(total) };
}

/** One coach message (used for the current card and in the conversation sheet). */
function FeedBubble({ it, compact, actions, flag, type }: { it: FeedItem; compact?: boolean; actions?: ReactNode; flag?: boolean; type?: boolean }) {
  const g = usePlay((s) => s.game)!;
  const p = it.ply >= 0 ? g.plies[it.ply] : undefined;
  const words = useMemo(() => it.text.map((t) => t.split(' ')), [it.text]);
  const total = words.reduce((n, w) => n + w.length, 0);
  const { shown, skip } = useTypewriter(`${g.startedAt}:${it.id}`, total, !!type);
  let index = 0;
  return (
    <CoachBubble compact={compact} {...FEED_LABEL[it.kind]} mood={it.mood ?? 'happy'} badge={it.classification} special={it.special} actions={actions}>
      {it.kind === 'comment' && p && <p className="text-xs font-semibold text-stone-500">You: {shortWords(p.fenBefore, p.uci)}</p>}
      <div className="space-y-1" onClick={shown < total ? skip : undefined}>
        {words.map((line, i) => (
          <p key={i} className={it.kind === 'opening' && i === 0 ? 'font-display text-[17px] font-semibold' : ''}>
            {/* Every word is laid out from the start (hidden ones invisible) so the card never jumps in size. */}
            {line.map((w, j) => (
              <span key={j} className={`transition-opacity duration-200 ${index++ < shown ? '' : 'opacity-0'}`}>
                {j ? ' ' : ''}
                {w}
              </span>
            ))}
          </p>
        ))}
      </div>
      {flag && it.kind === 'comment' && p?.comment && it.classification !== 'best' && it.classification !== 'good' && <FlagButton fen={p.fenBefore} uci={p.uci} comment={p.comment} />}
    </CoachBubble>
  );
}

/** Coach Sam's current message only — the conversation so far is one tap away. */
function CoachCard({ safetyMessages, onHistory }: { safetyMessages: string[]; onHistory: () => void }) {
  const s = usePlay();
  const push = useNav((n) => n.push);
  const settings = useSettings();
  const g = s.game!;
  const feed = g.feed ?? [];
  const latest = feed[feed.length - 1];
  const paused = s.phase === 'paused';
  const rematch = () => s.newGame(g.userColor, g.elo, undefined, g.opponentId);
  const earlier = feed.length - 1;
  useTypedBaseline(g.startedAt, feed);

  let card: ReactNode;
  if (s.precheck) {
    card = (
      <CoachBubble
        mood="concerned"
        label="Before you move"
        icon={<ShieldCheck size={12} />}
        actions={
          <>
            <button className="btn-primary" onClick={s.dismissPrecheck}>Let me think again</button>
            {!s.precheck.revealed && <button className="btn-secondary" onClick={s.revealPrecheck}>Show me why</button>}
            <button className="btn-ghost" onClick={s.confirmPrecheck}>Play it anyway</button>
          </>
        }
      >
        <p>{s.precheck.check.ask}</p>
        {s.precheck.revealed && <p className="font-semibold">{s.precheck.check.reveal}</p>}
      </CoachBubble>
    );
  } else if (latest) {
    const actions =
      paused && latest.kind === 'comment' ? (
        <>
          <button className="btn-primary" onClick={s.tryAgain}>Try again</button>
          <button className="btn-secondary" onClick={s.continueGame}>Continue</button>
        </>
      ) : s.over && latest.kind === 'result' ? (
        <>
          {s.over.practice && (
            <button className="btn-primary" onClick={() => push({ name: 'practice', theme: s.over!.practice! })}>
              Practise: {THEMES[s.over.practice].label.toLowerCase()}
            </button>
          )}
          {s.over.gameId > 0 && (
            <button className={s.over.practice ? 'btn-secondary' : 'btn-primary'} onClick={() => push({ name: 'report', gameId: s.over!.gameId })}>Game report</button>
          )}
          <button className="btn-secondary" onClick={rematch}>Rematch</button>
          <button className="btn-ghost" onClick={s.leaveGame}>New opponent</button>
        </>
      ) : undefined;
    card = <FeedBubble key={latest.id} it={latest} actions={actions} flag type />;
  }

  return (
    <div className="space-y-2">
      {card}
      {!s.precheck && safetyMessages.length > 0 && settings.safetyOverlay && (
        <p className="flex items-start gap-1.5 px-1 text-[13px] text-stone-600 dark:text-stone-300">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-600" />
          {safetyMessages.join(' ')}
        </p>
      )}
      <div className="flex items-center justify-between px-1 text-xs text-stone-500">
        <span className="flex items-center gap-1.5">
          {s.phase === 'analyzing' ? (
            <>
              <Spinner className="!h-3 !w-3" /> Coach Sam is looking at your move…
            </>
          ) : s.phase === 'userTurn' && !s.precheck ? (
            'Your move'
          ) : null}
        </span>
        {earlier > 0 && (
          <button className="flex items-center gap-1 font-semibold text-stone-500 active:text-stone-800" onClick={onHistory}>
            <MessagesSquare size={14} /> {earlier} earlier
          </button>
        )}
      </div>
    </div>
  );
}

/** The whole conversation of this game (newest at the bottom). */
function CoachHistory() {
  const g = usePlay((s) => s.game)!;
  const feed = g.feed ?? [];
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), []);
  return (
    <div className="space-y-2.5">
      {feed.map((it, k) => (
        <FeedBubble key={it.id} it={it} compact={k < feed.length - 1} />
      ))}
      <div ref={end} />
    </div>
  );
}

export function resultFor(result: string, userColor: 'w' | 'b') {
  const userResult = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (userColor === 'w') ? 'win' : 'loss';
  return { userResult };
}

function TipOfTheDay() {
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => void tipOfTheDay().then(setTip), []);
  if (!tip) return null;
  return (
    <CoachBubble label={tip.personal ? 'Coach Sam · just for you' : 'Coach Sam · tip of the day'} icon={<Sparkles size={12} />}>
      <p>{tip.text}</p>
    </CoachBubble>
  );
}

export function Stars({ n, size = 12, of = 3 }: { n: number; size?: number; of?: number }) {
  return (
    <span className="mt-0.5 flex gap-0.5">
      {Array.from({ length: of }, (_, i) => i).map((i) => (
        <Star key={i} size={size} className={i < n ? 'fill-gold-400 text-gold-500' : 'text-stone-300 dark:text-stone-600'} />
      ))}
    </span>
  );
}

/** iPhone Safari: how to install the app on the home screen (once dismissed, gone for good). */
function HomeScreenHint() {
  const [show, setShow] = useState(() => {
    try {
      return needsHomeScreenHint() && localStorage.getItem('homeHintDismissed') !== '1';
    } catch {
      return needsHomeScreenHint();
    }
  });
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem('homeHintDismissed', '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  return (
    <CoachBubble label="Coach Sam · tip" icon={<Sparkles size={12} />} actions={<button className="btn-secondary" onClick={dismiss}>Got it</button>}>
      <p className="font-semibold">Put me on your home screen!</p>
      <p>
        Tap the <Share size={15} className="mx-0.5 inline -translate-y-0.5" /> <b>Share</b> button in Safari, then <b>Add to Home Screen</b>. I'll open like a real app, work
        offline, and your progress stays safe.
      </p>
    </CoachBubble>
  );
}

/** The opponent's special challenge: opens with all 5 stars, rewards something unique. */
function ChallengeCard({ opponentId, stars, done }: { opponentId: string; stars: number; done: boolean }) {
  const ch = challengeFor(opponentId);
  if (!ch) return null;
  const open = stars >= MAX_STARS;
  const rewards = ch.rewards.map((id) => cosmeticById(id)).filter((c): c is Cosmetic => !!c);
  return (
    <div className={`card relative overflow-hidden !p-3 ${open && !done ? 'ring-2 ring-gold-400' : ''}`}>
      {open && !done && <span className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-gold-300/40 blur-2xl" />}
      <div className="relative flex items-center gap-3">
        <div className="flex -space-x-3">
          {rewards.map((c) => (
            <div key={c.id} className={open ? '' : 'opacity-60 grayscale-[0.6]'}>
              <CosmeticPreview c={c} size={44} />
            </div>
          ))}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-[11px] font-bold tracking-wider text-gold-500 uppercase">
            {done ? <Check size={12} strokeWidth={3} /> : open ? <Trophy size={12} /> : <Lock size={12} />} Special challenge
          </div>
          <div className="font-semibold leading-tight">{open ? ch.title : `${stars} of ${MAX_STARS} stars`}</div>
          <div className="text-xs text-stone-500">
            {done
              ? `Done! You won: ${rewards.map((c) => c.name).join(' + ')}.`
              : open
                ? `${ch.description} Reward: ${rewards.map((c) => c.name).join(' + ')}.`
                : `Each win earns a star. With all ${MAX_STARS}, a special challenge opens.`}
          </div>
        </div>
      </div>
      {!open && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
          <div className="h-full rounded-full bg-gold-400" style={{ width: `${(stars / MAX_STARS) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
