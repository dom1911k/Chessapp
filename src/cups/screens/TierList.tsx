// Choose a cup: five tiers with tight rating bands; each win opens the next. Entering opens the
// preparation sheet: sign a sponsor's contract and, once you have won the tier, turn up the heat.
import { useState } from 'react';
import { TIERS, tierInfo, tierOpen, type CupTier } from '../ladder';
import { useCup } from '../store';
import { useCupsMeta } from '../meta';
import { Sprite } from '../pixel/sprites';
import { BLOOD, GOLD, JADE, SPIRIT, EMBER, type SpritePalette } from '../pixel/pixelize';
import { sfx } from '../sfx';
import { HEATS, heatLaurels, heatOf, heatOpen, type HeatId } from '../heat';
import { sponsorOffers, sponsorReward } from '../sponsors';
import { STAR_NAMES } from '../mastery';
import { opponentById } from '../../lib/people';
import { Sheet } from '../ui/Sheet';
import { TUNING } from '../tuning';

export const TIER_PAL: Record<CupTier, SpritePalette> = { bronze: EMBER, silver: SPIRIT, gold: GOLD, platinum: JADE, diamond: BLOOD };

/** Three stars: filled for the ones earned. */
export function Stars({ got, size = 14 }: { got: boolean[] | undefined; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${(got ?? []).filter(Boolean).length} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} title={STAR_NAMES[i]} style={{ fontSize: size, lineHeight: 1, color: got?.[i] ? 'var(--gold-2)' : 'rgba(255,255,255,.18)', textShadow: got?.[i] ? '0 0 6px rgba(242,199,92,.6)' : undefined }}>★</span>
      ))}
    </span>
  );
}

export function TierList() {
  const s = useCup();
  const meta = useCupsMeta();
  const [prep, setPrep] = useState<CupTier | null>(null);
  return (
    <div className="mt-4 w-full max-w-sm space-y-2.5">
      {meta.nemesis && (
        <div className="run-panel flex items-center gap-2 px-3 py-2 text-left" style={{ boxShadow: '0 0 0 2px var(--blood)' }}>
          <Sprite name="skull" size={28} px={12} pal={BLOOD} />
          <div className="run-sans text-xs leading-snug">
            <b className="text-[#ff8a98]">Nemesis: {opponentById(meta.nemesis.id)?.name}</b> knocked you out {meta.nemesis.grudge === 1 ? 'once' : `${meta.nemesis.grudge} times`}. They are waiting in your next cup, on the other side of the bracket.
          </div>
        </div>
      )}
      {TIERS.map((t) => {
        const open = tierOpen(t, s.trophies);
        const won = s.trophies[t] ?? 0;
        const info = tierInfo(t);
        const best = meta.heatBest?.[t];
        return (
          <div key={t} className={`run-panel flex items-center gap-3 px-3 py-2.5 text-left ${open ? '' : 'opacity-50'}`}>
            <Sprite name={open ? 'crown' : 'lock'} size={42} px={16} pal={TIER_PAL[t]} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="run-title text-lg leading-tight font-black">{info.name}</span>
                {open && <Stars got={meta.stars?.[t]} />}
              </div>
              <div className="run-sans text-xs text-[var(--ink-dim)]">{open ? `Opponents ${info.band[0]}–${info.band[1]}` : `Win the ${tierInfo(TIERS[TIERS.indexOf(t) - 1]).name} first`}</div>
              {won > 0 && <div className="run-sans text-xs font-black text-[var(--gold-2)]">Won {won}×{best ? ` · best heat ${best}` : ''}</div>}
            </div>
            <button className="run-btn px-4! py-2!" disabled={!open} onClick={() => (sfx('card'), setPrep(t))}>Enter</button>
          </div>
        );
      })}
      {prep && <PrepareSheet tier={prep} won={s.trophies[prep] ?? 0} onClose={() => setPrep(null)} />}
    </div>
  );
}

