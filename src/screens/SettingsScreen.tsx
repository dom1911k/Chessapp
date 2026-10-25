import { Header, Segmented, Toggle } from '../components/ui';
import { useSettings } from '../lib/settings';
import { BackupCard } from '../components/BackupCard';

export function SettingsScreen() {
  const s = useSettings();
  return (
    <div className="flex h-full flex-col">
      <Header title="Settings" back />
      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto p-4">
        <div className="card">
          <div className="mb-2 text-sm font-semibold text-stone-500">Appearance</div>
          <Segmented
            value={s.theme}
            onChange={(theme) => s.set({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <Toggle checked={s.showCoordinates} onChange={(v) => s.set({ showCoordinates: v })} label="Board coordinates" />
        </div>
        <div className="card divide-y divide-stone-100 dark:divide-stone-800">
          <div className="pb-1 text-sm font-semibold text-stone-500">Coaching</div>
          <Toggle checked={s.pauseOnMistakes} onChange={(v) => s.set({ pauseOnMistakes: v })} label="Pause and explain mistakes" />
          <Toggle checked={s.safetyOverlay} onChange={(v) => s.set({ safetyOverlay: v })} label="Safety overlay (hanging pieces & threats)" />
          <Toggle checked={s.showEvalBar} onChange={(v) => s.set({ showEvalBar: v })} label="Show evaluation bar" />
        </div>
        <BackupCard />
        <p className="px-2 text-xs text-stone-500">
          Chess Coach runs fully offline. Engine: Stockfish 19 (GPLv3). Puzzles: Lichess puzzle database (CC0).
        </p>
      </div>
    </div>
  );
}
