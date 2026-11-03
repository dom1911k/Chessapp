// Between runs: the run history and Run mode's settings sheet (volumes, CRT, motion, board,
// abandon run). The old Sanctum is now the Order (screens/Order.tsx).
import { useEffect, useState } from 'react';
import { runDb } from '../db';
import { boardUnlocked, piecesUnlocked, useMeta } from '../meta';
import { ROOM_NAME, RELICS } from '../content';
import { useRunSettings } from '../settings';
import { applyVolumes, sfx } from '../sfx';
import { useRun } from '../store';
import type { Run } from '../types';
import { BOARD_THEMES, PIECE_SETS, pieceSprite, tileSprite } from '../pixel/board';
import { PixelPortrait, Sprite } from '../pixel/sprites';
import { GOLD } from '../pixel/pixelize';
import { MaterialRow, PixelNum } from './bits';
import { PixelText } from './PixelText';

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button className="run-btn ghost px-3! py-2!" onClick={onClick}>
      ← Back
    </button>
  );
}

export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const [runs, setRuns] = useState<(Run & { pk?: number })[] | null>(null);
  useEffect(() => {
    void runDb.runs
      .orderBy('startedAt')
      .reverse()
      .limit(50)
      .toArray()
      .then(setRuns)
      .catch(() => setRuns([]));
  }, []);
  const best = Math.max(0, ...(runs ?? []).map((r) => r.finalScore ?? 0));
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <Back onClick={onBack} />
      </div>
      <div className="mt-2 flex flex-col items-center">
        <PixelText text="Past runs" size={3} />
        {runs && runs.length > 0 && <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">Best score {best}</div>}
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-6">
        {runs?.length === 0 && <div className="run-sans py-10 text-center text-sm text-[var(--ink-dim)]">No finished runs yet.</div>}
        {runs?.map((r, i) => {
          const date = new Date(r.startedAt);
          const won = r.ended === 'won';
          const isBest = (r.finalScore ?? 0) === best && best > 0;
          return (
            <div key={r.pk ?? i} className="run-panel p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PixelPortrait id={r.bossId} size={34} px={24} boss={!won} />
                  <div>
                    <div className="run-title text-base leading-tight font-bold" style={{ color: won ? 'var(--gold-2)' : r.abandoned ? 'var(--ink-dim)' : 'var(--blood)' }}>
                      {won ? 'Victory' : r.abandoned ? 'Abandoned' : 'Defeat'} {isBest && <span className="run-sans text-[10px] text-[#5ee59a]">★ best</span>}
                    </div>
                    <div className="run-sans text-[11px] text-[var(--ink-dim)]">
                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {r.cursed ? ' · cursed' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <PixelNum value={r.finalScore ?? 0} size={2.5} />
                  {r.materials ? <MaterialRow m={{ ...r.materials, ...(r.seals ? { seals: r.seals } : {}) }} size={12} /> : null}
                </div>
              </div>
              <div className="run-sans mt-2 flex flex-wrap gap-1 text-[10px]">
                {r.results.map((x, k) => (
                  <span key={k} className="bg-black/40 px-1.5 py-0.5" style={{ boxShadow: `inset 0 -2px 0 ${x.won ? '#5ee59a' : '#e2475a'}` }}>
                    {ROOM_NAME[x.kind]}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1">
                {r.relics.map((id) => (
                  <Sprite key={id} name={RELICS[id]?.glyph ?? 'star'} size={18} px={12} pal={GOLD} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const rs = useRunSettings();
  const meta = useMeta();
  const run = useRun((s) => s.run);
  const abandon = useRun((s) => s.abandonRun);
  const [confirm, setConfirm] = useState(false);
  const canAbandon = !!run && !run.ended;
  return (
    <div className="fixed inset-0 z-[68] flex items-end bg-black/60" onClick={onClose}>
      <div className="run-panel run-fadeup max-h-[85%] w-full overflow-y-auto rounded-b-none p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <PixelText text="Settings" size={2.5} />
          <button className="run-btn ghost px-3! py-1.5! text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="mt-4 block">
          <span className="run-label">Music · {Math.round(rs.music * 100)}%</span>
          <input type="range" className="run-range" min={0} max={1} step={0.05} value={rs.music} onChange={(e) => (rs.set({ music: Number(e.target.value) }), applyVolumes())} />
        </label>
        <label className="mt-3 block">
          <span className="run-label">Sound effects · {Math.round(rs.sfx * 100)}%</span>
          <input type="range" className="run-range" min={0} max={1} step={0.05} value={rs.sfx} onChange={(e) => (rs.set({ sfx: Number(e.target.value) }), applyVolumes())} onPointerUp={() => sfx('move')} />
        </label>
        <div className="mt-3">
          <span className="run-label">CRT effect</span>
          <div className="mt-1 flex gap-1">
            {(['Off', 'Subtle', 'Strong'] as const).map((l, i) => (
              <button key={l} className={`run-btn flex-1 px-2! py-1.5! text-sm ${rs.crt === i ? '' : 'ghost'}`} onClick={() => rs.set({ crt: i as 0 | 1 | 2 })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 flex items-center justify-between">
          <span className="run-sans text-sm">Reduce motion (no shakes or pulses)</span>
          <input type="checkbox" className="h-5 w-5 accent-[#e0a93a]" checked={rs.reduceMotion} onChange={(e) => rs.set({ reduceMotion: e.target.checked })} />
        </label>
        <div className="mt-3">
          <span className="run-label">Board</span>
          <div className="mt-1 flex gap-1.5">
            {Object.values(BOARD_THEMES).map((t) => {
              const own = boardUnlocked(meta, t.id);
              return (
                <button
                  key={t.id}
                  disabled={!own}
                  onClick={() => rs.set({ board: t.id })}
                  className="pixelated h-11 flex-1 disabled:opacity-35"
                  title={t.name}
                  style={{ background: `url(${tileSprite(t, true, 0)}) 0 0 / 50% 100% no-repeat, url(${tileSprite(t, false, 2)}) 100% 0 / 50% 100% no-repeat`, boxShadow: `0 0 0 2px #1b0f22, 0 0 0 ${rs.board === t.id ? 4 : 3}px ${rs.board === t.id ? 'var(--gold-2)' : t.frame[1]}` }}
                >
                  {!own && <Sprite name="lock" size={18} px={10} />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            {Object.keys(PIECE_SETS).map((id) => {
              const own = piecesUnlocked(meta, id);
              const t = BOARD_THEMES[rs.board] ?? BOARD_THEMES.crypt;
              return (
                <button
                  key={id}
                  disabled={!own}
                  onClick={() => rs.set({ pieces: id })}
                  className="flex h-11 flex-1 items-center justify-center bg-black/40 disabled:opacity-35"
                  style={{ boxShadow: `0 0 0 2px #1b0f22, 0 0 0 ${(rs.pieces ?? 'board') === id ? 4 : 3}px ${(rs.pieces ?? 'board') === id ? 'var(--gold-2)' : 'var(--gold-dim)'}` }}
                >
                  <img src={pieceSprite(t, 'w', 'K', id)} alt="" className="pixelated h-8 w-8" />
                  <img src={pieceSprite(t, 'b', 'K', id)} alt="" className="pixelated h-8 w-8" />
                </button>
              );
            })}
          </div>
          <div className="run-sans mt-1 text-[11px] text-[var(--ink-dim)]">More boards and piece sets unlock in the Sanctum.</div>
        </div>
        {canAbandon && (
          <div className="mt-5 border-t border-[var(--gold-dim)]/30 pt-4">
            {!confirm ? (
              <button className="run-btn danger w-full" onClick={() => setConfirm(true)}>
                Abandon this run
              </button>
            ) : (
              <div className="text-center">
                <div className="run-sans text-sm">End the run now? You still get Embers for what you cleared.</div>
                <div className="mt-2 flex gap-2">
                  <button className="run-btn ghost flex-1" onClick={() => setConfirm(false)}>
                    Keep playing
                  </button>
                  <button
                    className="run-btn danger flex-1"
                    onClick={() => {
                      abandon();
                      onClose();
                    }}
                  >
                    Abandon
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
