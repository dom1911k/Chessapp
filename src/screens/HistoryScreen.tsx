import { useEffect, useState } from 'react';
import { Header } from '../components/ui';
import { Portrait } from '../components/Coach';
import { opponentById } from '../lib/people';
import { db } from '../lib/db';
import { useNav } from '../lib/nav';
import { formatDate } from '../lib/store/finish';
import type { GameRecord } from '../lib/store/types';
import { Medallion } from '../components/Glyph';

export function HistoryScreen() {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const push = useNav((s) => s.push);
  useEffect(() => {
    void db.games.orderBy('endedAt').reverse().toArray().then(setGames);
  }, []);
  return (
    <div className="flex h-full flex-col">
      <Header title="Past games" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-2 overflow-y-auto p-4">
        {games?.length === 0 && <p className="text-center text-stone-500">No finished games yet.</p>}
        {games?.map((g) => (
          <button key={g.id} className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'report', gameId: g.id! })}>
            <span className="relative">
              {opponentById(g.opponentId) ? <Portrait id={g.opponentId!} size={40} /> : <Medallion name="brain" size={40} tint="stone" />}
              <span className={`absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-stone-900 ${g.userResult === 'win' ? 'bg-emerald-600' : g.userResult === 'loss' ? 'bg-red-500' : 'bg-stone-400'}`}>
                {g.userResult === 'win' ? 'W' : g.userResult === 'loss' ? 'L' : 'D'}
              </span>
            </span>
            <span className="flex-1">
              <span className="block font-semibold">
                {g.userColor === 'w' ? 'White' : 'Black'} vs {opponentById(g.opponentId)?.name ?? 'Bot'} ~{g.elo}
              </span>
              <span className="block text-xs text-stone-500">
                {formatDate(g.endedAt)} · {g.reason}
                {g.opening ? ` · ${g.opening}` : ''}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-bold">{g.summary.accuracy}%</span>
              <span className="block text-xs text-stone-500">{g.summary.counts.blunder} blunders</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
