// Choose a cup: five tiers with tight rating bands; each win opens the next.
import { TIERS, tierInfo, tierOpen, type CupTier } from '../ladder';
import { useCup } from '../store';
import { Sprite } from '../pixel/sprites';
import { BLOOD, GOLD, JADE, SPIRIT, EMBER, type SpritePalette } from '../pixel/pixelize';
import { sfx } from '../sfx';

export const TIER_PAL: Record<CupTier, SpritePalette> = { bronze: EMBER, silver: SPIRIT, gold: GOLD, platinum: JADE, diamond: BLOOD };

export function TierList() {
  const s = useCup();
  return (
    <div className="mt-4 w-full max-w-sm space-y-2.5">
      {TIERS.map((t) => {
        const open = tierOpen(t, s.trophies);
        const won = s.trophies[t] ?? 0;
        const info = tierInfo(t);
        return (
          <div key={t} className={`run-panel flex items-center gap-3 px-3 py-2.5 text-left ${open ? '' : 'opacity-50'}`}>
            <Sprite name={open ? 'crown' : 'lock'} size={42} px={16} pal={TIER_PAL[t]} />
            <div className="min-w-0 flex-1">
              <div className="run-title text-lg leading-tight font-black">{info.name}</div>
              <div className="run-sans text-xs text-[var(--ink-dim)]">{open ? `Opponents ${info.band[0]}–${info.band[1]}` : `Win the ${tierInfo(TIERS[TIERS.indexOf(t) - 1]).name} first`}</div>
              {won > 0 && <div className="run-sans text-xs font-black text-[var(--gold-2)]">Won {won}×</div>}
            </div>
            <button className="run-btn px-4! py-2!" disabled={!open} onClick={() => (sfx('card'), void s.enter(t))}>Enter</button>
          </div>
        );
      })}
    </div>
  );
}
