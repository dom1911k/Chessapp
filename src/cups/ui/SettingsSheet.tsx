// Cups look and sound: music, effects, CRT, motion, animation speed, and the pixel board and
// pieces (more are in the Laurel shop).
import { useRunSettings } from '../settings';
import { applyVolumes, sfx } from '../sfx';
import { BOARD_THEMES, PIECE_SETS, tileSprite } from '../pixel/board';
import { useCupsMeta } from '../meta';
import { boardOwned, piecesOwned } from '../laurels';
import { Sprite } from '../pixel/sprites';
import { TUNING } from '../tuning';
import { Sheet } from './Sheet';
import { PixelText } from './PixelText';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const rs = useRunSettings();
  const owned = useCupsMeta((s) => s.unlocks);
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between">
        <PixelText text="Settings" size={2.5} />
        <button className="run-btn ghost px-3! py-1.5! text-sm" onClick={onClose}>Close</button>
      </div>
      <label className="mt-4 block">
        <span className="run-label">Music · {Math.round(rs.music * 100)}%</span>
        <input type="range" className="run-range w-full" min={0} max={1} step={0.05} value={rs.music} onChange={(e) => (rs.set({ music: Number(e.target.value) }), applyVolumes())} />
      </label>
      <label className="mt-3 block">
        <span className="run-label">Sound effects · {Math.round(rs.sfx * 100)}%</span>
        <input type="range" className="run-range w-full" min={0} max={1} step={0.05} value={rs.sfx} onChange={(e) => (rs.set({ sfx: Number(e.target.value) }), applyVolumes())} onPointerUp={() => sfx('move')} />
      </label>
      <div className="mt-3">
        <span className="run-label">CRT effect</span>
        <div className="mt-1 flex gap-1">
          {(['Off', 'Subtle', 'Strong'] as const).map((l, i) => (
            <button key={l} className={`run-btn flex-1 px-2! py-1.5! text-sm ${rs.crt === i ? '' : 'ghost'}`} onClick={() => rs.set({ crt: i as 0 | 1 | 2 })}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <span className="run-label">Animation speed</span>
        <div className="mt-1 flex gap-1">
          {TUNING.juice.speeds.map((v) => (
            <button key={v} className={`run-btn flex-1 px-2! py-1.5! text-sm ${(rs.speed ?? 1) === v ? '' : 'ghost'}`} onClick={() => rs.set({ speed: v })}>{v}×</button>
          ))}
        </div>
      </div>
      <label className="mt-3 flex items-center justify-between">
        <span className="run-sans text-sm">Reduce motion</span>
        <input type="checkbox" className="h-5 w-5 accent-[#e0a93a]" checked={rs.reduceMotion} onChange={(e) => rs.set({ reduceMotion: e.target.checked })} />
      </label>
      <div className="mt-3">
        <span className="run-label">Board</span>
        <div className="mt-1 flex gap-1.5">
          {Object.values(BOARD_THEMES).map((t) => {
            const own = boardOwned(owned, t.id);
            return (
              <button key={t.id} disabled={!own} onClick={() => rs.set({ board: t.id })} className="pixelated flex h-11 flex-1 items-center justify-center disabled:opacity-35" title={t.name}
                style={{ background: `url(${tileSprite(t, true, 0)}) 0 0 / 50% 100% no-repeat, url(${tileSprite(t, false, 2)}) 100% 0 / 50% 100% no-repeat`, boxShadow: `0 0 0 2px #1b0f22, 0 0 0 ${rs.board === t.id ? 4 : 3}px ${rs.board === t.id ? 'var(--gold-2)' : t.frame[1]}` }}>
                {!own && <Sprite name="lock" size={18} px={10} />}
              </button>
            );
          })}
        </div>
        <span className="run-label mt-2 block">Pieces</span>
        <div className="mt-1 flex gap-1.5">
          {Object.keys(PIECE_SETS).map((id) => {
            const own = piecesOwned(owned, id);
            return (
              <button key={id} disabled={!own} className={`run-btn flex-1 px-2! py-1.5! text-xs ${rs.pieces === id ? '' : 'ghost'}`} onClick={() => rs.set({ pieces: id })}>
                {!own && '🔒 '}{id === 'board' ? 'Match board' : PIECE_SETS[id]!.name}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
