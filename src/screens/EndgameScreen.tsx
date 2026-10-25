import { Chess } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { Header, Spinner } from '../components/ui';
import { povScore, scoreToCp, type Score } from '../lib/chess/evaluation';
import { tryMove, type MoveInput } from '../lib/chess/game';
import { hangingPieces, parseFen, PIECE_NAME, sqName, type Color } from '../lib/chess/pos';
import { getHint } from '../lib/coach';
import type { Hint } from '../lib/coach/hints';
import { kvGet, kvSet, bumpActivity } from '../lib/db';
import { drillById, type Drill } from '../lib/endgames';
import { getEngine } from '../lib/engine';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';

type Status = 'playing' | 'thinking' | 'won' | 'lost';

export interface DrillProgress {
  completed: number;
  bestMoves: number | null;
}
export const DRILL_KEY = 'endgameProgress';

const ENGINE = { depth: 16, movetime: 1500, owner: 'endgame' };

export function EndgameScreen({ drillId }: { drillId: string }) {
  const drill = drillById(drillId)!;
  const confirmMoves = useSettings((s) => s.confirmMoves);
  const [startFen, setStartFen] = useState(() => pickFen(drill));
  const me = startFen.split(' ')[1] as Color;
  const [history, setHistory] = useState<string[]>([startFen]);
  const [status, setStatus] = useState<Status>('playing');
  const [tip, setTip] = useState<string | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const evalRef = useRef<Map<string, Score>>(new Map());
  const tipIndex = useRef(1); // tip 0 is the intro
  const run = useRef(0);
  const fen = history[history.length - 1];
  const myMoves = Math.floor((history.length - 1) / 2) + (history.length % 2 === 0 ? 1 : 0);

  useEffect(() => () => getEngine().cancelAll('endgame'), []);

  const evaluate = useCallback(async (f: string) => {
    const a = await getEngine().analyze(f, ENGINE);
    if (a.lines[0]) evalRef.current.set(f, a.lines[0].score);
    return a;
  }, []);

  useEffect(() => {
    void evaluate(startFen).catch(() => undefined);
  }, [startFen, evaluate]);

  const finish = async (won: boolean, msg: string) => {
    playSound(won ? 'success' : 'error');
    setStatus(won ? 'won' : 'lost');
    setTip(msg);
    if (won) {
      const all = await kvGet<Record<string, DrillProgress>>(DRILL_KEY, {});
      const prev = all[drill.id] ?? { completed: 0, bestMoves: null };
      all[drill.id] = { completed: prev.completed + 1, bestMoves: prev.bestMoves === null ? myMoves : Math.min(prev.bestMoves, myMoves) };
      await kvSet(DRILL_KEY, all);
      await bumpActivity('puzzles');
    }
  };

  const onMove = (m: MoveInput) => {
    if (status !== 'playing') return false;
    const r = tryMove(fen, m);
    if (!r) return false;
    const before = fen;
    setHistory((h) => [...h, r.fen]);
    setLast({ from: m.from, to: m.to });
    setHint(null);
    void afterUserMove(before, r.fen, r.move.promotion ? true : false, myMoves + 1);
    return true;
  };

  const afterUserMove = async (before: string, after: string, promoted: boolean, movesUsed: number) => {
    const my = ++run.current;
    const c = new Chess(after);
    if (c.isCheckmate()) return finish(true, `Checkmate in ${movesUsed} moves! ${movesUsed <= drill.maxMoves ? 'Goal reached. 🎉' : ''}`);
    const hold = drill.goal === 'hold';
    if (c.isStalemate() || c.isInsufficientMaterial() || c.isThreefoldRepetition())
      return hold
        ? finish(true, 'Draw! You held the position. 🎉')
        : c.isStalemate()
          ? finish(false, 'Stalemate! The king had no legal move but was not in check — that\'s a draw. Always leave the king a square until you can give mate.')
          : finish(false, 'There isn\'t enough material left to checkmate — it\'s a draw.');
    // Won the pawn: the opponent has nothing but the king (a promoted pawn doesn't count as won).
    if (drill.goal === 'capture' && !parseFen(after).board.some((p) => p && p.color !== me && p.type !== 'k'))
      return finish(true, `You won the pawn in ${movesUsed} moves! The rest is an easy queen mate. 🎉`);
    if (drill.goal === 'promote' && promoted) {
      setStatus('thinking');
      const a = await evaluate(after).catch(() => null);
      if (my !== run.current) return;
      const s = a?.lines[0] ? povScore(a.lines[0].score, me) : null;
      if (!s || scoreToCp(s) > 300) return finish(true, `You promoted the pawn in ${movesUsed} moves! 🎉`);
      return finish(false, 'You promoted, but the new queen can be captured right away. Promote only when the square is safe!');
    }
    if (movesUsed >= drill.maxMoves && !hold) return finish(false, `That's ${drill.maxMoves} moves — the goal was ${drill.goalText.toLowerCase()}. Try again!`);

    setStatus('thinking');
    try {
      const a = await evaluate(after);
      if (my !== run.current) return;
      const sc = a.lines[0]?.score;
      if (hold && sc) {
        const mine = scoreToCp(povScore(sc, me));
        if (mine < -350) return finish(false, 'That move loses — now the attacker can force a win. Take it back and try to keep your king (or rook) in the defensive spot.');
        if (movesUsed >= drill.maxMoves) return finish(true, `You held the draw for ${drill.maxMoves} moves! 🎉`);
      }
      setTip(coachTip(before, after, sc));
      const reply = a.lines[0]?.pv[0] ?? a.bestMove;
      if (!reply) return;
      await new Promise((r) => setTimeout(r, 350));
      if (my !== run.current) return;
      const rr = tryMove(after, reply)!;
      setHistory((h) => [...h, rr.fen]);
      setLast({ from: reply.slice(0, 2), to: reply.slice(2, 4) });
      const c2 = new Chess(rr.fen);
      if (c2.isCheckmate()) return finish(false, 'Checkmate — your opponent got through. Take back a move and try again!');
      if (c2.isInsufficientMaterial() || c2.isStalemate()) return hold ? finish(true, 'Draw! You held the position. 🎉') : finish(false, 'Your opponent captured your last piece that could win — it\'s a draw.');
      if (drill.goal === 'promote' && !parseFen(rr.fen).board.some((p) => p?.type === 'p' && p.color === me))
        return finish(false, 'Your pawn was captured. Try again — keep it protected by your king!');
      setStatus('playing');
      void evaluate(rr.fen).catch(() => undefined);
    } catch {
      /* cancelled */
    }
  };

  /** Coach tips from the engine's view of the move. */
  const coachTip = (before: string, after: string, scoreAfter?: Score): string | null => {
    const sb = evalRef.current.get(before);
    if (!scoreAfter) return null;
    const pa = povScore(scoreAfter, me);
    const pb = sb ? povScore(sb, me) : null;
    const hang = hangingPieces(parseFen(after).board, me).filter((h) => parseFen(after).board[h.sq]?.type !== 'p');
    if (hang.length) {
      const p = parseFen(after).board[hang[0].sq]!;
      return `Careful — your ${PIECE_NAME[p.type]} on ${sqName(hang[0].sq)} can be captured! Take the move back.`;
    }
    // Some endings (two bishops) are misjudged by the small engine: no eval-based tips there.
    if (drill.engineTips === false) return null;
    const cpA = scoreToCp(pa);
    const cpB = pb ? scoreToCp(pb) : null;
    if (drill.goal === 'hold') return cpA < -150 ? drill.tips[tipIndex.current++ % drill.tips.length] : null;
    if (cpB !== null && cpB > 300 && cpA < 100) return 'Oh no — that lets the win slip away. Take it back and try another idea.';
    // Mate got further away: not making progress.
    if (pb?.type === 'mate' && pa.type === 'mate' && pa.value > pb.value + 1) return drill.tips[tipIndex.current++ % drill.tips.length];
    if (pb?.type === 'mate' && pa.type !== 'mate') return drill.tips[tipIndex.current++ % drill.tips.length];
    return null;
  };

  const takeback = () => {
    run.current++;
    getEngine().cancelAll('endgame');
    // Remove the opponent's reply and your move.
    setHistory((h) => {
      const myTurnLen = h.length % 2 === 1 ? h.length - 2 : h.length - 1;
      return h.slice(0, Math.max(1, myTurnLen));
    });
    setStatus('playing');
    setTip(null);
    setHint(null);
    setLast(null);
  };

  const restart = (newPosition = false) => {
    run.current++;
    getEngine().cancelAll('endgame');
    const f = newPosition ? pickFen(drill, startFen) : startFen;
    setStartFen(f);
    setHistory([f]);
    setStatus('playing');
    setTip(null);
    setHint(null);
    setLast(null);
  };

  const askHint = async () => {
    const level = Math.min(3, (hint?.level ?? 0) + 1) as 1 | 2 | 3;
    try {
      const a = await getEngine().analyze(fen, ENGINE);
      const h = getHint(fen, a.lines[0]?.pv ?? [], level);
      if (h && level === 1) h.text = drill.tips[tipIndex.current++ % drill.tips.length];
      setHint(h);
    } catch {
      /* ignore */
    }
  };

  const movable = status === 'playing' && fen.split(' ')[1] === me ? me : null;
  const intro = useMemo(() => drill.tips[0], [drill]);

  return (
    <div className="flex h-full flex-col">
      <Header title={drill.title} back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4">
        <div className="flex items-center justify-between px-3 text-sm">
          <span className="font-semibold">🎯 {drill.goalText}</span>
          <span className={myMoves >= drill.maxMoves - 3 ? 'font-bold text-red-600' : 'text-stone-500'}>
            Move {Math.min(myMoves + (movable ? 1 : 0), drill.maxMoves)}/{drill.maxMoves}
          </span>
        </div>
        <div className="px-1.5">
          <Board fen={fen} confirm={confirmMoves} orientation={me === 'w' ? 'white' : 'black'} movable={movable} onMove={onMove} lastMove={last} arrows={hint?.arrows} highlights={hint?.highlights} />
        </div>
        <div className="space-y-3 px-3">
          {status === 'won' || status === 'lost' ? (
            <CoachBubble
              mood={status === 'won' ? 'happy' : 'concerned'}
              actions={
                <>
                  {status === 'lost' && history.length > 1 && <button className="btn-primary" onClick={takeback}>Take back</button>}
                  <button className={status === 'won' ? 'btn-primary' : 'btn-secondary'} onClick={() => restart(true)}>New position</button>
                  <button className="btn-secondary" onClick={() => restart(false)}>Restart</button>
                </>
              }
            >
              <p>{tip}</p>
            </CoachBubble>
          ) : (
            <CoachBubble mood={status === 'thinking' ? 'thinking' : tip ? 'concerned' : 'happy'}>
              {status === 'thinking' && !tip ? (
                <p className="flex items-center gap-2"><Spinner /> Your opponent is thinking…</p>
              ) : (
                <p>{hint?.text ?? tip ?? (history.length === 1 ? intro : 'Keep going!')}</p>
              )}
            </CoachBubble>
          )}
          {(status === 'playing' || status === 'thinking') && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" disabled={status !== 'playing' || hint?.level === 3} onClick={askHint}>💡 Hint</button>
              <button className="btn-secondary" disabled={history.length < 2} onClick={takeback}>↶ Take back</button>
              <button className="btn-ghost" onClick={() => restart(false)}>Restart</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pickFen(d: Drill, not?: string): string {
  const pool = d.fens.length > 1 ? d.fens.filter((f) => f !== not) : d.fens;
  return pool[Math.floor(Math.random() * pool.length)];
}
