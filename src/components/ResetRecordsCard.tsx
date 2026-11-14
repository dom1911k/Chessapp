// Settings: start every bot head-to-head afresh (the bots were recalibrated in v1.55).
import { useState } from 'react';
import { Dialog } from './ui';
import { resetOpponentRecords } from '../lib/people/record';

export function ResetRecordsCard() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    await resetOpponentRecords();
    setBusy(false);
    setOpen(false);
    setDone(true);
  };
  return (
    <div className="card" data-testid="reset-records">
      <div className="mb-1 section-title">Fresh records against the bots</div>
      <p className="text-sm text-stone-500">Set your wins, draws, losses, stars and rivalry levels against every bot back to zero. Your game history stays.</p>
      <button className="btn-secondary mt-3 w-full" disabled={done} onClick={() => setOpen(true)}>
        {done ? 'Records reset' : 'Reset bot records…'}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Reset bot records?">
        <div className="space-y-3 text-sm">
          <p>Every bot's W/D/L counter, stars and rivalry level start again from zero.</p>
          <p className="text-stone-500">Kept: your game history, your rating, opponents you've already opened, matchup badges and finished challenges.</p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1" disabled={busy} onClick={() => void reset()}>{busy ? 'Resetting…' : 'Reset records'}</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
