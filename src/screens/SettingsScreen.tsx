import { Header, Segmented, Toggle } from '../components/ui';
import { BOARD_THEMES, useSettings, type BoardTheme } from '../lib/settings';
import { BackupCard } from '../components/BackupCard';
import { UpdateCard } from '../components/UpdatePanel';
import { FeedbackCard } from '../components/FeedbackCard';

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
          <div className="mt-3 mb-1 text-sm font-semibold text-stone-500">Board</div>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((k) => (
              <button
                key={k}
                onClick={() => s.set({ boardTheme: k })}
                className={`overflow-hidden rounded-lg ring-2 ${s.boardTheme === k ? 'ring-brand-600' : 'ring-transparent'}`}
              >
                <div className="grid grid-cols-2">
                  {[0, 1, 1, 0].map((d, i) => (
                    <div key={i} className="h-5" style={{ background: d ? BOARD_THEMES[k].dark : BOARD_THEMES[k].light }} />
                  ))}
                </div>
                <div className="py-0.5 text-xs">{BOARD_THEMES[k].label}</div>
              </button>
            ))}
          </div>
          <Toggle checked={s.largePieces} onChange={(v) => s.set({ largePieces: v })} label="Larger pieces" />
          <Toggle checked={s.showCoordinates} onChange={(v) => s.set({ showCoordinates: v })} label="Board coordinates" />
          <Toggle checked={s.sound} onChange={(v) => s.set({ sound: v })} label="Sound effects" />
          <Toggle checked={s.confirmMoves} onChange={(v) => s.set({ confirmMoves: v })} label="Confirm each move (prevents slips)" />
        </div>
        <div className="card divide-y divide-stone-100 dark:divide-stone-800">
          <div className="pb-1 text-sm font-semibold text-stone-500">Coaching</div>
          <Toggle checked={s.pauseOnMistakes} onChange={(v) => s.set({ pauseOnMistakes: v })} label="Pause and explain mistakes" />
          <Toggle checked={s.botNotes} onChange={(v) => s.set({ botNotes: v })} label="Point out threats from the bot's moves" />
          <Toggle checked={s.safetyOverlay} onChange={(v) => s.set({ safetyOverlay: v })} label="Safety overlay (hanging pieces & threats)" />
          <Toggle checked={s.showEvalBar} onChange={(v) => s.set({ showEvalBar: v })} label="Show evaluation bar" />
        </div>
        <UpdateCard />
        <BackupCard />
        <FeedbackCard />
        <p className="px-2 text-xs text-stone-500">
          Chess Coach runs fully offline. Engine: Stockfish 19 (GPLv3). Puzzles: Lichess puzzle database (CC0).
        </p>
      </div>
    </div>
  );
}
