import { useMemo, useState } from 'react';
import { Header } from '../components/ui';
import { formatLine, START_FEN } from '../lib/chess/game';
import { ECO } from '../lib/openings';
import { useNav } from '../lib/nav';

const PRINCIPLES = [
  ['Control the center', 'Pawns and pieces on e4, d4, e5 and d5 give you space and options.'],
  ['Develop your pieces', 'Bring out knights and bishops before moving the same piece twice.'],
  ['Castle early', 'Get your king to safety and connect your rooks.'],
  ["Don't bring the queen out too early", 'She can be chased around while your opponent develops.'],
  ['Connect your rooks', 'Once the pieces between them are out, rooks protect each other.'],
  ['Every move, check for threats', 'Ask what your opponent\'s last move wants to do.'],
];

export function OpeningsScreen() {
  const push = useNav((s) => s.push);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const list = ECO.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()));
    const by = new Map<string, typeof list>();
    for (const o of list) {
      const first = o.moves.split(' ')[0];
      const key = first === 'e4' ? '1. e4' : first === 'd4' ? '1. d4' : 'Other first moves';
      by.set(key, [...(by.get(key) ?? []), o]);
    }
    return [...by.entries()];
  }, [q]);
  return (
    <div className="flex h-full flex-col">
      <Header title="Openings" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <div className="card">
          <h2 className="mb-2 font-bold">The golden rules</h2>
          <ol className="space-y-1.5 text-[15px]">
            {PRINCIPLES.map(([t, d], i) => (
              <li key={t}>
                <span className="font-semibold">{i + 1}. {t}.</span> <span className="text-stone-600 dark:text-stone-300">{d}</span>
              </li>
            ))}
          </ol>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search openings…"
          className="w-full rounded-xl bg-white px-4 py-2.5 ring-1 ring-stone-200 outline-none focus:ring-brand-500 dark:bg-stone-900 dark:ring-stone-700"
        />
        {groups.map(([g, list]) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-stone-500">{g}</h2>
            <div className="space-y-2">
              {list.map((o) => (
                <div key={o.name + o.moves} className="card !p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{o.name}</span>
                    <span className="text-xs text-stone-400">{o.eco}</span>
                  </div>
                  <div className="text-sm text-brand-700 dark:text-brand-500">{formatLine(START_FEN, o.moves.split(' '))}</div>
                  <div className="mt-1 text-sm text-stone-600 dark:text-stone-300">{o.idea}</div>
                  <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={() => push({ name: 'openingPractice', index: ECO.indexOf(o) })}>
                    ▶ Practise
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
