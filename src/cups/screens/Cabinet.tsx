// The trophy cabinet: per tier, cups won, best finish, fastest win and two special records.
import { cabinet } from '../laurels';
import { tierInfo } from '../ladder';
import { useCupsMeta } from '../meta';
import { useCup } from '../store';
import { Sprite } from '../pixel/sprites';
import { PixelText } from '../ui/PixelText';
import { Stars, TIER_PAL } from './TierList';
import { QUIRKS } from '../quirks';
import { TUNING } from '../tuning';
import { allStars, starCount, STAR_NAMES } from '../mastery';
import { opponentById } from '../../lib/people';
import { SPIRIT } from '../pixel/pixelize';

const BEST = { winner: 'Won', final: 'Final', semi: 'Semi-final', quarter: 'Quarter-final' } as const;

export function Cabinet({ onBack }: { onBack: () => void }) {
  const meta = useCupsMeta();
  const history = meta.history;
  const trophies = useCup((s) => s.trophies);
  const rows = cabinet(history ?? [], trophies);
  return (
    <div className="run-fadeup flex h-full flex-col overflow-y-auto px-4 pt-5 pb-6">
      <button className="run-btn ghost self-start px-3! py-1.5! text-sm" onClick={onBack}>Back</button>
      <div className="mt-2 text-center">
        <PixelText text="Trophy cabinet" size={3} />
        <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">{(history ?? []).length} cups played · {starCount(meta.stars ?? {})}/{allStars()} stars · {meta.contractsDone ?? 0} contracts fulfilled</div>
        <div className="run-sans mt-1 text-[11px] text-[var(--ink-dim)]">Stars: {STAR_NAMES.join(' · ')}</div>
      </div>
      <div className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.tier} className="run-panel px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Sprite name={r.won ? 'crown' : 'lock'} size={40} px={16} pal={TIER_PAL[r.tier]} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="run-title text-lg leading-tight font-black">{tierInfo(r.tier).name}</span><Stars got={meta.stars?.[r.tier]} /></div>
                <div className="run-sans text-xs text-[var(--ink-dim)]">Best finish: {r.best ? BEST[r.best] : 'not played yet'}{meta.heatBest?.[r.tier] ? ` · best heat ${meta.heatBest[r.tier]}` : ''}</div>
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
      <section className="mt-5">
        <div className="run-label">Quirk codex · {QUIRKS.filter((q) => (meta.codex?.[q.id]?.beaten ?? 0) > 0).length}/{QUIRKS.length} beaten</div>
        <div className="run-sans mb-2 text-xs text-[var(--ink-dim)]">Beat an opponent with each quirk once: +{TUNING.mastery.codexLaurels} Laurel each, and the Quirk Hunter title and frame for all of them.</div>
        <div className="grid grid-cols-2 gap-1.5">
          {QUIRKS.map((q) => {
            const e = meta.codex?.[q.id];
            const seen = (e?.faced ?? 0) > 0;
            const beat = (e?.beaten ?? 0) > 0;
            return (
              <div key={q.id} className={`run-panel flex items-center gap-2 px-2 py-1.5 ${beat ? '' : seen ? 'opacity-80' : 'opacity-45'}`}>
                <Sprite name={seen ? q.glyph : 'question'} size={22} px={12} pal={SPIRIT} />
                <div className="min-w-0 flex-1">
                  <div className="run-title truncate text-xs font-black">{seen ? q.name : '???'}</div>
                  <div className="run-sans text-[10px] text-[var(--ink-dim)]">{seen ? `${e!.beaten}/${e!.faced} won` : 'not met yet'}</div>
                </div>
                {beat && <span className="text-[var(--gold-2)]">✓</span>}
              </div>
            );
          })}
        </div>
      </section>
      <section className="run-panel mt-4 px-3 py-2.5">
        <div className="run-label">Nemesis</div>
        {meta.nemesis ? (
          <div className="run-sans text-sm"><b className="text-[#ff8a98]">{opponentById(meta.nemesis.id)?.name}</b> has knocked you out {meta.nemesis.grudge === 1 ? 'once' : `${meta.nemesis.grudge} times`}. They wait in your next cup.</div>
        ) : (
          <div className="run-sans text-sm text-[var(--ink-dim)]">No nemesis right now. Whoever knocks you out next becomes one.</div>
        )}
        <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">Nemeses defeated: {(meta.nemesesBeaten ?? []).length ? meta.nemesesBeaten.map((id) => opponentById(id)?.name ?? id).join(', ') : 'none yet'}</div>
      </section>
      <p className="run-sans mt-4 text-center text-xs text-[var(--ink-dim)]">Winning a cup also unlocks avatar frames and titles (Profile → tap your picture).</p>
    </div>
  );
}
