// Small visual pieces for Run mode: pixel numerals, tarot cards, glyphs, the HUD.
import type { ReactNode } from 'react';
import { CONSUMABLES, RELICS, type CardInfo } from '../content';
import type { ConsumableId, RelicId } from '../types';

// 3×5 pixel font for numbers and a few symbols.
const FONT: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '×': ['000', '101', '010', '101', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  ',': ['000', '000', '000', '010', '100'],
  ' ': ['000', '000', '000', '000', '000'],
};

/** Chunky pixel numerals (SVG, crisp at any size). `size` = pixel cell in px. */
export function PixelNum({ value, size = 4, color = 'var(--gold-2)', glow = true, className = '' }: { value: string | number; size?: number; color?: string; glow?: boolean; className?: string }) {
  const chars = String(value).split('');
  const w = chars.length * 4 - 1;
  return (
    <svg
      width={w * size}
      height={5 * size}
      viewBox={`0 0 ${w} 5`}
      shapeRendering="crispEdges"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 ${size * 1.5}px ${color}) drop-shadow(0 ${size / 2}px 0 rgba(0,0,0,.6))` } : undefined}
      aria-label={String(value)}
    >
      {chars.flatMap((ch, i) =>
        (FONT[ch] ?? FONT[' ']).flatMap((row, y) => row.split('').map((b, x) => (b === '1' ? <rect key={`${i}-${x}-${y}`} x={i * 4 + x} y={y} width={1} height={1} fill={color} /> : null))),
      )}
    </svg>
  );
}

/** Line-art glyphs for cards (stroke = currentColor). */
export function Glyph({ name, size = 40 }: { name: string; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const g: Record<string, ReactNode> = {
    moon: <><path {...p} d="M27 8a13 13 0 1 0 6 20A11 11 0 0 1 27 8z" /><circle {...p} cx="30" cy="12" r="1" /><circle {...p} cx="34" cy="18" r="0.6" /></>,
    fang: <><path {...p} d="M8 12c8 4 24 4 32 0" /><path {...p} d="M14 14l3 14 3-13M28 15l3 13 3-14" /><circle {...p} cx="24" cy="34" r="3" /></>,
    fork: <><path {...p} d="M24 40V22M14 8v8a10 10 0 0 0 20 0V8M24 8v12" /><circle {...p} cx="14" cy="7" r="1.5" /><circle {...p} cx="34" cy="7" r="1.5" /></>,
    tower: <><path {...p} d="M14 40h20M16 40V16h16v24M14 16V9h4v3h4V9h4v3h4V9h4v7" /><path {...p} d="M22 40v-7a2 2 0 0 1 4 0v7" /></>,
    pin: <><path {...p} d="M8 24h32" /><circle {...p} cx="14" cy="24" r="4" /><circle {...p} cx="25" cy="24" r="3" /><circle {...p} cx="35" cy="24" r="4" /><path {...p} d="M24 8v8M24 32v8" /></>,
    star: <><path {...p} d="M24 7l4.5 11 11.5.8-8.8 7.4 2.8 11.3L24 31.4l-10 6.1 2.8-11.3L8 18.8 19.5 18z" /></>,
    coin: <><ellipse {...p} cx="24" cy="18" rx="12" ry="5" /><path {...p} d="M12 18v12c0 2.8 5.4 5 12 5s12-2.2 12-5V18" /><path {...p} d="M12 24c0 2.8 5.4 5 12 5s12-2.2 12-5" /></>,
    sprout: <><path {...p} d="M24 40V22" /><path {...p} d="M24 24c0-8-6-12-14-12 0 8 6 12 14 12zM24 20c0-7 5-11 13-11 0 7-5 11-13 11z" /><path {...p} d="M16 40h16" /></>,
    eye: <><path {...p} d="M5 24s7-11 19-11 19 11 19 11-7 11-19 11S5 24 5 24z" /><circle {...p} cx="24" cy="24" r="6" /><circle cx="24" cy="24" r="2" fill="currentColor" /><path {...p} d="M24 5v4M24 39v4M9 9l3 3M39 9l-3 3" /></>,
    rewind: <><path {...p} d="M22 14L10 24l12 10zM38 14L26 24l12 10z" /><path {...p} d="M8 40a20 20 0 0 1 32 0" /></>,
    cards: <><rect {...p} x="8" y="12" width="13" height="20" rx="2" transform="rotate(-12 14 22)" /><rect {...p} x="18" y="10" width="13" height="20" rx="2" /><rect {...p} x="27" y="12" width="13" height="20" rx="2" transform="rotate(12 34 22)" /><path {...p} d="M24 17l1.5 3 3 .4-2.2 2 .6 3-2.9-1.5-2.9 1.5.6-3-2.2-2 3-.4z" /></>,
    lens: <><circle {...p} cx="21" cy="21" r="11" /><path {...p} d="M29 29l11 11" /><path {...p} d="M16 21h10M21 16v10" /></>,
    scale: <><path {...p} d="M24 8v32M14 40h20M10 14h28" /><path {...p} d="M10 14l-5 11h10zM38 14l-5 11h10z" /><path {...p} d="M5 25a5 3 0 0 0 10 0M33 25a5 3 0 0 0 10 0" /></>,
    shield: <><path {...p} d="M24 6l15 5v11c0 9-6 16-15 20-9-4-15-11-15-20V11z" /><path {...p} d="M17 23l5 5 9-10" /></>,
    skull: <><path {...p} d="M12 22a12 12 0 0 1 24 0v6l-4 3v5H16v-5l-4-3z" /><circle {...p} cx="19" cy="24" r="3" /><circle {...p} cx="29" cy="24" r="3" /><path {...p} d="M21 36v-3M24 36v-3M27 36v-3" /></>,
    flame: <><path {...p} d="M24 42c-8 0-12-6-12-12 0-8 8-12 8-20 4 3 6 7 6 11 2-2 3-4 3-7 5 5 7 10 7 16 0 6-4 12-12 12z" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {g[name] ?? g.star}
    </svg>
  );
}

export function TarotCard({
  info, kind, onClick, selected, footer, w = 112, className = '', style,
}: { info: CardInfo; kind: 'relic' | 'consumable'; onClick?: () => void; selected?: boolean; footer?: ReactNode; w?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`tarot ${kind === 'relic' ? 'relic' : ''} ${selected ? 'selected' : ''} ${className}`}
      style={{ width: w, height: w * 1.72, ...style }}
    >
      <div className="tarot-inner px-1.5 pt-1.5 pb-2">
        <div className="numeral text-[11px]">{info.numeral}</div>
        <div className="glow-gold mt-1 text-[var(--gold-2)]">
          <Glyph name={info.glyph} size={w * 0.36} />
        </div>
        <div className="run-title mt-1 text-[13px] leading-tight font-bold">{info.name}</div>
        <div className="run-sans mt-1 text-[10px] leading-[1.3] text-[var(--ink-dim)]">{info.text}</div>
        <div className="mt-auto">{footer}</div>
      </div>
    </button>
  );
}

export const relicCard = (id: RelicId) => RELICS[id];
export const consumableCard = (id: ConsumableId) => CONSUMABLES[id];

/** Composure as candle flames. */
export function Composure({ value, max, hit }: { value: number; max: number; hit?: number }) {
  return (
    <div key={hit} className={`flex items-center gap-0.5 ${hit ? 'run-hit' : ''}`} aria-label={`Composure ${value}`}>
      {Array.from({ length: Math.max(max, value) }, (_, i) => (
        <span key={i} className={i < value ? 'run-flicker text-[var(--gold-2)]' : 'text-white/15'} style={{ animationDelay: `${i * 0.37}s` }}>
          <Glyph name="flame" size={18} />
        </span>
      ))}
    </div>
  );
}