/** Before a cup: a sponsor's contract (or none) and, for a tier you have won, heat challenges. */
function PrepareSheet({ tier, won, onClose }: { tier: CupTier; won: number; onClose: () => void }) {
  const enter = useCup((s) => s.enter);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const offers = sponsorOffers(tier, seed);
  const [sponsor, setSponsor] = useState<string | null>(null);
  const [heat, setHeat] = useState<HeatId[]>([]);
  const total = heatOf(heat);
  const canHeat = heatOpen(won);
  const toggle = (id: HeatId) => setHeat((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  return (
    <Sheet onClose={onClose}>
      <div className="text-left">
        <div className="run-label text-center">{tierInfo(tier).name} · prepare</div>
        <div className="run-label mt-3">Sponsor</div>
        <div className="run-sans mb-1.5 text-xs text-[var(--ink-dim)]">Sign one contract: +{TUNING.sponsors.signingGold} gold now, Laurels if you fulfil it.</div>
        <div className="space-y-1.5">
          {offers.map((o) => (
            <button key={o.id} aria-pressed={sponsor === o.id} className={`run-panel flex w-full items-center gap-2.5 px-2.5 py-2 text-left active:scale-[.98] ${sponsor === o.id ? 'bg-[var(--gold)]/15 ring-2 ring-[var(--gold)]' : sponsor ? 'opacity-60' : ''}`} onClick={() => (sfx('card'), setSponsor(sponsor === o.id ? null : o.id))}>
              <Sprite name={o.glyph} size={26} px={12} pal={GOLD} />
              <div className="min-w-0 flex-1">
                <div className="run-title text-sm leading-tight font-black">{o.name}</div>
                <div className="run-sans text-xs leading-snug text-[var(--ink-dim)]">{o.text}</div>
              </div>
              <span className="run-sans shrink-0 text-sm font-black text-[var(--gold-2)]">+{sponsorReward(o, tier)} 🌿</span>
            </button>
          ))}
        </div>
        <div className="run-label mt-4">Heat {canHeat ? `· ${total}` : ''}</div>
        {canHeat ? (
          <>
            <div className="run-sans mb-1.5 text-xs text-[var(--ink-dim)]">Optional challenges. Each heat point adds a Laurel if you win the cup (half in the final).</div>
            <div className="grid grid-cols-1 gap-1.5">
              {HEATS.map((h) => (
                <button key={h.id} aria-pressed={heat.includes(h.id)} className={`run-panel flex items-center gap-2.5 px-2.5 py-1.5 text-left ${heat.includes(h.id) ? 'bg-[var(--blood)]/20 ring-2 ring-[var(--blood)]' : 'opacity-60'}`} onClick={() => (sfx('chip'), toggle(h.id))}>
                  <Sprite name={h.glyph} size={22} px={12} pal={heat.includes(h.id) ? BLOOD : SPIRIT} />
                  <div className="min-w-0 flex-1">
                    <div className="run-title text-sm leading-tight font-black">{h.name}</div>
                    <div className="run-sans text-[11px] leading-snug text-[var(--ink-dim)]">{h.text}</div>
                  </div>
                  <span className="run-sans shrink-0 text-xs font-black text-[#ff8a98]">{'🔥'.repeat(h.heat)}</span>
                </button>
              ))}
            </div>
            {total > 0 && <div className="run-sans mt-2 text-center text-xs">Heat {total}: +{heatLaurels(total, 'winner')} Laurels if you win{total >= TUNING.mastery.starHeat ? ', and the third star' : ''}.</div>}
          </>
        ) : (
          <div className="run-sans text-xs text-[var(--ink-dim)]">Win this cup once to unlock heat challenges.</div>
        )}
        <button className="run-btn mt-4 w-full text-lg" onClick={() => (sfx('relic'), onClose(), void enter(tier, { heat, sponsor: sponsor ?? undefined, seed }))}>
          Enter the cup
        </button>
      </div>
    </Sheet>
  );
}
