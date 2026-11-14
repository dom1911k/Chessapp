// What's new (v1.55, shown once): ratings moved to the chess.com scale.
import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { kvGet, kvSet } from '../lib/db';
import { SCALE_NEWS_KEY } from '../lib/migrate';

export const SCALE_NEWS = "What's new: bot ratings are now chess.com ratings — each bot plays like real chess.com players at its rating, and your rating and history were converted to match.";

export function ScaleNews() {
  const [show, setShow] = useState(false);
  useEffect(() => void kvGet<boolean>(SCALE_NEWS_KEY, false).then(setShow), []);
  if (!show) return null;
  const close = () => { setShow(false); void kvSet(SCALE_NEWS_KEY, false); };
  return (
    <div className="card flex items-start gap-2 !p-3 text-sm" data-testid="scale-news">
      <Sparkles size={16} className="mt-0.5 shrink-0 text-brand-600" />
      <p className="flex-1">{SCALE_NEWS}</p>
      <button aria-label="Dismiss" className="shrink-0 text-stone-400" onClick={close}><X size={16} /></button>
    </div>
  );
}
