// The trophy cabinet: per tier, cups won, best finish, fastest win and two special records.
import { cabinet } from '../laurels';
import { tierInfo } from '../ladder';
import { useCupsMeta } from '../meta';
import { useCup } from '../store';
import { Sprite } from '../pixel/sprites';
import { PixelText } from '../ui/PixelText';
import { TIER_PAL } from './TierList';

const BEST = { winner: 'Won', final: 'Final', semi: 'Semi-final', quarter: 'Quarter-final' } as const;

export function Cabinet({ onBack }: { onBack: () => void }) {
  const history = useCupsMeta((s) => s.history);
  const trophies = useCup((s) => s.trophies);
  const rows = cabinet(history ?? [], trophies);
  return (
    <div className="run-fadeup flex h-full flex-col overflow-y-auto px-4 pt-5 pb-6">
      <button className="run-btn ghost self-start px-3! py-1.5! text-sm" onClick={onBack}>Back</button>
      <div className="mt-2 text-center">
        <PixelText text="Trophy cabinet" size={3} />
        <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">{(history ?? []).length} cups played</div>
      </div>
      <div className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.tier} className="run-panel px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Sprite name={r.won ? 'crown' : 'lock'} size={40} px={16} pal={TIER_PAL[r.tier]} />
              <div className="min-w-0 flex-1">
                <div className="run-title text-lg leading-tight font-black">{tierInfo(r.tier).name}</div>
                <div className="run-sans text-xs text-[var(--ink-dim)]">Best finish: {r.best ? BEST[r.best] : 'not played yet'}</div>
              </div>
              <div className="text-right">
                <div className="run-title text-2xl font-black text-[var(--gold-2)]">{r.won}×</div>
                <div className="run-label text-[9px]!">won</div>
              </div>
            </div>
            <div className="run-sans mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
              <div className="rounded bg-black/25 px-1 py-1"><div className="text-[var(--ink-dim)]">Fastest win</div><b>{r.fastest !== null ? `${r.fastest} moves` : '—'}</b></div>
              <div className={`rounded px-1 py-1 ${r.noCharms ? 'bg-[var(--gold)]/20' : 'bg-black/25'}`}><div className="text-[var(--ink-dim)]">No charms used</div><b>{r.noCharms ? 'Yes' : '—'}</b></div>
              <div className={`rounded px-1 py-1 ${r.secondChance ? 'bg-[var(--gold)]/20' : 'bg-black/25'}`}><div className="text-[var(--ink-dim)]">Second Chance win</div><b>{r.secondChance ? 'Yes' : '—'}</b></div>
            </div>
          </div>
        ))}
      </div>
      <p className="run-sans mt-4 text-center text-xs text-[var(--ink-dim)]">Winning a cup also unlocks avatar frames and titles (Profile → tap your picture).</p>
    </div>
  );
}
