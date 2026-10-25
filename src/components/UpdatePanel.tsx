import { useEffect, useState } from 'react';
import { checkForUpdate, currentVersion, installUpdate, skipVersion, updatesSupported, type UpdateInfo } from '../lib/update';
import { Dialog, Spinner } from './ui';

/** Shows the download/install flow for an available update. */
function UpdateBody({ u, onClose }: { u: UpdateInfo; onClose: () => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const start = async () => {
    setMsg(null);
    setProgress(0);
    try {
      const r = await installUpdate(u, setProgress);
      if (r === 'needs-permission') {
        setProgress(null);
        setMsg('Allow Chess Coach to install updates (switch on "Allow from this source"), come back, and tap Update again.');
      } else {
        setMsg('Tap "Update" in the Android window. Your games and progress are kept.');
      }
    } catch (e) {
      setProgress(null);
      setMsg(`${(e as Error).message}. Check your internet connection and try again.`);
    }
  };
  const notes = u.notes.split('\n').filter((l) => l.trim() && !l.startsWith('**Install')).slice(0, 6);
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Version <b>{u.version}</b> is available (you have {u.current}). Size: {(u.size / 1e6).toFixed(1)} MB.
      </p>
      {notes.length > 0 && <div className="max-h-32 overflow-y-auto rounded-lg bg-stone-100 p-2 text-xs whitespace-pre-wrap dark:bg-stone-800">{notes.join('\n')}</div>}
      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {msg && <p className="text-sm text-stone-600 dark:text-stone-300">{msg}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={start} disabled={progress !== null && progress < 1}>
          {progress !== null && progress < 1 ? <><Spinner /> {Math.round(progress * 100)}%</> : 'Update'}
        </button>
        <button className="btn-secondary flex-1" onClick={onClose}>Later</button>
      </div>
    </div>
  );
}

/** Dialog shown at start-up when the daily check finds a new version. */
export function UpdateDialog({ update, onClose }: { update: UpdateInfo | null; onClose: () => void }) {
  return (
    <Dialog open={!!update} onClose={onClose} title="Update available 🎉">
      {update && (
        <>
          <UpdateBody u={update} onClose={onClose} />
          <button
            className="btn-ghost mt-1 w-full text-xs"
            onClick={() => {
              void skipVersion(update.version);
              onClose();
            }}
          >
            Skip this version
          </button>
        </>
      )}
    </Dialog>
  );
}

/** Settings card: current version + manual check. */
export function UpdateCard() {
  const [version, setVersion] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'none' | 'error'>('idle');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    void currentVersion().then(setVersion);
  }, []);
  if (!updatesSupported()) return null;
  const check = async () => {
    setState('checking');
    try {
      const u = await checkForUpdate();
      setUpdate(u);
      setState(u ? 'idle' : 'none');
    } catch {
      setState('error');
    }
  };
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-stone-500">App updates</div>
          <div className="text-sm">Version {version}</div>
        </div>
        <button className="btn-secondary" onClick={check} disabled={state === 'checking'}>
          {state === 'checking' ? <Spinner /> : 'Check for updates'}
        </button>
      </div>
      {state === 'none' && <p className="text-sm text-stone-500">You have the newest version. ✓</p>}
      {state === 'error' && <p className="text-sm text-stone-500">Couldn't reach GitHub — are you online?</p>}
      {update && <UpdateBody u={update} onClose={() => setUpdate(null)} />}
    </div>
  );
}
