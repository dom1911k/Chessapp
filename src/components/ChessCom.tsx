// chess.com import UI: the account card (Settings), a progress line, the home card with your
// latest games, and the "in your games" insights card (Progress).
import { useEffect, useState } from 'react';
import { Check, ChevronRight, CloudDownload, RefreshCw, TriangleAlert } from 'lucide-react';
import { Segmented, Toggle } from './ui';
import { useSettings } from '../lib/settings';
import { useNav } from '../lib/nav';
import { db } from '../lib/db';
import { clearImports, useImport } from '../lib/chesscom/store';
import { timeControlLabel, validUsername } from '../lib/chesscom/parse';
import { allGames } from '../lib/games';
import { biggestMistake, gameInsights } from '../lib/games/insights';
import { gapReport, PERIOD_DAYS } from '../lib/games/gap';
import { timeStats } from '../lib/timestats';
import type { GameSource } from '../lib/chesscom/analysis';
import type { AnyGame, ImportedGame } from '../lib/store/types';
import { THEMES } from '../lib/themes';
import { TACTIC_LABEL } from '../lib/rewards/career';
import { shortWords } from '../lib/chess/words';
import { ClassBadge } from './Coach';

/** A small green "chess.com" tag. */
export function ChessComBadge({ className = '' }: { className?: string }) {
  return <span className={`inline-flex items-center rounded bg-[#769656] px-1 py-px align-middle text-[10px] font-bold leading-tight text-white ${className}`}>chess.com</span>;
}

/** "Analysing your chess.com games · 12 of 40" — never blocks anything. */
export function ImportProgress({ className = '' }: { className?: string }) {
  const s = useImport();
  if (s.syncing) return <div className={`flex items-center gap-1.5 text-xs text-stone-500 ${className}`}><RefreshCw size={12} className="animate-spin" /> {s.status ?? 'Syncing…'}</div>;
  if (!s.total || s.done >= s.total) return null;
  const pct = Math.round(((s.done + s.current) / s.total) * 100);
  return (
    <div className={`text-xs text-stone-500 ${className}`}>
      <div className="flex justify-between">
        <span>{s.analyzing ? 'Analysing your chess.com games' : 'chess.com games waiting for analysis'}</span>
        <span>{s.done} of {s.total}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
        <div className="h-full bg-[#769656] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Settings → chess.com account. */
export function ChessComCard() {
  const s = useSettings();
  const imp = useImport();
  const [name, setName] = useState(s.ccUsername);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => void imp.refresh(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = validUsername(name);
  const save = () => {
    const u = name.trim();
    if (u === s.ccUsername) return;
    s.set({ ccUsername: u });
  };
  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-stone-500">
        <ChessComBadge /> chess.com account
      </div>
      <p className="text-xs text-stone-500">
        Import your public chess.com games to analyse them here. No login — only your username is sent to chess.com's public API, and only when you sync. Everything stays on this phone.
      </p>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-stone-800"
          placeholder="Your chess.com username"
          value={name}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
        />
        <button
          className="btn-primary !px-3"
          disabled={!ok || imp.syncing}
          onClick={() => {
            save();
            void useImport.getState().sync();
          }}
        >
          {imp.syncing ? <RefreshCw size={16} className="animate-spin" /> : <CloudDownload size={16} />} Sync now
        </button>
      </div>
      {name && !ok && <p className="text-xs text-red-600">Usernames have 3–25 letters, digits, "_" or "-".</p>}
      <Toggle checked={s.ccAutoSync} onChange={(v) => s.set({ ccAutoSync: v })} label="Sync when the app opens (only when online)" />
      {imp.error && (
        <p className="flex items-start gap-1.5 text-sm text-red-600">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {imp.error}
        </p>
      )}
      {imp.added !== null && !imp.error && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          <Check size={15} /> {imp.added ? `${imp.added} new game${imp.added === 1 ? '' : 's'} imported.` : 'Up to date — no new games.'}
        </p>
      )}
      <div className="text-xs text-stone-500">
        {imp.total} imported game{imp.total === 1 ? '' : 's'}
        {imp.lastSync ? ` · last sync ${new Date(imp.lastSync).toLocaleString()}` : ''}
      </div>
      <ImportProgress />
      {imp.total > 0 &&
        (confirmClear ? (
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setConfirmClear(false)}>Keep them</button>
            <button className="btn-secondary flex-1 !text-red-600" onClick={() => void clearImports().then(() => setConfirmClear(false))}>Delete imported games</button>
          </div>
        ) : (
          <button className="text-xs text-stone-500 underline" onClick={() => setConfirmClear(true)}>Remove imported games from this phone</button>
        ))}
    </div>
  );
}

