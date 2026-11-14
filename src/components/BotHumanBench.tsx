// Developer tool (Settings): do the bots play like the people they claim to be? Each chess.com
// rating band next to the bot label that maps to it: blunders and mistakes per move, what kind
// of blunders, and think time per phase. Humans: your chess.com opponents (measured here, on the
// phone) or a public chess.com sample; bots: self-play profiles made with scripts/maia3/profile.mts.
import { useEffect, useRef, useState } from 'react';
import baseline from '../lib/benchmark/baseline.json';
import { benchTable, type BotRow, type HumanRow } from '../lib/benchmark/table';
import { benchmarkOpponents, type BandResult, type BenchDeps } from '../lib/benchmark/humans';
import { useCcMap } from './CcLabel';
import { db, kvGet, kvSet } from '../lib/db';
import { getEngine } from '../lib/engine';
import { maia3Logits } from '../lib/maia3';
import { povScore, scoreToCp } from '../lib/chess/evaluation';
import type { ProfileSummary } from '../lib/benchmark/profile';

const KEY = 'benchOpponents';
interface Saved {
  at: number;
  games: number;
  results: BandResult[];
}

const appDeps: BenchDeps = {
  async candidates(fen, depth, multipv) {
    const turn = fen.split(' ')[1] as 'w' | 'b';
    const a = await getEngine().analyze(fen, { depth, multipv });
    return new Map(a.lines.filter((l) => l.pv.length).map((l) => [l.pv[0], scoreToCp(povScore(l.score, turn))]));
  },
  async scoreAfter(fenAfter, turn) {
    const a = await getEngine().analyze(fenAfter, { depth: 9 });
    const s = a.lines[0]?.score;
    if (s) return scoreToCp(povScore(s, turn));
    return 0;
  },
  async prob(fens, uci, self, oppo) {
    const lg = await maia3Logits(fens, self, oppo);
    const vals = [...lg.values()];
    if (!vals.length) return 1;
    const mx = Math.max(...vals);
    const z = vals.reduce((s, v) => s + Math.exp(v - mx), 0);
    return Math.exp((lg.get(uci) ?? -1e9) - mx) / z;
  },
};

const n1 = (x: number | undefined) => (x === undefined ? '–' : x.toFixed(1));
const n0 = (x: number | undefined) => (x === undefined ? '–' : String(Math.round(x)));

function Line({ who, p, highlight }: { who: string; p?: ProfileSummary; highlight?: boolean }) {
  if (!p) return <tr className="text-stone-400"><td className="pr-1">{who}</td><td colSpan={7}>no data</td></tr>;
  const t = p.think;
  return (
    <tr className={highlight ? 'font-semibold' : ''}>
      <td className="pr-1 whitespace-nowrap">{who}</td>
      <td className="text-right">{n1(p.blunder)}</td>
      <td className="text-right">{n1(p.mistake)}</td>
      <td className="text-right whitespace-nowrap">{n0(p.ofBlunders.hung)}/{n0(p.ofBlunders.threat)}/{n0(p.ofBlunders.randomLooking)}</td>
      <td className="text-right whitespace-nowrap">{t ? `${n1(t.opening)}/${n1(t.middlegame)}/${n1(t.endgame)}` : '–'}</td>
      <td className="text-right">{t ? n0(t.fast) : '–'}</td>
      <td className="text-right text-stone-500">{p.games}</td>
      <td className="text-right text-stone-500">{p.moves}</td>
    </tr>
  );
}

export function BotHumanBench() {
  const map = useCcMap();
  const [mine, setMine] = useState<Saved | null>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [count, setCount] = useState(0);
  const stop = useRef(false);
  useEffect(() => {
    void kvGet<Saved | null>(KEY, null).then(setMine);
    void db.imported.count().then(setCount);
  }, []);
  const run = async () => {
    stop.current = false;
    const games = (await db.imported.toArray()).filter((g) => g.timeControl !== 'daily');
    setBusy({ done: 0, total: games.length });
    try {
      const results = await benchmarkOpponents(games, appDeps, (done, total) => setBusy({ done, total }), () => stop.current);
      const saved = { at: Date.now(), games: games.length, results };
      await kvSet(KEY, saved);
      setMine(saved);
    } finally {
      setBusy(null);
    }
  };
  const rows = benchTable(baseline.humans as HumanRow[], baseline.bots as BotRow[], map.offset, mine?.results ?? []);
  return (
    <div className="border-t border-stone-100 py-2 dark:border-stone-800" data-testid="bot-human-bench">
      <div className="mb-1 text-sm">Bots vs humans</div>
      <p className="mb-2 text-xs text-stone-500">
        Each chess.com band next to the bot that claims to match it ({map.offset > 0 ? '+' : ''}{Math.round(map.offset)} rating gap). Blunders and mistakes are % of moves in undecided positions; blunder kinds are hung / missed threat / random-looking (%); think time is seconds per move in opening / middlegame / endgame, and the share under 2 s.
        Humans: {mine?.results.length ? 'your chess.com opponents where there are 150+ moves, else ' : ''}a public chess.com 10+0 sample{baseline.generated ? ` (${baseline.generated})` : ''}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-stone-500">
              <th className="text-left font-normal" />
              <th className="text-right font-normal">Blund</th>
              <th className="text-right font-normal">Mist</th>
              <th className="text-right font-normal">H/T/R</th>
              <th className="text-right font-normal">Think O/M/E</th>
              <th className="text-right font-normal">&lt;2s</th>
              <th className="text-right font-normal">G</th>
              <th className="text-right font-normal">Mv</th>
            </tr>
          </thead>
          {rows.map((r) => (
            <tbody key={r.band} className="border-t border-stone-100 dark:border-stone-800">
              <Line who={`cc ${r.band}`} p={r.human} />
              <Line who={`bot ${r.bot?.label ?? r.label}`} p={r.bot} highlight />
            </tbody>
          ))}
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button className="btn-secondary px-3 py-1.5 text-xs" disabled={!!busy || !count} onClick={() => void run()}>
          {mine ? 'Re-measure my opponents' : 'Measure my opponents'}
        </button>
        {busy && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => (stop.current = true)}>Stop</button>}
        <span className="text-xs text-stone-500">
          {busy ? `Game ${busy.done}/${busy.total}…` : !count ? 'Import chess.com games first.' : mine ? `Last run: ${mine.games} games, ${new Date(mine.at).toLocaleDateString()}` : `${count} imported games (slow: about a minute per game)`}
        </span>
      </div>
    </div>
  );
}
