// My mistakes: every recorded and imported game, the mistake types that come up most, when they
// happen, whether they're getting rarer, example positions, and practice for each.
import { useEffect, useMemo, useState } from 'react';
import { CauseBreakdown } from '../components/Causes';
import { causeReport } from '../lib/games/causes';
import { reviewGame } from '../lib/review';
import { bySource } from '../lib/chesscom/analysis';
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Header, Segmented, Spinner } from '../components/ui';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { ChessComBadge, ImportProgress } from '../components/ChessCom';
import { allGames } from '../lib/games';
import { mistakeReport, PHASES, trendWord, type MistakeTheme, type Phase } from '../lib/games/mistakes';
import type { GameSource } from '../lib/chesscom/analysis';
import type { AnyGame } from '../lib/store/types';
import { THEMES } from '../lib/themes';
import { useNav } from '../lib/nav';
import { useImport } from '../lib/chesscom/store';
import { formatDate } from '../lib/store/finish';

const PHASE_LABEL: Record<Phase, string> = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };
const PERIODS = { all: 0, '90': 90, '30': 30 } as const;

export function MistakesScreen() {
  const [games, setGames] = useState<AnyGame[] | null>(null);
  const [src, setSrc] = useState<GameSource>('all');
  const [period, setPeriod] = useState<keyof typeof PERIODS>('all');
  const [open, setOpen] = useState<string | null>(null);
  const done = useImport((s) => s.done);
  useEffect(() => void allGames().then(setGames), [done]);
  const causes = useMemo(() => {
    if (!games) return null;
    const since = PERIODS[period] ? Date.now() - PERIODS[period] * 864e5 : 0;
    const list = bySource(games, src).filter((g) => g.endedAt >= since && (g.source !== 'chess.com' || (g as { analyzed?: boolean }).analyzed));
    return causeReport(list, (g) => reviewGame(g).plies.map((x) => x.cls));
  }, [games, src, period]);
  if (!games) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  const hasImports = games.some((g) => g.source === 'chess.com');
  const r = mistakeReport(games, { src, sinceDays: PERIODS[period] || undefined });
  const top = r.themes[0];
  const maxShare = Math.max(0.01, ...r.themes.map((t) => t.share));
  return (
    <div className="flex h-full flex-col">
      <Header title="My mistakes" back subtitle={`${r.games} analysed game${r.games === 1 ? '' : 's'} · ${r.mistakes} mistakes & blunders`} />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto p-4">
        {hasImports && <Segmented value={src} onChange={setSrc} options={[{ value: 'all', label: 'All games' }, { value: 'app', label: 'App' }, { value: 'chess.com', label: 'chess.com' }]} />}
        <Segmented value={period} onChange={setPeriod} options={[{ value: 'all', label: 'All time' }, { value: '90', label: '90 days' }, { value: '30', label: '30 days' }]} />
        <ImportProgress />
        {r.games === 0 ? (
          <CoachBubble><p>No analysed games here yet. Play a game, or import your chess.com games in Settings.</p></CoachBubble>
        ) : r.themes.length === 0 ? (
          <CoachBubble mood="happy"><p>No mistakes or blunders in these games. Impressive!</p></CoachBubble>
        ) : (
          <>
            <CoachBubble>
              <p>
                Your most common mistake is <b>{THEMES[top.theme].label.toLowerCase()}</b>: it came up in {top.games} of {r.games} games ({Math.round(top.share * 100)}%), most often in the {mostPhase(top.phases).toLowerCase()}.
              </p>
              <p className="text-sm">{THEMES[top.theme].lesson}</p>
            </CoachBubble>
            {causes && <CauseBreakdown r={causes} title="Why your mistakes happen" />}
            <PhaseBar phases={r.phases} />
            {r.themes.map((t) => (
              <ThemeRow key={t.theme} t={t} total={r.games} max={maxShare} open={open === t.theme} onToggle={() => setOpen(open === t.theme ? null : t.theme)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const mostPhase = (p: Record<Phase, number>) => PHASE_LABEL[PHASES.reduce((a, b) => (p[b] > p[a] ? b : a))];

/** Where your mistakes happen: opening / middlegame / endgame. */
function PhaseBar({ phases }: { phases: Record<Phase, number> }) {
  const total = Math.max(1, PHASES.reduce((a, p) => a + phases[p], 0));
  const color: Record<Phase, string> = { opening: 'bg-sky-500', middlegame: 'bg-amber-500', endgame: 'bg-violet-500' };
  return (
    <div className="card space-y-1.5 !p-3">
      <div className="section-title">When they happen</div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {PHASES.map((p) => phases[p] > 0 && <div key={p} className={color[p]} style={{ width: `${(phases[p] / total) * 100}%` }} />)}
      </div>
      <div className="flex justify-between text-xs text-stone-500">
        {PHASES.map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${color[p]}`} /> {PHASE_LABEL[p]} {Math.round((phases[p] / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function ThemeRow({ t, total, max, open, onToggle }: { t: MistakeTheme; total: number; max: number; open: boolean; onToggle: () => void }) {
  const push = useNav((s) => s.push);
  const [shown, setShown] = useState(5);
  const [peek, setPeek] = useState<number | null>(null);
  const tw = trendWord(t.trend);
  const info = THEMES[t.theme];
  return (
    <div className="card !p-3">
      <button className="flex w-full items-center gap-2 text-left" onClick={onToggle}>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold">
            {info.label}
            {tw === 'better' && <span className="chip bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><TrendingDown size={11} className="mr-0.5 inline" />getting rarer</span>}
            {tw === 'worse' && <span className="chip bg-red-100 text-[10px] text-red-700 dark:bg-red-900/40 dark:text-red-300"><TrendingUp size={11} className="mr-0.5 inline" />more often lately</span>}
          </span>
          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
            <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(t.share / max) * 100}%` }} />
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            {t.games} of {total} games · {t.count}× in all · most in the {mostPhase(t.phases).toLowerCase()} · as White {t.colors.w}, as Black {t.colors.b}
          </span>
        </span>
        {open ? <ChevronDown size={18} className="text-stone-400" /> : <ChevronRight size={18} className="text-stone-400" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-sm">{info.lesson}</p>
          {t.trend && (
            <p className="text-xs text-stone-500">
              Last 20 games: {Math.round(t.trend.recent * 100)}% · the 20 before: {Math.round(t.trend.before * 100)}%
            </p>
          )}
          <button className="btn-primary w-full !py-2 text-sm" onClick={() => push({ name: 'practice', theme: t.theme })}>
            Practise {info.label.toLowerCase()}
          </button>
          <div className="section-title">Where it happened</div>
          {t.examples.slice(0, shown).map((e, k) => (
            <div key={`${e.gameId}:${e.ply}`} className="rounded-xl bg-stone-50 p-2 dark:bg-stone-800/50">
              <div className="flex items-center gap-2">
                <button className="min-w-0 flex-1 text-left text-sm" onClick={() => setPeek(peek === k ? null : k)}>
                  <span className={`font-bold ${e.cls === 'blunder' ? 'text-red-600' : 'text-amber-600'}`}>
                    {Math.floor(e.ply / 2) + 1}{e.color === 'w' ? '.' : '…'} {e.san}
                  </span>
                  {e.better && <span className="text-stone-500"> — better {e.better}</span>}
                  <span className="block truncate text-xs text-stone-500">
                    {e.source === 'chess.com' && <ChessComBadge className="mr-1" />}
                    {formatDate(e.endedAt)}
                    {e.opponent ? ` · vs ${e.opponent}` : ''} · {PHASE_LABEL[e.phase].toLowerCase()}
                  </span>
                </button>
                <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => push({ name: 'review', gameId: e.gameId, ply: e.ply })}>
                  Open
                </button>
              </div>
              {peek === k && (
                <div className="mx-auto mt-2 w-full max-w-[260px]">
                  <Board fen={e.fenBefore} orientation={e.color === 'w' ? 'white' : 'black'} movable={null} />
                </div>
              )}
            </div>
          ))}
          {t.examples.length > shown && (
            <button className="btn-ghost w-full text-sm" onClick={() => setShown(shown + 10)}>
              Show more ({t.examples.length - shown} left)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
