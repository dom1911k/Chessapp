// Custom Puzzles, chess.com style: Rated or Unrated, a difficulty and a theme.
// Quick picks on top: Mate in 1, your weakest theme, and (unrated) any theme near your rating —
// what used to be "Learning mode".
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Header, Segmented } from '../components/ui';
import { Medallion } from '../components/Glyph';
import { useNav } from '../lib/nav';
import { kvGet, kvSet } from '../lib/db';
import { themeStats, weakestThemes, type ThemeStat } from '../lib/puzzles/select';
import { THEME_GROUPS, THEME_SETS } from '../lib/puzzles/themes';
import { loadIndex } from '../lib/puzzles/data';

/** Rating offsets from your puzzle rating. */
export const DIFFICULTY = { easiest: -600, easier: -300, normal: 0, harder: 300, hardest: 600 } as const;
type Difficulty = keyof typeof DIFFICULTY;
const KEY = 'customDifficulty';
const RATED_KEY = 'customRated';

export function CustomPuzzlesScreen() {
  const push = useNav((s) => s.push);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [stats, setStats] = useState<Record<string, ThemeStat>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rated, setRated] = useState(false);
  const [weak, setWeak] = useState<string | undefined>();
  useEffect(() => {
    void kvGet<Difficulty>(KEY, 'normal').then(setDiff);
    void kvGet<boolean>(RATED_KEY, false).then(setRated);
    void weakestThemes(1).then((w) => setWeak(w[0]));
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
  const chooseRated = (r: boolean) => {
    setRated(r);
    void kvSet(RATED_KEY, r);
  };
  const theme = (id: string, offset: number = DIFFICULTY[diff]) => push({ name: 'puzzle', mode: { kind: 'theme', theme: id, difficulty: offset, rated: rated || undefined } });
  // Your weakest theme, once there's something to judge it by.
  const weakSet = weak && Object.values(stats).some((x) => x.attempts >= 3) ? THEME_SETS.find((t) => t.id === weak) : undefined;
  const quick: { id: string; icon: string; label: string; sub: string; go: () => void }[] = [
    { id: 'mate1', icon: 'target', label: 'Mate in 1', sub: 'Quick warm-up', go: () => theme('mateIn1', DIFFICULTY[diff] - 300) },
    ...(weakSet && weakSet.id !== 'mateIn1' ? [{ id: 'weak', icon: weakSet.icon, label: weakSet.label, sub: 'Your weakest theme', go: () => theme(weakSet.id) }] : []),
    ...(!rated ? [{ id: 'any', icon: 'cap', label: 'Any theme', sub: 'Near your rating, no clock, no rating change', go: () => push({ name: 'puzzle', mode: { kind: 'learn' } }) }] : []),
  ];
  return (
    <div className="flex h-full flex-col">
      <Header title="Custom Puzzles" back subtitle={rated ? 'Rated · pick a theme' : 'Unrated · pick a theme'} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div data-testid="custom-rated">
          <Segmented
            value={rated ? 'rated' : 'unrated'}
            onChange={(v) => chooseRated(v === 'rated')}
            options={[
              { value: 'rated', label: 'Rated' },
              { value: 'unrated', label: 'Unrated' },
            ]}
          />
          <p className="mt-1.5 px-1 text-[12px] text-stone-500 dark:text-stone-400" data-testid="custom-rated-note">{rated ? 'Your puzzle rating moves' : 'No clock, no rating change'}</p>
        </div>
        <section>
          <h2 className="mb-1.5 section-title">Quick start</h2>
          <div className="card divide-y divide-stone-100 !p-0 dark:divide-stone-800">
            {quick.map((q) => (
              <button key={q.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left press" onClick={q.go} data-testid={`custom-${q.id}`}>
                <Medallion name={q.icon} tint="gold" size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{q.label}</span>
                  <span className="block truncate text-xs text-stone-500 dark:text-stone-400">{q.sub}</span>
                </span>
                <ChevronRight size={16} className="text-stone-400" />
              </button>
            ))}
          </div>
        </section>
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
                  <button key={t.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left press" onClick={() => theme(t.id)}>
                    <Medallion name={t.icon} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.label}</span>
                      <span className="block truncate text-xs text-stone-500">{t.description}</span>
                      {s && s.solved > 0 && <span className="mt-0.5 block text-[12px] font-semibold text-stone-500 dark:text-stone-400">{s.solved} solved</span>}
                    </span>
                    {pct !== null && <span className={`text-xs font-bold ${pct >= 70 ? 'text-brand-700' : pct < 45 ? 'text-danger-700' : 'text-stone-500'}`}>{pct}%</span>}
                    {counts[t.id] ? <span className="text-xs text-stone-500">{counts[t.id] >= 1000 ? `${(counts[t.id] / 1000).toFixed(1)}k` : counts[t.id]}</span> : null}
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
