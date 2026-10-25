import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: never change appId after the first release — Android treats a different
// id as a different app, and your data would not carry over.
const config: CapacitorConfig = {
  appId: 'io.github.dom1911k.chesscoach',
  appName: 'Chess Coach',
  webDir: 'dist',
  android: {
    // The WebView origin (https://localhost) must stay the same between versions so
    // IndexedDB data survives updates.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // Old WebViews get padding; new ones go edge-to-edge and expose env(safe-area-inset-*).
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#23804F',
    },
  },
};

export default config;
