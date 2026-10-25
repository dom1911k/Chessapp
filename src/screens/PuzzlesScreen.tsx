import { useEffect, useState } from 'react';
import { CoachBubble } from '../components/Coach';
import { Header } from '../components/ui';
import { db } from '../lib/db';
import { useNav } from '../lib/nav';
import { getRating } from '../lib/puzzles/rating';
import { themeStats, weakestThemes, type ThemeStat } from '../lib/puzzles/select';
import { THEME_SETS } from '../lib/puzzles/themes';
import { SettingsButton } from './PlayScreen';

export function PuzzlesScreen() {
  const push = useNav((s) => s.push);
  const tab = useNav((s) => s.tab);
  const [rating, setRating] = useState<number | null>(null);
  const [stats, setStats] = useState<Record<string, ThemeStat>>({});
  const [weak, setWeak] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (tab !== 'puzzles') return;
    void (async () => {
      setRating((await getRating()).rating);
      setStats(Object.fromEntries((await themeStats()).map((s) => [s.id, s])));
      setWeak(await weakestThemes(2));
      setCount(await db.attempts.count());
    })();
  }, [tab]);

  return (
    <div className="flex h-full flex-col">
      <Header title="Puzzles" right={<SettingsButton />} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div className="card flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm text-stone-500">Puzzle rating</div>
            <div className="text-3xl font-bold">{rating ?? '…'}</div>
            <div className="text-xs text-stone-500">{count} puzzles played</div>
          </div>
          <button className="btn-primary !px-5 !py-3 text-base" onClick={() => push({ name: 'puzzle', mode: { kind: 'rated' } })}>
            Solve puzzles
          </button>
        </div>
        {weak.length > 0 && count >= 5 && (
          <CoachBubble>
            <p>
              Want to get better faster? Try some <b>{THEME_SETS.find((t) => t.id === weak[0])?.label}</b> puzzles — that's where I see the most room to grow.
            </p>
          </CoachBubble>
        )}
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">Themes</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {THEME_SETS.map((t) => {
              const s = stats[t.id];
              return (
                <button key={t.id} className="card !p-3 text-left active:scale-[0.98]" onClick={() => push({ name: 'puzzle', mode: { kind: 'theme', theme: t.id } })}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.icon}</span>
                    <span className="font-semibold leading-tight">{t.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-stone-500">{t.description}</div>
                  {s && s.attempts > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((s.solved / s.attempts) * 100)}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
