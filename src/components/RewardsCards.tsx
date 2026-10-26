// Progress-tab entry points: journey, skill tree, collection and career statistics.
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNav } from '../lib/nav';
import { getCareer, TACTIC_KEYS, TACTIC_LABEL, type TacticCounts } from '../lib/rewards/career';
import { COSMETICS, isUnlocked, unlockContext } from '../lib/rewards/cosmetics';
import { getGameRating, MILESTONES, titleFor, type GameRating } from '../lib/rewards/rating';
import { skillStates, TIERS, type SkillState } from '../lib/rewards/skills';
import { Glyph, Medallion } from './Glyph';

function useRefresh() {
  const tab = useNav((s) => s.tab);
  const depth = useNav((s) => s.stack.length);
  return `${tab}:${depth}`;
}

export function RewardsCards() {
  const push = useNav((s) => s.push);
  const key = useRefresh();
  const [r, setR] = useState<GameRating | null>(null);
  const [skills, setSkills] = useState<Record<string, SkillState>>({});
  const [owned, setOwned] = useState(0);
  useEffect(() => {
    void getGameRating().then(setR);
    void skillStates().then(setSkills);
    void unlockContext().then((ctx) => setOwned(COSMETICS.filter((c) => isUnlocked(c, ctx)).length));
  }, [key]);
  const next = r ? MILESTONES.find((m) => m.rating > r.peak) : undefined;
  const medals = [1, 2, 3].map((t) => Object.values(skills).filter((s) => s.tier >= t).length);

  return (
    <div className="space-y-2.5">
      <button className="card relative flex w-full items-center gap-3 overflow-hidden !p-3.5 text-left active:scale-[0.99]" onClick={() => push({ name: 'journey' })}>
        <span className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-gold-300/25 to-transparent" />
        <Medallion name="map" tint="gold" size={48} />
        <span className="relative flex-1">
          <span className="block text-xs font-bold tracking-wider text-stone-500 uppercase">Your journey</span>
          <span className="block font-display text-xl leading-tight font-semibold">
            {r?.rating ?? '…'} · {r ? titleFor(r.peak) : ''}
          </span>
          {next && r && <span className="block text-xs text-stone-500">{next.rating - r.peak} to {next.title}</span>}
        </span>
        <ChevronRight className="relative text-stone-400" size={20} />
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        <button className="card flex flex-col gap-2 !p-3 text-left active:scale-[0.98]" onClick={() => push({ name: 'skills' })}>
          <span className="flex items-center justify-between">
            <span className="font-semibold">Skill tree</span>
            <Glyph name="tree" size={18} className="text-brand-600" />
          </span>
          <span className="flex gap-1.5">
            {[1, 2, 3].map((t, i) => (
              <span key={t} className="flex items-center gap-1 text-sm font-bold">
                <span className="h-3 w-3 rounded-full" style={{ background: TIERS[t].color }} />
                {medals[i]}
              </span>
            ))}
          </span>
        </button>
        <button className="card flex flex-col gap-2 !p-3 text-left active:scale-[0.98]" onClick={() => push({ name: 'collection' })}>
          <span className="flex items-center justify-between">
            <span className="font-semibold">Collection</span>
            <Glyph name="palette" size={18} className="text-brand-600" />
          </span>
          <span className="text-sm">
            <b>{owned}</b> <span className="text-stone-500">of {COSMETICS.length} unlocked</span>
          </span>
        </button>
      </div>
    </div>
  );
}

/** Career statistics: the tactics you've played in real games. */
export function CareerCard() {
  const key = useRefresh();
  const [c, setC] = useState<TacticCounts>({});
  useEffect(() => void getCareer().then(setC), [key]);
  return (
    <div className="card !p-3">
      <div className="mb-2 text-sm font-semibold text-stone-500">Your chess career</div>
      <div className="grid grid-cols-3 gap-2">
        {TACTIC_KEYS.map((k) => (
          <div key={k} className={`flex flex-col items-center rounded-xl bg-stone-100 px-1 py-2 text-center dark:bg-stone-800/60 ${c[k] ? '' : 'opacity-50'}`}>
            <Glyph name={TACTIC_LABEL[k].icon} size={16} className="text-brand-600" />
            <span className="text-lg leading-tight font-bold">{c[k] ?? 0}</span>
            <span className="text-[10px] leading-tight text-stone-500">{TACTIC_LABEL[k].many}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