/** Home: "Your last chess.com games" — the latest result, its biggest mistake, the last 10. */
export function LastChessComGames() {
  const user = useSettings((s) => s.ccUsername);
  const done = useImport((s) => s.done);
  const total = useImport((s) => s.total);
  const push = useNav((s) => s.push);
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  useEffect(() => {
    if (!user) return;
    void db.imported.orderBy('endedAt').reverse().limit(10).toArray().then(setGames);
  }, [user, done, total]);
  if (!user || !games?.length) return null;
  const last = games[0];
  const big = last.analyzed ? biggestMistake(last) : null;
  const w = games.filter((g) => g.userResult === 'win').length;
  const l = games.filter((g) => g.userResult === 'loss').length;
  const d = games.length - w - l;
  return (
    <div className="card space-y-2 !p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-500">
          <ChessComBadge /> Your last chess.com games
        </span>
        <span className="text-xs text-stone-500">
          last {games.length}: <b className="text-emerald-600">{w}W</b> {d ? `${d}D ` : ''}<b className="text-red-500">{l}L</b>
        </span>
      </div>
      <div className="flex gap-1">
        {[...games].reverse().map((g) => (
          <span key={g.id} title={`${g.userResult} vs ${g.opponentName}`} className={`h-2 flex-1 rounded-full ${g.userResult === 'win' ? 'bg-emerald-500' : g.userResult === 'loss' ? 'bg-red-500' : 'bg-stone-400'}`} />
        ))}
      </div>
      <button className="flex w-full items-center gap-2 text-left" onClick={() => push({ name: 'report', gameId: last.id })}>
        <span className="flex-1 text-sm">
          <b>{last.userResult === 'win' ? 'Won' : last.userResult === 'loss' ? 'Lost' : 'Drew'}</b> vs {last.opponentName} ({last.elo}) · {timeControlLabel(last.timeControl)} · {last.reason}
        </span>
        <ChevronRight size={16} className="text-stone-400" />
      </button>
      {big?.move ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2 dark:bg-amber-900/20">
          {big.move.classification && <ClassBadge c={big.move.classification} />}
          <span className="min-w-0 flex-1 truncate text-sm">
            Biggest mistake: {shortWords(big.move.fenBefore, big.move.uci)}
          </span>
          <button className="btn-primary !px-3 !py-1.5 text-sm" onClick={() => push({ name: 'review', gameId: last.id, ply: big.ply })}>
            Review it
          </button>
        </div>
      ) : !last.analyzed ? (
        <ImportProgress />
      ) : (
        <div className="text-sm text-emerald-700 dark:text-emerald-400">No mistakes or blunders in your latest game. 👏</div>
      )}
      <button className="text-left text-sm font-semibold text-brand-700 dark:text-brand-500" onClick={() => push({ name: 'face' })}>
        What people play against you →
      </button>
    </div>
  );
}

/** Progress: recurring mistakes and the tactics you play, in all / app / chess.com games. */
export function GameInsightsCard() {
  const [src, setSrc] = useState<GameSource>('all');
  const [games, setGames] = useState<AnyGame[] | null>(null);
  const done = useImport((s) => s.done);
  useEffect(() => void allGames().then(setGames), [done]);
  if (!games) return null;
  const hasImports = games.some((g) => g.source === 'chess.com');
  const ins = gameInsights(games, src);
  return (
    <div className="card space-y-2 !p-3">
      <div className="text-sm font-semibold text-stone-500">In your games (last {ins.games})</div>
      {hasImports && (
        <Segmented
          value={src}
          onChange={setSrc}
          options={[
            { value: 'all', label: 'All' },
            { value: 'app', label: 'App' },
            { value: 'chess.com', label: 'chess.com' },
          ]}
        />
      )}
      {ins.games === 0 ? (
        <p className="text-xs text-stone-500">No analysed games here yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-sm font-semibold">Keeps coming back</div>
            {ins.mistakes.slice(0, 3).map((m) => (
              <div key={m.theme} className="flex justify-between text-sm">
                <span>{THEMES[m.theme].label}</span>
                <span className="text-stone-500">{m.games}/{ins.games}</span>
              </div>
            ))}
            {!ins.mistakes.length && <div className="text-xs text-stone-500">No recurring mistakes. 🎉</div>}
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">You play well</div>
            {ins.strengths.slice(0, 3).map((t) => (
              <div key={t.key} className="flex justify-between text-sm">
                <span>{TACTIC_LABEL[t.key].many}</span>
                <span className="text-stone-500">{t.count}</span>
              </div>
            ))}
            {!ins.strengths.length && <div className="text-xs text-stone-500">No tactics yet.</div>}
          </div>
        </div>
      )}
      {ins.games > 0 && (
        <div className="text-xs text-stone-500">
          Score: {ins.score.w}W {ins.score.d}D {ins.score.l}L
        </div>
      )}
    </div>
  );
}

