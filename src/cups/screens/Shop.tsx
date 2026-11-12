// The shop between rounds: three charms for gold, two slots.
import { CHARMS, canHoldCharm, charmPrice, type CharmId } from '../boons';
import type { CupState } from '../cup';
import { useCup } from '../store';
import { TarotCard } from '../ui/bits';
import { PixelText } from '../ui/PixelText';
import { PixelNum } from '../ui/bits';
import { Sprite } from '../pixel/sprites';
import { sfx } from '../sfx';
import { TUNING } from '../tuning';

export function GoldCount({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Sprite name="coin" size={18} px={10} stroke={5} />
      <PixelNum value={value} size={3} />
    </span>
  );
}

export function Shop({ c }: { c: CupState }) {
  const s = useCup();
  const full = c.charms.length >= TUNING.charms.slots;
  return (
    <div className="run-fadeup flex h-full flex-col items-center overflow-y-auto px-4 pt-5 pb-6 text-center">
      <div className="flex w-full items-center justify-between">
        <span className="run-label">Charm shop</span>
        <GoldCount value={c.gold} />
      </div>
      <PixelText text="Shop" size={4} />
      <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">Charms are single use. Use them from the bar during a game (or on the opponent card).</div>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        {(c.shop ?? []).map((id: CharmId, i) => {
          const price = charmPrice(id);
          const held = !canHoldCharm(c.charms, id);
          const can = c.gold >= price && !full && !held;
          return (
            <TarotCard
              key={`${id}-${i}`}
              info={CHARMS[id]}
              kind="consumable"
              w={104}
              onClick={can ? () => void s.buyCharm(id).then((ok) => ok && sfx('coin')) : undefined}
              className={`run-deal ${can ? '' : 'opacity-50'}`}
              style={{ animationDelay: `${i * 90}ms` }}
              footer={held ? <span className="run-sans text-[10px] font-bold text-[var(--ink-dim)]">Hold one at a time</span> : <span className="run-sans inline-flex items-center gap-1 text-xs font-black text-[var(--gold-2)]"><Sprite name="coin" size={12} px={10} /> {price}</span>}
            />
          );
        })}
        {!(c.shop ?? []).length && <div className="run-sans text-sm text-[var(--ink-dim)]">Sold out.</div>}
      </div>
      <div className="mt-6">
        <div className="run-label">Your charms · {c.charms.length}/{TUNING.charms.slots}</div>
        <div className="mt-1 flex justify-center gap-2">
          {Array.from({ length: TUNING.charms.slots }, (_, k) => (c.charms[k] ? <TarotCard key={k} info={CHARMS[c.charms[k]]} kind="consumable" w={60} /> : <div key={k} className="run-panel flex items-center justify-center opacity-40" style={{ width: 60, height: 112 }}>empty</div>))}
        </div>
      </div>
      <button className="run-btn mt-6 w-full max-w-xs text-lg" onClick={() => (sfx('door'), void s.leaveShop())}>Next match</button>
    </div>
  );
}
