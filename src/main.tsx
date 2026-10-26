import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { registerWebApp } from './lib/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

void registerWebApp();

if (import.meta.env.DEV) {
  void import('./lib/store/play').then((m) => ((window as unknown as Record<string, unknown>).__play = m.usePlay));
  void import('./lib/db').then((m) => ((window as unknown as Record<string, unknown>).__db = m.db));
  void import('./lib/nav').then((m) => ((window as unknown as Record<string, unknown>).__nav = m.useNav));
}
