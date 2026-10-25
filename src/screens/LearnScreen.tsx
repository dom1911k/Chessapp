import { useEffect, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { Header } from '../components/ui';
import { kvGet } from '../lib/db';
import { DRILLS } from '../lib/endgames';
import { useNav } from '../lib/nav';
import { DRILL_KEY, type DrillProgress } from './EndgameScreen';
import { SettingsButton } from './PlayScreen';

export function LearnScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const [progress, setProgress] = useState<Record<string, DrillProgress>>({});
  useEffect(() => {
    if (tab === 'learn') void kvGet(DRILL_KEY, {}).then(setProgress);
  }, [tab]);
  const groups = [...new Set(DRILLS.map((d) => d.group))];
  return (
    <div className="flex h-full flex-col">
      <Header title="Learn" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-5 overflow-y-auto p-4">
        <CoachBubble>
          <p>Endgames are where games are won. Practice these against the engine until they feel easy!</p>
        </CoachBubble>
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">{g}</h2>
            <div className="space-y-2">
              {DRILLS.filter((d) => d.group === g).map((d) => {
                const p = progress[d.id];
                return (
                  <button key={d.id} className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'endgame', drillId: d.id })}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-2xl dark:bg-brand-700/20">{d.icon}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{d.title}</span>
                      <span className="block text-xs text-stone-500">{d.description}</span>
                      <span className="block text-xs text-stone-500">🎯 {d.goalText}</span>
                    </span>
                    {p?.completed ? (
                      <span className="text-right text-xs text-emerald-600">
                        ✓ {p.completed}×
                        {p.bestMoves ? <span className="block text-stone-500">best: {p.bestMoves}</span> : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">Openings</h2>
          <button className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'openings' })}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-2xl dark:bg-brand-700/20">📖</span>
            <span className="flex-1">
              <span className="block font-semibold">Opening names & ideas</span>
              <span className="block text-xs text-stone-500">The main idea behind common openings, plus the golden rules.</span>
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
