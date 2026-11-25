// The Play tab's home: the opponent card with Play (the one primary action), the rivalry row,
// "This week", and one "Up next" row (the single most useful thing to do next). The rest of the
// app lives in the tabs.
import { BadgeLine } from '../../components/Rivalry';
import { PlaysLine } from '../../components/PlaysLine';
import { TurningPrompt } from '../../components/TurningCards';
import { useEffect, useState } from 'react';
import { ChevronRight, Timer, Bot, Check, Lock, Settings, Share, Shuffle, SlidersHorizontal, Dumbbell, Sparkles, Star, Trophy } from 'lucide-react';
import { eloLabel, MAX_ELO, MIN_ELO } from '../../lib/bot';
import { getSparring, sparringStep, type SparringState } from '../../lib/sparring';
import { getPlayerRating } from '../../lib/playerRating';
import { ScaleNews } from '../../components/ScaleNews';
import { onChange } from '../../lib/changes';
import { useNav } from '../../lib/nav';
import { useSettings } from '../../lib/settings';
import { usePlay } from '../../lib/store/play';
import { CoachBubble, Portrait } from '../../components/Coach';
import { OPPONENTS, opponentById, portraitColors } from '../../lib/people';
import { getOpponentRecords, type OpponentRecord } from '../../lib/people/record';
import { Dialog, IconButton, Segmented } from '../../components/ui';
import { badgeCount, challengeOpen } from '../../lib/people/record';
import { CHALLENGE_BADGES } from '../../lib/people/rivalry';
import { challengeFor } from '../../lib/people/challenges';
import { cosmeticById, type Cosmetic } from '../../lib/rewards/cosmetics';
import { CosmeticPreview } from '../../components/CosmeticPreview';
import { WeekRing } from '../../components/Gamification';
import { LastChessComGames } from '../../components/ChessCom';
import { db, kvGet } from '../../lib/db';
import { mostCommonTimeControl, offeredTimeControls } from '../../lib/clock';
import { timeControlLabel } from '../../lib/chesscom/parse';
import { HomeHero } from '../../components/HomeHero';
import { UpNextCard } from '../../components/UpNextCard';
import { OpponentCarousel } from '../../components/OpponentCarousel';
import { needsHomeScreenHint } from '../../lib/pwa';
import { coachElo } from '../../lib/coach/level';

/** Quick match (Phase 3 of round 7) shows the Play card's switch. */
const QUICK_MATCH = false;
import { COLOUR_NEWS_KEY, colourChip, getLastColour, nextColour } from '../../lib/colour';
import type { Color } from '../../lib/chess/pos';

const sparringTagline = (s: SparringState | null) => (s && s.games ? `Keeps you near 50% · ${s.w}W ${s.d}D ${s.l}L` : 'Its rating follows yours, game by game');

