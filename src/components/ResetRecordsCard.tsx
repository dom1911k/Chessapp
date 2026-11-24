// Settings: a fresh start against the bots (the bots were recalibrated in v1.55).
import { useState } from 'react';
import { Dialog } from './ui';
import { resetOpponentRecords } from '../lib/people/record';
import { restartGameRating } from '../lib/rewards/rating';
import { OPPONENTS } from '../lib/people';

const START = OPPONENTS[0].elo;

export function ResetRecordsCard() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(true);
  const reset = async () => {
    setBusy(true);
    await resetOpponentRecords();
    if (rating) await restartGameRating(START);
    setBusy(false);
    setOpen(false);
    setDone(true);
  };
  return (
    <div className="card" data-testid="reset-records">
      <div className="mb-1 section-title">Fresh start against the bots</div>
      <p className="text-sm text-stone-500">Clear your records against every bot and start the ladder again from {OPPONENTS[0].name} ({START}). Your game history stays.</p>
      <button className="btn-secondary mt-3 w-full" disabled={done} onClick={() => setOpen(true)}>
        {done ? 'Done — fresh start' : 'Start fresh against the bots…'}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Fresh start against the bots?">
        <div className="space-y-3 text-sm">
          <p>Every bot's wins, draws, losses, badges and special challenges are cleared, and only the first three opponents are open again.</p>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={rating} onChange={(e) => setRating(e.target.checked)} className="h-5 w-5 accent-brand-600" />
            Also restart my rating at {START}
          </label>
          <p className="text-stone-500">Kept: your game history and reviews, puzzles, achievements and your collection.</p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={busy} onClick={() => void reset()}>{busy ? 'Resetting…' : 'Start fresh'}</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
