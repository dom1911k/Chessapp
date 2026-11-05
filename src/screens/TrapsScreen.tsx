// The traps library: common tricks at 400–900, Coach Sam's explanation, the trap played out, and a
// drill — spot and refute it, then keep the position safe against Maia. Traps seen in my imported
// chess.com games are marked.
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { ChevronRight, Swords } from 'lucide-react';
import { Header, Segmented } from '../components/ui';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { ChessComBadge } from '../components/ChessCom';
import { db } from '../lib/db';
import { useNav } from '../lib/nav';
import { TRAPS, trapById, trapFen, trapStats, sanToUci, type Trap } from '../lib/traps';
import { formatLine, START_FEN, tryMove, uciToSan, type MoveInput } from '../lib/chess/game';
import { classify, povScore, winPct } from '../lib/chess/evaluation';
import { getEngine } from '../lib/engine';
import { chooseMaiaMove, maiaLogits, maiaTemperature } from '../lib/maia';
import { playSound } from '../lib/sound';

type Stats = Record<string, { faced: number; fell: number; set: number }>;

function useTrapStats(): Stats {
  const [st, setSt] = useState<Stats>({});
  useEffect(() => void db.imported.toArray().then((gs) => setSt(trapStats(gs))), []);
  return st;
}

export function TrapsScreen() {
  const push = useNav((s) => s.push);
  const st = useTrapStats();
  const [side, setSide] = useState<'all' | 'w' | 'b'>('all');
  const list = TRAPS.filter((t) => side === 'all' || t.victim === side);
  return (
    <div className="flex h-full flex-col">
      <Header title="Traps & tricks" back subtitle="What people at 400–900 try" />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-2 overflow-y-auto p-4">
        <Segmented value={side} onChange={setSide} options={[{ value: 'all', label: 'All' }, { value: 'w', label: 'Against White' }, { value: 'b', label: 'Against Black' }]} />
        {list.map((t) => {
          const s = st[t.id];
          return (
            <button key={t.id} className="card flex w-full items-center gap-3 !p-3 text-left" onClick={() => push({ name: 'trap', trapId: t.id })}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.victim === 'w' ? 'bg-white text-stone-800 ring-1 ring-stone-300' : 'bg-stone-800 text-white'}`}>
                <Swords size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.name}</span>
                <span className="block truncate text-xs text-stone-500">
                  {t.opening} · against {t.victim === 'w' ? 'White' : 'Black'}
                </span>
                {s && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs">
                    <ChessComBadge />
                    {s.faced > 0 && <span className={s.fell ? 'text-red-600' : 'text-emerald-700'}>faced {s.faced}×{s.fell ? `, fell for it ${s.fell}×` : ', never fell for it'}</span>}
                    {s.set > 0 && <span className="text-stone-500">{s.faced ? ' · ' : ''}you set it {s.set}×</span>}
                  </span>
                )}
              </span>
              <ChevronRight size={18} className="text-stone-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TrapScreen({ trapId }: { trapId: string }) {
  const t = trapById(trapId)!;
  const st = useTrapStats()[t.id];
  const [tab, setTab] = useState<'learn' | 'drill'>('learn');
  return (
    <div className="flex h-full flex-col">
      <Header title={t.name} back subtitle={t.opening} />
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        <div className="px-3">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'learn', label: 'See the trap' }, { value: 'drill', label: 'Drill vs Maia' }]} />
        </div>
        {st && (
          <p className="flex items-center gap-1.5 px-3 text-sm">
            <ChessComBadge /> In your games: {st.faced ? `faced ${st.faced}×${st.fell ? `, fell for it ${st.fell}×` : ''}` : ''}
            {st.set ? `${st.faced ? ' · ' : ''}you set it ${st.set}×` : ''}
          </p>
        )}
        {tab === 'learn' ? <TrapWalkthrough t={t} onDrill={() => setTab('drill')} /> : <TrapDrill key={t.id} t={t} />}
      </div>
    </div>
  );
}

/** The trap played out move by move, with Coach Sam's words. */
function TrapWalkthrough({ t, onDrill }: { t: Trap; onDrill: () => void }) {
  const [n, setN] = useState(t.critical);
  const fens = useMemo(() => {
    const c = new Chess(START_FEN);
    const out = [c.fen()];
    const moves: { from: string; to: string }[] = [];
    for (const san of t.line) {
      const m = c.move(san);
      out.push(c.fen());
      moves.push({ from: m.from, to: m.to });
    }
    return { out, moves };
  }, [t]);
  const fen = fens.out[n];
  const last = n > 0 ? fens.moves[n - 1] : null;
  const atCritical = n === t.critical;
  const good = sanToUci(trapFen(t), t.good[0]);
  const arrows = atCritical ? [{ from: good.slice(0, 2), to: good.slice(2, 4), tone: 'good' as const }, { from: fens.moves[t.critical].from, to: fens.moves[t.critical].to, tone: 'bad' as const }] : [];
  return (
    <>
      <div className="board-cell px-1.5">
        <Board fen={fen} orientation={t.victim === 'w' ? 'white' : 'black'} movable={null} lastMove={last} arrows={arrows} />
      </div>
      <div className="space-y-3 px-3">
        <div className="grid grid-cols-4 gap-1.5">
          <button className="btn-secondary !px-0" onClick={() => setN(0)}>⏮</button>
          <button className="btn-secondary !px-0" disabled={n === 0} onClick={() => setN(n - 1)}>◀</button>
          <button className="btn-secondary !px-0" disabled={n >= t.line.length} onClick={() => setN(n + 1)}>▶</button>
          <button className="btn-secondary !px-0" onClick={() => setN(t.line.length)}>⏭</button>
        </div>
        <p className="text-center text-xs text-stone-500">
          {n === 0 ? 'Start position' : formatLine(START_FEN, t.line.slice(0, n)).split(' ').slice(-2).join(' ')}
          {atCritical ? ' — the critical moment: red = the trap move, green = the safe move' : n > t.critical ? ' — the trap springs' : ''}
        </p>
        <CoachBubble mood={n > t.critical ? 'concerned' : 'thinking'} actions={<button className="btn-primary" onClick={onDrill}>Drill it vs Maia</button>}>
          {t.text.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
          <p className="text-sm text-stone-500">Warning sign: {t.sign}</p>
        </CoachBubble>
      </div>
    </>
  );
}

/** Rating Maia plays at in the drill: my chess.com level, else 800. */
async function drillElo(): Promise<number> {
  const gs = await db.imported.orderBy('endedAt').reverse().limit(10).toArray();
  return gs.length ? Math.round(gs.reduce((a, g) => a + g.myRating, 0) / gs.length) : 800;
}

const DRILL_MOVES = 4;

/** Spot and refute the trap at the critical moment, then keep it safe for a few moves vs Maia. */
function TrapDrill({ t }: { t: Trap }) {
  const start = useMemo(() => trapFen(t), [t]);
  const prevMove = useMemo(() => {
    const c = new Chess(START_FEN);
    let m = null;
    for (const san of t.line.slice(0, t.critical)) m = c.move(san);
    return m ? { from: m.from, to: m.to } : null;
  }, [t]);
  const [fens, setFens] = useState<string[]>([start]);
  const [last, setLast] = useState(prevMove);
  const [phase, setPhase] = useState<'move' | 'thinking' | 'won' | 'failed'>('move');
  const [made, setMade] = useState(0);
  const [msg, setMsg] = useState<string>(`${t.victim === 'w' ? 'White' : 'Black'} to move. Something here is a trap — find the safe move.`);
  const [better, setBetter] = useState<string | null>(null);
  const fen = fens[fens.length - 1];
  const me = t.victim;

  useEffect(() => () => getEngine().cancelAll('trap'), []);

  const reset = () => {
    getEngine().cancelAll('trap');
    setFens([start]);
    setLast(prevMove);
    setPhase('move');
    setMade(0);
    setBetter(null);
    setMsg(`${me === 'w' ? 'White' : 'Black'} to move. Something here is a trap — find the safe move.`);
  };

  const onMove = (m: MoveInput) => {
    if (phase !== 'move') return false;
    const r = tryMove(fen, m);
    if (!r) return false;
    const history = [...fens, r.fen];
    setFens(history);
    setLast({ from: r.move.from, to: r.move.to });
    setPhase('thinking');
    void (async () => {
      try {
        const eng = getEngine();
        const before = await eng.analyze(fen, { depth: 12, multipv: 1, owner: 'trap' });
        const after = new Chess(r.fen).isGameOver() ? null : await eng.analyze(r.fen, { depth: 12, multipv: 1, owner: 'trap' });
        const wpB = before.lines[0] ? winPct(povScore(before.lines[0].score, me)) : 50;
        const mate = new Chess(r.fen).isCheckmate();
        const wpA = mate ? 100 : after?.lines[0] ? winPct(povScore(after.lines[0].score, me)) : wpB;
        const cls = classify(wpB, wpA, r.move.lan === before.bestMove);
        const first = made === 0;
        const ok = first ? cls === 'best' || cls === 'good' : cls !== 'mistake' && cls !== 'blunder';
        if (!ok) {
          playSound('error');
          setPhase('failed');
          setBetter(before.bestMove);
          setMsg(
            first && r.move.san === t.line[t.critical]
              ? `That's exactly the trap! ${t.text[1]}`
              : `Not safe: ${before.bestMove ? `${uciToSan(fen, before.bestMove)} was the move here` : 'there was something better'}. ${first ? t.text[t.text.length - 1] : ''}`,
          );
          return;
        }
        const n = made + 1;
        setMade(n);
        if (n >= DRILL_MOVES || mate) {
          playSound('success');
          setPhase('won');
          setMsg(first ? `Spotted it! ${t.text[t.text.length - 1]}` : `Refuted — and you kept it safe for ${n} moves against Maia. That's how you beat this trap.`);
          return;
        }
        setMsg(first ? 'Good — you saw through it. Now keep it safe: Maia plays on.' : 'Still safe. Keep going.');
        // Maia replies like a human at my level.
        const elo = await drillElo();
        let reply: string | null = null;
        try {
          reply = chooseMaiaMove(await maiaLogits(history, elo), maiaTemperature(elo), elo);
        } catch {
          reply = after?.bestMove ?? null;
        }
        reply ??= after?.bestMove ?? null;
        const rr = reply ? tryMove(r.fen, reply) : null;
        if (!rr) {
          setPhase('won');
          return;
        }
        setFens([...history, rr.fen]);
        setLast({ from: rr.move.from, to: rr.move.to });
        setPhase('move');
      } catch {
        /* cancelled */
      }
    })();
    return true;
  };

  const arrows = phase === 'failed' && better ? [{ from: better.slice(0, 2), to: better.slice(2, 4), tone: 'good' as const }] : [];
  return (
    <>
      <div className="board-cell px-1.5">
        <Board fen={phase === 'failed' ? fens[fens.length - 2] ?? fen : fen} orientation={me === 'w' ? 'white' : 'black'} movable={phase === 'move' ? me : null} onMove={onMove} lastMove={last} arrows={arrows} />
      </div>
      <div className="space-y-3 px-3">
        <CoachBubble
          mood={phase === 'failed' ? 'concerned' : phase === 'won' ? 'happy' : 'thinking'}
          actions={(phase === 'won' || phase === 'failed') && <button className="btn-primary" onClick={reset}>{phase === 'won' ? 'Again' : 'Try again'}</button>}
        >
          <p>{phase === 'thinking' ? 'Checking…' : msg}</p>
          {phase === 'move' && made > 0 && <p className="text-sm text-stone-500">Move {made + 1} of {DRILL_MOVES}</p>}
        </CoachBubble>
      </div>
    </>
  );
}
