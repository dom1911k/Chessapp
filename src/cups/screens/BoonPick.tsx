// After a won round: pick one boon of three (it lasts the rest of the cup).
import { useState } from 'react';
import { BOONS } from '../boons';
import type { CupState } from '../cup';
import { useCup } from '../store';
import { TarotCard } from '../ui/bits';
import { PixelText } from '../ui/PixelText';
import { sfx } from '../sfx';
import { TUNING } from '../tuning';

export function BoonPick({ c }: { c: CupState }) {
  const pick = useCup((s) => s.pickBoon);
  const [sel, setSel] = useState<string | null>(null);
  const offer = c.offer ?? [];
  return (
    <div className="run-fadeup flex h-full flex-col items-center overflow-y-auto px-4 pt-6 pb-6 text-center">
      <div className="run-label">Round won · boon {c.boons.length + 1} of {TUNING.boons.maxPerCup}</div>
      <PixelText text="Choose a boon" size={3} />
      <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">It lasts for the rest of the cup.</div>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {offer.map((b, i) => (
          <TarotCard key={b} info={BOONS[b]} kind="relic" w={104} selected={sel === b} onClick={() => (sfx('card'), setSel(b))} className="run-deal" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      {sel && <div className="run-sans mt-4 max-w-xs text-sm">{BOONS[sel as keyof typeof BOONS].text}</div>}
      <button className="run-btn mt-5 w-full max-w-xs text-lg" disabled={!sel} onClick={() => (sfx('relic'), void pick(sel as keyof typeof BOONS))}>Take it</button>
      {c.boons.length > 0 && (
        <div className="mt-6">
          <div className="run-label">Your boons</div>
          <div className="mt-1 flex justify-center gap-1.5">{c.boons.map((b) => <TarotCard key={b} info={BOONS[b]} kind="relic" w={52} />)}</div>
        </div>
      )}
    </div>
  );
}
