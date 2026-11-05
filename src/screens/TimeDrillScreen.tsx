// Time drills: Convert on the clock (60 s to mate against Maia) and Quick decisions (10 obvious
// moves, 5 s each — trains not over-thinking easy moves).
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Header, Spinner } from '../components/ui';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { kvGet, kvSet } from '../lib/db';
import { tryMove, uciToSan, type MoveInput } from '../lib/chess/game';
import { classify, povScore, winPct } from '../lib/chess/evaluation';
import { getEngine } from '../lib/engine';
import { chooseMaiaMove, maiaLogits, maiaTemperature } from '../lib/maia';
import { loadRange } from '../lib/puzzles/data';
import { playSound } from '../lib/sound';
import { fmtClock } from '../lib/clock';
import { CONVERT_SECONDS, QUICK_COUNT, QUICK_LABEL, QUICK_MAX_RATING, QUICK_SECONDS, convertPositions, quickCorrect, quickSet, type QuickItem } from '../lib/timedrills';

const BEST_KEY = 'timeDrillBest';
type Best = { convert?: number; quick?: number };

export function TimeDrillScreen({ kind }: { kind: 'convert' | 'quick' }) {
  return kind === 'convert' ? <ConvertDrill /> : <QuickDrill />;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const mv = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

/** A countdown that ticks every 100 ms while `running`; calls onZero once at 0. */
function useCountdown(seconds: number, running: boolean, onZero: () => void, resetKey: unknown) {
  const [ms, setMs] = useState(seconds * 1000);
  const end = useRef(0);
  const fired = useRef(false);
  const zero = useRef(onZero);
  zero.current = onZero;
  useEffect(() => {
    setMs(seconds * 1000);
    fired.current = false;
  }, [resetKey, seconds]);
  useEffect(() => {
    if (!running) return;
    end.current = Date.now() + ms;
    const t = setInterval(() => {
      const left = Math.max(0, end.current - Date.now());
      setMs(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        zero.current();
      }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, resetKey]);
  return ms;
}

function ConvertDrill() {
  const [start, setStart] = useState(() => pick(convertPositions()));
  const [fens, setFens] = useState<string[]>([start.fen]);
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const [phase, setPhase] = useState<'ready' | 'play' | 'reply' | 'won' | 'lost'>('ready');
  const [best, setBest] = useState<Best>({});
  useEffect(() => void kvGet<Best>(BEST_KEY, {}).then(setBest), []);
  const fen = fens[fens.length - 1];
  const me = start.fen.split(' ')[1] as 'w' | 'b';
  const running = phase === 'play' || phase === 'reply';
  const ms = useCountdown(CONVERT_SECONDS, running, () => (setPhase('lost'), playSound('error')), start);

  const again = () => {
    const s = pick(convertPositions());
    setStart(s);
    setFens([s.fen]);
    setLast(null);
    setPhase('ready');
  };
  const onMove = (m: MoveInput) => {
    // The first move starts the clock.
    if (phase !== 'play' && phase !== 'ready') return false;
    const r = tryMove(fen, m);
    if (!r) return false;
    const hist = [...fens, r.fen];
    setFens(hist);
    setLast({ from: r.move.from, to: r.move.to });
    const c = new Chess(r.fen);
    if (c.isCheckmate()) {
      const secs = Math.round((CONVERT_SECONDS * 1000 - ms) / 100) / 10;
      setPhase('won');
      playSound('success');
      if (!best.convert || secs < best.convert) {
        const b = { ...best, convert: secs };
        setBest(b);
        void kvSet(BEST_KEY, b);
      }
      return true;
    }
    if (c.isGameOver()) {
      setPhase('lost');
      playSound('error');
      return true;
    }
    setPhase('reply');
    void (async () => {
      let reply: string | null = null;
      try {
        reply = chooseMaiaMove(await maiaLogits(hist, 1100), maiaTemperature(1100), 1100);
      } catch {
        reply = (await getEngine().analyze(r.fen, { depth: 6, owner: 'timeDrill' }).catch(() => null))?.bestMove ?? null;
      }
      const rr = reply ? tryMove(r.fen, reply) : null;
      if (!rr) return setPhase('lost');
      setFens([...hist, rr.fen]);
      setLast({ from: rr.move.from, to: rr.move.to });
      setPhase((p) => (p === 'reply' ? 'play' : p));
    })();
    return true;
  };
  const low = ms < CONVERT_SECONDS * 100;
  return (
    <div className="flex h-full flex-col">
      <Header title="Convert on the clock" back subtitle={`${start.title} · ${CONVERT_SECONDS} seconds`} />
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        <div className="flex items-center justify-between px-3">
          <span className="text-sm text-stone-500">Checkmate before the flag falls. Maia defends.</span>
          <span className={`rounded-lg px-2 py-0.5 font-mono text-lg font-bold tabular-nums ${low ? 'animate-pulse bg-red-600 text-white' : 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'}`}>{fmtClock(ms)}</span>
        </div>
        <div className="board-cell px-1.5">
          <Board fen={fen} orientation={me === 'w' ? 'white' : 'black'} movable={phase === 'play' || phase === 'ready' ? me : null} onMove={onMove} lastMove={last} />
        </div>
        <div className="px-3">
          {phase === 'ready' && (
            <CoachBubble actions={<button className="btn-primary" onClick={() => setPhase('play')}>Start the clock</button>}>
              <p>You're winning — now prove it on the clock. Push the king to the edge with the {start.title.split(' ')[0].toLowerCase()}, bring your king, then mate. Don't stalemate!</p>
              {best.convert && <p className="text-sm text-stone-500">Your best: mate in {best.convert}s.</p>}
            </CoachBubble>
          )}
          {phase === 'won' && (
            <CoachBubble mood="happy" actions={<button className="btn-primary" onClick={again}>Another one</button>}>
              <p>Checkmate with {fmtClock(ms)} left! Converting quickly is what wins games on chess.com.</p>
            </CoachBubble>
          )}
          {phase === 'lost' && (
            <CoachBubble mood="concerned" actions={<button className="btn-primary" onClick={again}>Try again</button>}>
              <p>{ms <= 0 ? 'Flag! Out of time.' : new Chess(fen).isStalemate() ? "Stalemate — that's only a draw." : 'That one got away.'} Make the box smaller with every move, and don't check without a plan.</p>
            </CoachBubble>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickDrill() {
  const [items, setItems] = useState<QuickItem[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<{ ok: boolean; secs: number }[]>([]);
  const [shown, setShown] = useState<{ ok: boolean; why: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [best, setBest] = useState<Best>({});
  const load = () => {
    setItems(null);
    setI(0);
    setResults([]);
    setShown(null);
    void loadRange(400, QUICK_MAX_RATING).then((ps) => setItems(quickSet(ps)));
  };
  useEffect(() => {
    load();
    void kvGet<Best>(BEST_KEY, {}).then(setBest);
  }, []);
  const it = items?.[i];
  const done = !!items && i >= items.length;
  const running = !!it && !shown && !checking;
  const ms = useCountdown(QUICK_SECONDS, running, () => finish(false, QUICK_SECONDS, 'Too slow — five seconds is plenty for this one.'), i);

  const finish = (ok: boolean, secs: number, why: string) => {
    setResults((r) => [...r, { ok, secs }]);
    setShown({ ok, why });
    playSound(ok ? 'success' : 'error');
  };
  useEffect(() => {
    if (!done || !items) return;
    const score = results.filter((r) => r.ok).length;
    if (best.quick === undefined || score > best.quick) {
      const b = { ...best, quick: score };
      setBest(b);
      void kvSet(BEST_KEY, b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const onMove = (m: MoveInput) => {
    if (!it || !running) return false;
    const r = tryMove(it.fen, m);
    if (!r) return false;
    const secs = Math.round((QUICK_SECONDS * 1000 - ms) / 100) / 10;
    if (quickCorrect(it, r.move.lan)) {
      finish(true, secs, 'Right — and quick.');
      return true;
    }
    // Another escape can be just as good: let the engine judge (the clock has stopped).
    setChecking(true);
    void (async () => {
      let ok = false;
      try {
        const e = getEngine();
        const me = it.fen.split(' ')[1] as 'w' | 'b';
        const before = await e.analyze(it.fen, { depth: 10, owner: 'timeDrill' });
        const after = await e.analyze(r.fen, { depth: 10, owner: 'timeDrill' });
        const cls = classify(winPct(povScore(before.lines[0].score, me)), winPct(povScore(after.lines[0].score, me)), r.move.lan === before.bestMove);
        ok = cls === 'best' || cls === 'good';
      } catch {
        /* keep it wrong */
      }
      setChecking(false);
      finish(ok, secs, ok ? 'That works too.' : `${uciToSan(it.fen, it.answer)} was the move.`);
    })();
    return true;
  };

  if (!items) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  const score = results.filter((r) => r.ok).length;
  const avg = results.length ? Math.round((results.reduce((a, r) => a + r.secs, 0) / results.length) * 10) / 10 : 0;
  return (
    <div className="flex h-full flex-col">
      <Header title="Quick decisions" back subtitle={`${QUICK_COUNT} easy moves · ${QUICK_SECONDS} seconds each`} />
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        {done ? (
          <div className="px-3">
            <CoachBubble mood={score >= 8 ? 'happy' : 'thinking'} actions={<button className="btn-primary" onClick={load}>Play again</button>}>
              <p className="font-semibold">{score} of {items.length} · {avg}s per move</p>
              <p>{score >= 8 ? "That's how to play easy moves: see it, play it, save your clock for the hard ones." : 'Recaptures, free pieces and escaping a threat should take a second or two. The more of them you see at once, the more time you keep for the hard moves.'}</p>
              {best.quick !== undefined && <p className="text-sm text-stone-500">Your best: {best.quick} of {QUICK_COUNT}.</p>}
            </CoachBubble>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3">
              <span className="text-sm font-semibold">{i + 1}/{items.length}</span>
              <span className="chip bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{QUICK_LABEL[it!.kind]}?</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-stone-200 dark:bg-stone-800">
                <div className={`h-full ${ms < 1500 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${(ms / (QUICK_SECONDS * 1000)) * 100}%` }} />
              </div>
            </div>
            <div className="board-cell px-1.5">
              <Board
                key={it!.id}
                fen={it!.fen}
                orientation={it!.fen.split(' ')[1] === 'w' ? 'white' : 'black'}
                movable={running ? (it!.fen.split(' ')[1] as 'w' | 'b') : null}
                onMove={onMove}
                lastMove={mv(it!.last)}
                arrows={shown && !shown.ok ? [{ ...mv(it!.answer), tone: 'good' as const }] : []}
              />
            </div>
            <div className="px-3">
              {checking ? (
                <CoachBubble><p>Checking…</p></CoachBubble>
              ) : shown ? (
                <CoachBubble mood={shown.ok ? 'happy' : 'concerned'} actions={<button className="btn-primary" onClick={() => (setShown(null), setI(i + 1))}>Next</button>}>
                  <p>{shown.why}</p>
                </CoachBubble>
              ) : (
                <CoachBubble><p>One move is obvious here. Play it — don't overthink.</p></CoachBubble>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
