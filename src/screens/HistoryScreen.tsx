import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { EmptyState, Header, Segmented, Skeleton } from '../components/ui';
import { Portrait } from '../components/Coach';
import { opponentById } from '../lib/people';
import { useNav } from '../lib/nav';
import { formatDate } from '../lib/store/finish';
import type { AnyGame, ImportedGame } from '../lib/store/types';
import { Medallion } from '../components/Glyph';
import { allGames } from '../lib/games';
import { bySource, type GameSource } from '../lib/chesscom/analysis';
import { ChessComBadge, ImportProgress } from '../components/ChessCom';
import { timeControlLabel } from '../lib/chesscom/parse';

export function HistoryScreen() {
  const [games, setGames] = useState<AnyGame[] | null>(null);
  const [src, setSrc] = useState<GameSource>('all');
  const push = useNav((s) => s.push);
  useEffect(() => {
    void allGames({ includeUnanalyzed: true }).then(setGames);
  }, []);
  const hasImports = !!games?.some((g) => g.source === 'chess.com');
  const shown = games ? bySource(games, src) : null;
  return (
    <div className="flex h-full flex-col">
      <Header title="Past games" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-2 overflow-y-auto p-4">
        {hasImports && (
          <>
            <Segmented
              value={src}
              onChange={setSrc}
              options={[
                { value: 'all', label: 'All' },
                { value: 'app', label: 'App' },
                { value: 'chess.com', label: 'chess.com' },
              ]}
            />
            <ImportProgress />
          </>
        )}
        {!shown && <Skeleton rows={6} />}
        {shown?.length === 0 && <EmptyState icon={<History size={26} />} title="No finished games yet" text="Every game you finish — here or imported from chess.com — shows up with its Game Review." />}
        {shown && shown.length > 0 && (
        <div className="card divide-y divide-stone-100 overflow-hidden !p-0 dark:divide-white/[0.06]">
        {shown.map((g) => {
          const cc = g.source === 'chess.com';
          const imported = g as ImportedGame;
          return (
            <button key={String(g.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-stone-100 dark:active:bg-white/[0.04]" onClick={() => push({ name: 'report', gameId: g.id! })}>
              <span className="relative">
                {cc ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#769656] text-lg font-black text-white">{imported.opponentName[0]?.toUpperCase()}</span>
                ) : opponentById(g.opponentId) ? (
                  <Portrait id={g.opponentId!} size={40} />
                ) : (
                  <Medallion name="brain" size={40} tint="stone" />
                )}
                <span className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[#fffdf9] dark:ring-[#1d1915] ${g.userResult === 'win' ? 'bg-emerald-600' : g.userResult === 'loss' ? 'bg-red-500' : 'bg-stone-400'}`}>
                  {g.userResult === 'win' ? 'W' : g.userResult === 'loss' ? 'L' : 'D'}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {cc && <ChessComBadge className="mr-1" />}
                  {g.userColor === 'w' ? 'White' : 'Black'} vs {cc ? `${imported.opponentName} (${g.elo})` : `${opponentById(g.opponentId)?.name ?? 'Bot'} ~${g.elo}`}
                </span>
                <span className="block truncate text-xs text-stone-500">
                  {formatDate(g.endedAt)} · {cc ? `${timeControlLabel(imported.timeControl)} · ` : g.match ? 'Match conditions · ' : ''}
                  {g.reason}
                  {g.opening ? ` · ${g.opening}` : ''}
                </span>
              </span>
              <span className="text-right">
                {cc && !imported.analyzed ? (
                  <span className="block text-xs text-stone-500">not analysed yet</span>
                ) : (
                  <>
                    <span className="block font-bold tabular-nums">{g.summary.accuracy}%</span>
                    <span className="block text-[11px] text-stone-500">
                      {g.summary.counts.blunder ? `${g.summary.counts.blunder} blunder${g.summary.counts.blunder === 1 ? '' : 's'}` : 'accuracy'}
                    </span>
                  </>
                )}
              </span>
            </button>
          );
        })}
        </div>
        )}
      </div>
    </div>
  );
}
