// The Laurel shop (between cups): boons and a charm that join the random offers, pixel skins,
// and an avatar frame per cup tier.
import { LAUREL_SHOP, canBuy, type ShopKind } from '../laurels';
import { useCupsMeta } from '../meta';
import { useCup } from '../store';
import { Sprite } from '../pixel/sprites';
import { GOLD, JADE, SPIRIT, EMBER, BLOOD, type SpritePalette } from '../pixel/pixelize';
import { PixelText } from '../ui/PixelText';
import { sfx } from '../sfx';

const SECTIONS: { kind: ShopKind; title: string; pal: SpritePalette }[] = [
  { kind: 'boon', title: 'Boons', pal: GOLD },
  { kind: 'charm', title: 'Charm', pal: EMBER },
  { kind: 'board', title: 'Boards', pal: JADE },
  { kind: 'pieces', title: 'Pieces', pal: SPIRIT },
  { kind: 'frame', title: 'Avatar frames', pal: BLOOD },
];

export function LaurelShop({ onBack }: { onBack: () => void }) {
  const meta = useCupsMeta();
  const trophies = useCup((s) => s.trophies);
  return (
    <div className="run-fadeup flex h-full flex-col overflow-y-auto px-4 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <button className="run-btn ghost px-3! py-1.5! text-sm" onClick={onBack}>Back</button>
        <span className="flex items-center gap-1.5"><Sprite name="crown" size={20} px={12} /><span className="run-title text-lg font-black">{meta.laurels}</span></span>
      </div>
      <div className="mt-2 text-center">
        <PixelText text="Laurel shop" size={3} />
        <div className="run-sans mt-1 text-xs text-[var(--ink-dim)]">Laurels: semi-final 1 · final 2 · cup won 3. Boons and charms you buy join the random offers.</div>
      </div>
      {SECTIONS.map((sec) => (
        <section key={sec.kind} className="mt-4">
          <div className="run-label mb-1">{sec.title}</div>
          <div className="space-y-2">
            {LAUREL_SHOP.filter((i) => i.kind === sec.kind).map((item) => {
              const st = canBuy(item, meta.laurels, meta.unlocks, trophies);
              const owned = meta.unlocks.includes(item.id);
              return (
                <div key={item.id} className={`run-panel flex items-center gap-3 px-3 py-2 ${owned ? 'opacity-70' : ''}`}>
                  <Sprite name={item.glyph} size={34} px={14} pal={sec.pal} />
                  <div className="min-w-0 flex-1">
                    <div className="run-title leading-tight font-black">{item.name}</div>
                    <div className="run-sans text-xs leading-snug text-[var(--ink-dim)]">{item.text}</div>
                  </div>
                  {owned ? (
                    <span className="run-sans text-xs font-black text-[var(--gold-2)]">Owned</span>
                  ) : (
                    <button className="run-btn shrink-0 px-3! py-1.5! text-sm" disabled={!st.ok} title={st.why} onClick={() => void meta.buy(item.id, item.price).then((ok) => ok && sfx('relic'))}>
                      {st.ok || st.why?.endsWith('Laurels') ? `${item.price} 🌿` : 'Locked'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
