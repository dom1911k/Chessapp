import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useEffect, useState, type ReactNode } from 'react';
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
import { UpdateDialog } from './components/UpdatePanel';
import { autoCheck, type UpdateInfo } from './lib/update';

const TABS: { tab: Tab; label: string; icon: ReactNode }[] = [
  { tab: 'play', label: 'Play', icon: <path d="M9 3h6l-1 3h2l-1.5 4H16l1 9H7l1-9h1.5L8 6h2z" /> },
  { tab: 'puzzles', label: 'Puzzles', icon: <path d="M10 3a2 2 0 0 1 4 0v2h4v4h-2a2 2 0 0 0 0 4h2v6h-6v-2a2 2 0 0 0-4 0v2H4v-6h2a2 2 0 0 0 0-4H4V5h6z" /> },
  { tab: 'daily', label: 'Daily', icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4" /></> },
  { tab: 'learn', label: 'Learn', icon: <path d="M4 6l8-3 8 3-8 3-8-3zm2 2v6c0 1.5 3 3 6 3s6-1.5 6-3V8M20 6v6" /> },
  { tab: 'progress', label: 'Progress', icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
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
    void useSettings.getState().load().then(() => usePlay.getState().load());
    // Look for a new version (at most once a day, silently skipped when offline).
    const t = setTimeout(() => void autoCheck().then(setUpdate), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!loaded) return null;
  const top = stack[stack.length - 1];

  return (
    <div className="flex h-full flex-col">
      <main className="relative min-h-0 flex-1">
        {/* Tabs stay mounted underneath pushed screens so their state survives. */}
        <div className={top ? 'hidden' : 'h-full'}>
          <TabScreen tab={tab} />
        </div>
        {top && (
          <div key={stack.length} className="h-full overflow-hidden">
            <StackScreen screen={top} />
          </div>
        )}
      </main>
      {!top && (
        <nav className="safe-bottom border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto flex max-w-xl">
            {TABS.map((t) => (
              <button
                key={t.tab}
                onClick={() => setTab(t.tab)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  tab === t.tab ? 'text-brand-600 dark:text-brand-500' : 'text-stone-500'
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
                  {t.icon}
                </svg>
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}
      <UpdateDialog update={update} onClose={() => setUpdate(null)} />
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 flex justify-center">
          <div className="rounded-full bg-stone-800 px-4 py-2 text-sm text-white shadow-lg">Press back again to exit — your game is saved</div>
        </div>
      )}
    </div>
  );
}
