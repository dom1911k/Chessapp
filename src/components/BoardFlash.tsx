// Celebrations on the board: a burst for brilliant (!!) and great (!) moves, and a
// small label when you play a tactic such as a fork.
import { useEffect, useState, type CSSProperties } from 'react';
import { TACTIC_LABEL, type Special, type TacticKey } from '../lib/rewards/career';

const SPECIAL: Record<Special, { mark: string; label: string; color: string; glow: string }> = {
  brilliant: { mark: '!!', label: 'Brilliant move!', color: '#0d9488', glow: 'rgba(45,212,191,0.75)' },
  great: { mark: '!', label: 'Great move!', color: '#2563eb', glow: 'rgba(96,165,250,0.7)' },
};

export function BoardFlash({ flash, orientation }: { flash: { id: number; kind: Special | TacticKey; sq: string } | null; orientation: 'white' | 'black' }) {
  const [shown, setShown] = useState(flash);
  useEffect(() => {
    if (!flash) return;
    setShown(flash);
    const t = setTimeout(() => setShown(null), flash.kind === 'brilliant' || flash.kind === 'great' ? 2600 : 1700);
    return () => clearTimeout(t);
  }, [flash]);
  if (!shown) return null;

  const f = shown.sq.charCodeAt(0) - 97;
  const r = Number(shown.sq[1]) - 1;
  const col = orientation === 'white' ? f : 7 - f;
  const row = orientation === 'white' ? 7 - r : r;
  const at: CSSProperties = { left: `${(col + 0.5) * 12.5}%`, top: `${(row + 0.5) * 12.5}%` };
  const special = shown.kind === 'brilliant' || shown.kind === 'great' ? SPECIAL[shown.kind] : null;

  if (!special) {
    return (
      <div key={shown.id} className="pointer-events-none absolute inset-0 z-20">
        <span
          className="animate-flash-chip absolute -translate-x-1/2 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 px-3 py-1 text-sm font-extrabold whitespace-nowrap text-white shadow-lg ring-2 ring-white"
          style={{ ...at, top: `calc(${at.top} - 9%)` }}
        >
          {TACTIC_LABEL[shown.kind as TacticKey].one}!
        </span>
      </div>
    );
  }
  return (
    <div key={shown.id} className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-md">
      <div className="animate-flash-dim absolute inset-0" style={{ background: `radial-gradient(circle at ${at.left} ${at.top}, transparent 8%, rgba(0,0,0,0.28) 60%)` }} />
      <span className="animate-flash-ring absolute h-[12.5%] w-[12.5%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ ...at, boxShadow: `0 0 0 4px ${special.glow}, 0 0 30px 10px ${special.glow}` }} />
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const d = 70 + (i % 3) * 25;
        return (
          <span
            key={i}
            className="animate-flash-spark absolute h-2.5 w-2.5 rounded-full"
            style={{ ...at, background: i % 2 ? '#fde68a' : special.glow, '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, animationDelay: `${(i % 4) * 30}ms` } as CSSProperties}
          />
        );
      })}
      <span
        className="animate-flash-mark absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-display text-xl font-black text-white shadow-xl ring-[3px] ring-white"
        style={{ ...at, background: special.color }}
      >
        {special.mark}
      </span>
      <div className="absolute inset-x-0 top-[42%] flex justify-center">
        <span className="animate-flash-banner rounded-2xl px-5 py-2 font-display text-2xl font-bold text-white shadow-2xl ring-2 ring-white/70" style={{ background: `linear-gradient(135deg, ${special.color}, ${special.glow})` }}>
          {special.label}
        </span>
      </div>
    </div>
  );
}
