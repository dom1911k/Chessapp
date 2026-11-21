import { Sparkles, Volume2 } from 'lucide-react';
import { PieceIcon } from './PieceIcon';
import type { Cosmetic } from '../lib/rewards/cosmetics';
import { CELEBRATIONS, HIGHLIGHTS } from '../lib/rewards/looks';
import { BOARD_THEMES, useSettings } from '../lib/settings';
import { PIECE_SETS } from '../lib/rewards/looks';

/** A small visual sample of an unlockable item. */
export function CosmeticPreview({ c, size = 64 }: { c: Cosmetic; size?: number }) {
  const box = { width: size, height: size };
  if (c.kind === 'board' || c.kind === 'hl') {
    const t = BOARD_THEMES[c.kind === 'board' ? c.key : 'green'];
    const hl = c.kind === 'hl' ? HIGHLIGHTS[c.key].color : null;
    return (
      <div className="grid shrink-0 grid-cols-4 overflow-hidden rounded-[6px] ring-1 ring-black/10" style={box}>
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
    // Two pieces on a light and a dark square of the default green board.
    return (
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-[6px] ring-1 ring-black/10" style={box}>
        {(['wN', 'bQ'] as const).map((k, i) => (
          <div key={k} className="flex items-center justify-center" style={{ background: i ? BOARD_THEMES.green.dark : BOARD_THEMES.green.light }}>
            <PieceIcon code={k} setId={c.key} size={size * 0.5} />
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

/** Your current look at a glance: a corner of your board with your pieces and last-move colour. */
export function LookPreview({ size = 56 }: { size?: number }) {
  const s = useSettings();
  const t = BOARD_THEMES[s.boardTheme] ?? BOARD_THEMES.green;
  const hl = (HIGHLIGHTS[s.highlight] ?? HIGHLIGHTS.classic).color;
  // A 3×3 corner: a knight that just moved, a queen and a pawn.
  const piece: Record<number, 'wN' | 'bQ' | 'wP'> = { 1: 'bQ', 5: 'wN', 6: 'wP' };
  return (
    <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-[6px] ring-1 ring-black/10" style={{ width: size, height: size }} aria-hidden data-testid="look-preview">
      {Array.from({ length: 9 }, (_, i) => {
        const light = (Math.floor(i / 3) + i) % 2 === 0;
        const bg = light ? (t.lightBg ?? t.light) : (t.darkBg ?? t.dark);
        const lit = i === 5 || i === 7;
        return (
          <div key={i} className="flex items-center justify-center" style={{ background: lit ? `linear-gradient(rgba(${hl},0.5), rgba(${hl},0.5)), ${bg}` : bg }}>
            {piece[i] && <PieceIcon code={piece[i]} setId={s.pieceStyle} size={size / 3} />}
          </div>
        );
      })}
    </div>
  );
}

/** "Green · Neo-style" for your current board and pieces. */
export function useLookLabel(): string {
  const s = useSettings();
  return `${(BOARD_THEMES[s.boardTheme] ?? BOARD_THEMES.green).label} · ${(PIECE_SETS[s.pieceStyle] ?? PIECE_SETS.kaneo).label}`;
}