export function SetupView() {
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
  // Every game against a character is a real game, and every character is open (as Match was).
  const [ccTc, setCcTc] = useState<string | null>(null);
  useEffect(() => void db.imported.toArray().then((gs) => setCcTc(mostCommonTimeControl(gs))), []);
  const rec = opp ? records[opp.id] : undefined;
  const running = usePlay((s) => (s.game && s.phase !== 'over' && s.phase !== 'setup' ? s.game : null));
  // Your last game's colour (for Alternate) and the one-time line after the move to Alternate, from kv.
  const [lastColour, setLastColourState] = useState<Color | null>(null);
  const [colourNews, setColourNews] = useState(false);
  useEffect(() => {
    const read = () => {
      void getLastColour().then(setLastColourState);
      void kvGet<boolean>(COLOUR_NEWS_KEY, false).then(setColourNews);
    };
    read();
    return onChange('colour', read);
  }, [phaseNow]);
  const chip = colourChip(settings.colorPref, lastColour);
  const start = async () => {
    const color = nextColour(settings.colorPref, lastColour);
    // Starting over ends the game in progress (counts as resigned after a few moves).
    if (running) await usePlay.getState().abandon();
    // While their special challenge is open, every game is an attempt at it: no form (round 7).
    newGame(color, botElo, undefined, opp?.id, { match: true, timeControl: settings.charTimeControl || undefined, sparring, challenge: !!opp && chOpen && !rec?.challengeDone });
  };
  /** Play Coach: Sam at your rating (150 below for Easier, 150 above for Harder), no clock. */
  const startCoach = async () => {
    const color = nextColour(settings.colorPref, lastColour);
    if (running) await usePlay.getState().abandon();
    newGame(color, coachElo(getPlayerRating(), settings.coachStrength), undefined, 'coach', { coach: settings.coachStrength });
  };
  const [sheet, setSheet] = useState<'opponent' | 'options' | 'coach' | null>(null);
  const tc = settings.charTimeControl;
  const chOpen = challengeOpen(rec);
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <HomeHero right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 p-4">
        <ScaleNews />
        <TurningPrompt />
        {running && <ResumeCard />}
        <HomeScreenHint />
        {/* The Play card: real games (Characters; Quick match joins it). */}
        <div className="card space-y-3 overflow-hidden !p-0 !pb-3" data-testid="play-card" data-side={settings.playSide}>
          {QUICK_MATCH && (
            <div className="px-3 pt-3">
              <Segmented value={settings.playSide} onChange={(v) => settings.set({ playSide: v })} options={[{ value: 'quick', label: 'Quick match' }, { value: 'characters', label: 'Characters' }]} />
            </div>
          )}
          <button
            className="relative flex w-full items-center gap-3.5 px-3.5 pt-3.5 pb-3 text-left transition-[filter] duration-100 active:brightness-95"
            style={{ background: opp ? `linear-gradient(115deg, color-mix(in srgb, ${portraitColors(opp.id)[1]} 12%, transparent), transparent 70%)` : undefined }}
            onClick={() => setSheet('opponent')}
          >
            {opp ? <Portrait id={opp.id} size={84} /> : <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[8px] bg-stone-200 dark:bg-stone-800">{sparring ? <Dumbbell size={36} /> : <Bot size={36} />}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold tracking-[0.1em] text-stone-500 uppercase dark:text-stone-400">Your opponent</span>
              <span className="block truncate text-[22px] leading-tight font-extrabold tracking-[-0.015em]">{opp ? opp.name : sparring ? 'Sparring partner' : 'Custom bot'}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 rounded-[4px] bg-stone-800 px-1.5 py-px text-xs font-bold text-white tabular-nums">{botElo}</span>
                <span className="truncate text-xs text-stone-600 dark:text-stone-400">{opp ? opp.tagline : sparring ? sparringTagline(spar) : eloLabel(settings.botElo)}</span>
              </span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200" aria-label="Change opponent"><ChevronRight size={18} /></span>
          </button>
          <div className="space-y-3 px-3">
          {/* Your badges with them, in one place on Home: a line that opens the badge sheet. */}
          {opp && <PlaysLine o={opp} />}
          {opp && <BadgeLine opponentId={opp.id} rec={rec} />}
          <button className="flex w-full flex-wrap items-center gap-1.5 rounded-[8px] p-1 text-left press" onClick={() => setSheet('options')}>
            {/* The next game's colour (Alternate: a two-tone dot). */}
            <span className="chip bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200" data-testid="colour-chip" data-dot={chip.dot}>
              <ColourDot kind={chip.dot} size={12} /> {chip.label}
            </span>
            <span className="chip bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200" data-testid="clock-chip"><Timer size={12} /> {tc ? timeControlLabel(tc) : 'No clock'}</span>
            <span className="ml-auto text-sm font-semibold text-brand-700 dark:text-brand-500">Options</span>
          </button>
          {colourNews && settings.colorPref === 'alternate' && (
            <p className="rounded-[8px] bg-stone-100 px-2.5 py-2 text-[12px] leading-snug text-stone-600 dark:bg-white/[0.05] dark:text-stone-300" data-testid="colour-news">
              Colours now alternate, like on chess.com. Change it in Options.
            </p>
          )}
          <button className="btn-primary !min-h-14 w-full text-[18px] !font-extrabold" onClick={() => void start()} data-testid="play-button">
            {running ? 'Start a new game' : 'Play'}
          </button>
          {running && <p className="-mt-1 text-center text-xs text-stone-500">This ends your game in progress.</p>}
          </div>
        </div>
        {opp && chOpen && !rec?.challengeDone && <ChallengeCard opponentId={opp.id} badges={badgeCount(rec)} open done={false} />}
        <PlayCoachCard running={!!running} onPlay={() => void startCoach()} onOptions={() => setSheet('coach')} />
        <WeekRing />
        <UpNextCard />
        <LastChessComGames />
      </div>
      <Dialog open={sheet === 'opponent'} onClose={() => setSheet(null)} title="Choose your opponent">
        <div className="-mx-4">
          {!custom && !sparring && <OpponentCarousel records={records} allOpen selected={settings.opponentId} onSelect={(id) => settings.set({ opponentId: id })} />}
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
        {opp && !chOpen && <ChallengeCard opponentId={opp.id} badges={badgeCount(rec)} open={false} done={!!rec?.challengeDone} />}
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
      <Dialog open={sheet === 'options' || sheet === 'coach'} onClose={() => setSheet(null)} title={sheet === 'coach' ? 'Play Coach options' : 'Game options'}>
        <div className="space-y-4" data-testid="options-sheet" data-mode={sheet === 'coach' ? 'coach' : 'characters'}>
          <div>
            <div className="mb-1.5 section-title">You play</div>
            {/* Four choices: on a small phone the dots go so the words fit. */}
            <Segmented
              dense
              value={settings.colorPref}
              onChange={(v) => settings.set({ colorPref: v })}
              options={[
                { value: 'w', label: <><span className="max-[380px]:hidden"><ColourDot kind="w" size={13} /></span> White</> },
                { value: 'b', label: <><span className="max-[380px]:hidden"><ColourDot kind="b" size={13} /></span> Black</> },
                { value: 'alternate', label: <><span className="max-[380px]:hidden"><ColourDot kind="half" size={13} /></span> Alternate</> },
                { value: 'random', label: <><span className="max-[380px]:hidden"><ColourDot kind="random" size={13} /></span> Random</> },
              ]}
            />
            {settings.colorPref === 'alternate' && (
              <p className="mt-1.5 px-1 text-xs text-stone-500" data-testid="colour-hint">
                Like chess.com: you switch colours every game, and Rematch swaps too. <b className="font-semibold text-stone-700 dark:text-stone-300">Next game: {chip.label}.</b>
              </p>
            )}
          </div>
          {sheet === 'coach' ? (
            <div>
              <div className="mb-1.5 section-title">Sam talks</div>
              <Segmented
                value={settings.coachLevel === 'full' ? 'full' : 'warnings'}
                onChange={(v) => settings.set({ coachLevel: v, coachLevelSince: Date.now() })}
                options={[
                  { value: 'full', label: 'All' },
                  { value: 'warnings', label: 'Only when it matters' },
                ]}
              />
              <p className="mt-1.5 px-1 text-xs text-stone-500">
                {settings.coachLevel === 'full' ? 'Sam comments on your moves, warns you, shows threats and explains his own moves.' : 'Sam only speaks up before a real mistake, and when you ask.'} No clock in Play Coach.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 section-title">Clock</div>
              <TimeControlPicker value={settings.charTimeControl || 'off'} options={['off', ...offeredTimeControls(ccTc)]} onChange={(v) => settings.set({ charTimeControl: v === 'off' ? '' : v })} mine={ccTc} />
            </div>
          )}
          <button className="btn-primary w-full" onClick={() => setSheet(null)}>Done</button>
        </div>
      </Dialog>
    </div>
  );
}

