// "Where did it turn?" — scrub a lost game with no evals, tap the move you think lost it,
// optionally say why, then see where it really turned and why.
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, X } from 'lucide-react';
import { Board } from '../components/Board';
import { Header, Spinner } from '../components/ui';
import { CoachAvatar } from '../components/Coach';
import { useNav } from '../lib/nav';
import { db } from '../lib/db';
import { loadAnyGame } from '../lib/games';
import { reviewGame } from '../lib/review';
import { mistakeCauses } from '../lib/games/causes';
import { tidy } from '../lib/reviewText';
import { newCardDue, type Card } from '../lib/srs';
import { chipForCause, myPlies, REASON_CHIPS, saveResult, skipGame, spotOn, turningPoint, type ReasonChip } from '../lib/turning';
import type { AnyGame } from '../lib/store/types';

const sq = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

export function TurningScreen({ gameId }: { gameId: number | string }) {
  const pop = useNav((s) => s.pop);
  const [g, setG] = useState<AnyGame | null | undefined>(undefined);
  useEffect(() => void loadAnyGame(gameId).then(setG), [gameId]);
  const tp = useMemo(() => (g ? turningPoint(g) : null), [g]);
  const mine = useMemo(() => (g ? myPlies(g) : []), [g]);
  // Position shown: after `at` plies (0 = start).
  const [at, setAt] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [chip, setChip] = useState<ReasonChip | null>(null);
  const [stage, setStage] = useState<'scrub' | 'why' | 'reveal'>('scrub');
  const [showBest, setShowBest] = useState(false);
  const [result, setResult] = useState<{ found: boolean; engineChip: ReasonChip | null; added: boolean } | null>(null);

  if (g === undefined) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (!g || !tp) return (
    <div className="flex h-full flex-col"><Header title="Where did it turn?" back />
      <p className="p-4 text-stone-500">This game has no clear turning point.</p></div>
  );

  const orientation = g.userColor === 'w' ? 'white' : 'black';
  const n = g.plies.length;
  const plyShown = at - 1; // the move just played to reach this position
  const isMine = plyShown >= 0 && g.plies[plyShown].isUser;
  const moveLabel = (i: number) => `${Math.floor(i / 2) + 1}${g.plies[i].color === 'w' ? '.' : '…'} ${g.plies[i].san}`;

  const reveal = async () => {
    if (pick === null) return;
    const found = spotOn(g, pick, tp.ply);
    // What the engine says went wrong at the real turning point.
    const r = reviewGame(g);
    const cause = mistakeCauses(g, r.plies.map((x) => x.cls)).find((c) => c.ply === tp.ply);
    const engineChip = cause ? (cause.timeTrouble ? 'time' : chipForCause(cause.cause)) : null;
    const chipMatched = chip && engineChip ? chip === engineChip || (chip === 'time' && !!(cause?.fast || cause?.timeTrouble)) : undefined;
    let added = false;
    if (!found) {
      const p = g.plies[tp.ply];
      const best = p.comment?.bestUci;
      if (best && best !== p.uci) {
        const card: Card = {
          id: `tp:${g.id}`, kind: 'mistake', fen: p.fenBefore, solution: [best], playedUci: p.uci, playedSan: p.san,
          themes: p.comment?.themes ?? [], label: `Turning point · vs ${g.opponentName ?? 'opponent'}`,
          explanation: p.comment?.text, createdAt: Date.now(), due: newCardDue(Date.now()), step: 0, reps: 0, lapses: 0,
          ...(g.source === 'chess.com' ? { source: 'chess.com' as const, ccGameId: String(g.id) } : { gameId: Number(g.id) }),
        };
        if (!(await db.cards.get(card.id))) await db.cards.put(card);
        added = true;
      }
    }
    await saveResult({ gameId: g.id!, at: Date.now(), found, chip: chip ?? undefined, chipMatched });
    setResult({ found, engineChip, added });
    setAt(tp.ply + 1);
    setStage('reveal');
  };
  const skip = async () => { await skipGame(g.id!); pop(); };

  const tpPly = g.plies[tp.ply];
  // Same arrows as Game Review: after the move, red = what it allowed; "Show best" = the position
  // before it with the best move in green.
  const showFen = stage === 'reveal' ? (showBest ? tpPly.fenBefore : tpPly.fenAfter) : at === 0 ? g.startFen : g.plies[at - 1].fenAfter;
  const last = stage === 'reveal' ? (showBest ? null : sq(tpPly.uci)) : plyShown >= 0 ? sq(g.plies[plyShown].uci) : null;
  const reply = tpPly.comment?.replyLine?.[0];
  const bestUci = tpPly.comment?.bestUci;
  const arrows = stage !== 'reveal' ? undefined : showBest ? (bestUci ? [{ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), tone: 'good' as const }] : []) : reply ? [{ from: reply.slice(0, 2), to: reply.slice(2, 4), tone: 'bad' as const }] : [];

  return (
    <div className="flex h-full flex-col" data-testid="turning">
      <Header title="Where did it turn?" back />
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 overflow-y-auto p-4">
        {stage === 'scrub' && <p className="text-sm text-stone-600 dark:text-stone-300">Step through the game and tap <b>This move lost it</b> on the move of yours you think turned it. No engine help.</p>}
        <div className="-mx-4"><Board fen={showFen} orientation={orientation} movable={null} lastMove={last} arrows={arrows} /></div>
        {stage === 'scrub' && (
          <>
            <div className="flex items-center justify-between gap-1">
              <button className="btn-secondary !px-3" aria-label="Start" onClick={() => setAt(0)}><ChevronsLeft size={18} /></button>
              <button className="btn-secondary !px-3" aria-label="Back" onClick={() => setAt((x) => Math.max(0, x - 1))}><ChevronLeft size={18} /></button>
              <span className="min-w-[96px] text-center text-sm tabular-nums">{plyShown >= 0 ? moveLabel(plyShown) : 'Start'}</span>
              <button className="btn-secondary !px-3" aria-label="Forward" onClick={() => setAt((x) => Math.min(n, x + 1))}><ChevronRight size={18} /></button>
              <button className="btn-secondary !px-3" aria-label="End" onClick={() => setAt(n)}><ChevronsRight size={18} /></button>
            </div>
            <input type="range" min={0} max={n} value={at} onChange={(e) => setAt(Number(e.target.value))} className="w-full accent-brand-600" aria-label="Move" />
            <button className="btn-primary w-full" disabled={!isMine} onClick={() => { setPick(plyShown); setStage('why'); }}>
              {isMine ? `This move lost it: ${moveLabel(plyShown)}` : 'Go to one of your moves'}
            </button>
            <button className="btn-ghost w-full text-sm" onClick={() => void skip()}>Skip this game</button>
          </>
        )}
        {stage === 'why' && pick !== null && (
          <div className="card space-y-3 !p-3">
            <p className="text-sm">You picked <b>{moveLabel(pick)}</b>. Why did it go wrong? <span className="text-stone-500">(optional)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {REASON_CHIPS.map((c) => (
                <button key={c.id} className={`chip ${chip === c.id ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200'}`} onClick={() => setChip(chip === c.id ? null : c.id)}>{c.label}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setStage('scrub')}>Change move</button>
              <button className="btn-primary flex-1" onClick={() => void reveal()}>Check</button>
            </div>
          </div>
        )}
        {stage === 'reveal' && result && (
          <div className="card space-y-2 !p-3">
            <div className="flex items-center gap-2 font-semibold">
              {result.found ? <Check size={18} className="text-emerald-600" /> : <X size={18} className="text-red-500" />}
              {result.found ? 'Spot on!' : `It turned on ${moveLabel(tp.ply)}`}
            </div>
            <div className="flex gap-2">
              <CoachAvatar mood={result.found ? 'happy' : 'thinking'} size={32} />
              <p className="flex-1 text-sm">{tpPly.comment?.text?.[0] ? tidy(tpPly.comment.text[0]) : `That move cost about ${(tp.drop / 100).toFixed(1)} pawns.`}</p>
            </div>
            {chip && result.engineChip && (
              <p className="text-xs text-stone-500">Your reason: {REASON_CHIPS.find((c) => c.id === chip)!.label}. The engine's: {REASON_CHIPS.find((c) => c.id === result.engineChip)!.label}.</p>
            )}
            {result.added && <p className="text-xs text-stone-500">This position is in your reviews now.</p>}
            {bestUci && <button className="text-sm font-semibold text-brand-700 dark:text-brand-500" onClick={() => setShowBest(!showBest)}>{showBest ? 'Show what it allowed' : 'Show the best move'}</button>}
            <div className="flex gap-2 pt-1">
              <button className="btn-secondary flex-1" onClick={() => useNav.getState().push({ name: 'review', gameId: g.id!, ply: tp.ply })}>Full review</button>
              <button className="btn-primary flex-1" onClick={pop}>Done</button>
            </div>
          </div>
        )}
        <p className="text-center text-xs text-stone-500">{mine.length} of your moves · vs {g.opponentName ?? 'opponent'}</p>
      </div>
    </div>
  );
}
