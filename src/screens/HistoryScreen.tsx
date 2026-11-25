import { useEffect, useState, type ReactNode } from 'react';
import { accuracyText, hasAccuracy } from '../lib/report';
import { TurningList } from '../components/TurningCards';
import { History } from 'lucide-react';
import { Arrive, EmptyState, Header, Skeleton } from '../components/ui';
import { Portrait } from '../components/Coach';
import { opponentById } from '../lib/people';
import { useNav } from '../lib/nav';
import { shortDate } from '../lib/store/finish';
import type { AnyGame, ImportedGame } from '../lib/store/types';
import { Medallion } from '../components/Glyph';
import { allGames } from '../lib/games';
import { emptyText, filterGames, groupGames, NO_FILTER, type HistoryFilter } from '../lib/games/history';
import { useSettings } from '../lib/settings';
import { ChessComBadge, ImportProgress } from '../components/ChessCom';
import { timeControlLabel } from '../lib/chesscom/parse';

/** Kept while the app is open (not stored). */
let kept: HistoryFilter = NO_FILTER;

export function HistoryScreen() {
  const [games, setGames] = useState<AnyGame[] | null>(null);
  const [filter, setFilterState] = useState<HistoryFilter>(kept);
  const setFilter = (f: HistoryFilter) => {
    kept = f;
    setFilterState(f);
  };
  const push = useNav((s) => s.push);
  const ccUser = useSettings((s) => s.ccUsername);
  useEffect(() => {
    void allGames({ includeUnanalyzed: true }).then(setGames);
  }, []);
  const hasImports = !!games?.some((g) => g.source === 'chess.com');
  // Source chips when there are imports (or a chess.com username to import from).
  const sources = hasImports || !!ccUser.trim();
  const f = sources ? filter : { ...filter, source: null };
  const shown = games ? filterGames(games, f) : null;
  const groups = shown ? groupGames(shown) : [];
  const toggle = (patch: Partial<HistoryFilter>) => setFilter({ ...f, ...patch });
  return (
    <div className="flex h-full flex-col">
      <Header title="Game history" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-2 overflow-y-auto p-4">
        <TurningList />
        {games && games.length > 0 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" data-testid="history-chips">
            <Chip on={!f.result && !f.source} onClick={() => setFilter(NO_FILTER)}>All</Chip>
            <Chip on={f.result === 'win'} onClick={() => toggle({ result: f.result === 'win' ? null : 'win' })}>Wins</Chip>
            <Chip on={f.result === 'loss'} onClick={() => toggle({ result: f.result === 'loss' ? null : 'loss' })}>Losses</Chip>
            {sources && (
              <>
                <Chip on={f.source === 'app'} onClick={() => toggle({ source: f.source === 'app' ? null : 'app' })}>App</Chip>
                <Chip on={f.source === 'chess.com'} onClick={() => toggle({ source: f.source === 'chess.com' ? null : 'chess.com' })}>chess.com</Chip>
              </>
            )}
          </div>
        )}
        {hasImports && <ImportProgress />}
        <Arrive ready={!!shown} skeleton={<Skeleton rows={6} />}>
        {games?.length === 0 && <EmptyState icon={<History size={26} />} title="No finished games yet" text="Every game you finish — here or imported from chess.com — shows up with its Game Review." />}
        {games && games.length > 0 && shown?.length === 0 && (
          <p className="rounded-[10px] bg-white px-3 py-4 text-center text-sm text-stone-600 dark:bg-white/[0.05] dark:text-stone-300" data-testid="history-empty">
            {emptyText(f, hasImports)}
          </p>
        )}
        {groups.map((grp) => (
        <section key={grp.label} className="space-y-1.5 pt-1" data-testid="history-group">
        <h2 className="section-title px-1" data-testid="history-header">{grp.label} · {grp.games.length}</h2>
        <div className="card divide-y divide-stone-100 overflow-hidden !p-0 dark:divide-white/[0.06]">
        {grp.games.map((g) => {
          const cc = g.source === 'chess.com';
          const imported = g as ImportedGame;
          return (
            <button key={String(g.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left press" onClick={() => push({ name: 'report', gameId: g.id! })}>
              <span className="relative">
                {cc ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-chesscom text-lg font-black text-white">{imported.opponentName[0]?.toUpperCase()}</span>
                ) : opponentById(g.opponentId) ? (
                  <Portrait id={g.opponentId!} size={40} />
                ) : (
                  <Medallion name="brain" size={40} tint="stone" />
                )}
                <span className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white dark:ring-stone-900 ${g.userResult === 'win' ? 'bg-brand-600' : g.userResult === 'loss' ? 'bg-danger-500' : 'bg-stone-400'}`}>
                  {g.userResult === 'win' ? 'W' : g.userResult === 'loss' ? 'L' : 'D'}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                {/* The opponent in the title (it no longer gets cut off by the rating); colour, rating,
                    date and how it ended underneath. */}
                <span className="block truncate font-semibold">
                  {cc && <ChessComBadge className="mr-1" />}
                  vs {cc ? imported.opponentName : g.opponentName ?? opponentById(g.opponentId)?.name ?? 'Bot'}
                </span>
                <span className="block truncate text-[12px] text-stone-500 dark:text-stone-400">
                  {g.userColor === 'w' ? 'White' : 'Black'} · {g.elo} · {shortDate(g.endedAt)} · {cc ? `${timeControlLabel(imported.timeControl)} · ` : ''}
                  {g.reason}
                </span>
              </span>
              <span className="text-right">
                {cc && !imported.analyzed ? (
                  <span className="block text-xs text-stone-500">not analysed yet</span>
                ) : (
                  <>
                    <span className="block font-bold tabular-nums">{accuracyText(g.summary.accuracy, hasAccuracy(g.summary))}</span>
                    <span className="block text-[12px] text-stone-500 dark:text-stone-400">
                      {g.summary.counts.blunder ? `${g.summary.counts.blunder} blunder${g.summary.counts.blunder === 1 ? '' : 's'}` : 'accuracy'}
                    </span>
                  </>
                )}
              </span>
            </button>
          );
        })}
        </div>
        </section>
        ))}
        </Arrive>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={`shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${on ? 'bg-stone-800 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-200 text-stone-700 dark:bg-white/[0.08] dark:text-stone-300'}`}
      onClick={onClick}
      aria-pressed={on}
      data-on={on || undefined}
    >
      {children}
    </button>
  );
}
