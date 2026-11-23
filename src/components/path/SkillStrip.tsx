// After a solve (once the tally has landed): the skill this puzzle trained, from the skill tree
// (the first skill whose puzzle themes include one of the puzzle's), its tier and a bar to the
// next tier filling with this solve's +1. It replaces the old per-theme mastery.
import { useEffect, useState } from 'react';
import { Glyph } from '../Glyph';
import { TIERS, skillForThemes, skillStates, type Skill, type SkillState, type Tier } from '../../lib/rewards/skills';
import { useNav } from '../../lib/nav';

export function SkillStrip({ themes }: { themes: string[] }) {
  const push = useNav((s) => s.push);
  const [st, setSt] = useState<{ skill: Skill; s: SkillState } | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const skill = skillForThemes(themes);
    if (!skill) return;
    let alive = true;
    void skillStates().then((all) => alive && setSt({ skill, s: all[skill.id] }));
    return () => {
      alive = false;
    };
  }, [themes]);
  useEffect(() => {
    if (!st) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, [st]);
  if (!st) return null;
  const { skill, s } = st;
  const lo = TIERS[s.tier].points;
  const hi = s.tier < 3 ? TIERS[(s.tier + 1) as Tier].points : lo;
  const before = s.tier === 3 ? 1 : Math.max(0, Math.min(1, (s.points - 1 - lo) / (hi - lo)));
  const tierUp = s.tier > 0 && s.points - 1 < lo;
  return (
    <button className="animate-reveal mt-3 flex w-full items-center gap-2.5 rounded-[10px] bg-stone-100 px-2.5 py-2 text-left dark:bg-white/[0.05]" onClick={() => push({ name: 'skills' })} data-testid="skill-strip">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-stone-700 dark:bg-white/10 dark:text-stone-200">
        <Glyph name={skill.icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5 text-[13px]">
          <b className="truncate">{skill.name}</b>
          <span className={`text-xs font-bold ${tierUp ? 'animate-pop' : ''}`} style={{ color: TIERS[s.tier].color }}>
            {s.tier === 0 ? 'Getting started' : TIERS[s.tier].name}
          </span>
          <span className="ml-auto shrink-0 text-xs font-extrabold text-[#81b64c]">+1</span>
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
          <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(3, (grown ? s.toNext : before) * 100)}%`, background: TIERS[Math.min(3, s.tier + 1) as Tier].color }} />
        </span>
      </span>
      <span className="shrink-0 text-[11px] text-stone-500 tabular-nums">{s.tier < 3 ? `${s.points} / ${hi}` : `${s.points}`}</span>
    </button>
  );
}
