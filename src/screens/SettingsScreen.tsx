import { Header, Segmented, Toggle } from '../components/ui';
import { BOARD_THEMES, useSettings, type BoardTheme } from '../lib/settings';
import { BackupCard } from '../components/BackupCard';
import { UpdateCard } from '../components/UpdatePanel';
import { FeedbackCard } from '../components/FeedbackCard';
import { applyReminder, remindersSupported } from '../lib/reminders';
import { playSound, previewPack, SOUND_PACKS } from '../lib/sound';
import { useState } from 'react';
import { Check } from 'lucide-react';

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
          <div className="mt-3 mb-1 text-sm font-semibold text-stone-500">Pieces</div>
          <Segmented
            value={s.pieceStyle}
            onChange={(pieceStyle) => s.set({ pieceStyle })}
            options={[
              { value: 'wood', label: 'Wood' },
              { value: 'classic', label: 'Classic' },
            ]}
          />
          <Toggle checked={s.largePieces} onChange={(v) => s.set({ largePieces: v })} label="Larger pieces" />
          <Toggle checked={s.showCoordinates} onChange={(v) => s.set({ showCoordinates: v })} label="Board coordinates" />
          <Toggle checked={s.sound} onChange={(v) => s.set({ sound: v })} label="Sound effects" />
          {s.sound && (
            <label className="flex items-center gap-3 py-1 text-sm">
              <span>Volume</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={s.soundVolume}
                onChange={(e) => s.set({ soundVolume: Number(e.target.value) })}
                onPointerUp={() => playSound('move')}
                className="flex-1 accent-brand-600"
              />
            </label>
          )}
          {s.sound && (
            <div className="space-y-1.5 py-2">
              <div className="text-sm font-semibold text-stone-500">Sound set</div>
              {Object.entries(SOUND_PACKS).map(([id, pack]) => (
                <div key={id} className={`flex items-center gap-2 rounded-xl p-2 ring-1 ${s.soundPack === id ? 'bg-brand-50 ring-brand-500 dark:bg-brand-700/20' : 'ring-stone-200 dark:ring-stone-700'}`}>
                  <button className="flex-1 text-left" onClick={() => { s.set({ soundPack: id }); previewPack(id); }}>
                    <span className="block text-sm font-semibold">{pack.label}{s.soundPack === id ? <Check size={14} strokeWidth={3} className="ml-1 inline -translate-y-px text-brand-600" /> : null}</span>
                    <span className="block text-xs text-stone-500">{pack.description}</span>
                  </button>
                  <button className="btn-secondary !px-3 !py-1.5" aria-label={`Preview ${pack.label}`} onClick={() => previewPack(id)}>▶</button>
                </div>
              ))}
            </div>
          )}
          <Toggle checked={s.confirmMoves} onChange={(v) => s.set({ confirmMoves: v })} label="Confirm each move (prevents slips)" />
        </div>
        <div className="card divide-y divide-stone-100 dark:divide-stone-800">
          <div className="pb-1 text-sm font-semibold text-stone-500">Coaching</div>
          <Toggle checked={s.pauseOnMistakes} onChange={(v) => s.set({ pauseOnMistakes: v })} label="Pause and explain mistakes" />
          <Toggle checked={s.botNotes} onChange={(v) => s.set({ botNotes: v })} label="Point out threats from the bot's moves" />
          <Toggle checked={s.safetyOverlay} onChange={(v) => s.set({ safetyOverlay: v })} label="Safety overlay (hanging pieces & threats)" />
          <Toggle checked={s.showEvalBar} onChange={(v) => s.set({ showEvalBar: v })} label="Show evaluation bar" />
        </div>
        <ReminderCard />
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

function ReminderCard() {
  const s = useSettings();
  const [denied, setDenied] = useState(false);
  if (!remindersSupported()) return null;
  const apply = async (enabled: boolean, time: string) => {
    const ok = await applyReminder(enabled, time);
    setDenied(!ok);
    s.set({ reminderEnabled: ok && enabled, reminderTime: time });
  };
  return (
    <div className="card">
      <div className="text-sm font-semibold text-stone-500">Daily reminder</div>
      <Toggle checked={s.reminderEnabled} onChange={(v) => void apply(v, s.reminderTime)} label="Remind me to train every day" />
      {s.reminderEnabled && (
        <label className="flex items-center justify-between py-1 text-sm">
          <span>Time</span>
          <input
            type="time"
            value={s.reminderTime}
            onChange={(e) => e.target.value && void apply(true, e.target.value)}
            className="rounded-lg bg-stone-100 px-2 py-1 dark:bg-stone-800"
          />
        </label>
      )}
      {denied && <p className="text-sm text-red-600">Notifications are blocked. Allow them for Chess Coach in Android settings.</p>}
    </div>
  );
}
