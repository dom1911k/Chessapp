import { Maia3Bench } from '../components/Maia3Bench';
import { Header, Segmented, Toggle } from '../components/ui';
import { useSettings } from '../lib/settings';
import { useNav } from '../lib/nav';
import { COSMETICS, isUnlocked, unlockContext } from '../lib/rewards/cosmetics';
import { BackupCard } from '../components/BackupCard';
import { ChessComCard } from '../components/ChessCom';
import { COACH_LEVELS } from '../lib/coach/level';
import { ResetCard } from '../components/ResetCard';
import { useRunFlag } from '../cups/flag';
import { UpdateCard } from '../components/UpdatePanel';
import { FeedbackCard } from '../components/FeedbackCard';
import { applyReminder, remindersSupported } from '../lib/reminders';
import { playSound, previewPack, SOUND_PACKS } from '../lib/sound';
import { useEffect, useState } from 'react';
import { Check, ChevronRight, Palette } from 'lucide-react';

export function SettingsScreen() {
  const s = useSettings();
  const push = useNav((n) => n.push);
  const runMode = useRunFlag();
  const [unlockedSounds, setUnlockedSounds] = useState<string[]>(['standard', 'wood', 'felt', 'deep', 'clack', 'marble', 'minimal']);
  useEffect(() => void unlockContext().then((ctx) => setUnlockedSounds(COSMETICS.filter((c) => c.kind === 'snd' && isUnlocked(c, ctx)).map((c) => c.key))), []);
  return (
    <div className="flex h-full flex-col">
      <Header title="Settings" back />
      <div className="mx-auto w-full max-w-md flex-1 space-y-4 overflow-y-auto p-4">
        <div className="card">
          <div className="mb-2 section-title">Appearance</div>
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
          <Toggle checked={s.haptics} onChange={(v) => s.set({ haptics: v })} label="Vibration on captures and key moves" />
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
              <div className="section-title">Sound set</div>
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
          <Toggle checked={s.showLegalMoves} onChange={(v) => s.set({ showLegalMoves: v })} label="Show legal moves" />
          <Toggle checked={s.premoves} onChange={(v) => s.set({ premoves: v })} label="Premoves (queue a move while the opponent thinks)" />
          <div className="py-2">
            <div className="mb-1.5 text-sm">Piece animation</div>
            <Segmented
              value={s.moveSpeed}
              onChange={(v) => s.set({ moveSpeed: v })}
              options={[
                { value: 'slow', label: 'Slow' },
                { value: 'normal', label: 'Normal' },
                { value: 'fast', label: 'Fast' },
                { value: 'instant', label: 'None' },
              ]}
            />
            <p className="mt-1.5 text-xs text-stone-500">Long-press a square (or right-click) and drag to draw an arrow; release on the same square for a circle. Tap the board to clear.</p>
          </div>
        </div>
        <div className="card divide-y divide-stone-100 dark:divide-stone-800">
          <div className="pb-1 section-title">Coaching</div>
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
          {s.opponentEngine === 'maia' && (
            <div className="py-2">
              <div className="mb-1.5 text-sm">Human-like brain</div>
              <Segmented
                value={s.maiaVersion}
                onChange={(v) => s.set({ maiaVersion: v })}
                options={[
                  { value: 'maia3', label: 'Maia-3' },
                  { value: 'maia1', label: 'Maia-1 (classic)' },
                ]}
              />
              <p className="mt-1.5 text-xs text-stone-500">
                {s.maiaVersion === 'maia3' ? 'One model for every rating that also knows your strength: its mistakes are the ones real players at that level make.' : 'The original networks, one per rating band. Use this if Maia-3 is slow on your device.'}
              </p>
            </div>
          )}
          <div className="py-2">
            <div className="mb-1.5 text-sm">Coach level (normal games)</div>
            <Segmented
              value={s.coachLevel}
              onChange={(v) => s.set({ coachLevel: v, coachLevelSince: Date.now() })}
              options={COACH_LEVELS.map((l) => ({ value: l.id, label: l.label }))}
            />
            <p className="mt-1.5 text-xs text-stone-500">
              {COACH_LEVELS.find((l) => l.id === s.coachLevel)?.text} After 5 wins at a level, I'll suggest the next one down — Match conditions after Silent. It's always your call.
            </p>
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
        <ChessComCard />
        <ReminderCard />
        <UpdateCard />
        <BackupCard />
        <ResetCard />
        <FeedbackCard />
        <div className="card">
          <Toggle checked={runMode.enabled} onChange={runMode.set} label="Show the Cups tab" />
          <p className="mt-1 text-xs text-stone-500">Knockout tournaments of real games against the bots, with boons, charms and Laurels to collect.</p>
        </div>
        <div className="card">
          <div className="section-title">Developer</div>
          <Maia3Bench />
        </div>
        <p className="px-2 text-xs text-stone-500">
          Chess Coach runs fully offline (the optional chess.com import is the only thing that uses the internet). Engine: Stockfish 19 (GPLv3). Human-like opponents: Maia by the University of Toronto CSSLab (Maia-1: GPLv3, Leela Chess Zero networks; Maia-3: AGPLv3, run with ONNX Runtime, MIT). Puzzles: Lichess puzzle database (CC0). Standard piece sounds: recordings from Lichess (AGPLv3+). Portraits and avatars: painted illustrations made for this app.
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
      <div className="section-title">Daily reminder</div>
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
