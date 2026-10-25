import { useRef, useState } from 'react';
import { describeBackup, exportBackup, parseBackup, restoreBackup, type Backup } from '../lib/backup';
import { Dialog, Spinner } from './ui';

export function BackupCard() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);

  const doExport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const name = await exportBackup();
      setMsg(`Backup created: ${name}`);
    } catch (e) {
      setMsg(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
    } catch (e) {
      setMsg((e as Error).message);
    }
    if (input.current) input.current.value = '';
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending);
      window.location.reload();
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="card space-y-3">
      <div>
        <div className="text-sm font-semibold text-stone-500">Backup</div>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Save all your games, puzzles and progress to one file — keep it in Google Drive or send it to yourself. Use it to move to a new phone.
        </p>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={doExport} disabled={busy}>
          {busy ? <Spinner /> : '⬆️ Export'}
        </button>
        <button className="btn-secondary flex-1" onClick={() => input.current?.click()} disabled={busy}>
          ⬇️ Import
        </button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {msg && <p className="text-sm text-stone-500">{msg}</p>}
      <Dialog open={!!pending} onClose={() => setPending(null)} title="Restore backup?">
        <p className="text-sm">{pending && describeBackup(pending)}</p>
        <p className="mt-2 text-sm font-semibold text-red-600">This replaces everything currently in the app.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" onClick={confirm} disabled={busy}>
            {busy ? <Spinner /> : 'Restore'}
          </button>
          <button className="btn-secondary flex-1" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </div>
  );
}
