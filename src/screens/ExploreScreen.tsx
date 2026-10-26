import { useEffect, useRef, useState } from 'react';
import { Board } from '../components/Board';
import { CoachBubble } from '../components/Coach';
import { Header, Spinner } from '../components/ui';
import { PlayFromHere } from '../components/PlayFromHere';
import { explainPosition } from '../lib/coach/position';
import { formatScore } from '../lib/chess/evaluation';
import { formatLine, lineToSan, tryMove, type MoveInput } from '../lib/chess/game';
import { explainMove, type CoachComment } from '../lib/coach';
import { getEngine, type AnalysisResult } from '../lib/engine';
import { analysisLimits } from '../lib/engine/speed';
import { ScanSearch } from 'lucide-react';
import { shortWords } from '../lib/chess/words';

interface Step {
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
}

/** Analysis sandbox: play any move and the coach explains what happens after it. */
export function ExploreScreen({ fen, orientation, title }: { fen: string; orientation: 'white' | 'black'; title?: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [comment, setComment] = useState<CoachComment | null>(null);
  const [reply, setReply] = useState<{ line: string[]; fen: string; eval: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBest, setShowBest] = useState<{ san: string; uci: string } | null>(null);
  const [explained, setExplained] = useState<string[] | null>(null);
  const run = useRef(0);
  const current = steps.length ? steps[steps.length - 1].fenAfter : fen;

  useEffect(() => () => getEngine().cancelAll('explore'), []);

  const onMove = (m: MoveInput) => {
    const r = tryMove(current, m);
    if (!r) return false;
    const step = { uci: r.move.lan, san: r.move.san, fenBefore: current, fenAfter: r.fen };
    setSteps((s) => [...s, step]);
    setExplained(null);
    setComment(null);
    setReply(null);
    setShowBest(null);
    void analyse(step);
    return true;
  };

  const analyse = async (step: Step) => {
    const my = ++run.current;
    setBusy(true);
    try {
      const engine = getEngine();
      const before: AnalysisResult = await engine.analyze(step.fenBefore, { ...analysisLimits(), multipv: 3, owner: 'explore' });
      const after = await engine.analyze(step.fenAfter, { ...analysisLimits(), owner: 'explore' });
      if (my !== run.current) return;
      setComment(explainMove({ fenBefore: step.fenBefore, uci: step.uci, before, after }));
      const pv = after.lines[0]?.pv ?? [];
      setReply(pv.length ? { line: pv, fen: step.fenAfter, eval: after.lines[0] ? formatScore(after.lines[0].score) : '' } : null);
    } catch {
      /* cancelled */
    } finally {
      if (my === run.current) setBusy(false);
    }
  };

  const best = async () => {
    const a = await getEngine().analyze(current, { ...analysisLimits(), multipv: 3, owner: 'explore' });
    const uci = a.lines[0]?.pv[0];
    if (uci) setShowBest({ uci, san: lineToSan(current, [uci])[0] });
  };

  const playReply = () => {
    if (!reply) return;
    const r = tryMove(reply.fen, reply.line[0]);
    if (!r) return;
    setSteps((s) => [...s, { uci: r.move.lan, san: r.move.san, fenBefore: reply.fen, fenAfter: r.fen }]);
    setComment(null);
    setReply(null);
  };

  const reset = () => {
    run.current++;
    getEngine().cancelAll('explore');
    setSteps([]);
    setComment(null);
    setReply(null);
    setShowBest(null);
    setBusy(false);
  };

  const undo = () => {
    run.current++;
    setSteps((s) => s.slice(0, -1));
    setComment(null);
    setReply(null);
    setShowBest(null);
    setBusy(false);
  };

  const last = steps[steps.length - 1];
  const arrows = [
    ...(comment?.arrows ?? []),
    ...(showBest ? [{ from: showBest.uci.slice(0, 2), to: showBest.uci.slice(2, 4), tone: 'good' as const }] : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <Header title={title ?? 'Explore'} back />
      <div className="board-split mx-auto w-full max-w-xl flex-1 space-y-3 overflow-y-auto pb-4 land:max-w-6xl">
        <div className="board-cell px-1.5">
          <Board
            fen={current}
            orientation={orientation}
            movable={busy ? null : 'both'}
            onMove={onMove}
            arrows={arrows}
            highlights={comment?.highlights ?? []}
            lastMove={last ? { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) } : null}
          />
        </div>
        <div className="px-3 text-sm text-stone-500">{steps.length ? formatLine(fen, steps.map((s) => s.san)) : 'Play any move to see what the coach thinks of it.'}</div>
        <div className="space-y-3 px-3">
          {busy && (
            <CoachBubble mood="thinking">
              <p className="flex items-center gap-2">
                <Spinner /> Let me look at that…
              </p>
            </CoachBubble>
          )}
          {comment && !busy && (
            <CoachBubble badge={comment.classification} mood={comment.classification === 'blunder' || comment.classification === 'mistake' ? 'concerned' : 'happy'}>
              {comment.text.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
              {reply && (
                <p className="pt-1 text-sm text-stone-500">
                  Their likely answer: {shortWords(reply.fen, reply.line[0]).toLowerCase()}.
                </p>
              )}
            </CoachBubble>
          )}
          {explained && (
            <CoachBubble mood="thinking">
              {explained.map((t, i) => <p key={i}>{t}</p>)}
            </CoachBubble>
          )}
          {showBest && !comment && (
            <CoachBubble>
              <p>The best move here: {shortWords(current, showBest.uci).toLowerCase()} (see the arrow).</p>
            </CoachBubble>
          )}
          <div className="flex flex-wrap gap-2">
            {reply && (
              <button className="btn-secondary" onClick={playReply}>
                Play reply
              </button>
            )}
            <button className="btn-secondary" disabled={!steps.length} onClick={undo}>
              Undo
            </button>
            <button className="btn-secondary" disabled={!steps.length} onClick={reset}>
              Reset
            </button>
            <button className="btn-secondary" disabled={busy} onClick={best}>
              Best move?
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                void getEngine()
                  .analyze(current, { ...analysisLimits(), owner: 'explore' })
                  .then((a) => setExplained(explainPosition(current, a, orientation === 'white' ? 'w' : 'b')))
                  .catch(() => undefined)
              }
            >
              <ScanSearch size={16} className="mr-1 inline" />Explain
            </button>
            <PlayFromHere fen={current} color={orientation === 'white' ? 'w' : 'b'} />
          </div>
        </div>
      </div>
    </div>
  );
}
