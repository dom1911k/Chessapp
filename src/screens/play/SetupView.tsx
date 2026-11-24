// The Play tab's home: the opponent card with Play (the one primary action), the rivalry row,
// "This week", and one "Up next" row (the single most useful thing to do next). The rest of the
// app lives in the tabs.
import { RivalryCard, RivalryChip } from '../../components/Rivalry';
import { TurningPrompt } from '../../components/TurningCards';
import { useEffect, useState } from 'react';
import { Flame, ChevronRight, Timer, Swords, Bot, Brain, Check, Lock, MessageCircleHeart, Settings, Share, Shuffle, SlidersHorizontal, Dumbbell, Sparkles, Star, Trophy } from 'lucide-react';
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
import { getOpponentRecords, isUnlocked, type OpponentRecord } from '../../lib/people/record';
import { Dialog, IconButton, Segmented } from '../../components/ui';
import { MAX_STARS, starsOf } from '../../lib/people/record';
import { challengeFor } from '../../lib/people/challenges';
import { cosmeticById, type Cosmetic } from '../../lib/rewards/cosmetics';
import { CosmeticPreview } from '../../components/CosmeticPreview';
import { WeekRing } from '../../components/Gamification';
import { currentWinStreak } from '../../lib/stats';
import { LastChessComGames } from '../../components/ChessCom';
import { db } from '../../lib/db';
import { defaultMatchTc, mostCommonTimeControl, offeredTimeControls } from '../../lib/clock';
import { timeControlLabel } from '../../lib/chesscom/parse';
import { COACH_LEVELS, nextLevel, stepDownSuggestion } from '../../lib/coach/level';
import { HomeHero } from '../../components/HomeHero';
import { UpNextCard } from '../../components/UpNextCard';
import { OpponentCarousel } from '../../components/OpponentCarousel';
import { needsHomeScreenHint } from '../../lib/pwa';

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
            style={{ background: opp ? `linear-gradient(115deg, color-mix(in srgb, ${portraitColors(opp.id)[1]} 12%, transparent), transparent 70%)` : undefined }}
            onClick={() => setSheet('opponent')}
          >
            {opp ? <Portrait id={opp.id} size={84} /> : <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[8px] bg-stone-200 dark:bg-stone-800">{sparring ? <Dumbbell size={36} /> : <Bot size={36} />}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold tracking-[0.1em] text-stone-500 uppercase dark:text-stone-400">Your opponent</span>
              <span className="block truncate text-[22px] leading-tight font-extrabold tracking-[-0.015em]">{opp ? opp.name : sparring ? 'Sparring partner' : 'Custom bot'}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded-[4px] bg-stone-800 px-1.5 py-px text-xs font-bold text-white tabular-nums">{botElo}</span>
                {opp && <Stars n={stars} of={MAX_STARS} size={12} />}
                {opp && <RivalryChip rec={rec} />}
              </span>
              <span className="mt-0.5 block truncate text-xs text-stone-600 dark:text-stone-400">{opp ? opp.tagline : sparring ? sparringTagline(spar) : eloLabel(settings.botElo)}</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200" aria-label="Change opponent"><ChevronRight size={18} /></span>
          </button>
          <div className="space-y-3 px-3">
          <Segmented
            value={match ? 'match' : 'coached'}
            onChange={(v) => settings.set({ matchMode: v === 'match' })}
            options={[
              { value: 'coached', label: <><MessageCircleHeart size={15} /> Coached</> },
              { value: 'match', label: <><Swords size={15} /> Match</> },
            ]}
          />
          <button className="flex w-full flex-wrap items-center gap-1.5 rounded-[8px] p-1 text-left press" onClick={() => setSheet('options')}>
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
            <div className="flex items-center gap-2 rounded-[8px] bg-hue-orange-500/10 px-3 py-2 text-sm">
              <Flame size={18} className={`animate-flame ${winRun >= 5 ? 'fill-hue-rose-400 text-hue-rose-500' : 'fill-hue-orange-400 text-hue-orange-500'}`} />
              <span className="flex-1"><b>{winRun} wins in a row</b> <span className="text-stone-500">— keep it going!</span></span>
            </div>
          )}
          <button className="btn-primary !min-h-14 w-full text-[18px] !font-extrabold" disabled={locked} onClick={() => void start()}>
            {locked ? <><Lock size={16} /> Beat {prevName} first</> : running ? 'Start a new game' : 'Play'}
          </button>
          {running && <p className="-mt-1 text-center text-xs text-stone-500">This ends your game in progress.</p>}
          </div>
        </div>
        {opp && !locked && stars >= MAX_STARS && !rec?.challengeDone && <ChallengeCard opponentId={opp.id} stars={stars} done={false} />}
        {opp && !locked && <RivalryCard opponentId={opp.id} rec={rec} />}
        <WeekRing />
        <UpNextCard />
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
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 ${value === tc ? 'bg-brand-700 text-white ring-brand-700' : 'ring-stone-200 dark:ring-stone-700'}`}
        >
          {tc === 'off' ? 'Off' : timeControlLabel(tc)}
          {mine === tc && <span className={`ml-1 text-xs font-normal ${value === tc ? 'text-white/80' : 'text-stone-500'}`}>your usual</span>}
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
    <div className="rounded-[10px] bg-brand-50 p-3 text-sm ring-1 ring-brand-500/30 dark:bg-brand-700/15">
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
