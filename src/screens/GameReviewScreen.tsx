// Game Review, chess.com style. First a summary (Coach Sam's take, both players' accuracy, the
// move classes, phases, key moments), then a steady step-through: eval bar + board, a move strip,
// a fixed-size coach panel, Best / Retry / Next, and the arrows at the bottom. The two views live
// in ./review/ (SummaryView, StepView).
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '../components/ui';
import { loadAnyGame } from '../lib/games';
import { db } from '../lib/db';
import { reviewGame } from '../lib/review';
import { trapById, trapCard, trapForLoss } from '../lib/traps';
import type { AnyGame, ImportedGame } from '../lib/store/types';
import { StepView } from './review/StepView';
import { SummaryView } from './review/SummaryView';

export function GameReviewScreen({ gameId, ply }: { gameId: number | string; ply?: number }) {
  const [g, setG] = useState<AnyGame | null | undefined>(undefined);
  const [step, setStep] = useState<number | null>(ply ?? null);
  useEffect(() => void loadAnyGame(gameId).then(setG), [gameId]);
  const review = useMemo(() => (g ? reviewGame(g) : null), [g]);
  // A quick chess.com loss to a known trap: make sure that trap is in the daily reviews.
  const trap = g && g.source === 'chess.com' ? trapForLoss(g) : null;
  useEffect(() => {
    if (!trap || !g) return;
    void db.cards.get(`t:${trap.id}`).then(async (c) => {
      if (!c) await db.cards.put(trapCard(trapById(trap.id)!, Date.now(), g as ImportedGame));
    });
  }, [trap?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g || !review) return <div className="flex h-full items-center justify-center">{g === null ? <p className="text-stone-500">Game not found.</p> : <Spinner />}</div>;
  if (step !== null) return <StepView g={g} r={review} start={step} onSummary={() => setStep(null)} />;
  return <SummaryView g={g} r={review} trap={trap?.id} onStart={(i) => setStep(i)} />;
}
