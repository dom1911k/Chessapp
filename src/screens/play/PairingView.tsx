// Quick match pairing (round 7): "Finding an opponent…" with the time control for a moment, then
// the versus card. Three default avatars take turns lighting up while it looks.
import { useEffect, useState } from 'react';
import { usePlay } from '../../lib/store/play';
import { timeControlLabel } from '../../lib/chesscom/parse';
import { StrangerAvatar } from '../../components/StrangerAvatar';
import { reduced as reducedMotion } from '../../lib/motion';

export function PairingView() {
  const pairing = usePlay((s) => s.pairing);
  const cancel = usePlay((s) => s.cancelPairing);
  const reduced = reducedMotion();
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setLit((x) => (x + 1) % 3), 420);
    return () => clearInterval(t);
  }, [reduced]);
  if (!pairing) return null;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center" data-testid="pairing">
      <div className="flex items-center -space-x-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`rounded-[8px] ring-2 ring-[var(--surface,#fff)] transition-opacity duration-200 dark:ring-stone-900 ${reduced || lit === i ? 'opacity-100' : 'opacity-45'}`}>
            <StrangerAvatar avatar={[0, 4, 6][i]} size={56} grey={!reduced && lit !== i} />
          </span>
        ))}
      </div>
      <div>
        <div className="text-[20px] font-extrabold tracking-[-0.01em]">Finding an opponent…</div>
        <div className="mt-1 text-sm text-stone-500" data-testid="pairing-tc">{timeControlLabel(pairing.tc)} · Rated</div>
      </div>
      <button className="btn-ghost text-sm" onClick={cancel}>Cancel</button>
    </div>
  );
}
