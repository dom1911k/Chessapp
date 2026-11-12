// Small visual pieces for the Cups tab: pixel numerals and tarot cards.
import type { CSSProperties, ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Sprite } from '../pixel/sprites';
import { BLOOD, EMBER, GOLD, SPIRIT, type SpritePalette } from '../pixel/pixelize';

export type Rarity = 'common' | 'uncommon' | 'rare';
export const RARITY_COLOR: Record<Rarity, string> = { common: '#cdbf9f', uncommon: '#6fd3ff', rare: '#ff6bd5' };

/** What a tarot card shows. */
export interface CardInfo {
  name: string;
  /** Full description (info sheets, selection). */
  text: string;
  /** A few words for the card face. */
  short?: string;
  /** Roman numeral shown on the card. */
  numeral: string;
  /** Sprite key (see pixel/sprites). */
  glyph: string;
  rarity?: Rarity;
}

/** 12345 → 12.3k, 1234567 → 1.23M. */
export function fmtBig(n: number): string {
  const a = Math.abs(n);
  if (a < 10_000) return String(Math.round(n));
  if (a < 1_000_000) return `${(n / 1000).toFixed(a < 100_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

// 3×5 pixel font for numbers and a few symbols/letters.
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
  '/': ['001', '001', '010', '100', '100'],
  V: ['101', '101', '101', '010', '010'],
  S: ['111', '100', '111', '001', '111'],
  k: ['100', '101', '110', '101', '101'],
  M: ['101', '111', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  ' ': ['000', '000', '000', '000', '000'],
};

/** Chunky pixel numerals (SVG, crisp at any size). `size` = pixel cell in px. */
export function PixelNum({ value, size = 4, color = 'var(--gold-2)', glow = true, className = '', minChars = 0, big = false }: { value: string | number; size?: number; color?: string; glow?: boolean; className?: string; /** Reserve this many digit widths (right-aligned) so counting never resizes. */ minChars?: number; /** Format numbers as 12.3k / 1.23M. */ big?: boolean }) {
  const text = big && typeof value === 'number' ? fmtBig(value) : String(value);
  const chars = text.padStart(minChars, ' ').split('');
  const w = chars.length * 4 - 1;
  return (
    <svg
      width={w * size}
      height={5 * size}
      viewBox={`0 0 ${w} 5`}
      shapeRendering="crispEdges"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 ${size * 1.5}px ${color}) drop-shadow(0 ${size / 2}px 0 rgba(0,0,0,.6))` } : undefined}
      aria-label={text}
    >
      {chars.flatMap((ch, i) =>
        (FONT[ch] ?? FONT[' ']).flatMap((row, y) => row.split('').map((b, x) => (b === '1' ? <rect key={`${i}-${x}-${y}`} x={i * 4 + x} y={y} width={1} height={1} fill={color} /> : null))),
      )}
    </svg>
  );
}

const RARITY_PAL: Record<Rarity, SpritePalette> = { common: GOLD, uncommon: SPIRIT, rare: BLOOD };

/**
 * A tarot card. `kind` 'relic' = a lasting card (boons: gold frame, rarity palette);
 * 'consumable' = single use (charms: ember palette).
 */
export function TarotCard({
  info, kind, onClick, selected, footer, w = 112, className = '', style,
}: { info: CardInfo; kind: 'relic' | 'consumable'; onClick?: () => void; selected?: boolean; footer?: ReactNode; w?: number; className?: string; style?: CSSProperties }) {
  const pal = kind === 'relic' ? RARITY_PAL[info.rarity ?? 'common'] : EMBER;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`tarot ${kind === 'relic' ? 'relic' : ''} ${selected ? 'selected' : ''} ${className}`}
      style={{ width: w, height: Math.round(w * 1.86), ...style }}
    >
      <div className="tarot-inner px-1.5 pt-1.5 pb-2">
        <div className="flex w-full items-center justify-between px-0.5">
          <span className="numeral text-[11px]">{info.numeral}</span>
          <span className="flex items-center gap-1">
            {info.rarity && <span className="pixel-gem" style={{ background: RARITY_COLOR[info.rarity] }} title={info.rarity} />}
          </span>
        </div>
        <div className="mt-1">
          <Sprite name={info.glyph} size={Math.round(w * 0.38)} pal={pal} />
        </div>
        <div className="run-title mt-1 leading-tight font-bold" style={{ fontSize: Math.max(10, Math.round(w * 0.115)) }}>
          {info.name}
        </div>
        <FitText text={info.short ?? info.text} max={Math.max(9, Math.round(w * 0.092))} />
        {footer && <div className="mt-auto pt-0.5">{footer}</div>}
      </div>
    </button>
  );
}

/** Shrinks its text until it fits the card face. */
function FitText({ text, max }: { text: string; max: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(max);
  useLayoutEffect(() => setSize(max), [text, max]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && size > 7) setSize((x) => x - 0.5);
  }, [size, text, max]);
  return (
    <div ref={ref} className="run-sans mt-1 min-h-0 w-full flex-1 overflow-hidden leading-[1.25] text-[var(--ink-dim)]" style={{ fontSize: size }}>
      {text}
    </div>
  );
}
