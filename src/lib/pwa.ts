// The web app (GitHub Pages / iPhone home screen): offline service worker and updates.
// Only active in the web build (VITE_PWA=1); the Android app updates through its APK updater.
import { create } from 'zustand';

export const isWebApp = import.meta.env.VITE_PWA === '1';
export const webVersion: string = import.meta.env.VITE_APP_VERSION ?? 'web';

interface PwaStore {
  /** A new version has been downloaded and is waiting. */
  needRefresh: boolean;
  checking: boolean;
  apply(): void;
  check(): Promise<void>;
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;

export const usePwa = create<PwaStore>((set) => ({
  needRefresh: false,
  checking: false,
  apply() {
    if (updateSW) void updateSW(true);
    else location.reload();
  },
  async check() {
    set({ checking: true });
    try {
      await registration?.update();
    } catch {
      /* offline */
    }
    set({ checking: false });
  },
}));

export async function registerWebApp() {
  if (!isWebApp || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  updateSW = registerSW({
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onRegisteredSW: (_url, reg) => {
      registration = reg;
      // Look for a new version whenever the app comes back to the foreground (and hourly).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg?.update().catch(() => undefined);
      });
      setInterval(() => void reg?.update().catch(() => undefined), 60 * 60 * 1000);
    },
  });
}

/** iPhone/iPad Safari that hasn't been added to the home screen yet. */
export function needsHomeScreenHint(): boolean {
  if (!isWebApp) return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}