/** The Play Coach card: Sam, the line, the level switch and its own button. */
function PlayCoachCard({ running, onPlay, onOptions }: { running: boolean; onPlay: () => void; onOptions: () => void }) {
  const level = useSettings((s) => s.coachStrength);
  const set = useSettings((s) => s.set);
  return (
    <div className="card space-y-3 !p-3.5" data-testid="play-coach-card">
      <div className="flex gap-3">
        <Portrait id="coach" size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-[16px] font-extrabold tracking-[-0.01em]">Play Coach</span>
            <button className="text-sm font-semibold text-brand-700 dark:text-brand-500" onClick={onOptions}>Options</button>
          </div>
          <p className="text-[12px] leading-snug text-stone-500 dark:text-stone-400">Sam plays at your level and teaches as you go.</p>
          <div className="mt-2">
            <Segmented
              dense
              value={level}
              onChange={(v) => set({ coachStrength: v })}
              options={[
                { value: 'easier', label: 'Easier' },
                { value: 'your', label: 'Your level' },
                { value: 'harder', label: 'Harder' },
              ]}
            />
          </div>
        </div>
      </div>
      <button className="btn-secondary !min-h-12 w-full text-[16px] !font-extrabold" onClick={onPlay} data-testid="play-coach-button">
        {running ? 'Play Coach (ends your game)' : 'Play Coach'}
      </button>
    </div>
  );
}

