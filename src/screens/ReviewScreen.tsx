import { useEffect, useState } from 'react';
import { Board } from '../components/Board';
import { EvalGraph } from '../components/Charts';
import { CoachBubble, FlagButton } from '../components/Coach';
import { MoveList } from '../components/MoveList';
import { Header, Spinner } from '../components/ui';
import { formatScore } from '../lib/chess/evaluation';
import { db } from '../lib/db';
import { useNav } from '../lib/nav';
import type { GameRecord } from '../lib/store/types';

export function ReviewScreen({ gameId, ply }: { gameId: number; ply?: number }) {
  const [g, setG] = useState<GameRecord | null>(null);
  const [i, setI] = useState(ply ?? -1);
  const [showBetter, setShowBetter] = useState(false);
  const push = useNav((s) => s.push);

  useEffect(() => {
    void db.games.get(gameId).then((x) => setG(x ?? null));
  }, [gameId]);
  useEffect(() => setShowBetter(false), [i]);

  if (!g) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  const p = i >= 0 ? g.plies[i] : null;
  const orientation = g.userColor === 'w' ? 'white' : 'black';
  const important = (k: number) => {
    const c = g.plies[k].classification;
    return g.plies[k].isUser && (c === 'inaccuracy' || c === 'mistake' || c === 'blunder');
  };
  const nextImportant = () => {
    for (let k = i + 1; k < g.plies.length; k++) if (important(k)) return setI(k);
  };
  const c = p?.comment;
  const serious = p && (p.classification === 'mistake' || p.classification === 'blunder' || p.classification === 'inaccuracy');
  const fen = p ? (showBetter ? p.fenBefore : p.fenAfter) : g.startFen;
  const arrows = showBetter && c?.bestUci ? [{ from: c.bestUci.slice(0, 2), to: c.bestUci.slice(2, 4), tone: 'good' as const }] : [];

  return (
    <div className="flex h-full flex-col">
      <Header title="Review" back />
      <div className="mx-auto w-full max-w-xl flex-1 space-y-2 overflow-y-auto pb-3">
        <div className="px-1.5">
          <Board
            fen={fen}
            orientation={orientation}
            movable={null}
            arrows={arrows}
            highlights={!showBetter ? (c?.highlights ?? []) : []}
            lastMove={p && !showBetter ? { from: p.uci.slice(0, 2), to: p.uci.slice(2, 4) } : null}
          />
        </div>
        <MoveList plies={g.plies} startFen={g.startFen} current={i} onSelect={setI} />
        <div className="grid grid-cols-5 gap-1.5 px-3">
          <button className="btn-secondary !px-0" onClick={() => setI(-1)}>⏮</button>
          <button className="btn-secondary !px-0" disabled={i < 0} onClick={() => setI(i - 1)}>◀</button>
          <button className="btn-secondary !px-0" disabled={i >= g.plies.length - 1} onClick={() => setI(i + 1)}>▶</button>
          <button className="btn-secondary !px-0" onClick={() => setI(g.plies.length - 1)}>⏭</button>
          <button className="btn-secondary !px-0 text-xs" onClick={nextImportant} title="Next mistake">⚠️ Next</button>
        </div>
        <div className="space-y-3 px-3">
          {p && p.isUser && c ? (
            <CoachBubble
              badge={c.classification}
              mood={serious ? 'concerned' : 'happy'}
              actions={
                serious && (
                  <>
                    {c.bestSan && (
                      <button className="btn-secondary" onClick={() => setShowBetter(!showBetter)}>
                        {showBetter ? 'Show game move' : `Show better: ${c.bestSan}`}
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => push({ name: 'explore', fen: p.fenBefore, orientation, title: 'Explore position' })}>
                      Explore
                    </button>
                  </>
                )
              }
            >
              <p className="font-semibold">You played {p.san}.</p>
              {c.text.map((t, k) => <p key={k}>{t}</p>)}
              {serious && <FlagButton fen={p.fenBefore} uci={p.uci} comment={c} />}
            </CoachBubble>
          ) : p ? (
            <CoachBubble>
              <p>
                The bot played {p.san}.{p.evalAfter ? <span className="text-stone-500"> Eval: {formatScore(p.evalAfter)}</span> : null}
              </p>
            </CoachBubble>
          ) : (
            <CoachBubble><p>Step through the game with ▶, or jump to the next mistake with ⚠️.</p></CoachBubble>
          )}
          <EvalGraph plies={g.plies} current={i} onSelect={setI} />
        </div>
      </div>
    </div>
  );
}
