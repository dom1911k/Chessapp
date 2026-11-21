import { RivalryCard, RivalryChip } from '../components/Rivalry';
import { rematchLabel } from '../lib/rematch';
import { TurningPrompt } from '../components/TurningCards';
import { Dock, DockButton } from '../components/Dock';
import { courseLevel, courseState } from '../lib/course';
import { kvGet } from '../lib/db';
import { useRunFlag } from '../cups/flag';
import { TUNING as CUPS_T } from '../cups/tuning';
import { UserAvatar, useMyName } from '../components/UserAvatar';
import { getRating as getPuzzleRating } from '../lib/puzzles/rating';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Clock as ClockIcon, Flame, FlipVertical2, Puzzle, CalendarCheck, ChevronRight, Timer, Swords, BookOpen, Bot, Brain, Check, ChevronLeft, Crosshair, EllipsisVertical, Flag, History, Lightbulb, ListOrdered, Lock, MessageCircleHeart, MessagesSquare, RotateCcw, ScanSearch, Settings, Share, ShieldCheck, Shuffle, SlidersHorizontal, Dumbbell, Sparkles, Star, Trophy, Undo2, Users } from 'lucide-react';
import { eloLabel, MAX_ELO, MIN_ELO } from '../lib/bot';
import { getSparring, sparringStep, type SparringState } from '../lib/sparring';
import { getPlayerRating } from '../lib/playerRating';
import { ScaleNews } from '../components/ScaleNews';
import { onChange } from '../lib/changes';
import { formatScore, povScore, scoreToCp, winPct } from '../lib/chess/evaluation';
import { safetyInfo } from '../lib/coach';
import { START_FEN } from '../lib/chess/game';
import { detectOpening } from '../lib/openings';
import { useNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { currentFen, turnOf, usePlay } from '../lib/store/play';
import { Board } from '../components/Board';
import { CoachBubble, FlagButton, Portrait } from '../components/Coach';
import { OPPONENTS, opponentById, portraitColors, type Mood } from '../lib/people';
import { getOpponentRecords, isUnlocked, type OpponentRecord } from '../lib/people/record';
import { Dialog, EvalBar, IconButton, Segmented, Spinner, useBackHandler } from '../components/ui';
import { MoveList } from '../components/MoveList';
import { MoveHistory } from '../components/MoveHistory';
import type { CoachArrow, CoachHighlight } from '../lib/coach/types';
import type { FeedItem, PlyRecord } from '../lib/store/types';
import { MAX_STARS, starsOf } from '../lib/people/record';
import { challengeFor } from '../lib/people/challenges';
import { cosmeticById, type Cosmetic } from '../lib/rewards/cosmetics';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { BoardFlash } from '../components/BoardFlash';
import { Captured } from '../components/Captured';
import { WeekRing } from '../components/Gamification';
import { currentWinStreak } from '../lib/stats';
import { LastChessComGames } from '../components/ChessCom';
import { dueCount } from '../lib/store/daily';
import { ReviewIcon } from '../components/ReviewIcon';
import { RC, type ReviewClass } from '../lib/review';
import { formatLine, lineToSan } from '../lib/chess/game';
import { db } from '../lib/db';
import { defaultMatchTc, fmtClock, lowTime, mostCommonTimeControl, offeredTimeControls, timeLeft } from '../lib/clock';
import { timeControlLabel } from '../lib/chesscom/parse';
import { COACH_LEVELS, aidsFor, nextLevel, stepDownSuggestion } from '../lib/coach/level';
import { HomeHero } from '../components/HomeHero';
import { VersusIntro } from '../components/VersusIntro';
import { OpponentCarousel } from '../components/OpponentCarousel';
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

const sparringTagline = (s: SparringState | null) => (s && s.games ? `Keeps you near 50% · ${s.w}W ${s.d}D ${s.l}L` : 'Its rating follows yours, game by game');

function SetupView() {
  const settings = useSettings();
  const newGame = usePlay((s) => s.newGame);
  const custom = settings.opponentId === 'custom';
  // The sparring partner: its rating follows yours to keep games near 50%.
  const sparring = settings.opponentId === 'sparring';
  const [spar, setSpar] = useState<SparringState | null>(null);
  const phaseNow = usePlay((s) => s.phase);
  useEffect(() => void getSparring(getPlayerRating()).then(setSpar), [phaseNow]);
  const [records, setRecords] = useState<Record<string, OpponentRecord>>({});
  useEffect(() => {
    void getOpponentRecords().then(setRecords);
    // Reload when records change elsewhere (a game finished, a reset in Settings).
    return onChange('records', () => void getOpponentRecords().then(setRecords));
  }, []);
  const chosen = opponentById(settings.opponentId) ?? (custom || sparring ? undefined : OPPONENTS[1]);
  const opp = custom || sparring ? null : chosen ?? null;
  const botElo = opp ? opp.elo : sparring ? spar?.rating ?? getPlayerRating() : settings.botElo;
  // Match conditions: any opponent from the ladder, no rating gate.
  const match = settings.matchMode;
  const locked = !match && !!opp && !isUnlocked(opp.id, records);
  const [ccTc, setCcTc] = useState<string | null>(null);
  useEffect(() => void db.imported.toArray().then((gs) => setCcTc(mostCommonTimeControl(gs))), []);
  const matchTc = defaultMatchTc(settings.matchTimeControl, ccTc);
  const prevName = opp ? OPPONENTS[OPPONENTS.indexOf(opp) - 1]?.name : undefined;
  const rec = opp ? records[opp.id] : undefined;
  const running = usePlay((s) => (s.game && s.phase !== 'over' && s.phase !== 'setup' ? s.game : null));
  // Wins in a row against the bots (refreshed whenever the menu shows again).
  const [winRun, setWinRun] = useState(0);
  const away = usePlay((s) => s.phase);
  useEffect(() => void currentWinStreak().then(setWinRun), [away]);
  const start = async () => {
    if (locked) return;
    const color = settings.colorPref === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.colorPref;
    // Starting over ends the game in progress (counts as resigned after a few moves).
    if (running) await usePlay.getState().abandon();
    newGame(color, botElo, undefined, opp?.id, { ...(match ? { match: true, timeControl: matchTc } : { timeControl: settings.coachedTimeControl || undefined }), sparring });
  };
  const [sheet, setSheet] = useState<'opponent' | 'options' | null>(null);
  const tc = match ? matchTc : settings.coachedTimeControl;
  const stars = starsOf(rec);
  const colorLabel = settings.colorPref === 'w' ? 'White' : settings.colorPref === 'b' ? 'Black' : 'Random colour';
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <HomeHero right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 p-4">
        <ScaleNews />
        <TurningPrompt />
        {running && <ResumeCard />}
        <HomeScreenHint />
        {!match && <StepDownCard />}
        {/* The one card that starts a game. */}
        <div className="card space-y-3 overflow-hidden !p-0 !pb-3">
          <button
            className="relative flex w-full items-center gap-3.5 px-3.5 pt-3.5 pb-3 text-left transition-[filter] duration-100 active:brightness-95"
            style={{ background: opp ? `linear-gradient(115deg, color-mix(in srgb, ${portraitColors(opp.id)[1]} 34%, transparent), color-mix(in srgb, ${portraitColors(opp.id)[0]} 10%, transparent))` : undefined }}
            onClick={() => setSheet('opponent')}
          >
            {opp ? <Portrait id={opp.id} size={84} className="ring-2 ring-white/80 dark:ring-white/20" /> : <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[8px] bg-stone-200 dark:bg-stone-800">{sparring ? <Dumbbell size={36} /> : <Bot size={36} />}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold tracking-[0.1em] text-stone-500 uppercase dark:text-stone-400">Your opponent</span>
              <span className="block truncate font-display text-[22px] leading-tight font-semibold">{opp ? opp.name : sparring ? 'Sparring partner' : 'Custom bot'}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded-md bg-stone-900/85 px-1.5 py-px text-xs font-bold text-white tabular-nums dark:bg-white/90 dark:text-stone-900">{botElo}</span>
                {opp && <Stars n={stars} of={MAX_STARS} size={12} />}
                {opp && <RivalryChip rec={rec} />}
              </span>
              <span className="mt-0.5 block truncate text-xs text-stone-600 dark:text-stone-400">{opp ? opp.tagline : sparring ? sparringTagline(spar) : eloLabel(settings.botElo)}</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-stone-700 shadow-sm dark:bg-white/10 dark:text-stone-200" aria-label="Change opponent"><ChevronRight size={18} /></span>
          </button>
          <div className="space-y-3 px-3">
          <Segmented
            value={match ? 'match' : 'coached'}
            onChange={(v) => settings.set({ matchMode: v === 'match' })}
            options={[
              { value: 'coached', label: <><MessageCircleHeart size={15} /> Coached</> },
              { value: 'match', label: <><Swords size={15} /> Match conditions</> },
            ]}
          />
          <button className="flex w-full flex-wrap items-center gap-1.5 rounded-2xl p-1 text-left active:bg-stone-100 dark:active:bg-stone-800" onClick={() => setSheet('options')}>
            <span className="chip bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
              {settings.colorPref === 'random' ? <Shuffle size={12} /> : <span className={`h-3 w-3 rounded-full ring-1 ${settings.colorPref === 'w' ? 'bg-white ring-stone-400' : 'bg-stone-900 ring-stone-600'}`} />} {colorLabel}
            </span>
            <span className="chip bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200"><Timer size={12} /> {tc ? timeControlLabel(tc) : 'No clock'}</span>
            <span className="chip bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">{settings.opponentEngine === 'maia' ? <><Brain size={12} /> Human-like</> : <><Bot size={12} /> Classic</>}</span>
            {!match && <span className="chip bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">Coach: {COACH_LEVELS.find((l) => l.id === settings.coachLevel)?.label}</span>}
            <span className="ml-auto text-sm font-semibold text-brand-700 dark:text-brand-500">Options</span>
          </button>
          {match && <p className="px-1 text-xs text-stone-500">Like a real chess.com game: clock on, no help until it ends — then the full Game Review.</p>}
          {winRun >= 2 && (
            <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 px-3 py-2 text-sm ring-1 ring-orange-200/70 dark:from-orange-500/10 dark:to-rose-500/10 dark:ring-orange-500/20">
              <Flame size={18} className={`animate-flame ${winRun >= 5 ? 'fill-rose-400 text-rose-500' : 'fill-orange-400 text-orange-500'}`} />
              <span className="flex-1"><b>{winRun} wins in a row</b> <span className="text-stone-500">— keep it going!</span></span>
            </div>
          )}
          <button className="btn-primary w-full !rounded-[18px] !py-4 font-display text-xl" disabled={locked} onClick={() => void start()}>
            {locked ? <><Lock size={16} /> Beat {prevName} first</> : running ? 'Start a new game' : 'Play'}
          </button>
          {running && <p className="-mt-1 text-center text-xs text-stone-500">This ends your game in progress.</p>}
          </div>
        </div>
        {opp && !locked && stars >= MAX_STARS && !rec?.challengeDone && <ChallengeCard opponentId={opp.id} stars={stars} done={false} />}
        {opp && !locked && <RivalryCard opponentId={opp.id} rec={rec} />}
        <WeekRing />
        <HomeLinks />
        <LastChessComGames />
      </div>
      <Dialog open={sheet === 'opponent'} onClose={() => setSheet(null)} title="Choose your opponent">
        <div className="-mx-4">
          {!custom && !sparring && <OpponentCarousel records={records} allOpen={match} selected={settings.opponentId} onSelect={(id) => settings.set({ opponentId: id })} />}
        </div>
        {custom && (
          <div className="py-2">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="section-title">Bot strength</span>
              <span className="text-sm font-bold">{settings.botElo} <span className="font-normal text-stone-500">· {eloLabel(settings.botElo)}</span></span>
            </div>
            <input type="range" min={MIN_ELO} max={MAX_ELO} step={50} value={settings.botElo} onChange={(e) => settings.set({ botElo: Number(e.target.value) })} className="w-full accent-brand-600" />
          </div>
        )}
        {sparring && (
          <div className="space-y-1.5 py-2">
            <div className="flex items-baseline justify-between">
              <span className="section-title">Sparring partner</span>
              <span className="text-sm font-bold">{botElo}</span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Its rating moves after every game to keep you near 50%: up {sparringStep(spar?.games ?? 0)} when you win, down {sparringStep(spar?.games ?? 0)} when you lose{(spar?.games ?? 0) < 10 ? ' (smaller steps once it knows you)' : ''}.
            </p>
            {spar && spar.games > 0 && <p className="text-xs font-semibold text-stone-500">{spar.w}W · {spar.d}D · {spar.l}L in {spar.games} game{spar.games === 1 ? '' : 's'}</p>}
          </div>
        )}
        {!sparring && <p className="mt-2 px-1 text-xs text-stone-500">Ratings are chess.com rapid ratings: each bot plays like real chess.com players at its rating.</p>}
        {opp && !locked && stars < MAX_STARS && <ChallengeCard opponentId={opp.id} stars={stars} done={!!rec?.challengeDone} />}
        <div className="mt-3 flex gap-2">
          {!sparring && (
            <button className="btn-ghost flex-1 text-sm" onClick={() => settings.set({ opponentId: custom ? OPPONENTS[1].id : 'custom' })}>
              <SlidersHorizontal size={14} /> {custom ? 'Opponents' : 'Custom'}
            </button>
          )}
          <button className="btn-ghost flex-1 text-sm" onClick={() => settings.set({ opponentId: sparring ? OPPONENTS[1].id : 'sparring' })}>
            <Dumbbell size={14} /> {sparring ? 'Opponents' : 'Sparring'}
          </button>
          <button className="btn-primary flex-1" onClick={() => setSheet(null)}>Done</button>
        </div>
      </Dialog>
      <Dialog open={sheet === 'options'} onClose={() => setSheet(null)} title="Game options">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 section-title">You play</div>
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
            <div className="mb-1.5 section-title">Clock</div>
            {match ? (
              <TimeControlPicker value={matchTc} options={offeredTimeControls(ccTc)} onChange={(v) => settings.set({ matchTimeControl: v })} mine={ccTc} />
            ) : (
              <TimeControlPicker value={settings.coachedTimeControl || 'off'} options={['off', ...offeredTimeControls(ccTc)]} onChange={(v) => settings.set({ coachedTimeControl: v === 'off' ? '' : v })} mine={ccTc} />
            )}
          </div>
          <div>
            <div className="mb-1.5 section-title">Opponent style</div>
            <Segmented
              value={settings.opponentEngine}
              onChange={(v) => settings.set({ opponentEngine: v })}
              options={[
                { value: 'maia', label: <><Brain size={15} /> Human-like</> },
                { value: 'stockfish', label: <><Bot size={15} /> Classic</> },
              ]}
            />
            <p className="mt-1.5 px-1 text-xs text-stone-500">
              {settings.opponentEngine === 'maia' ? 'Plays like real people at that level (Maia). Its mistakes are human mistakes.' : 'An engine made weaker with random slips.'}
            </p>
          </div>
          {!match && (
            <div>
              <div className="mb-1.5 section-title">Coach</div>
              <Segmented value={settings.coachLevel} onChange={(v) => settings.set({ coachLevel: v, coachLevelSince: Date.now() })} options={COACH_LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
              <p className="mt-1.5 px-1 text-xs text-stone-500">{COACH_LEVELS.find((l) => l.id === settings.coachLevel)?.text}</p>
            </div>
          )}
          <button className="btn-primary w-full" onClick={() => setSheet(null)}>Done</button>
        </div>
      </Dialog>
    </div>
  );
}

/** Quiet links under the Play card, chess.com style: training due, past games. */
function HomeLinks() {
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const [due, setDue] = useState(0);
  const [pz, setPz] = useState<number | null>(null);
  useEffect(() => void dueCount().then(setDue), []);
  useEffect(() => void getPuzzleRating().then((r) => setPz(r.rating)), []);
  const [lvl, setLvl] = useState<ReturnType<typeof courseLevel> | null>(null);
  const tabNow = useNav((st) => st.tab);
  useEffect(() => {
    if (tabNow === 'play') void courseState().then((c) => setLvl(courseLevel(c)));
  }, [tabNow]);
  // A cup in progress: say what is waiting (refreshed when you come back from a game).
  const [cupLine, setCupLine] = useState<string | null>(null);
  const phase = usePlay((st) => st.phase);
  const cupsOn = useRunFlag((f) => f.enabled);
  // A cup in progress: say which round is waiting (read straight from storage, no Cups code loaded).
  useEffect(() => void kvGet<{ v?: number; tier: string; rounds: string[][]; place?: string } | null>('cupState', null).then((c) => setCupLine(c && c.v === 2 && !c.place ? `${CUPS_T.ladder.tiers.find((t) => t.id === c.tier)?.name}: your ${['quarter-final', 'semi-final', 'final'][c.rounds.length - 1] ?? 'next match'} is waiting` : null)), [phase]);
  const tile = (icon: ReactNode, tone: string, title: string, sub: ReactNode, onClick: () => void, badge?: ReactNode) => (
    <button className="card tile relative flex flex-col items-start gap-2 !p-3.5 text-left" onClick={onClick}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-[14px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_12px_-6px_rgba(0,0,0,0.4)] ${tone}`}>{icon}</span>
      <span className="block leading-tight">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-stone-500">{sub}</span>
      </span>
      {badge && <span className="absolute top-3 right-3">{badge}</span>}
    </button>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {tile(<Puzzle size={20} />, 'bg-gradient-to-br from-orange-400 to-rose-500', 'Puzzles', pz === null ? 'Solve and climb' : <>Rating <b className="text-stone-700 tabular-nums dark:text-stone-200">{pz}</b></>, () => push({ name: 'puzzle', mode: { kind: 'rated' } }))}
      {tile(<CalendarCheck size={20} />, 'bg-gradient-to-br from-sky-400 to-indigo-500', 'Daily training', due ? `${due} to review today` : 'Picked for your weak spots', () => push({ name: 'daily' }), due ? <span className="chip bg-red-500 text-white">{due}</span> : null)}
      {tile(<BookOpen size={20} />, 'bg-gradient-to-br from-emerald-400 to-teal-600', 'Course', lvl ? <>Level <b className="text-stone-700 tabular-nums dark:text-stone-200">{lvl.level}</b> · {lvl.stepsDone}/{lvl.steps} done</> : 'Learn step by step', () => setTab('learn'))}
      {tile(<History size={20} />, 'bg-gradient-to-br from-violet-400 to-purple-600', 'Past games', 'Reviews of your games', () => push({ name: 'history' }))}
      {cupsOn && <button className="card tile col-span-2 flex items-center gap-3 !p-3.5 text-left" onClick={() => setTab('run')}>
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-amber-300 to-amber-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_12px_-6px_rgba(0,0,0,0.4)]"><Trophy size={20} /></span>
        <span className="flex-1 leading-tight">
          <span className="block font-semibold">Cups</span>
          <span className="mt-0.5 block text-xs text-stone-500">{cupLine ?? 'Knockout tournaments in the Cups tab'}</span>
        </span>
        <ChevronRight size={18} className="text-stone-400" />
      </button>}
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
    <button className="card tile flex w-full items-center gap-3 !p-3 text-left ring-2 ring-brand-500 active:scale-[0.99]" onClick={() => s.setAway(false)}>
      {o ? <Portrait id={o.id} size={48} /> : <span className="flex h-12 w-12 items-center justify-center rounded-md bg-stone-200 dark:bg-stone-800"><Bot size={24} /></span>}
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

/** A player bar above or below the board, chess.com style: avatar, name (rating), material, clock. */
function PlayerBar({ me }: { me: boolean }) {
  const s = usePlay();
  const g = s.game!;
  const o = opponentById(g.opponentId);
  const mood = useOpponentMood();
  const side = me ? g.userColor : g.userColor === 'w' ? 'b' : 'w';
  const thinking = !me && s.phase === 'botThinking';
  const myName = useMyName();
  const rating = me ? getPlayerRating() : g.elo;
  return (
    <div className="flex h-11 items-center gap-2 px-2">
      <span className="relative">
        {me ? (
          <UserAvatar size={36} />
        ) : o ? (
          <Portrait id={o.id} mood={mood} size={36} />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-stone-200 text-stone-600 dark:bg-stone-800"><Bot size={18} /></span>
        )}
        {thinking && (
          <span className="absolute -right-1 -bottom-1 flex h-3.5 items-center gap-0.5 rounded-[4px] bg-white px-1 shadow-[0_1px_2px_rgba(0,0,0,0.25)] dark:bg-stone-800" aria-label="Thinking">
            {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-stone-500 dark:bg-stone-300" style={{ animationDelay: `${i * 120}ms` }} />)}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[14px] font-bold">
          {me ? myName : o ? o.name : g.rematch ? rematchLabel(g.rematch.name) : g.sparring ? 'Sparring partner' : 'Bot'}{' '}
          <span className="text-[13px] font-medium text-stone-500 tabular-nums">({rating})</span>
        </div>
        <Captured fen={currentFen(g)} startFen={g.startFen} side={side} />
      </div>
      {g.clock && <ClockFace side={side} />}
    </div>
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
      <div className="relative rounded-[10px] rounded-tl-[3px] bg-white px-3 py-1.5 text-[13px] leading-snug font-medium text-[#312e2b] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
        {chat.text}
      </div>
    </div>
  );
}

/** Same opponent, colour, strength, time control and mode (match or coached). */
function rematch(s: ReturnType<typeof usePlay.getState>) {
  const g = s.game!;
  s.newGame(g.userColor, g.elo, undefined, g.opponentId, g.match ? { match: true, timeControl: g.timeControl } : { timeControl: g.timeControl });
}

function GameView() {
  const s = usePlay();
  const settings = useSettings();
  const push = useNav((n) => n.push);
  const [menu, setMenu] = useState(false);
  const [history, setHistory] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [overMenu, setOverMenu] = useState(false);
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
  const viewPly = viewing && view! >= 0 ? g.plies[view!] : null;
  const aids = aidsFor(settings, g);
  // Match conditions and the quieter coach levels show the move list in the coach's place.
  const coachOff = !aids.comments;
  const feed = g.feed ?? [];
  const latestFeed = feed[feed.length - 1];
  const actionKind: ActionKind | null = s.precheck ? 'precheck' : s.over ? 'over' : s.phase === 'paused' && latestFeed?.kind === 'comment' ? 'paused' : null;
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
    <div className="flex h-full flex-col bg-stone-100 dark:bg-stone-950">
      <GameTopBar onMenu={() => setMenu(true)} />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col land:max-w-6xl land:flex-row land:gap-5 land:px-3">
        <div className="land:w-[min(calc(100dvh-11rem),58vw)] land:shrink-0">
          <PlayerBar me={flipped} />
          {/* Full-bleed on phones, like every board screen; the eval bar (when on) sits on the left. */}
          <div className="flex gap-1">
            {aids.evalBar && <EvalBar whitePct={whitePct} orientation={orientation} />}
            <div className="relative flex-1">
              <ChatBubble />
              <BoardFlash flash={s.flash} orientation={orientation} />
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
          {settings.showMoveList && !coachOff && (
            <MoveList plies={g.plies} startFen={g.startFen} current={viewing ? view! : undefined} onSelect={(i) => setView(i >= g.plies.length - 1 ? null : i)} />
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col land:pt-1">
          {/* The coach's message sits right under the move strip and scrolls (with a fade) if long. */}
          {coachOff ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-1 pb-2">
              <MoveHistory plies={g.plies} startFen={g.startFen} view={viewing ? view : null} onView={setView} />
              {coachFresh && (
                <div className="max-h-[45%] shrink-0 overflow-y-auto">
                  <CoachCard safetyMessages={safety?.messages ?? []} onHistory={() => setHistory(true)} />
                </div>
              )}
            </div>
          ) : (
            <CoachPanel>
              <CoachCard safetyMessages={safety?.messages ?? []} onHistory={() => setHistory(true)} />
            </CoachPanel>
          )}
          {/* Choices (a paused mistake, the pre-check, game over) take the Dock's place, so they're never scrolled away. */}
          {actionKind ? (
            <GameActions kind={actionKind} onMore={() => setOverMenu(true)} />
          ) : !s.over && (
            <Dock>
                {aids.requests ? (
                  <>
                    <DockButton label={s.hint ? `Hint ${s.hint.level}/3` : 'Hint'} icon={<Lightbulb size={22} />} disabled={!myTurn || s.hint?.level === 3} onClick={s.requestHint} primary />
                    <DockButton label="Take back" icon={<Undo2 size={22} />} disabled={userPlies === 0 || !['userTurn', 'paused', 'botThinking'].includes(s.phase)} onClick={s.takeback} />
                    <DockButton label="Threats" icon={<Crosshair size={22} />} disabled={!myTurn} onClick={s.requestThreat} />
                  </>
                ) : (
                  <>
                    <div className="flex flex-[2] flex-col items-center justify-center text-[11px] leading-tight font-semibold text-stone-500">
                      <Swords size={18} className="mb-0.5 text-brand-600" />
                      Match conditions
                    </div>
                    <DockButton label="Resign" icon={<Flag size={22} />} onClick={() => setConfirmResign(true)} />
                  </>
                )}
                <DockButton label="More" icon={<EllipsisVertical size={22} />} onClick={() => setMenu(true)} />
            </Dock>
          )}
        </div>
      </div>
      {s.intro && <VersusIntro opponentId={g.opponentId} elo={g.elo} userColor={g.userColor} line={s.chat?.text} onDone={s.endIntro} />}
      {s.rewards && (
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
          {!s.over && menuItem(<Flag size={19} />, 'Resign', () => (g.match ? setConfirmResign(true) : void s.resign()))}
          {menuItem(<RotateCcw size={19} />, 'New game', () => void (s.over ? s.leaveGame() : s.abandon()))}
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
function FeedBubble({ it, compact, flag, type }: { it: FeedItem; compact?: boolean; flag?: boolean; type?: boolean }) {
  const g = usePlay((s) => s.game)!;
  const p = it.ply >= 0 ? g.plies[it.ply] : undefined;
  const words = useMemo(() => it.text.map((t) => t.split(' ')), [it.text]);
  const total = words.reduce((n, w) => n + w.length, 0);
  const gentle = useSettings((st) => st.coachStyle === 'gentle');
  const { shown, skip } = useTypewriter(`${g.startedAt}:${it.id}`, total, !!type);
  const verdict = it.kind === 'comment' && !!p;
  let index = 0;
  return (
    // One verdict only: the "Qh6 is a blunder" row when the move is known, else the class chip.
    <CoachBubble compact={compact} {...FEED_LABEL[it.kind]} mood={it.mood ?? 'happy'} badge={verdict ? undefined : it.classification} special={verdict ? undefined : it.special}>
      {verdict && <MoveVerdict p={p!} index={it.ply} />}
      <div className="space-y-1" onClick={shown < total ? skip : undefined}>
        {words.map((line, i) => (
          <p key={i} className={it.kind === 'opening' && i === 0 ? 'text-[16px] font-bold' : ''}>
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
      {it.kind === 'comment' && p && (it.classification === 'mistake' || it.classification === 'blunder') && shown >= total && <MoveLines p={p} />}
      {flag && !gentle && it.kind === 'comment' && p?.comment && it.classification !== 'best' && it.classification !== 'good' && <FlagButton fen={p.fenBefore} uci={p.uci} comment={p.comment} />}
    </CoachBubble>
  );
}

/** Coach Sam's current message only — the conversation so far is one tap away. */
function CoachCard({ safetyMessages, onHistory }: { safetyMessages: string[]; onHistory: () => void }) {
  const s = usePlay();
  const settings = useSettings();
  const g = s.game!;
  const feed = g.feed ?? [];
  const latest = feed[feed.length - 1];
  const paused = s.phase === 'paused';
  const earlier = feed.length - 1;
  useTypedBaseline(g.startedAt, feed);

  // An older message (2+ moves ago) shrinks, and "Your move" takes the stage.
  const sinceLatest = latest ? g.plies.length - 1 - latest.ply : 0;
  const stale = !!latest && !paused && !s.over && !s.precheck && sinceLatest >= 2;
  const myTurn = s.phase === 'userTurn' && !s.precheck;

  let card: ReactNode;
  if (s.precheck) {
    card = (
      <CoachBubble mood="concerned" label="Before you move" icon={<ShieldCheck size={12} />}>
        <p>{s.precheck.check.ask}</p>
        {s.precheck.revealed && <p className="font-semibold">{s.precheck.check.reveal}</p>}
      </CoachBubble>
    );
  } else if (latest) {
    card = <FeedBubble key={latest.id} it={latest} flag type compact={stale} />;
  }

  return (
    <div className="space-y-2">
      {stale && myTurn && (
        <p className="flex items-center gap-2 px-1 text-[15px] font-bold" data-testid="your-move">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> Your move
        </p>
      )}
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
          ) : myTurn && !stale ? (
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

/** The coach's area under the move strip: top-aligned, scrolls when long, with a soft fade while more is below. */
function CoachPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-3 ${more ? '[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]' : ''}`}
      data-testid="coach-panel"
    >
      {children}
    </div>
  );
}

type ActionKind = 'paused' | 'precheck' | 'over';

/** The choices of the moment, in a fixed row where the Dock sits (44px buttons, at most three per row). */
function GameActions({ kind, onMore }: { kind: ActionKind; onMore: () => void }) {
  const s = usePlay();
  const push = useNav((n) => n.push);
  const row = 'mx-auto flex max-w-md gap-2';
  let body: ReactNode;
  if (kind === 'precheck' && s.precheck) {
    body = (
      <div className="space-y-1">
        <div className={row}>
          <button className="btn-primary !min-h-11 flex-1 !px-3" onClick={s.dismissPrecheck}>Let me think again</button>
          {!s.precheck.revealed && <button className="btn-secondary !min-h-11 flex-1 !px-3" onClick={s.revealPrecheck}>Show me why</button>}
          {s.precheck.revealed && <button className="btn-ghost !min-h-11 flex-1 !px-3" onClick={s.confirmPrecheck}>Play it anyway</button>}
        </div>
        {!s.precheck.revealed && (
          <div className="flex justify-center">
            <button className="btn-ghost !min-h-9 !py-1 text-sm" onClick={s.confirmPrecheck}>Play it anyway</button>
          </div>
        )}
      </div>
    );
  } else if (kind === 'paused') {
    body = (
      <div className={row}>
        <button className="btn-primary !min-h-11 flex-1" onClick={s.tryAgain}>Try again</button>
        <button className="btn-secondary !min-h-11 flex-1" onClick={s.continueGame}>Continue</button>
      </div>
    );
  } else {
    const id = s.over?.gameId ?? 0;
    body = (
      <div className={row}>
        {id > 0 && <button className="btn-primary !min-h-11 flex-[1.4]" onClick={() => push({ name: 'report', gameId: id })}>Game Review</button>}
        <button className={`${id > 0 ? 'btn-secondary' : 'btn-primary'} !min-h-11 flex-1`} onClick={() => rematch(s)}>Rematch</button>
        <button className="btn-secondary !min-h-11 w-11 shrink-0 !px-0" aria-label="More options" onClick={onMore}><EllipsisVertical size={20} /></button>
      </div>
    );
  }
  return (
    <div className="safe-bottom z-10 shrink-0 border-t border-black/[0.08] bg-white px-3 pt-2 pb-1.5 dark:border-white/[0.06] dark:bg-stone-900" data-testid="game-actions">
      {body}
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

/** Time control chips; my most common chess.com one is marked. */
export function TimeControlPicker({ value, options, onChange, mine }: { value: string; options: string[]; onChange: (v: string) => void; mine?: string | null }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((tc) => (
        <button
          key={tc}
          onClick={() => onChange(tc)}
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 ${value === tc ? 'bg-brand-600 text-white ring-brand-600' : 'ring-stone-200 dark:ring-stone-700'}`}
        >
          {tc === 'off' ? 'Off' : timeControlLabel(tc)}
          {mine === tc && <span className={`ml-1 text-[10px] font-normal ${value === tc ? 'text-white/80' : 'text-stone-500'}`}>your usual</span>}
        </button>
      ))}
    </div>
  );
}

/** After 5 wins at the current coach level: suggest one step down (never forced). */
function StepDownCard() {
  const settings = useSettings();
  const [games, setGames] = useState<{ coachLevel?: 'full' | 'warnings' | 'silent'; match?: boolean; userResult: string; endedAt: number }[]>([]);
  useEffect(() => void db.games.toArray().then(setGames), []);
  const level = settings.coachLevel;
  const sug = stepDownSuggestion(games, level, settings.coachLevelSince);
  if (!sug || settings.stepDownDismissed === `${level}:${settings.coachLevelSince}`) return null;
  const to = nextLevel(level);
  const label = to === 'match' ? 'Match conditions' : COACH_LEVELS.find((l) => l.id === to)!.label;
  return (
    <div className="rounded-2xl bg-brand-50 p-3 text-sm ring-1 ring-brand-500/30 dark:bg-brand-700/15">
      <p>
        <b>{sug.wins} wins</b> with the coach on “{COACH_LEVELS.find((l) => l.id === level)!.label}”. Ready for a little less help? Try <b>{label}</b>.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          className="btn-primary !py-1.5 text-sm"
          onClick={() => (to === 'match' ? settings.set({ matchMode: true }) : settings.set({ coachLevel: to, coachLevelSince: Date.now() }))}
        >
          Try {label}
        </button>
        <button className="btn-secondary !py-1.5 text-sm" onClick={() => settings.set({ stepDownDismissed: `${level}:${settings.coachLevelSince}` })}>
          Not now
        </button>
      </div>
    </div>
  );
}

/**
 * A chess clock for one side, chess.com style: its colour is the piece colour (white or charcoal),
 * the running one fully opaque with a small clock glyph, the idle one faded; red when time is low,
 * pulsing in the final 10 seconds.
 */
function ClockFace({ side, className = '' }: { side: 'w' | 'b'; className?: string }) {
  const g = usePlay((s) => s.game);
  const over = usePlay((s) => s.phase === 'over');
  const [, setTick] = useState(0);
  const toMove = g ? turnOf(currentFen(g)) : 'w';
  const running = !!g?.clock && !over && toMove === side;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 100);
    return () => clearInterval(t);
  }, [running]);
  if (!g?.clock || !g.timeControl) return null;
  const ms = timeLeft(g.clock, side, over ? (side === 'w' ? 'b' : 'w') : toMove, Date.now());
  const low = lowTime(ms, g.timeControl) || ms < 20_000;
  const critical = running && ms < 10_000;
  const face = side === 'w' ? 'bg-white text-[#262421] ring-1 ring-black/10' : 'bg-stone-800 text-white dark:bg-[#262421]';
  const tone = low ? (running ? 'bg-[#e02f2f] text-white' : `${face} !text-[#e02f2f]`) : face;
  return (
    <span
      className={`inline-flex h-9 w-[92px] shrink-0 items-center justify-end gap-1.5 rounded-[6px] px-2.5 text-[20px] font-extrabold tracking-tight tabular-nums transition-[background-color,color,opacity] duration-150 ${tone} ${running ? '' : 'opacity-55'} ${critical ? 'animate-pulse' : ''} ${className}`}
      aria-label={`${side === g.userColor ? 'Your' : "Opponent's"} clock ${fmtClock(ms)}`}
    >
      {running && <ClockIcon size={14} strokeWidth={2.6} className="shrink-0" />}
      {fmtClock(ms)}
    </span>
  );
}

/** Gentle coach: amber and orange instead of the harsher red (readable on the white bubble). */
const GENTLE_INK: Partial<Record<ReviewClass, string>> = { mistake: '#9a6c07', blunder: '#bf5600', miss: '#bf5600' };

/** "Qh6 is a blunder" with the class icon (like Game Review) and the evaluation before → after. */
function MoveVerdict({ p, index }: { p: PlyRecord; index: number }) {
  const g = usePlay((s) => s.game)!;
  const gentle = useSettings((st) => st.coachStyle === 'gentle');
  const cls: ReviewClass = p.special ?? (p.classification === 'good' ? ((p.wpLoss ?? 0) <= 2.5 ? 'excellent' : 'good') : (p.classification ?? 'good'));
  const ink = (gentle && GENTLE_INK[cls]) || RC[cls].ink;
  const before = index > 0 ? g.plies[index - 1]?.evalAfter : { type: 'cp' as const, value: 0 };
  const after = p.evalAfter;
  const fmt = (x: NonNullable<PlyRecord['evalAfter']>) => formatScore(x).replace('-', '−');
  return (
    <p className="mb-1 flex items-center gap-1.5 text-[15px] font-bold">
      <ReviewIcon cls={cls} size={20} />
      <span className="min-w-0 flex-1">
        {p.san} <span style={{ color: ink }}>{RC[cls].verdict}</span>
      </span>
      {before && after && <span className="shrink-0 rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[11px] font-semibold text-stone-600 tabular-nums">{fmt(before)} → {fmt(after)}</span>}
    </p>
  );
}

/** After a mistake: the better move and what yours allows (the opponent's best reply). */
function MoveLines({ p }: { p: PlyRecord }) {
  const c = p.comment;
  const reply = c?.replyLine?.length ? formatLine(p.fenAfter, lineToSan(p.fenAfter, c.replyLine, 3)) : null;
  if (!c?.bestSan && !reply) return null;
  return (
    <div className="mt-1.5 space-y-0.5 rounded-[8px] bg-black/[0.04] px-2.5 py-1.5 text-[13px]">
      {c?.bestSan && (
        <p>
          <span className="text-stone-500">Better:</span> <b style={{ color: RC.best.ink }}>{c.bestSan}</b>
        </p>
      )}
      {reply && (
        <p>
          <span className="text-stone-500">It allows:</span> <b>{reply}</b>
        </p>
      )}
    </div>
  );
}