/** The colour dot: white, black, half and half (Alternate), or the shuffle icon (Random). */
function ColourDot({ kind, size }: { kind: 'w' | 'b' | 'half' | 'random'; size: number }) {
  if (kind === 'random') return <Shuffle size={size} className="shrink-0" />;
  const bg = kind === 'w' ? '#ffffff' : kind === 'b' ? '#1c1917' : 'linear-gradient(90deg, #ffffff 50%, #1c1917 50%)';
  return <span className="block shrink-0 rounded-full ring-1 ring-stone-400 dark:ring-stone-500" style={{ width: size, height: size, background: bg }} />;
}

/** Quiet links under the Play card, chess.com style: training due, past games. */
/** On the menu while a game is running: jump back in. */
function ResumeCard() {
  const s = usePlay();
  const g = s.game!;
  const o = opponentById(g.opponentId);
  const moves = Math.ceil(g.plies.length / 2);
  return (
    <button className="card tile flex w-full items-center gap-3 !p-3 text-left ring-2 ring-brand-500 transition-[filter] active:brightness-95" onClick={() => s.setAway(false)}>
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

export function resultFor(result: string, userColor: 'w' | 'b') {
  const userResult = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (userColor === 'w') ? 'win' : 'loss';
  return { userResult };
}

export function Stars({ n, size = 12, of = 3 }: { n: number; size?: number; of?: number }) {
  return (
    <span className="mt-0.5 flex gap-0.5">
      {Array.from({ length: of }, (_, i) => i).map((i) => (
        <Star key={i} size={size} className={i < n ? 'fill-[#f7c631] text-[#e0a800]' : 'text-stone-300 dark:text-stone-600'} />
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

/** The opponent's special challenge: opens with seven of the eight badges, rewards something unique. */
function ChallengeCard({ opponentId, badges, open, done }: { opponentId: string; badges: number; open: boolean; done: boolean }) {
  const ch = challengeFor(opponentId);
  if (!ch) return null;
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
          <div className="font-semibold leading-tight">{open ? ch.title : `${Math.min(badges, CHALLENGE_BADGES)} of ${CHALLENGE_BADGES} badges`}</div>
          <div className="text-xs text-stone-500">
            {done
              ? `Done! You won: ${rewards.map((c) => c.name).join(' + ')}.`
              : open
                ? `${ch.description} Reward: ${rewards.map((c) => c.name).join(' + ')}.`
                : `Earn ${CHALLENGE_BADGES} of the 8 badges against them and a special challenge opens.`}
          </div>
        </div>
      </div>
      {!open && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
          <div className="h-full rounded-full bg-gold-400" style={{ width: `${(Math.min(badges, CHALLENGE_BADGES) / CHALLENGE_BADGES) * 100}%` }} />
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
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 ${value === tc ? 'bg-brand-700 text-white ring-brand-700' : 'ring-stone-200 dark:ring-stone-700'}`}
        >
          {tc === 'off' ? 'Off' : timeControlLabel(tc)}
          {mine === tc && <span className={`ml-1 text-xs font-normal ${value === tc ? 'text-white/80' : 'text-stone-500'}`}>your usual</span>}
        </button>
      ))}
    </div>
  );
}

