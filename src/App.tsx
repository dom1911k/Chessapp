import { migrateRatingScale } from './lib/migrate';
import { Onboarding } from './components/Onboarding';
import { getGameRating } from './lib/rewards/rating';
import { setPlayerRating } from './lib/playerRating';
import { needsOnboarding } from './lib/onboarding';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import { GraduationCap, House, Menu, Puzzle, Trophy, type LucideIcon } from 'lucide-react';
import { requestPersistentStorage } from './lib/db';
import { handleBack, useNav, type Screen, type Tab } from './lib/nav';
import { useSettings } from './lib/settings';
import { usePlay } from './lib/store/play';
import { PlayScreen } from './screens/PlayScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PuzzlesScreen } from './screens/PuzzlesScreen';
import { PuzzleScreen } from './screens/PuzzleScreen';
import { DailyScreen } from './screens/DailyScreen';
import { LearnScreen } from './screens/LearnScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { VisionScreen } from './screens/VisionScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { GameReviewScreen } from './screens/GameReviewScreen';
import { TurningScreen } from './screens/TurningScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { EndgameScreen } from './screens/EndgameScreen';
import { OpeningsScreen } from './screens/OpeningsScreen';
import { RushScreen } from './screens/RushScreen';
import { AchievementsScreen } from './components/Gamification';
import { OpeningPracticeScreen } from './screens/OpeningPracticeScreen';
import { FaceScreen } from './screens/FaceScreen';
import { CustomPuzzlesScreen } from './screens/CustomPuzzlesScreen';
import { MistakesScreen } from './screens/MistakesScreen';
import { TimeDrillScreen } from './screens/TimeDrillScreen';
import { TrapScreen, TrapsScreen } from './screens/TrapsScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { JourneyScreen } from './screens/JourneyScreen';
import { SkillTreeScreen } from './screens/SkillTreeScreen';
import { CollectionScreen } from './screens/CollectionScreen';
import { PieceDefs } from './components/PieceDefs';
import { WebUpdateBanner } from './components/UpdatePanel';
import { ModelGameScreen } from './screens/ModelGameScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { RepertoireBuildScreen, RepertoireScreen, RepertoireTrainScreen } from './screens/RepertoireScreen';
import { LessonScreen } from './screens/LessonScreen';
import { UpdateDialog } from './components/UpdatePanel';
import { CelebrationLayer } from './components/Celebrate';
import { autoCheck, type UpdateInfo } from './lib/update';
import { calibrate } from './lib/engine/speed';
import { applyReminder } from './lib/reminders';
import { CupsTab } from './cups/screens/CupsTab';
import { useRunFlag } from './cups/flag';
import { startImports } from './lib/chesscom/store';
import { preloadSounds } from './lib/sound';

const TABS: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: 'play', label: 'Home', icon: House },
  { tab: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { tab: 'learn', label: 'Learn', icon: GraduationCap },
  { tab: 'more', label: 'More', icon: Menu },
  // Cups (src/cups): knockout tournaments of real games; can be hidden in Settings.
  { tab: 'run', label: 'Cups', icon: Trophy },
];

function TabScreen({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'play':
      return <PlayScreen />;
    case 'puzzles':
      return <PuzzlesScreen />;
    case 'learn':
      return <LearnScreen />;
    case 'more':
      return <MoreScreen />;
    case 'run':
      return <CupsTab />;
  }
}

/** A stable key per pushed screen, so a screen keeps its state while others sit on top of it. */
const screenKeys = new WeakMap<Screen, number>();
let nextScreenKey = 1;
function keyOf(s: Screen): number {
  let k = screenKeys.get(s);
  if (k === undefined) {
    k = nextScreenKey++;
    screenKeys.set(s, k);
  }
  return k;
}

