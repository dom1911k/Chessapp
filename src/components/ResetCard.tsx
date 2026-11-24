import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { resetProgress } from '../lib/backup';
import { Dialog } from './ui';

/** Settings: start over from scratch (with a clear warning and a second confirmation). */
export function ResetCard() {
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    await resetProgress();
    location.reload();
  };
  return (
    <div className="card">
      <div className="mb-1 section-title">Start over</div>
      <p className="text-sm text-stone-500">Delete all progress and begin again as a new player.</p>
      <button className="btn-secondary mt-3 w-full !text-danger-700" onClick={() => setOpen(true)}>
        Reset all progress…
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setSure(false);
        }}
        title="Reset all progress?"
      >
        <div className="space-y-3 text-sm">
          <p className="flex gap-2 rounded-xl bg-danger-50 p-3 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            This deletes your games, your ratings, achievements, badges, journey, skills, collection, course progress and review cards. It can't be undone.
          </p>
          <p className="text-stone-500">Your settings stay. Tip: make a backup first (above) if you might want it back.</p>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="h-5 w-5 accent-danger-700" />
            Yes, I want to start over
          </label>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn flex-1 bg-danger-700 text-white disabled:opacity-40" disabled={!sure || busy} onClick={() => void reset()}>
              {busy ? 'Resetting…' : 'Delete everything'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
