// Your boons as small tarot cards on the game screen; one lights up (with a short sound) when it acts.
import { useEffect, useState } from 'react';
import { BOONS, type BoonId } from '../boons';
import { useCupGame } from '../game';
import { TarotCard } from './bits';
import { Sheet } from './Sheet';
import { buzz, sfx } from '../sfx';
import { TUNING } from '../tuning';

export function BoonRail({ boons }: { boons: BoonId[] }) {
  const pulse = useCupGame((s) => s.pulse);
  const [lit, setLit] = useState<string | null>(null);
  const [info, setInfo] = useState<BoonId | null>(null);
  useEffect(() => {
    if (!pulse || pulse.kind !== 'boon') return;
    setLit(pulse.id);
    sfx('chip');
    buzz(TUNING.juice.haptic.boon);
    const t = setTimeout(() => setLit(null), 900);
    return () => clearTimeout(t);
  }, [pulse]);
  if (!boons.length) return null;
  return (
    <>
      <div className="flex justify-center gap-1.5 px-2 py-1">
        {boons.map((b) => (
          <div key={b} className={`transition-transform duration-200 ${lit === b ? 'run-punch scale-110 drop-shadow-[0_0_10px_var(--gold)]' : ''}`}>
            <TarotCard info={BOONS[b]} kind="relic" w={46} onClick={() => setInfo(b)} />
          </div>
        ))}
      </div>
      {info && (
        <Sheet onClose={() => setInfo(null)}>
          <div className="flex items-center gap-3">
            <TarotCard info={BOONS[info]} kind="relic" w={84} />
            <div className="min-w-0 text-left">
              <div className="run-label">Boon · whole cup</div>
              <div className="run-title text-xl font-black">{BOONS[info].name}</div>
              <div className="run-sans mt-1 text-sm text-[var(--ink-dim)]">{BOONS[info].text}</div>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
