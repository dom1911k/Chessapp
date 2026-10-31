import { Header, Segmented, Toggle } from '../components/ui';
import { useSettings } from '../lib/settings';
import { useNav } from '../lib/nav';
import { COSMETICS, isUnlocked, unlockContext } from '../lib/rewards/cosmetics';
import { BackupCard } from '../components/BackupCard';
import { ResetCard } from '../components/ResetCard';
import { UpdateCard } from '../components/UpdatePanel';
import { FeedbackCard } from '../components/FeedbackCard';
import { applyReminder, remindersSupported } from '../lib/reminders';
import { playSound, previewPack, SOUND_PACKS } from '../lib/sound';
import { useEffect, useState } from 'react';
import { Check, ChevronRight, Palette } from 'lucide-react';

export function SettingsScreen() {
  const s = useSettings();
  const push = useNav((n) => n.push);
  const [unlockedSounds, setUnlockedSounds] = useState<string[]>(['wood', 'felt', 'deep', 'clack', 'marble', 'minimal']);
  useEffect(() => void unlockContext().then((ctx) => setUnlockedSounds(COSMETICS.filter((c) => c.kind === 'snd' && isUnlocked(c, ctx)).map((c) => c.key))), []);
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
          <button className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-gold-300/40 to-transparent p-3 text-left ring-1 ring-gold-400/50" onClick={() => push({ name: 'collection' })}>
            <Palette size={22} className="text-gold-500" />
            <span className="flex-1">
              <span className="block font-semibold">Boards, pieces & effects</span>
              <span className="block text-xs text-stone-500">Choose your look in the Collection — more unlock as you play.</span>
            </span>
            <ChevronRight size={18} className="text-stone-400" />
          </button>
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
              {Object.entries(SOUND_PACKS).filter(([id]) => unlockedSounds.includes(id)).map(([id, pack]) => (
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
          <div className="py-2">
            <div className="mb-1.5 text-sm">Opponent style</div>
            <Segmented
              value={s.opponentEngine}
              onChange={(v) => s.set({ opponentEngine: v })}
              options={[
                { value: 'maia', label: 'Human-like (Maia)' },
                { value: 'stockfish', label: 'Classic' },
              ]}
            />
          </div>
          <div className="py-2">
            <div className="mb-1.5 text-sm">How chatty is Coach Sam?</div>
            <Segmented
              value={s.coachStyle}
              onChange={(v) => s.set({ coachStyle: v })}
              options={[
                { value: 'gentle', label: 'Gentle' },
                { value: 'detailed', label: 'Every move' },
                { value: 'off', label: 'Off' },
              ]}
            />
            <p className="mt-1.5 text-xs text-stone-500">
              {s.coachStyle === 'gentle'
                ? 'Sam only speaks up when a move really costs you, and cheers you on now and then. Full details are in the game report.'
                : s.coachStyle === 'detailed'
                  ? 'Sam comments on every move, including small slips and missed chances.'
                  : 'Sam stays quiet while you play and you see the list of moves instead — tap a move to look back. Hints still work, and the game report has all the feedback.'}
            </p>
          </div>
          <Toggle checked={s.checkBeforeMove} onChange={(v) => s.set({ checkBeforeMove: v })} label='Ask "are you sure?" before a risky move' />
          <Toggle checked={s.pauseOnMistakes} onChange={(v) => s.set({ pauseOnMistakes: v })} label="Pause and explain mistakes" />
          <Toggle checked={s.botNotes} onChange={(v) => s.set({ botNotes: v })} label="Point out threats from the bot's moves" />
          <Toggle checked={s.safetyOverlay} onChange={(v) => s.set({ safetyOverlay: v })} label="Safety overlay (hanging pieces & threats)" />
          <Toggle checked={s.showEvalBar} onChange={(v) => s.set({ showEvalBar: v })} label="Show evaluation bar" />
        </div>
        <ReminderCard />
        <UpdateCard />
        <BackupCard />
        <ResetCard />
        <FeedbackCard />
        <p className="px-2 text-xs text-stone-500">
          Chess Coach runs fully offline. Engine: Stockfish 19 (GPLv3). Human-like opponents: Maia by the University of Toronto CSSLab (GPLv3), running Leela Chess Zero networks. Puzzles: Lichess puzzle database (CC0).
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
