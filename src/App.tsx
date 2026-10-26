import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useEffect, useState } from 'react';
import { CalendarCheck, ChartColumn, ChessKnight, GraduationCap, Puzzle, type LucideIcon } from 'lucide-react';
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
import { ProgressScreen } from './screens/ProgressScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { ReportScreen } from './screens/ReportScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { EndgameScreen } from './screens/EndgameScreen';
import { OpeningsScreen } from './screens/OpeningsScreen';
import { RushScreen } from './screens/RushScreen';
import { AchievementsScreen } from './components/Gamification';
import { OpeningPracticeScreen } from './screens/OpeningPracticeScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { WebUpdateBanner } from './components/UpdatePanel';
import { LessonScreen } from './screens/LessonScreen';
import { UpdateDialog } from './components/UpdatePanel';
import { CelebrationLayer } from './components/Celebrate';
import { autoCheck, type UpdateInfo } from './lib/update';
import { calibrate } from './lib/engine/speed';
import { applyReminder } from './lib/reminders';

const TABS: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: 'play', label: 'Play', icon: ChessKnight },
  { tab: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { tab: 'daily', label: 'Daily', icon: CalendarCheck },
  { tab: 'learn', label: 'Learn', icon: GraduationCap },
  { tab: 'progress', label: 'Progress', icon: ChartColumn },
];

function TabScreen({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'play':
      return <PlayScreen />;
    case 'puzzles':
      return <PuzzlesScreen />;
    case 'daily':
      return <DailyScreen />;
    case 'learn':
      return <LearnScreen />;
    case 'progress':
      return <ProgressScreen />;
  }
}

function StackScreen({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'explore':
      return <ExploreScreen {...screen} />;
    case 'report':
      return <ReportScreen gameId={screen.gameId} />;
    case 'review':
      return <ReviewScreen gameId={screen.gameId} ply={screen.ply} />;
    case 'history':
      return <HistoryScreen />;
    case 'puzzle':
      return <PuzzleScreen mode={screen.mode} />;
    case 'endgame':
      return <EndgameScreen drillId={screen.drillId} />;
    case 'openings':
      return <OpeningsScreen />;
    case 'rush':
      return <RushScreen />;
    case 'achievements':
      return <AchievementsScreen />;
    case 'openingPractice':
      return <OpeningPracticeScreen index={screen.index} />;
    case 'lesson':
      return <LessonScreen lessonId={screen.lessonId} />;
    case 'practice':
      return <PracticeScreen theme={screen.theme} />;
  }
}

function useTheme() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c0a09' : '#f5f5f4');
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
  const loaded = useSettings((s) => s.loaded);
  const toast = useAndroidBack();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useTheme();

  useEffect(() => {
    requestPersistentStorage();
    void useSettings.getState().load().then(() => {
      const st = useSettings.getState();
      if (st.reminderEnabled) void applyReminder(true, st.reminderTime);
      // Measure engine speed (cached for a month) so analysis fits this phone; runs alongside loading.
      void calibrate();
      return usePlay.getState().load();
    });
    // Look for a new version (at most once a day, silently skipped when offline).
    const t = setTimeout(() => void autoCheck().then(setUpdate), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!loaded) return <Splash />;
  const top = stack[stack.length - 1];

  return (
    <div className="flex h-full flex-col">
      <main className={`relative min-h-0 flex-1 ${top ? 'safe-bottom' : ''}`}>
        {/* Tabs stay mounted underneath pushed screens so their state survives. */}
        <div key={tab} className={top ? 'hidden' : 'animate-fade-in h-full'}>
          <TabScreen tab={tab} />
        </div>
        {top && (
          <div key={stack.length} className="animate-slide-in h-full overflow-hidden">
            <StackScreen screen={top} />
          </div>
        )}
      </main>
      {!top && (
        <nav className="safe-bottom border-t border-stone-200/80 bg-[#fffdf9]/95 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95">
          <div className="mx-auto flex max-w-xl px-2 pt-1.5 pb-1">
            {TABS.map((t) => {
              const active = tab === t.tab;
              const Icon = t.icon;
              return (
                <button key={t.tab} onClick={() => setTab(t.tab)} className="flex flex-1 flex-col items-center gap-0.5 py-1">
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                      active ? 'bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100' : 'text-stone-500'
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                  </span>
                  <span className={`text-[11px] font-semibold ${active ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500'}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
      <UpdateDialog update={update} onClose={() => setUpdate(null)} />
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
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-[18px] bg-[radial-gradient(circle_at_30%_20%,#3aa872,#1f7a4c_55%,#0f4a2f)]">
      <img src="./icon.svg" alt="" width={112} height={112} className="rounded-[26px] shadow-[0_12px_32px_rgba(0,0,0,0.28)]" />
      <div className="font-display text-[26px] font-semibold tracking-wide text-[#fff8ea]">Chess Coach</div>
    </div>
  );
}
