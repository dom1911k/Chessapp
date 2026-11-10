// Custom Puzzles, chess.com style: pick a difficulty and a theme; unrated.
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Header, Segmented } from '../components/ui';
import { Medallion } from '../components/Glyph';
import { useNav } from '../lib/nav';
import { kvGet, kvSet } from '../lib/db';
import { themeStats, type ThemeStat } from '../lib/puzzles/select';
import { THEME_GROUPS, THEME_SETS } from '../lib/puzzles/themes';
import { loadIndex } from '../lib/puzzles/data';
import { TierMedal } from '../components/PuzzleProgress';
import { mastery } from '../lib/puzzles/level';

/** Rating offsets from your puzzle rating. */
export const DIFFICULTY = { easiest: -600, easier: -300, normal: 0, harder: 300, hardest: 600 } as const;
type Difficulty = keyof typeof DIFFICULTY;
const KEY = 'customDifficulty';

export function CustomPuzzlesScreen() {
  const push = useNav((s) => s.push);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [stats, setStats] = useState<Record<string, ThemeStat>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    void kvGet<Difficulty>(KEY, 'normal').then(setDiff);
    void themeStats().then((s) => setStats(Object.fromEntries(s.map((x) => [x.id, x]))));
    void loadIndex()
      .then((ix) => {
        const c: Record<string, number> = {};
        for (const b of ix.bands) for (const [t, n] of Object.entries(b.themes)) c[t] = (c[t] ?? 0) + n;
        setCounts(c);
      })
      .catch(() => undefined);
  }, []);
  const choose = (d: Difficulty) => {
    setDiff(d);
    void kvSet(KEY, d);
  };
  return (
    <div className="flex h-full flex-col">
      <Header title="Custom Puzzles" back subtitle="Unrated · pick a theme" />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <div className="mb-1.5 section-title">Difficulty</div>
          <Segmented
            value={diff}
            onChange={choose}
            options={[
              { value: 'easiest', label: 'Easiest' },
              { value: 'easier', label: 'Easier' },
              { value: 'normal', label: 'Normal' },
              { value: 'harder', label: 'Harder' },
              { value: 'hardest', label: 'Hardest' },
            ]}
          />
        </div>
        {THEME_GROUPS.map((g) => (
          <section key={g}>
            <h2 className="mb-1.5 section-title">{g}</h2>
            <div className="card divide-y divide-stone-100 !p-0 dark:divide-stone-800">
              {THEME_SETS.filter((t) => t.group === g && (counts[t.id] ?? 1) > 0).map((t) => {
                const s = stats[t.id];
                const pct = s && s.attempts ? Math.round((s.solved / s.attempts) * 100) : null;
                return (
                  <button key={t.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-stone-100 dark:active:bg-stone-800" onClick={() => push({ name: 'puzzle', mode: { kind: 'theme', theme: t.id, difficulty: DIFFICULTY[diff] } })}>
                    <Medallion name={t.icon} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.label}</span>
                      <span className="block truncate text-xs text-stone-500">{t.description}</span>
                      {s && s.solved > 0 && (
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                          <span className="block h-full origin-left rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ transform: `scaleX(${Math.max(0.03, mastery(s.solved).pos % 1 || (mastery(s.solved).tier >= 4 ? 1 : 0.03))})` }} />
                        </span>
                      )}
                    </span>
                    {pct !== null && <span className={`text-xs font-bold ${pct >= 70 ? 'text-emerald-600' : pct < 45 ? 'text-red-500' : 'text-stone-500'}`}>{pct}%</span>}
                    {s && mastery(s.solved).tier > 0 && <TierMedal tier={mastery(s.solved).tier} size={22} />}
                    {counts[t.id] ? <span className="text-xs text-stone-400">{counts[t.id] >= 1000 ? `${(counts[t.id] / 1000).toFixed(1)}k` : counts[t.id]}</span> : null}
                    <ChevronRight size={16} className="text-stone-400" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