/** Progress: coached vs Match-conditions score per opponent band, and chess.com over the same period. */
export function GapCard() {
  const [games, setGames] = useState<AnyGame[] | null>(null);
  useEffect(() => void allGames({ includeUnanalyzed: true }).then(setGames), []);
  if (!games) return null;
  const r = gapReport(games);
  if (r.coached.n + r.match.n === 0) return null;
  const cell = (t: { n: number; pct: number }) => (t.n ? <><b>{t.pct}%</b> <span className="text-stone-400">({t.n})</span></> : <span className="text-stone-400">–</span>);
  return (
    <div className="card space-y-2 !p-3">
      <div className="text-sm font-semibold text-stone-500">Coached vs Match conditions (last {PERIOD_DAYS} days)</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-stone-500">
            <th className="text-left font-normal">Opponents</th>
            <th className="text-right font-normal">Coached</th>
            <th className="text-right font-normal">Match</th>
          </tr>
        </thead>
        <tbody>
          {r.bands.map((b) => (
            <tr key={b.min}>
              <td>~{b.label}</td>
              <td className="text-right">{cell(b.coached)}</td>
              <td className="text-right">{cell(b.match)}</td>
            </tr>
          ))}
          {r.chessCom.n > 0 && (
            <tr className="border-t border-stone-100 dark:border-stone-800">
              <td className="pt-1"><ChessComBadge /> avg {r.chessCom.avgOpp}</td>
              <td colSpan={2} className="pt-1 text-right">{cell(r.chessCom)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-sm">{r.sentence}</p>
    </div>
  );
}

/** Time per move as a small bar chart, the longest thinks, slow easy moves, and one sentence of advice. */
export function TimeStatsCard({ g, onPly }: { g: AnyGame; onPly: (ply: number) => void }) {
  const st = g.clocks && g.timeControl ? timeStats(g.plies, g.clocks, g.timeControl, g.userColor, g.userResult === 'loss' && g.reason === 'time') : null;
  if (!st) return null;
  const max = Math.max(1, ...st.moves.map((m) => m.secs));
  const long = new Set(st.longest.map((m) => m.ply));
  const fmt = (x: number) => (x >= 60 ? `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}` : `${x < 10 ? x.toFixed(1) : Math.round(x)}s`);
  return (
    <div className="card space-y-2 !p-3">
      <div className="flex justify-between text-sm font-semibold text-stone-500">
        <span>Your time ({timeControlLabel(g.timeControl!)})</span>
        <span className="font-normal">{fmt(st.total)} used</span>
      </div>
      <div className="flex h-20 items-end gap-px" role="img" aria-label="Seconds per move">
        {st.moves.map((m) => (
          <button
            key={m.ply}
            title={`${m.moveNo}. ${m.san}: ${fmt(m.secs)}`}
            onClick={() => onPly(m.ply)}
            className={`min-w-[2px] flex-1 rounded-t-sm ${long.has(m.ply) ? 'bg-amber-500' : 'bg-brand-500/70'}`}
            style={{ height: `${Math.max(3, (m.secs / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-stone-400">
        <span>move 1</span>
        <span>move {st.moves[st.moves.length - 1].moveNo}</span>
      </div>
      <div className="text-sm">
        Longest thinks:{' '}
        {st.longest.map((m, i) => (
          <button key={m.ply} className="font-semibold underline decoration-dotted" onClick={() => onPly(m.ply)}>
            {i ? ', ' : ''}
            {m.moveNo}. {m.san} ({fmt(m.secs)})
          </button>
        ))}
      </div>
      {st.slowObvious.slice(0, 2).map((m) => (
        <div key={m.ply} className="text-sm text-amber-700 dark:text-amber-400">
          {fmt(m.secs)} on {m.moveNo}. {m.san} — {m.why}. That one could be played at once.
        </div>
      ))}
      <p className="text-sm font-semibold">{st.advice}</p>
    </div>
  );
}
