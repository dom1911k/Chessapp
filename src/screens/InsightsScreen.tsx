// Insights, chess.com style: where your games are won and lost — accuracy by phase, results by
// colour and opening, by time of day and by playing speed. App games and chess.com imports.
import { useEffect, useState } from 'react';
import { EmptyState, Header, Segmented, Skeleton } from '../components/ui';
import { Lightbulb } from 'lucide-react';
import { useNav } from '../lib/nav';
import { allGames } from '../lib/games';
import { insights, games as count, type Insights, type Row } from '../lib/games/profile';
import { bySource, type GameSource } from '../lib/chesscom/analysis';
import type { AnyGame } from '../lib/store/types';

const PHASE_LABEL = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' } as const;
const PART_LABEL = { morning: 'Morning (5–12)', afternoon: 'Afternoon (12–17)', evening: 'Evening (17–22)', night: 'Night (22–5)' } as const;
const SPEED_LABEL = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid', classical: 'Classical', daily: 'Daily', untimed: 'No clock' } as const;

export function InsightsScreen() {
  const [all, setAll] = useState<AnyGame[] | null>(null);
  const [src, setSrc] = useState<GameSource>('all');
  const push = useNav((s) => s.push);
  useEffect(() => void allGames({ includeUnanalyzed: true }).then(setAll), []);
  const r: Insights | null = all ? insights(bySource(all, src)) : null;
  return (
    <div className="flex h-full flex-col">
      <Header title="Insights" back subtitle={r ? `${r.games} games` : undefined} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 overflow-y-auto p-4">
        <Segmented value={src} onChange={setSrc} options={[{ value: 'all', label: 'All games' }, { value: 'app', label: 'In this app' }, { value: 'chess.com', label: 'chess.com' }]} />
        {!r && <Skeleton rows={4} />}
        {r && r.games === 0 && (
          <EmptyState
            icon={<Lightbulb size={26} />}
            title="No games here yet"
            text="Insights show up once you've played a few games — here, or imported from chess.com."
            action={<button className="btn-secondary" onClick={() => push({ name: 'settings' })}>Import from chess.com</button>}
          />
        )}
        {r && r.games > 0 && (
          <>
            <Section title="Accuracy by phase" note={r.weakestPhase ? `Your ${r.weakestPhase} is the weak spot — that's where training pays off most.` : undefined}>
              <div className="grid grid-cols-3 gap-2">
                {r.phases.map((p) => (
                  <div key={p.phase} className={`rounded-2xl p-2.5 text-center ${p.phase === r.weakestPhase ? 'bg-red-50 ring-1 ring-red-300 dark:bg-red-950/40 dark:ring-red-800' : 'bg-stone-100 dark:bg-stone-800'}`}>
                    <div className="text-2xl font-black tabular-nums">{p.accuracy ?? '–'}{p.accuracy !== null && <span className="text-sm">%</span>}</div>
                    <div className="text-xs font-semibold">{PHASE_LABEL[p.phase]}</div>
                    <div className="text-[11px] text-stone-500">{p.moves} moves</div>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="By colour">
              {r.colors.map((x) => (
                <ResultRow key={x.key} label={x.key === 'w' ? 'With White' : 'With Black'} row={x} />
              ))}
            </Section>
            <Section title="Openings as White" note={r.openings.white.length ? undefined : 'Play a few more games as White to see this.'}>
              {r.openings.white.map((x) => <ResultRow key={x.key} label={x.key} row={x} />)}
            </Section>
            <Section title="Openings as Black" note={r.openings.black.length ? undefined : 'Play a few more games as Black to see this.'}>
              {r.openings.black.map((x) => <ResultRow key={x.key} label={x.key} row={x} />)}
            </Section>
            <Section title="Time of day" note={bestWorst(r.dayParts, (k) => PART_LABEL[k].split(' ')[0].toLowerCase())}>
              {r.dayParts.map((x) => <ResultRow key={x.key} label={PART_LABEL[x.key]} row={x} />)}
            </Section>
            <Section title="Playing speed" note={bestWorst(r.speeds, (k) => SPEED_LABEL[k].toLowerCase())}>
              {r.speeds.map((x) => <ResultRow key={x.key} label={SPEED_LABEL[x.key]} row={x} />)}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

/** "You score best in the morning and worst at night." — only with enough games and a real gap. */
function bestWorst<K extends string>(rows: Row<K>[], name: (k: K) => string): string | undefined {
  const ok = rows.filter((r) => count(r.score) >= 3);
  if (ok.length < 2) return undefined;
  const best = [...ok].sort((a, b) => b.pct - a.pct)[0];
  const worst = [...ok].sort((a, b) => a.pct - b.pct)[0];
  if (best.pct - worst.pct < 15) return undefined;
  return `You score ${best.pct}% in ${name(best.key)} games but ${worst.pct}% in ${name(worst.key)}.`;
}

function Section({ title, note, children }: { title: string; note?: string; children?: React.ReactNode }) {
  return (
    <section className="card !p-3">
      <h2 className="mb-2 section-title">{title}</h2>
      <div className="space-y-2">{children}</div>
      {note && <p className="mt-2 text-xs text-stone-500">{note}</p>}
    </section>
  );
}

function ResultRow({ label, row }: { label: string; row: Row }) {
  const n = count(row.score);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="min-w-0 truncate font-semibold">{label}</span>
        <span className="shrink-0 pl-2 text-xs text-stone-500">
          {row.score.w}W {row.score.d}D {row.score.l}L · <b className={row.pct >= 55 ? 'text-emerald-600' : row.pct < 45 ? 'text-red-500' : 'text-stone-700 dark:text-stone-200'}>{row.pct}%</b>
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
        <div className="bg-emerald-500" style={{ width: `${(row.score.w / n) * 100}%` }} />
        <div className="bg-stone-400" style={{ width: `${(row.score.d / n) * 100}%` }} />
        <div className="bg-red-500" style={{ width: `${(row.score.l / n) * 100}%` }} />
      </div>
    </div>
  );
}