function StackScreen({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'daily':
      return <DailyScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'insights':
      return <InsightsScreen />;
    case 'vision':
      return <VisionScreen />;
    case 'explore':
      return <ExploreScreen {...screen} />;
    case 'report':
      return <GameReviewScreen key={`r${screen.gameId}`} gameId={screen.gameId} />;
    case 'review':
      return <GameReviewScreen key={`v${screen.gameId}:${screen.ply}`} gameId={screen.gameId} ply={screen.ply ?? -1} />;
    case 'turning':
      return <TurningScreen key={`t${screen.gameId}`} gameId={screen.gameId} />;
    case 'history':
      return <HistoryScreen />;
    case 'puzzle':
      return <PuzzleScreen mode={screen.mode} />;
    case 'endgame':
      return <EndgameScreen drillId={screen.drillId} />;
    case 'openings':
      return <OpeningsScreen />;
    case 'rush':
      return <RushScreen mode={screen.mode} />;
    case 'achievements':
      return <AchievementsScreen />;
    case 'openingPractice':
      return <OpeningPracticeScreen index={screen.index} custom={screen.custom} />;
    case 'face':
      return <FaceScreen />;
    case 'customPuzzles':
      return <CustomPuzzlesScreen />;
    case 'mistakes':
      return <MistakesScreen />;
    case 'traps':
      return <TrapsScreen />;
    case 'trap':
      return <TrapScreen trapId={screen.trapId} />;
    case 'timeDrill':
      return <TimeDrillScreen kind={screen.kind} />;
    case 'lesson':
      return <LessonScreen lessonId={screen.lessonId} mode={screen.mode} />;
    case 'placement':
      return <LessonScreen lessonId="placement" mode="placement" />;
    case 'modelGame':
      return <ModelGameScreen gameId={screen.gameId} />;
    case 'library':
      return <LibraryScreen />;
    case 'repertoire':
      return <RepertoireScreen />;
    case 'repertoireTrain':
      return <RepertoireTrainScreen lineId={screen.lineId} />;
    case 'repertoireBuild':
      return <RepertoireBuildScreen />;
    case 'practice':
      return <PracticeScreen theme={screen.theme} />;
    case 'journey':
      return <JourneyScreen />;
    case 'skills':
      return <SkillTreeScreen />;
    case 'collection':
      return <CollectionScreen />;
  }
}

