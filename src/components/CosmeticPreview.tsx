import { defaultPieces } from 'react-chessboard';
import { Sparkles, Volume2 } from 'lucide-react';
import type { Cosmetic } from '../lib/rewards/cosmetics';
import { CELEBRATIONS, HIGHLIGHTS, PIECE_SETS } from '../lib/rewards/looks';
import { BOARD_THEMES } from '../lib/settings';

/** A small visual sample of an unlockable item. */
export function CosmeticPreview({ c, size = 64 }: { c: Cosmetic; size?: number }) {
  const box = { width: size, height: size };
  if (c.kind === 'board' || c.kind === 'hl') {
    const t = BOARD_THEMES[c.kind === 'board' ? c.key : 'walnut'];
    const hl = c.kind === 'hl' ? HIGHLIGHTS[c.key].color : null;
    return (
      <div className="grid shrink-0 grid-cols-4 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/10" style={box}>
        {Array.from({ length: 16 }, (_, i) => {
          const light = (Math.floor(i / 4) + i) % 2 === 0;
          const bg = light ? (t.lightBg ?? t.light) : (t.darkBg ?? t.dark);
          const lit = hl && (i === 5 || i === 10);
          return <div key={i} style={{ background: lit ? `linear-gradient(rgba(${hl},0.55), rgba(${hl},0.55)), ${bg}` : bg }} />;
        })}
      </div>
    );
  }
  if (c.kind === 'pieces') {
    const set = PIECE_SETS[c.key];
    return (
      <div className="flex shrink-0 items-end justify-center rounded-xl bg-[#e6c495] ring-1 ring-black/10" style={box}>
        {(['wN', 'bQ'] as const).map((k) => (
          <div key={k} style={{ width: size * 0.5, height: size * 0.62, filter: set.filter?.[k[0] as 'w' | 'b'] }}>
            {defaultPieces[k]({ fill: set.fill?.[k[0] as 'w' | 'b'] })}
          </div>
        ))}
      </div>
    );
  }
  if (c.kind === 'fx') {
    const fx = CELEBRATIONS[c.key];
    return (
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-stone-800 to-stone-900" style={box}>
        {fx.colors.slice(0, 5).map((col, i) => (
          <span key={i} className="absolute h-2 w-2 rounded-full" style={{ background: col, left: `${15 + i * 17}%`, top: `${20 + ((i * 37) % 55)}%` }} />
        ))}
        <Sparkles size={size * 0.4} className="text-white/90" />
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 dark:from-brand-700/40 dark:to-brand-700/10 dark:text-brand-100" style={box}>
      <Volume2 size={size * 0.45} />
    </div>
  );
}
