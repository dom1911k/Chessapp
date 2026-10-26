import { useEffect, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { Glyph } from '../components/Glyph';
import { Dialog, Header } from '../components/ui';
import { useNav } from '../lib/nav';
import { getCareer, type TacticCounts } from '../lib/rewards/career';
import { BRANCHES, SKILLS, skillStates, TIERS, type Skill, type SkillState } from '../lib/rewards/skills';
import { THEME_SETS } from '../lib/puzzles/themes';

/** A medal-coloured skill node with a progress ring. */
function SkillNode({ skill, st, onClick }: { skill: Skill; st: SkillState; onClick: () => void }) {
  const tier = TIERS[st.tier];
  const next = TIERS[Math.min(3, st.tier + 1) as 0 | 1 | 2 | 3];
  const C = 2 * Math.PI * 30;
  return (
    <button onClick={onClick} className="flex w-full flex-col items-center gap-1 active:scale-95">
      <span className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-stone-100 dark:bg-stone-950">
        <svg viewBox="0 0 68 68" className="absolute inset-0 -rotate-90">
          <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(120,113,108,0.18)" strokeWidth="5" />
          <circle cx="34" cy="34" r="30" fill="none" stroke={st.tier === 3 ? tier.color : next.color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${C * st.toNext} ${C}`} />
        </svg>
        <span
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-sm"
          style={{
            background: st.tier ? `radial-gradient(circle at 35% 30%, #fff8, transparent 55%), ${tier.color}` : 'var(--color-stone-200)',
            color: st.tier ? 'white' : 'var(--color-stone-500)',
          }}
        >
          <Glyph name={skill.icon} size={24} />
        </span>
        {st.tier > 0 && (
          <span className="absolute -bottom-0.5 rounded-full px-1.5 text-[9px] font-black tracking-wider text-white uppercase shadow" style={{ background: tier.color }}>
            {tier.name}
          </span>
        )}
      </span>
      <span className="text-center text-[11px] leading-tight font-semibold">{skill.name}</span>
    </button>
  );
}

/** Your chess skills, growing from puzzles, games and lessons. */
export function SkillTreeScreen() {
  const push = useNav((s) => s.push);
  const [states, setStates] = useState<Record<string, SkillState> | null>(null);
  const [career, setCareer] = useState<TacticCounts>({});
  const [open, setOpen] = useState<Skill | null>(null);
  useEffect(() => {
    void skillStates().then(setStates);
    void getCareer().then(setCareer);
  }, []);
  if (!states) return null;
  const medals = [1, 2, 3].map((t) => Object.values(states).filter((s) => s.tier === t).length);
  const st = open ? states[open.id] : null;

  return (
    <div className="flex h-full flex-col">
      <Header title="Skill tree" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <div className="card flex items-center justify-around !py-3">
          {[1, 2, 3].map((t, i) => (
            <div key={t} className="flex flex-col items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow" style={{ background: TIERS[t].color }}>
                <Glyph name="medal" size={18} />
              </span>
              <span className="mt-1 text-lg leading-none font-bold">{medals[i]}</span>
              <span className="text-[11px] text-stone-500">{TIERS[t].name}</span>
            </div>
          ))}
        </div>
        <CoachBubble>
          <p>Every skill grows from <b>puzzles</b>, from <b>using it in your games</b> (that counts extra!) and from <b>lessons</b>. Tap a skill to see how to grow it.</p>
        </CoachBubble>
        <div className="relative grid grid-cols-4 gap-1">
          {BRANCHES.map((b) => {
            const list = SKILLS.filter((s) => s.branch === b.id);
            return (
              <div key={b.id} className="relative flex flex-col items-center">
                <div className="mb-3 w-full rounded-full py-1 text-center text-[11px] font-bold tracking-wide text-white uppercase shadow-sm" style={{ background: b.color }}>
                  {b.name}
                </div>
                <div className="absolute top-10 bottom-10 left-1/2 w-1 -translate-x-1/2 rounded-full opacity-30" style={{ background: b.color }} />
                <div className="relative flex w-full flex-col gap-5">
                  {list.map((s) => (
                    <SkillNode key={s.id} skill={s} st={states[s.id]} onClick={() => setOpen(s)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && st && (
          <div className="space-y-3">
            <p className="text-stone-600 dark:text-stone-300">{open.description}</p>
            <div>
              <div className="mb-1 flex justify-between text-sm font-semibold">
                <span style={{ color: st.tier ? TIERS[st.tier].color : undefined }}>{TIERS[st.tier].name}</span>
                <span className="text-stone-500">{st.tier === 3 ? `${st.points} points` : `${st.points} / ${TIERS[(st.tier + 1) as 1 | 2 | 3].points} for ${TIERS[(st.tier + 1) as 1 | 2 | 3].name}`}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                <div className="h-full rounded-full" style={{ width: `${st.toNext * 100}%`, background: TIERS[Math.min(3, st.tier + 1) as 1 | 2 | 3].color }} />
              </div>
            </div>
            <ul className="space-y-1 text-sm">
              <li>• 1 point for each puzzle solved with this theme</li>
              {open.game?.map((g) => (
                <li key={g.key}>• {g.points} points each time you play it in a game{career[g.key] ? ` (so far: ${career[g.key]})` : ''}</li>
              ))}
              {open.lessons?.length ? <li>• 5 points per lesson finished</li> : null}
              {open.id === 'endgames' && <li>• 5 points per endgame drill completed</li>}
            </ul>
            <div className="flex gap-2">
              {open.train && THEME_SETS.some((t) => t.id === open.train) && (
                <button
                  className="btn-primary flex-1"
                  onClick={() => {
                    setOpen(null);
                    push({ name: 'puzzle', mode: { kind: 'theme', theme: open.train! } });
                  }}
                >
                  Train with puzzles
                </button>
              )}
              {open.lessons?.[0] && (
                <button
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setOpen(null);
                    push({ name: 'lesson', lessonId: open.lessons![0] });
                  }}
                >
                  Lesson
                </button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
