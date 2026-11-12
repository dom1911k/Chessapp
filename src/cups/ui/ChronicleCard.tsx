// The recap at the end of a cup: one line per game, the highlight stats, and a share button.
import { useMemo, useState } from 'react';
import { useMyName } from '../../components/UserAvatar';
import type { CupState } from '../cup';
import { chronicle } from '../story';
import { shareChronicle } from '../share';

export function ChronicleCard({ c }: { c: CupState }) {
  const myName = useMyName();
  const ch = useMemo(() => chronicle(c, myName), [c, myName]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="run-panel run-fadeup mt-4 px-4 py-4 text-left">
      <div className="run-label">Chronicle</div>
      <div className="run-title text-xl leading-tight font-black text-[var(--gold-2)]">{ch.title}</div>
      <div className="run-sans text-xs text-[var(--ink-dim)]">{ch.subtitle}</div>
      <ul className="mt-3 space-y-1.5">
        {ch.lines.map((l, i) => (
          <li key={i} className="run-sans text-sm leading-snug">{l}</li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ch.stats.map((s) => (
          <div key={s.label}>
            <div className="run-label text-[9px]!">{s.label}</div>
            <div className="run-title text-lg font-black">{s.value}</div>
          </div>
        ))}
      </div>
      <button className="run-btn ghost mt-3 w-full text-sm" disabled={busy} onClick={() => (setBusy(true), void shareChronicle(ch).finally(() => setBusy(false)))}>Share as image</button>
    </div>
  );
}