function useTheme() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#312e2b' : '#f1f0ee');
      if (Capacitor.isNativePlatform()) void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function useAndroidBack() {
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let lastPress = 0;
    const sub = CapApp.addListener('backButton', () => {
      if (handleBack()) return;
      // At the root of the Play tab: press twice to leave (the game is saved).
      const now = Date.now();
      if (now - lastPress < 2000) {
        void CapApp.exitApp();
        return;
      }
      lastPress = now;
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, []);
  return toast;
}

export function App() {
  const { tab, stack, setTab } = useNav();
  // Screens just closed stay a moment longer so they can slide away.
  const [leaving, setLeaving] = useState<Screen[]>([]);
  const prevStack = useRef<Screen[]>(stack);
  useEffect(() => {
    const before = prevStack.current;
    prevStack.current = stack;
    const gone = before.filter((s) => !stack.includes(s));
    if (!gone.length) return;
    setLeaving((l) => [...l, ...gone]);
    // Not cancelled when the stack changes again within 200ms: a closed screen must always go
    // (left behind, it stayed mounted, invisible, 36px off the right edge, widening the page).
    setTimeout(() => setLeaving((l) => l.filter((s) => !gone.includes(s))), 200);
  }, [stack]);
  // Tabs you've visited stay mounted (hidden), so switching back is instant and keeps their state.
  const [visited, setVisited] = useState<Tab[]>([tab]);
  useEffect(() => setVisited((v) => (v.includes(tab) ? v : [...v, tab])), [tab]);
  const loaded = useSettings((s) => s.loaded);
  const runMode = useRunFlag((s) => s.enabled);
  const toast = useAndroidBack();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [welcome, setWelcome] = useState(false);
  useTheme();

  useEffect(() => {
    requestPersistentStorage();
    void preloadSounds();
    // Ratings moved to the chess.com scale (v1.55): convert stored ratings once, then load.
    const migrated = migrateRatingScale().catch(() => false);
    void migrated.then(() => getGameRating()).then((r) => setPlayerRating(r.rating));
    void migrated.then(() => useSettings.getState().load()).then(() => {
      const st = useSettings.getState();
      if (st.reminderEnabled) void applyReminder(true, st.reminderTime);
      // Measure engine speed (cached for a month) so analysis fits this phone; runs alongside loading.
      void calibrate();
      // chess.com: resume background analysis (and sync, if that's switched on) a little after start.
      setTimeout(startImports, 2500);
      return usePlay.getState().load();
    }).then(() => needsOnboarding()).then(setWelcome).catch(() => {});
    // Look for a new version (at most once a day, silently skipped when offline).
    const t = setTimeout(() => void autoCheck().then(setUpdate), 4000);
    return () => clearTimeout(t);
  }, []);

  // While playing, the board gets the whole screen (the game's back arrow returns to the menu).
  const inGame = usePlay((s) => !!s.game && !s.away && s.phase !== 'setup' && s.phase !== 'loading');
  if (!loaded) return <Splash />;
  const top = stack[stack.length - 1];
  const tabs = runMode ? TABS : TABS.filter((t) => t.tab !== 'run');
  const shownTab: Tab = tab === 'run' && !runMode ? 'play' : tab;

  return (
    <div className="flex h-full flex-col">
      {welcome && <Onboarding onDone={() => setWelcome(false)} />}
      <main className={`relative min-h-0 flex-1 overflow-x-clip ${top ? 'safe-bottom' : ''}`}>
        {/* Tabs stay mounted (and so keep their state); the shown one fades in. */}
        {visited.filter((t) => t !== 'run' || (runMode && shownTab === 'run')).map((t) => (
          <div key={t} className={top || t !== shownTab ? 'hidden' : 'animate-fade-in h-full'}>
            <TabScreen tab={t} />
          </div>
        ))}
        {/* Pushed screens: the top one slides in; the ones under it stay mounted but invisible, so
            going back returns to them exactly as you left them; a closed one slides away. */}
        {[...stack, ...leaving].map((s) => {
          const isTop = s === top;
          const isLeaving = leaving.includes(s);
          return (
            <div
              key={keyOf(s)}
              aria-hidden={!isTop}
              className={
                isLeaving
                  ? 'animate-slide-out pointer-events-none absolute inset-0 z-30 h-full overflow-hidden bg-stone-100 dark:bg-stone-950'
                  : isTop
                    ? 'absolute inset-0 z-20 h-full overflow-hidden'
                    : 'pointer-events-none invisible absolute inset-0 h-full overflow-hidden'
              }
            >
              {/* The slide-in runs once, when the screen opens (not when it's revealed again). */}
              <div className="animate-slide-in h-full bg-stone-100 dark:bg-stone-950">
                <StackScreen screen={s} />
              </div>
            </div>
          );
        })}
      </main>
      {!top && !(inGame && tab === 'play') && (
        <nav className="safe-bottom border-t border-black/[0.08] bg-white dark:border-white/[0.06] dark:bg-stone-900">
          <div className="mx-auto flex max-w-xl px-2 pt-1.5 pb-1">
            {tabs.map((t) => {
              const active = shownTab === t.tab;
              const Icon = t.icon;
              // Cups is its own game mode: set apart by a divider and its own violet accent.
              const run = t.tab === 'run';
              return (
                <button key={t.tab} onClick={() => setTab(t.tab)} className={`flex flex-1 flex-col items-center gap-0.5 py-1 ${run ? 'relative before:absolute before:top-2 before:bottom-2 before:left-0 before:w-px before:bg-stone-200 dark:before:bg-white/10' : ''}`}>
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-lg transition-colors duration-150 ${
                      active
                        ? run
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'
                          : 'bg-stone-200/70 text-stone-900 dark:bg-white/[0.08] dark:text-white'
                        : run
                          ? 'text-violet-500/80 active:bg-violet-100/60 dark:text-violet-300/70'
                          : 'text-stone-500 active:bg-stone-200/60 dark:active:bg-white/[0.05]'
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                  </span>
                  <span className={`text-[11px] font-semibold ${active ? 'text-stone-900 dark:text-white' : 'text-stone-500'}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
      <UpdateDialog update={update} onClose={() => setUpdate(null)} />
      <PieceDefs />
      <WebUpdateBanner />
      <CelebrationLayer />
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 flex justify-center">
          <div className="rounded-full bg-stone-800 px-4 py-2 text-sm text-white shadow-lg">Press back again to exit — your game is saved</div>
        </div>
      )}
    </div>
  );
}

/** The launch screen, matching the one in index.html, while settings load. */
function Splash() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-[18px] bg-[#312e2b]">
      <img src="./icon.svg" alt="" width={112} height={112} className="rounded-[14px] shadow-[0_12px_32px_rgba(0,0,0,0.28)]" />
      <div className="font-display text-[26px] text-white">Chess Coach</div>
    </div>
  );
}
